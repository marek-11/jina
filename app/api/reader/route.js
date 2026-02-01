import { NextResponse } from "next/server";

// --- HELPER: URL CLEANING LOGIC (Server-Side Safety Net) ---
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

  // Apply server-side cleaning
  url = cleanUrl(url);

  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
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
            // UPDATED PROMPT: Explicitly asks for the style in your example
            content: "You are a helpful assistant. Summarize the content into a structured 'Quick Overview'. ALWAYS return the response in English. Use Markdown formatting. Use **Bold Text** for section headers and categories (e.g., **Title & Theme**, **Broadcast Schedule**). Use bullet points for clear readability."
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
