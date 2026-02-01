import { NextResponse } from "next/server";

// --- HELPER: URL CLEANING LOGIC ---
function cleanUrl(raw) {
  if (!raw) return "";
  let trimmed = raw.replace(/^URL:\s*/i, '').trim();
  
  // Aggressive space removal for http/https lines
  if (/^https?:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/\s+/g, '');
  }
  
  // Ensure protocol
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

  // 1. Get the "Corrected and Exact" URL
  url = cleanUrl(url);

  try {
    // 2. Fetch content from Jina
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

    // 3. Fetch Summary from Groq (Brief Paragraph)
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
            content: "You are a helpful assistant. Summarize the provided content in a single, brief, and concise paragraph. Do not use bullet points, lists, or section headers. Focus on the core message and key details. ALWAYS return the summary in English."
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

    const aiSummary = groqData.choices?.[0]?.message?.content || "No summary generated.";

    // 4. Prepend the URL to the final output
    // This ensures it is always at the top, formatted nicely
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
