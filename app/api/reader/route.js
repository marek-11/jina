export async function POST(request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const jinaRes = await fetch("https://r.jina.ai/", {
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

    const data = await jinaRes.json();

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch from Jina Reader", details: err.message },
      { status: 500 }
    );
  }
}