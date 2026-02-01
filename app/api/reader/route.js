{
type: "file_change",
fileName: "jina-main (1)/jina-main/app/api/reader/route.js",
oldContent: `  // 1. Prepare Key Lists
  const jinaKeys = getKeyList('JINA_API_KEY');
  const groqKeys = getKeyList('GROQ_API_KEY');

  if (jinaKeys.length === 0) return NextResponse.json({ error: "Missing JINA_API_KEY" }, { status: 500 });
  if (groqKeys.length === 0) return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 });

  // 2. Clean URL
  url = cleanUrl(url);

  try {
    // --- STEP 3: FETCH CONTENT (JINA) WITH RETRY ---
    let markdown = null;
    let jinaError = null;

    for (const key of jinaKeys) {
      try {
        const jinaRes = await fetch(\`https://r.jina.ai/\${url}\`, {
          method: "GET",
          headers: {
            "Authorization": \`Bearer \${key}\`,
            "X-With-Links-Summary": "true",
            // Mimic a real browser to bypass simple blocks
            "x-user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        if (!jinaRes.ok) {
          // If 401 (Unauthorized) or 402/429 (Payment/Rate Limit), throw to trigger retry
          throw new Error(\`Status \${jinaRes.status}: \${jinaRes.statusText}\`);
        }

        markdown = await jinaRes.text();
        // If successful, break the loop
        break; 
      } catch (err) {
        console.warn(\`Jina key ending in ...\${key.slice(-4)} failed. Retrying...\`, err.message);
        jinaError = err;
        // Continue to next key
      }
    }

    if (!markdown) {
      throw new Error(\`All Jina keys failed. Last error: \${jinaError?.message}\`);
    }

    // Truncate if necessary`,
newContent: `  // 1. Prepare Key Lists
  const jinaKeys = getKeyList('JINA_API_KEY');
  const exaKeys = getKeyList('EXA_API_KEY');
  const groqKeys = getKeyList('GROQ_API_KEY');
  
  const provider = (process.env.PROVIDER || 'jina').toLowerCase();

  if (provider === 'jina' && jinaKeys.length === 0) return NextResponse.json({ error: "Missing JINA_API_KEY" }, { status: 500 });
  if (provider === 'exa' && exaKeys.length === 0) return NextResponse.json({ error: "Missing EXA_API_KEY" }, { status: 500 });
  if (groqKeys.length === 0) return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 });

  // 2. Clean URL
  url = cleanUrl(url);

  try {
    // --- STEP 3: FETCH CONTENT (JINA or EXA) ---
    let markdown = null;
    let fetchError = null;

    if (provider === 'exa') {
      // --- EXA.AI LOGIC ---
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
              text: true // Request full text in Markdown format
            })
          });

          if (!exaRes.ok) {
            throw new Error(\`Exa Status \${exaRes.status}: \${exaRes.statusText}\`);
          }

          const data = await exaRes.json();
          // Exa returns { results: [{ text: "..." }] }
          if (data.results && data.results.length > 0 && data.results[0].text) {
             markdown = data.results[0].text;
             break;
          } else {
             throw new Error("Exa returned no content for this URL.");
          }
        } catch (err) {
          console.warn(\`Exa key ending in ...\${key.slice(-4)} failed. Retrying...\`, err.message);
          fetchError = err;
        }
      }
    } else {
      // --- JINA.AI LOGIC (Default) ---
      for (const key of jinaKeys) {
        try {
          const jinaRes = await fetch(\`https://r.jina.ai/\${url}\`, {
            method: "GET",
            headers: {
              "Authorization": \`Bearer \${key}\`,
              "X-With-Links-Summary": "true",
              "x-user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });

          if (!jinaRes.ok) {
            throw new Error(\`Status \${jinaRes.status}: \${jinaRes.statusText}\`);
          }

          markdown = await jinaRes.text();
          break; 
        } catch (err) {
          console.warn(\`Jina key ending in ...\${key.slice(-4)} failed. Retrying...\`, err.message);
          fetchError = err;
        }
      }
    }

    if (!markdown) {
      throw new Error(\`All keys for provider '\${provider}' failed. Last error: \${fetchError?.message}\`);
    }

    // Truncate if necessary`
}
