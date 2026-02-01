"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  // --- HELPER: PURE CLEANING LOGIC ---
  // We extract this so it can be used by both onBlur and handleSubmit
  function getCleanedUrl(raw) {
    if (!raw) return "";

    const rawLines = raw.split('\n');
    const validUrlLines = [];

    rawLines.forEach(line => {
      let trimmed = line.trim();
      if (!trimmed) return;

      trimmed = trimmed.replace(/^URL:\s*/i, '');

      const firstChar = trimmed.charAt(0);
      
      const isFragment = ['/', '?', '&', '=', '#', '_', '%'].includes(firstChar) || 
                         trimmed.toLowerCase().startsWith('utm') ||
                         trimmed.toLowerCase().startsWith('gad') ||
                         trimmed.toLowerCase().startsWith('gclid') ||
                         trimmed.toLowerCase().startsWith('wbraid') ||
                         trimmed.includes('=');

      const hasSpaces = /\s/.test(trimmed);
      const hasDot = trimmed.includes('.');

      if (isFragment && validUrlLines.length > 0) {
        validUrlLines[validUrlLines.length - 1] += trimmed;
      } else if (!hasSpaces && hasDot) {
        validUrlLines.push(trimmed);
      }
    });

    const polishedUrls = validUrlLines.map(u => {
      let clean = u.replace(/[#•*]+$/, '');
      if (!/^https?:\/\//i.test(clean)) {
        clean = 'https://' + clean;
      }
      return clean;
    });

    return polishedUrls.join('\n');
  }

  // --- HANDLER: VISUAL FIX ON BLUR ---
  function handleBlur() {
    const cleaned = getCleanedUrl(url);
    if (cleaned && cleaned !== url) {
      setUrl(cleaned);
      setIsFixed(true);
      setTimeout(() => setIsFixed(false), 500);
    }
  }

  // --- HANDLER: SUBMIT ---
  async function handleSubmit(e) {
    e.preventDefault();
    
    // 1. Force clean immediately (in case user didn't blur/click away)
    const cleanedUrl = getCleanedUrl(url);
    
    // 2. Update UI if it changed
    if (cleanedUrl !== url) {
        setUrl(cleanedUrl);
        setIsFixed(true);
        setTimeout(() => setIsFixed(false), 500);
    }

    setLoading(true);
    setResult(null);
    setCopied(false);

    // 3. Use the CLEANED url for the API request
    // We split by newline to get the first valid URL if there are multiple
    const targetUrl = cleanedUrl.split('\n')[0].trim();

    if (!targetUrl) {
        setLoading(false);
        alert("Please enter a valid URL");
        return;
    }

    try {
        const res = await fetch("/api/reader", {
            method: "POST",
            body: JSON.stringify({ url: targetUrl }),
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json();
        setResult(data);
    } catch (err) {
        console.error(err);
        alert("An error occurred while fetching the URL.");
    } finally {
        setLoading(false);
    }
  }

  function copySummary() {
    if (!result?.summary) return;
    navigator.clipboard.writeText(result.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Jina Reader – URL Summary</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <textarea
          placeholder="Paste URL here..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleBlur} // Visual fix when clicking away
          required
          rows={4}
          style={{
            padding: 10,
            width: "100%",
            marginBottom: 10,
            border: "1px solid #ccc",
            borderRadius: 4,
            resize: "vertical",
            fontFamily: "monospace",
            transition: "background-color 0.3s ease",
            backgroundColor: isFixed ? "#e6ffe6" : "white"
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
              border: "1px solid #e2e2e2",
              overflowX: "auto"
            }}
          >
            {result.content}
          </pre>
        </div>
      )}
    </main>
  );
}
