"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFixed, setIsFixed] = useState(false); // State to trigger the visual flash effect

  // --- SMART EXTRACT LOGIC ADAPTED FOR REACT ---
  function extractAndCleanUrls() {
    const raw = url;
    if (!raw) return;

    const rawLines = raw.split('\n');
    const validUrlLines = [];

    rawLines.forEach(line => {
        let trimmed = line.trim();
        if (!trimmed) return;

        // Remove "URL:" prefix if present
        trimmed = trimmed.replace(/^URL:\s*/i, '');

        const firstChar = trimmed.charAt(0);
        
        // Detect if this line is actually a fragment of the previous URL
        const isFragment = ['/', '?', '&', '=', '#', '_', '%'].includes(firstChar) || 
                           trimmed.toLowerCase().startsWith('utm') ||
                           trimmed.toLowerCase().startsWith('gad') ||
                           trimmed.toLowerCase().startsWith('gclid') ||
                           trimmed.toLowerCase().startsWith('wbraid') ||
                           trimmed.includes('=');

        const hasSpaces = /\s/.test(trimmed);
        const hasDot = trimmed.includes('.');

        if (isFragment && validUrlLines.length > 0) {
            // Merge with previous line
            validUrlLines[validUrlLines.length - 1] += trimmed;
        } else if (!hasSpaces && hasDot) {
            // Treat as new URL
            validUrlLines.push(trimmed);
        }
    });

    const polishedUrls = validUrlLines.map(u => {
        let clean = u.replace(/[#•*]+$/, ''); // Remove trailing garbage
        if (!/^https?:\/\//i.test(clean)) {
            clean = 'https://' + clean; // Ensure protocol
        }
        return clean;
    });

    const newValue = polishedUrls.join('\n');

    // Only update if changes were made
    if (raw !== newValue) {
        setUrl(newValue);
        setIsFixed(true);
        setTimeout(() => setIsFixed(false), 500); // Remove flash effect after 500ms
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setCopied(false);

    // If multiple URLs are present after cleaning, we take the first one for the API
    // (Since the current backend only handles one URL at a time)
    const targetUrl = url.split('\n')[0].trim();

    const res = await fetch("/api/reader", {
      method: "POST",
      body: JSON.stringify({ url: targetUrl }),
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
        {/* Changed from input to textarea to allow pasting messy multi-line content */}
        <textarea
          placeholder="Paste URL here (messy fragments will be auto-fixed on blur)..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={extractAndCleanUrls} // Trigger smart fix when user leaves the field
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
            // Visual feedback for the "fix"
            transition: "background-color 0.3s ease, border-color 0.3s ease",
            backgroundColor: isFixed ? "#e6ffe6" : "white", // Flash green if fixed
            borderColor: isFixed ? "#28a745" : "#ccc"
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
