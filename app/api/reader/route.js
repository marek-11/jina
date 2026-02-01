export async function POST(request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // 1. Fetch raw content using Jina Reader
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
        "X-With-Links-Summary": "true" // Optional: Tells Jina to gather links/metadata
      }
    });

    if (!jinaRes.ok) {
        throw new Error(`Jina Reader failed: ${jinaRes.statusText}`);
    }

    const markdown = await jinaRes.text();

    // 2. Prepare content for Groq (truncate to avoid token limits if necessary)
    // Most models handle ~8k tokens. 30,000 chars is a safe rough limit.
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
        model: "openai/gpt-oss-20b", // The specific model you requested
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Please provide a concise and insightful summary of the following web page content."
          },
          {
            role: "user",
            content: truncatedContent
          }
        ],
        temperature: 0.5, // Lower temperature for more factual summaries
        max_tokens: 1024
      })
    });

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      console.error("Groq API Error:", groqData);
      // Fallback: If Groq fails, return a generic message
      return Response.json({
        summary: `Error generating AI summary: ${groqData.error?.message || "Unknown error"}`,
        content: markdown
      });
    }

    const aiSummary = groqData.choices?.[0]?.message?.content || "No summary generated.";

    return Response.json({
      summary: aiSummary,
      content: markdown
    });

  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Failed to process URL", details: err.message },
      { status: 500 }
    );
  }
}
