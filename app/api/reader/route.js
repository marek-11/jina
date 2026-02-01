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

  // 1. Prepare Configuration
  const provider = (process.env.PROVIDER || 'jina').toLowerCase();
  const groqKeys = getKeyList('GROQ_API_KEY');

  if (groqKeys.length === 0) return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 });

  // 2. Clean URL
  url = cleanUrl(url);

  try {
    // --- STEP 3: FETCH CONTENT (JINA or EXA) ---
    let markdown = null;
    let fetchError = null;

    if (provider === 'exa') {
        // --- EXA LOGIC ---
        const exaKeys = getKeyList('EXA_API_KEY');
        if (exaKeys.length === 0) return NextResponse.json({ error: "Missing EXA_API_KEY" }, { status: 500 });

        for (const key of exaKeys) {
            try {
                const exaRes = await fetch("https://api.exa.ai/contents", {
                    method: "POST",
                    headers: {
                        "x-api-key": key, // Exa uses x-api-key, not Bearer
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        urls: [url],
                        text: true // Request full text content
                    })
                });

                if (!exaRes.ok) {
                    throw new Error(`Exa Status ${exaRes.status}: ${exaRes.statusText}`);
                }

                const data = await exaRes.json();
                // Exa returns { results: [ { url, title, text } ] }
                if (data.results && data.results.length > 0) {
                    markdown = data.results[0].text;
                    break; // Success
                } else {
                    throw new Error("Exa returned no results.");
                }

            } catch (err) {
                console.warn(`Exa key ending in ...${key.slice(-4)} failed. Retrying...`, err.message);
                fetchError = err;
            }
        }

        if (!markdown) {
             throw new Error(`All Exa keys failed. Last error: ${fetchError?.message}`);
        }

    } else {
        // --- JINA LOGIC (Default) ---
        const jinaKeys = getKeyList('JINA_API_KEY');
        if (jinaKeys.length === 0) return NextResponse.json({ error: "Missing JINA_API_KEY" }, { status: 500 });

        for (const key of jinaKeys) {
            try {
                const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${key}`,
                        "X-With-Links-Summary": "true",
                        "x-user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                });

                if (!jinaRes.ok) {
                    throw new Error(`Status ${jinaRes.status}: ${jinaRes.statusText}`);
                }

                markdown = await jinaRes.text();
                break; 
            } catch (err) {
                console.warn(`Jina key ending in ...${key.slice(-4)} failed. Retrying...`, err.message);
                fetchError = err;
            }
        }

        if (!markdown) {
            throw new Error(`All Jina keys failed. Last error: ${fetchError?.message}`);
        }
    }

    // Truncate if necessary (Shared Logic)
    const truncatedContent = markdown.length > 30000 
      ? markdown.substring(0, 30000) + "\n...(content truncated)" 
      : markdown;

    // --- STEP 4: SUMMARIZE (GROQ) WITH RETRY ---
    let aiSummary = null;
    let groqError = null;

    for (const key of groqKeys) {
      try {
        const groqRes = await fetch("https://marqos.zeabur.app/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-5-nano", 
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
        aiSummary = `⚠️ Error generating AI summary: All API keys failed. (Last error: ${groqError?.message})`;
    }

    // 5. Format Output
    // Removed the "Provider" line as requested
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
