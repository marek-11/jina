export async function POST(request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    //
    // 1️⃣ Extract text from URL using Jina Reader
    //
    const readerRes = await fetch("https://r.jina.ai/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.JINA_API_KEY}`
      },
      body: JSON.stringify({
        url,
        format: "text",
        fetch: { timeout: 15000 }
      })
    });

    const extractedText = await readerRes.text();

    //
    // 2️⃣ Summarize the extracted text using Jina LLM
    //
    const summaryRes = await fetch("https://api.jina.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.JINA_API_KEY}`
      },
      body: JSON.stringify({
        model: "jina-llm-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a professional summarizer. Produce a clean, brief, easy-to-read paragraph summary."
          },
          {
            role: "user",
            content: extractedText.slice(0, 12000) // protect token limit
          }
        ],
        max_tokens: 250,
        temperature: 0.3
      })
    });

    const summaryJson = await summaryRes.json();
    const summary =
      summaryJson?.choices?.[0]?.message?.content ||
      "No summary produced.";

    //
    // 3️⃣ Return both extracted text + summary
    //
    return Response.json({
      summary,
      content: extractedText
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to process URL", details: err.message },
      { status: 500 }
    );
  }
}
