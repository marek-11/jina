import { NextResponse } from "next/server";

// --- HELPER: GET KEYS AS LIST ---
// Returns a shuffled array of keys so we don't always start with the first one
function getKeyList(envVarName) {
  const envVar = process.env[envVarName];
  if (!envVar) return [];
  
  const keys = envVar.split(',').map(k => k.trim()).filter(k => k);
  
  // Shuffle keys (Fisher-Yates) to distribute load randomly
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  
  return keys;
}

// --- HELPER: URL CLEANING ---
function cleanUrl(raw) {
  if (!raw) return "";
  let trimmed = raw.replace(/^URL:\s*/i, '').trim();
  if (/^https?:\/\//i.test(trimmed)) trimmed = trimmed.replace(/\s+/g, '');
  if (!/^https?:\/\//i.test(trimmed)) trimmed = 'https://' + trimmed;
  return trimmed;
}

export async function POST(request) {
  const body = await request.json();
  let { url } = body;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // 1. Prepare Key Lists
  const jinaKeys = getKeyList('JINA_API_KEY');
  const groqKeys = getKeyList('GROQ_API_KEY');

  if (jinaKeys.length === 0) return NextResponse.json({ error: "Missing JINA_API_KEY" }, { status: 500 });
  if (groqKeys.length === 0) return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 });

  // 2. Clean URL
  url = cleanUrl(url);

  try {
    // --- STEP 3: FETCH CONTENT (JINA) WITH RETRY ---
    let markdown = null;
    let jinaError = null;

    for (const key of jinaKeys) {
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${key}`,
            "X-With-Links-Summary": "true",
            // Mimic a real browser to bypass simple blocks
            "x-user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        if (!jinaRes.ok) {
          // If 401 (Unauthorized) or 402/429 (Payment/Rate Limit), throw to trigger retry
          throw new Error(`Status ${jinaRes.status}: ${jinaRes.statusText}`);
        }

        markdown = await jinaRes.text();
        // If successful, break the loop
        break; 
      } catch (err) {
        console.warn(`Jina key ending in ...${key.slice(-4)} failed. Retrying...`, err.message);
        jinaError = err;
        // Continue to next key
      }
    }

    if (!markdown) {
      throw new Error(`All Jina keys failed. Last error: ${jinaError?.message}`);
    }

    // Truncate if necessary
    const truncatedContent = markdown.length > 30000 
      ? markdown.substring(0, 30000) + "\n...(content truncated)" 
      : markdown;

    // --- STEP 4: SUMMARIZE (GROQ) WITH RETRY ---
    let aiSummary = null;
    let groqError = null;

    for (const key of groqKeys) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile", 
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant. Summarize the provided text in a single, brief, and concise paragraph. Base your summary STRICTLY on the provided content below. Do not add outside knowledge. ALWAYS return the summary in English."
              },
              {
                role: "user",
                content: truncatedContent
              }
            ],
            temperature: 0.5, 
            max_tokens: 500
          })
        });

        const groqData = await groqRes.json();

        if (!groqRes.ok) {
          throw new Error(`Groq API Error: ${groqData.error?.message || groqRes.statusText}`);
        }

        aiSummary = groqData.choices?.[0]?.message?.content;
        if (aiSummary) break; // Success

      } catch (err) {
        console.warn(`Groq key ending in ...${key.slice(-4)} failed. Retrying...`, err.message);
        groqError = err;
      }
    }

    if (!aiSummary) {
        // Fallback if all Groq keys fail, but we still return the Jina content
        aiSummary = `⚠️ Error generating AI summary: All API keys failed. (Last error: ${groqError?.message})`;
    }

    // 5. Format Output
    // We wrap the URL in markdown link syntax [url](url) so ReactMarkdown renders it as an anchor tag
    const finalOutput = `**URL:** [${url}](${url})\n\n${aiSummary}`;

    return NextResponse.json({
      summary: finalOutput,
      content: markdown
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to process URL", details: err.message },
      { status: 500 }
    );
  }
}
