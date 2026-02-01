"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  // --- LOGIC: URL CLEANER ---
  function getCleanedUrl(raw) {
    if (!raw) return "";
    const rawLines = raw.split('\n');
    const validUrlLines = [];

    rawLines.forEach(line => {
      let trimmed = line.trim();
      if (!trimmed) return;

      trimmed = trimmed.replace(/^URL:\s*/i, '');

      // Aggressive space removal for http/https lines
      if (/^https?:\/\//i.test(trimmed)) {
         trimmed = trimmed.replace(/\s+/g, '');
      }

      const firstChar = trimmed.charAt(0);
      const isFragmentStart = ['/', '?', '&', '=', '#', '_', '%'].includes(firstChar);
      
      if (isFragmentStart) {
         trimmed = trimmed.replace(/\s+/g, '');
      }

      const isFragment = isFragmentStart || 
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

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const cleaned = getCleanedUrl(pastedData);
    setUrl(cleaned || pastedData); 
    if (cleaned !== pastedData) {
      setIsFixed(true);
      setTimeout(() => setIsFixed(false), 500);
    }
  };

  function handleBlur() {
    const cleaned = getCleanedUrl(url);
    if (cleaned && cleaned !== url) {
      setUrl(cleaned);
      setIsFixed(true);
      setTimeout(() => setIsFixed(false), 500);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanedUrl = getCleanedUrl(url);
    if (cleanedUrl && cleanedUrl !== url) {
        setUrl(cleanedUrl);
    }
    const targetUrl = (cleanedUrl || url).split('\n')[0].trim();

    if (!targetUrl) {
        alert("Please enter a valid URL");
        return;
    }

    setLoading(true);
    setResult(null);
    setCopied(false);

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
        alert("An error occurred.");
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
          onPaste={handlePaste}
          onBlur={handleBlur}
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
            transition: "all 0.3s ease",
            backgroundColor: isFixed ? "#d4edda" : "#fff",
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

          {/* UPDATED: Added whiteSpace: "pre-wrap" to respect Markdown newlines/bullets.
            Note: For full bold/header rendering, you would need 'react-markdown'.
          */}
          <div
            style={{
              background: "#eef2ff",
              padding: 16,
              borderRadius: 8,
              lineHeight: 1.6,
              border: "1px solid #d0d7ff",
              whiteSpace: "pre-wrap", 
              fontFamily: "sans-serif"
            }}
          >
            {result.summary}
          </div>

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
