export async function POST(request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // Fast mode — single request only
    const res = await fetch(`https://r.jina.ai/${url}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.JINA_API_KEY}`
      }
    });

    const markdown = await res.text();

    // Extract Jina's built-in summary
    // Summary appears at the top in blockquote format
    const lines = markdown.split("\n");
    const summaryLines = lines.filter(line => line.startsWith(">"));
    const summary = summaryLines.join(" ").replace(/^>+/g, "").trim();

    return Response.json({
      summary: summary || "No summary found.",
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
