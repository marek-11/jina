import { NextResponse } from "next/server";

// --- HELPER: KEY ROTATION ---
function getRotatingKey(envVarName) {
  const envVar = process.env[envVarName];
  if (!envVar) return null;
  // Split by comma, trim whitespace, and filter out empty strings
  const keys = envVar.split(',').map(k => k.trim()).filter(k => k);
  if (keys.length === 0) return null;
  // Return a random key from the list
  return keys[Math.floor(Math.random() * keys.length)];
}

// --- HELPER: URL CLEANING LOGIC ---
function cleanUrl(raw) {
  if (!raw) return "";
  let trimmed = raw.replace(/^URL:\s*/i, '').trim();
  
  if (/^https?:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/\s+/g, '');
  }
  
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  return trimmed;
}

export async function POST(request) {
  const body = await request.json();
  let { url } = body;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // 1. Get Rotating Keys
  const jinaKey = getRotatingKey('JINA_API_KEY');
  const groqKey = getRotatingKey('GROQ_API_KEY');

  if (!jinaKey) {
    return NextResponse.json({ error: "Server configuration error: Missing JINA_API_KEY" }, { status: 500 });
  }
  if (!groqKey) {
    return NextResponse.json({ error: "Server configuration error: Missing GROQ_API_KEY" }, { status: 500 });
  }

  // 2. Clean URL
  url = cleanUrl(url);

  try {
    // 3. Fetch content from Jina
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jinaKey}`, // Uses the rotated key
        "X-With-Links-Summary": "true" 
      }
    });

    if (!jinaRes.ok) {
        throw new Error(`Jina Reader failed: ${jinaRes.statusText}`);
    }

    const markdown = await jinaRes.text();
    const truncatedContent = markdown.length > 30000 
      ? markdown.substring(0, 30000) + "\n...(content truncated)" 
      : markdown;

    // 4. Call Groq for Summarization
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`, // Uses the rotated key
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
      console.error("Groq API Error:", groqData);
      return NextResponse.json({
        summary: `Error generating AI summary: ${groqData.error?.message || "Unknown error"}`,
        content: markdown
      });
    }

    const aiSummary = groqData.choices?.[0]?.message?.content 
        || `⚠️ No summary generated. Debug info: ${JSON.stringify(groqData.choices?.[0] || groqData)}`;

    // 5. Format Output
    const finalOutput = `**URL:** ${url}\n\n${aiSummary}`;

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
