import { Component, type ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Capture window-level errors (useEffect throws, unhandled promise rejections, etc.)
const globalErrors: string[] = [];

window.addEventListener("error", (e) => {
  globalErrors.push(`[Error] ${e.message} — ${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  globalErrors.push(`[UnhandledRejection] ${String(e.reason)}`);
});

function GlobalErrorDisplay() {
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    const id = setInterval(() => {
      if (globalErrors.length > errors.length) setErrors([...globalErrors]);
    }, 500);
    return () => clearInterval(id);
  }, [errors.length]);
  if (!errors.length) return null;
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "#1a0000", padding: 12, borderTop: "2px solid #ff4444" }}>
      <p style={{ color: "#facc15", fontFamily: "monospace", fontSize: 11, margin: "0 0 4px" }}>Global errors caught:</p>
      {errors.map((e, i) => <pre key={i} style={{ color: "#ff9999", fontSize: 10, margin: 0, whiteSpace: "pre-wrap" }}>{e}</pre>)}
    </div>
  );
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", background: "#0a0a0a", color: "#ff6b6b", minHeight: "100vh" }}>
          <p style={{ color: "#facc15", marginBottom: 8, fontSize: 14 }}>Render crash — error details:</p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{(error as Error).message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#999", marginTop: 12 }}>{(error as Error).stack}</pre>
          <button
            style={{ marginTop: 24, padding: "8px 20px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return (
      <>
        {this.props.children}
        <GlobalErrorDisplay />
      </>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
