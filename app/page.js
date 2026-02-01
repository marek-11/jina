"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  // --- LOGIC: URL CLEANER (Enhanced) ---
  function getCleanedUrl(raw) {
    if (!raw) return "";

    const rawLines = raw.split('\n');
    const validUrlLines = [];

    rawLines.forEach(line => {
      let trimmed = line.trim();
      if (!trimmed) return;

      // 1. Remove "URL:" prefix (common in emails/chat)
      trimmed = trimmed.replace(/^URL:\s*/i, '');

      // 2. AGGRESSIVE FIX: If line starts with http/https, remove ALL spaces immediately.
      // This fixes: "https://site.com/ en/ page" -> "https://site.com/en/page"
      if (/^https?:\/\//i.test(trimmed)) {
         trimmed = trimmed.replace(/\s+/g, '');
      }

      // 3. Fragment Detection
      const firstChar = trimmed.charAt(0);
      const isFragmentStart = ['/', '?', '&', '=', '#', '_', '%'].includes(firstChar);
      
      // If it looks like a fragment, we also strip spaces (e.g. "? q = 1" -> "?q=1")
      if (isFragmentStart) {
         trimmed = trimmed.replace(/\s+/g, '');
      }

      const isFragment = isFragmentStart || 
                         trimmed.toLowerCase().startsWith('utm') ||
                         trimmed.toLowerCase().startsWith('gad') ||
                         trimmed.toLowerCase().startsWith('gclid') ||
                         trimmed.toLowerCase().startsWith('wbraid') ||
                         trimmed.includes('=');

      // Check for validity
      // If we stripped spaces, 'hasSpaces' is now false, so valid URL check passes easier
      const hasSpaces = /\s/.test(trimmed); 
      const hasDot = trimmed.includes('.');

      if (isFragment && validUrlLines.length > 0) {
        // Merge with previous line
        validUrlLines[validUrlLines.length - 1] += trimmed;
      } else if (!hasSpaces && hasDot) {
        // Treat as new URL line
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

    return polishedUrls.join('\n');
  }

  // --- HANDLER: ON PASTE (Immediate Fix) ---
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const cleaned = getCleanedUrl(pastedData);
    
    // Replace content with cleaned version
    setUrl(cleaned || pastedData); 
    
    // Visual feedback
    if (cleaned !== pastedData) {
      setIsFixed(true);
      setTimeout(() => setIsFixed(false), 500);
    }
  };

  // --- HANDLER: ON BLUR (Manual Fix) ---
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
            backgroundColor: isFixed ? "#d4edda" : "#fff", // Light green flash
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
