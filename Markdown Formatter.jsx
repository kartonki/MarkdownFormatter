import { useState, useCallback, useRef, useEffect } from "react";

const SAMPLE_MARKDOWN = `# my project docs
this is a quick overview of the project

##Installation
run the following to get started:
\`\`\`
npm install my-package
\`\`\`

###Usage
here's how you use it:

\`\`\`
const x = require('my-package')
x.doSomething({key: 'value', another: true})
console.log(x.result)
\`\`\`

##features
- fast performance
- easy to use
- works with node and browser
  - supports chrome
  - supports firefox
-TypeScript support

##api reference
**doSomething(options)**
takes an options object and does the thing. returns a promise.

*options.key* - a string value
*options.another* - boolean flag

see also: [github repo](https://github.com/example) and [npm page](https://npmjs.com/package/my-package)

##Contributing
please read CONTRIBUTING.md first. then fork the repo, make changes, and submit a PR.

###code style
we use eslint. run \`npm run lint\` before submitting.
`;

async function callAI(rawMarkdown, settings) {
  const settingsDesc = [
    settings.fixHeadings && "Fix heading hierarchy (ensure proper # levels with blank lines)",
    settings.detectCodeLang && "Detect and add language identifiers to fenced code blocks (js, bash, etc.)",
    settings.normalizeLists && "Normalize list indentation and bullet consistency",
    settings.fixSpacing && "Fix spacing: blank lines before/after headings, lists, code blocks",
    settings.improveStyle && "Capitalize first letter of sentences, clean up inline formatting (*bold*, **em** consistency)",
  ].filter(Boolean).join("; ");

  const prompt = `You are a Markdown formatting expert. Format the following markdown document.

Rules to apply: ${settingsDesc || "Apply all standard markdown formatting improvements."}

Return ONLY the formatted markdown. No explanations, no code fences around the entire output, just the cleaned markdown content.

INPUT MARKDOWN:
${rawMarkdown}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.map((b) => b.text || "").join("") || "";
  return text.trim();
}

function computeDiff(original, formatted) {
  const origLines = original.split("\n");
  const fmtLines = formatted.split("\n");
  const result = [];
  const maxLen = Math.max(origLines.length, fmtLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i] ?? null;
    const f = fmtLines[i] ?? null;
    if (o === null) result.push({ type: "added", line: f, idx: i });
    else if (f === null) result.push({ type: "removed", line: o, idx: i });
    else if (o !== f) result.push({ type: "changed", original: o, formatted: f, idx: i });
    else result.push({ type: "same", line: f, idx: i });
  }
  return result;
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "8px 14px", background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px",
      minWidth: "60px"
    }}>
      <span style={{ fontSize: "18px", fontWeight: "700", color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
      <span style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "2px" }}>{label}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "6px 0" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: "34px", height: "18px", borderRadius: "9px",
          background: checked ? "#e07b39" : "rgba(255,255,255,0.1)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
          border: checked ? "1px solid #f09050" : "1px solid rgba(255,255,255,0.15)",
          cursor: "pointer"
        }}
      >
        <div style={{
          position: "absolute", top: "2px",
          left: checked ? "16px" : "2px",
          width: "12px", height: "12px", borderRadius: "50%",
          background: checked ? "#fff" : "#888",
          transition: "left 0.2s, background 0.2s"
        }} />
      </div>
      <span style={{ fontSize: "12px", color: "#bbb", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
    </label>
  );
}

export default function MarkdownFormatter() {
  const [input, setInput] = useState(SAMPLE_MARKDOWN);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [diffView, setDiffView] = useState(false);
  const [diff, setDiff] = useState([]);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("output"); // output | diff
  const [settings, setSettings] = useState({
    fixHeadings: true,
    detectCodeLang: true,
    normalizeLists: true,
    fixSpacing: true,
    improveStyle: true,
  });
  const outputRef = useRef(null);

  const handleFormat = useCallback(async () => {
    if (!input.trim()) return;
    setStatus("loading");
    setOutput("");
    setDiff([]);
    setStats(null);
    try {
      const result = await callAI(input, settings);
      setOutput(result);
      const d = computeDiff(input, result);
      setDiff(d);
      const added = d.filter((x) => x.type === "added" || x.type === "changed").length;
      const removed = d.filter((x) => x.type === "removed").length;
      const same = d.filter((x) => x.type === "same").length;
      setStats({ added, removed, same, total: d.length });
      setStatus("done");
      setActiveTab("output");
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }, [input, settings]);

  const handleCopy = useCallback(() => {
    if (output) {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [output]);

  const setSetting = (key) => (val) => setSettings((s) => ({ ...s, [key]: val }));

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d0d",
      color: "#e8e8e8",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .format-btn {
          background: #e07b39;
          color: #0d0d0d;
          border: none;
          padding: 10px 24px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.05em;
          cursor: pointer;
          border-radius: 3px;
          transition: background 0.15s, transform 0.1s;
        }
        .format-btn:hover { background: #f09050; }
        .format-btn:active { transform: scale(0.97); }
        .format-btn:disabled { background: #444; color: #888; cursor: not-allowed; transform: none; }
        .tab-btn {
          background: transparent;
          border: none;
          padding: 8px 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
        }
        .tab-btn.active { color: #e07b39; border-bottom-color: #e07b39; }
        .tab-btn:not(.active) { color: #555; }
        .tab-btn:not(.active):hover { color: #999; }
        .pulse { animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.45 } }
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: "1px solid #1f1f1f",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0a0a0a"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px", height: "32px", background: "#e07b39",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", borderRadius: "4px", flexShrink: 0
          }}>⌗</div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: "800", fontSize: "16px", letterSpacing: "-0.02em", color: "#fff" }}>
              MD<span style={{ color: "#e07b39" }}>FORMAT</span>
            </div>
            <div style={{ fontSize: "9px", color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "1px" }}>AI-Powered Markdown Formatter</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {stats && (
            <div style={{ display: "flex", gap: "8px" }} className="fade-in">
              <StatBadge label="Lines" value={stats.total} color="#aaa" />
              <StatBadge label="Changed" value={stats.added} color="#e07b39" />
              <StatBadge label="Removed" value={stats.removed} color="#e06060" />
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 57px)" }}>
        {/* Sidebar settings */}
        <aside style={{
          width: "190px", flexShrink: 0,
          borderRight: "1px solid #1a1a1a",
          background: "#080808",
          padding: "20px 16px",
          display: "flex", flexDirection: "column", gap: "4px"
        }}>
          <div style={{ fontSize: "9px", color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid #181818" }}>
            Format Rules
          </div>
          <Toggle label="Fix headings" checked={settings.fixHeadings} onChange={setSetting("fixHeadings")} />
          <Toggle label="Detect code lang" checked={settings.detectCodeLang} onChange={setSetting("detectCodeLang")} />
          <Toggle label="Normalize lists" checked={settings.normalizeLists} onChange={setSetting("normalizeLists")} />
          <Toggle label="Fix spacing" checked={settings.fixSpacing} onChange={setSetting("fixSpacing")} />
          <Toggle label="Improve style" checked={settings.improveStyle} onChange={setSetting("improveStyle")} />

          <div style={{ marginTop: "auto", paddingTop: "20px", borderTop: "1px solid #181818" }}>
            <div style={{ fontSize: "9px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{
                width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
                background: status === "loading" ? "#e07b39" : status === "done" ? "#5c9e6a" : status === "error" ? "#e05050" : "#333",
                ...(status === "loading" ? { animation: "pulse 1s infinite" } : {})
              }} />
              <span style={{ fontSize: "11px", color: "#555" }}>
                {status === "idle" && "Ready"}
                {status === "loading" && "Processing..."}
                {status === "done" && "Complete"}
                {status === "error" && "Error"}
              </span>
            </div>
          </div>
        </aside>

        {/* Main content: two panels */}
        <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Input Panel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #1a1a1a" }}>
            <div style={{
              padding: "10px 16px", borderBottom: "1px solid #1a1a1a",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#0a0a0a"
            }}>
              <span style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Input · {input.split("\n").length} lines
              </span>
              <button
                onClick={() => setInput("")}
                style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}
              >clear</button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1, background: "#0d0d0d", color: "#c8c8c8",
                border: "none", resize: "none", padding: "20px",
                fontSize: "12px", lineHeight: "1.7",
                fontFamily: "'JetBrains Mono', monospace",
              }}
              placeholder="Paste your markdown here..."
            />
            <div style={{ padding: "12px 16px", borderTop: "1px solid #1a1a1a", background: "#0a0a0a" }}>
              <button
                className="format-btn"
                onClick={handleFormat}
                disabled={status === "loading" || !input.trim()}
              >
                {status === "loading" ? "⟳ Formatting..." : "⚡ Format with AI"}
              </button>
            </div>
          </div>

          {/* Output Panel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{
              padding: "0 16px", borderBottom: "1px solid #1a1a1a",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#0a0a0a"
            }}>
              <div style={{ display: "flex" }}>
                <button className={`tab-btn ${activeTab === "output" ? "active" : ""}`} onClick={() => setActiveTab("output")}>Output</button>
                <button className={`tab-btn ${activeTab === "diff" ? "active" : ""}`} onClick={() => setActiveTab("diff")}>
                  Diff {stats ? `(${stats.added + stats.removed})` : ""}
                </button>
              </div>
              <button
                onClick={handleCopy}
                disabled={!output}
                style={{
                  background: "none", border: "1px solid #2a2a2a", color: copied ? "#5c9e6a" : "#666",
                  cursor: output ? "pointer" : "not-allowed", fontSize: "11px",
                  padding: "4px 10px", borderRadius: "3px", fontFamily: "inherit",
                  transition: "color 0.2s"
                }}
              >
                {copied ? "✓ copied" : "copy"}
              </button>
            </div>

            <div ref={outputRef} style={{ flex: 1, overflow: "auto", padding: "20px" }}>
              {status === "idle" && (
                <div style={{ color: "#333", fontSize: "12px", marginTop: "40px", textAlign: "center" }}>
                  <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.3 }}>⌗</div>
                  <div>Run formatter to see output</div>
                </div>
              )}

              {status === "loading" && (
                <div style={{ color: "#555", fontSize: "12px", marginTop: "40px", textAlign: "center" }} className="pulse">
                  <div style={{ fontSize: "24px", marginBottom: "12px" }}>⟳</div>
                  <div>Analyzing and formatting...</div>
                </div>
              )}

              {status === "error" && (
                <div style={{ color: "#e05050", fontSize: "12px", marginTop: "40px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", marginBottom: "12px" }}>✕</div>
                  <div>Formatting failed. Please try again.</div>
                </div>
              )}

              {status === "done" && activeTab === "output" && (
                <pre className="fade-in" style={{
                  fontSize: "12px", lineHeight: "1.7", color: "#d0d0d0",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  fontFamily: "'JetBrains Mono', monospace"
                }}>{output}</pre>
              )}

              {status === "done" && activeTab === "diff" && (
                <div className="fade-in" style={{ fontSize: "12px", lineHeight: "1.7", fontFamily: "'JetBrains Mono', monospace" }}>
                  {diff.map((entry, i) => {
                    if (entry.type === "same") {
                      return (
                        <div key={i} style={{ color: "#555", padding: "1px 8px", display: "flex", gap: "12px" }}>
                          <span style={{ color: "#333", minWidth: "28px", userSelect: "none" }}>{i + 1}</span>
                          <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.line}</span>
                        </div>
                      );
                    }
                    if (entry.type === "removed") {
                      return (
                        <div key={i} style={{ color: "#e06060", background: "rgba(224,96,96,0.07)", padding: "1px 8px", display: "flex", gap: "12px" }}>
                          <span style={{ color: "#e06060", minWidth: "28px", userSelect: "none" }}>−</span>
                          <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: "line-through", opacity: 0.7 }}>{entry.line}</span>
                        </div>
                      );
                    }
                    if (entry.type === "added") {
                      return (
                        <div key={i} style={{ color: "#6ab87a", background: "rgba(90,180,110,0.07)", padding: "1px 8px", display: "flex", gap: "12px" }}>
                          <span style={{ color: "#6ab87a", minWidth: "28px", userSelect: "none" }}>+</span>
                          <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.line}</span>
                        </div>
                      );
                    }
                    if (entry.type === "changed") {
                      return (
                        <div key={i}>
                          <div style={{ color: "#e06060", background: "rgba(224,96,96,0.07)", padding: "1px 8px", display: "flex", gap: "12px" }}>
                            <span style={{ color: "#e06060", minWidth: "28px", userSelect: "none" }}>−</span>
                            <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: "line-through", opacity: 0.7 }}>{entry.original}</span>
                          </div>
                          <div style={{ color: "#6ab87a", background: "rgba(90,180,110,0.07)", padding: "1px 8px", display: "flex", gap: "12px" }}>
                            <span style={{ color: "#6ab87a", minWidth: "28px", userSelect: "none" }}>+</span>
                            <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.formatted}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
