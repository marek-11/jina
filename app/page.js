"use client";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [mode, setMode] = useState("url"); // "url" or "text"

  // --- KEYBOARD SHORTCUT: Press 'D' to Clear ---
  useEffect(() => {
    function handleKeyDown(e) {
      // Check if "d" or "D" was pressed
      if (e.key === "d" || e.key === "D") {
        // IGNORE if the user is currently typing inside the textarea or an input
        const activeTag = document.activeElement.tagName.toLowerCase();
        if (activeTag === "textarea" || activeTag === "input") {
          return;
        }

        // If not typing, perform the clear action
        setUrl("");
        setResult(null);
      }
    }

    // Attach listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup listener
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // --- LOGIC: URL CLEANER ---
  function getCleanedUrl(raw) {
    if (!raw) return "";
    const rawLines = raw.split('\n');
    const validUrlLines = [];

    rawLines.forEach(line => {
      let trimmed = line.trim();
      if (!trimmed) return;
      trimmed = trimmed.replace(/^URL:\s*/i, '');

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
    if (mode === "text") return; // Allow natural paste for text mode

    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const cleaned = getCleanedUrl(pastedData);
    setUrl(cleaned || pastedData);
    if (cleaned !== pastedData) {
      setIsFixed(true);
      setTimeout(() => setIsFixed(false), 500);
    }
  };

  // --- UPDATED: Handle Paste Button Click ---
  const handlePasteClick = async (onlyIfEmpty = false) => {
    // If we only want to paste into an empty box, stop if URL exists
    if (onlyIfEmpty && url) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (mode === "url") {
          const cleaned = getCleanedUrl(text);
          setUrl(cleaned || text);
        } else {
          setUrl(text);
        }
        setIsFixed(true);
        setTimeout(() => setIsFixed(false), 500);
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      // alert("Please allow clipboard permissions or paste manually.");
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

    let targetUrl = "";
    let targetText = "";

    if (mode === "url") {
      const cleanedUrl = getCleanedUrl(url);
      if (cleanedUrl && cleanedUrl !== url) {
        setUrl(cleanedUrl);
      }
      targetUrl = (cleanedUrl || url).split('\n')[0].trim();

      if (!targetUrl) {
        alert("Please enter a valid URL");
        return;
      }
    } else {
      // Text mode
      targetText = url.trim();
      if (!targetText) {
        alert("Please enter some text to summarize");
        return;
      }
    }

    setLoading(true);
    setResult(null);
    setCopied(false);

    try {
      const payload = mode === "url" ? { url: targetUrl } : { text: targetText };

      const res = await fetch("/api/reader", {
        method: "POST",
        body: JSON.stringify(payload),
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>WebCrawler</h1>

        {/* MODE TOGGLE */}
        <div style={{ display: "flex", background: "#f0f0f0", padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => { setMode("url"); setUrl(""); setResult(null); }}
            style={{
              padding: "6px 12px",
              border: "none",
              background: mode === "url" ? "#fff" : "transparent",
              color: mode === "url" ? "#000" : "#666",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: mode === "url" ? "bold" : "normal",
              boxShadow: mode === "url" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s"
            }}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => { setMode("text"); setUrl(""); setResult(null); }}
            style={{
              padding: "6px 12px",
              border: "none",
              background: mode === "text" ? "#fff" : "transparent",
              color: mode === "text" ? "#000" : "#666",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: mode === "text" ? "bold" : "normal",
              boxShadow: mode === "text" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s"
            }}
          >
            Summarizer
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>

        {/* WRAPPER DIV for Relative Positioning */}
        <div style={{ position: "relative", width: "100%", marginBottom: 10 }}>
          <textarea
            id="urlInput"
            placeholder={mode === "url" ? "Paste URL here..." : "Paste lengthy content here to summarize..."}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handlePaste}
            onClick={() => handlePasteClick(true)} // Paste only if empty
            onBlur={mode === "url" ? handleBlur : undefined} // Only clean URL in URL mode
            required
            rows={mode === "url" ? 4 : 10} // Taller box for text mode
            style={{
              padding: 10,
              paddingRight: 40, // Add padding on right so text doesn't go under the button
              width: "100%",
              border: "1px solid #ccc",
              borderRadius: 4,
              resize: "vertical",
              fontFamily: mode === "url" ? "monospace" : "sans-serif",
              transition: "all 0.3s ease",
              backgroundColor: isFixed ? "#d4edda" : "#fff",
              borderColor: isFixed ? "#28a745" : "#ccc",
              display: "block" // Removes inline-block gaps
            }}
          />

          {/* PASTE BUTTON ICON */}
          <button
            type="button"
            onClick={() => handlePasteClick(false)} // Force paste
            title="Paste from Clipboard"
            style={{
              position: "absolute",
              right: 8,
              top: 8,
              background: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              padding: "5px 8px",
              fontSize: "16px",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10
            }}
          >
            📋
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            style={{
              flex: 1,
              padding: 12,
              cursor: "pointer",
              background: "#222",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 16
            }}
          >
            {loading ? "Processing..." : (mode === "url" ? "Read & Summarize" : "Summarize Content")}
          </button>

          <button
            type="button"
            onClick={() => { setUrl(""); setResult(null); }}
            title="Clear input (Press 'D')"
            style={{
              padding: "0 15px",
              cursor: "pointer",
              background: "#ff4d4f",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 16
            }}
          >
            ✕
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
          Tip: Press <strong>'D'</strong> to clear (when not typing).
        </p>
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

          <div
            style={{
              background: "#eef2ff",
              padding: 16,
              borderRadius: 8,
              lineHeight: 1.6,
              border: "1px solid #d0d7ff",
              color: "#333"
            }}
          >
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => <h3 style={{ marginTop: 0 }} {...props} />,
                h2: ({ node, ...props }) => <h4 style={{ marginTop: 10 }} {...props} />,
                li: ({ node, ...props }) => <li style={{ marginBottom: 4 }} {...props} />,
                a: ({ node, ...props }) => <a style={{ color: "#0066cc", textDecoration: "underline" }} target="_blank" rel="noopener noreferrer" {...props} />
              }}
            >
              {result.summary}
            </ReactMarkdown>
          </div>

          {mode === 'url' && (
            <>
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
            </>
          )}
        </div>
      )}
    </main>
  );
}
