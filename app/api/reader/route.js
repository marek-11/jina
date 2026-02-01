import { NextResponse } from "next/server";

// --- HELPER: URL CLEANING LOGIC (Server-Side) ---
function cleanUrl(raw) {
  if (!raw) return "";
  
  // 1. Remove "URL:" prefix commonly found in copy-pastes
  let trimmed = raw.replace(/^URL:\s*/i, '').trim();

  // 2. Aggressive fix: If it starts with http/https, strip ALL spaces
  // This fixes "https:// site .com /foo" -> "https://site.com/foo"
  if (/^https?:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/\s+/g, '');
  }

  // 3. Ensure protocol
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

  // --- APPLY SMART FIX ON SERVER SIDE ---
  url = cleanUrl(url);

  try {
    // 1. Fetch raw content using Jina Reader
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
        "X-With-Links-Summary": "true" 
      }
    });

    if (!jinaRes.ok) {
        throw new Error(`Jina Reader failed: ${jinaRes.statusText} (URL: ${url})`);
    }

    const markdown = await jinaRes.text();

    // 2. Prepare content for Groq (truncate to ~30k chars to be safe)
    const truncatedContent = markdown.length > 30000 
      ? markdown.substring(0, 30000) + "\n...(content truncated)" 
      : markdown;

    // 3. Call Groq for Summarization
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b", 
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Summarize the provided content briefly and concisely. You must ALWAYS return the summary in English, regardless of the input language. Use Markdown formatting (such as bullet points) to structure the summary."
          },
          {
            role: "user",
            content: truncatedContent
          }
        ],
        temperature: 0.5, 
        max_tokens: 1024
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

    const aiSummary = groqData.choices?.[0]?.message?.content || "No summary generated.";

    return NextResponse.json({
      summary: aiSummary,
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
