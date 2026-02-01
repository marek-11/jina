"use client";
import { useState, useEffect } from "react"; 
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

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
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const cleaned = getCleanedUrl(pastedData);
    setUrl(cleaned || pastedData); 
    if (cleaned !== pastedData) {
      setIsFixed(true);
      setTimeout(() => setIsFixed(false), 500);
    }
  };

  // --- NEW: Handle Paste Button Click ---
  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = getCleanedUrl(text);
        setUrl(cleaned || text);
        setIsFixed(true);
        setTimeout(() => setIsFixed(false), 500);
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      alert("Please allow clipboard permissions or paste manually.");
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
        
        {/* WRAPPER DIV for Relative Positioning */}
        <div style={{ position: "relative", width: "100%", marginBottom: 10 }}>
          <textarea
            id="urlInput"
            placeholder="Paste URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handlePaste}
            onBlur={handleBlur}
            required
            rows={4}
            style={{
              padding: 10,
              paddingRight: 40, // Add padding on right so text doesn't go under the button
              width: "100%",
              border: "1px solid #ccc",
              borderRadius: 4,
              resize: "vertical",
              fontFamily: "monospace",
              transition: "all 0.3s ease",
              backgroundColor: isFixed ? "#d4edda" : "#fff",
              borderColor: isFixed ? "#28a745" : "#ccc",
              display: "block" // Removes inline-block gaps
            }}
          />
          
          {/* PASTE BUTTON ICON */}
          <button
            type="button"
            onClick={handlePasteClick}
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

        <div style={{display:'flex', gap: '10px'}}>
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
            {loading ? "Processing..." : "Read & Summarize"}
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
        <p style={{fontSize: '0.8rem', color: '#666', marginTop: '5px'}}>
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
                h1: ({node, ...props}) => <h3 style={{marginTop: 0}} {...props} />,
                h2: ({node, ...props}) => <h4 style={{marginTop: 10}} {...props} />,
                li: ({node, ...props}) => <li style={{marginBottom: 4}} {...props} />,
                a: ({node, ...props}) => <a style={{color: "#0066cc", textDecoration: "underline"}} target="_blank" rel="noopener noreferrer" {...props} />
              }}
            >
              {result.summary}
            </ReactMarkdown>
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
