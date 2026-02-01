"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/reader", {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: { "Content-Type": "application/json" }
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Jina Reader Webapp</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <input
          type="url"
          placeholder="Enter URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          style={{ padding: 10, width: "100%", marginBottom: 10 }}
        />
        <button
          type="submit"
          style={{ padding: 10, width: "100%", cursor: "pointer" }}
        >
          {loading ? "Loading..." : "Read with Jina"}
        </button>
      </form>

      {result && (
        <div>
          <h2>Extracted Content</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f3f3f3",
              padding: 20,
              borderRadius: 8
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}