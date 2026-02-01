"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setCopied(false);

    const res = await fetch("/api/reader", {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: { "Content-Type": "application/json" }
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  function copySummary() {
    navigator.clipboard.writeText(result.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Jina Reader – URL Summary</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <input
          type="url"
          placeholder="Enter URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          style={{
            padding: 10,
            width: "100%",
            marginBottom: 10,
            border: "1px solid #ccc",
            borderRadius: 4
          }}
        />
        <button
          type="submit"
          style={{
            padding: 12,
            width: "100%",
            cursor: "pointer",
            background: "#222",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 16
          }}
        >
          {loading ? "Processing..." : "Read & Summarize"}
        </button>
      </form>

      {result && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Summary (English)</h2>

            <button
              onClick={copySummary}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                padding: "6px 10px"
              }}
              title="Copy summary"
            >
              📋
            </button>
          </div>

          {copied && (
            <div style={{ color: "green", marginBottom: 10 }}>Copied!</div>
          )}

          <p
            style={{
              background: "#eef2ff",
              padding: 16,
              borderRadius: 8,
              lineHeight: 1.6,
              border: "1px solid #d0d7ff"
            }}
          >
            {result.summary}
          </p>

          <h2 style={{ marginTop: 30 }}>Extracted Content</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f3f3f3",
              padding: 20,
              borderRadius: 8,
              lineHeight: 1.5,
              border: "1px solid #e2e2e2"
            }}
          >
            {result.content}
          </pre>
        </div>
      )}
    </main>
  );
}
