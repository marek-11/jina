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
  
  // UPDATED: Use API_KEY instead of GROQ_API_KEY
  const apiKeys = getKeyList('API_KEY');

  if (apiKeys.length === 0) return NextResponse.json({ error: "Missing API_KEY" }, { status: 500 });

  // 2. Clean URL
  url = cleanUrl(url);

  try {
    // --- STEP 3: FETCH CONTENT (JINA, EXA, or SCRAPINGBEE) ---
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
                        "x-api-key": key,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        urls: [url],
                        text: true
                    })
                });

                if (!exaRes.ok) {
                    throw new Error(`Exa Status ${exaRes.status}: ${exaRes.statusText}`);
                }

                const data = await exaRes.json();
                if (data.results && data.results.length > 0) {
                    markdown = data.results[0].text;
                    break; 
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

    } else if (provider === 'scrapingbee') {
        // --- SCRAPINGBEE LOGIC ---
        const sbKeys = getKeyList('SCRAPINGBEE_API_KEY');
        if (sbKeys.length === 0) return NextResponse.json({ error: "Missing SCRAPINGBEE_API_KEY" }, { status: 500 });

        for (const key of sbKeys) {
            try {
                // ScrapingBee params
                const sbParams = new URLSearchParams({
                    api_key: key,
                    url: url,
                    return_page_text: 'true', // Extracts text content
                    block_ads: 'true'         // Saves bandwidth/credits
                    // render_js is True by default on ScrapingBee, which handles dynamic sites
                });

                const sbRes = await fetch(`https://app.scrapingbee.com/api/v1/?${sbParams.toString()}`, {
                    method: "GET"
                });

                if (!sbRes.ok) {
                    // ScrapingBee often returns error details in the body
                    const errText = await sbRes.text(); 
                    throw new Error(`ScrapingBee Status ${sbRes.status}: ${errText}`);
                }

                // With return_page_text=true, the body is the plain text content
                markdown = await sbRes.text();
                break;

            } catch (err) {
                console.warn(`ScrapingBee key ending in ...${key.slice(-4)} failed. Retrying...`, err.message);
                fetchError = err;
            }
        }

        if (!markdown) {
            throw new Error(`All ScrapingBee keys failed. Last error: ${fetchError?.message}`);
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

    // --- STEP 4: SUMMARIZE WITH RETRY ---
    let aiSummary = null;
    let summaryError = null;
    
    // UPDATED: Use the env var or fallback to the previous default
    const summaryBaseUrl = process.env.SUMMARY_BASE_URL || "https://api.openai.com/v1/chat/completions";

    // UPDATED: Iterate over apiKeys
    for (const key of apiKeys) {
      try {
        const summaryRes = await fetch(summaryBaseUrl, {
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

        const summaryData = await summaryRes.json();

        if (!summaryRes.ok) {
          throw new Error(`Summary API Error: ${summaryData.error?.message || summaryRes.statusText}`);
        }

        aiSummary = summaryData.choices?.[0]?.message?.content;
        if (aiSummary) break; // Success

      } catch (err) {
        console.warn(`Summary key ending in ...${key.slice(-4)} failed. Retrying...`, err.message);
        summaryError = err;
      }
    }

    if (!aiSummary) {
        aiSummary = `⚠️ Error generating AI summary: All API keys failed. (Last error: ${summaryError?.message})`;
    }

    // 5. Format Output
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
