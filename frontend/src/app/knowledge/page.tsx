"use client";

import { useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

export default function KnowledgeBasePage() {
  const [form, setForm] = useState({
    kb_type: "Regola",
    name: "",
    instructions: "",
    funnel_stage: ""
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.instructions) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, funnel_stage: form.funnel_stage || null })
      });
      if (res.ok) {
        setMessage({ text: "✅ Salvato con successo nel database!", type: "success" });
        setForm({ ...form, name: "", instructions: "" });
      } else {
        setMessage({ text: "❌ Errore durante il salvataggio.", type: "error" });
      }
    } catch {
      setMessage({ text: "❌ Errore di rete.", type: "error" });
    }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "10px 14px",
    color: "#f3f4f6",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#9ca3af",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  };

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px", background: "var(--navy, #0b0f19)", color: "#f3f4f6" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", color: "#9ca3af",
              textDecoration: "none", fontSize: 18, border: "1px solid rgba(255,255,255,0.08)"
            }}
          >
            ←
          </Link>
          <div>
            <h1 style={{
              fontSize: 26, fontWeight: 800, margin: 0,
              background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Database della Conoscenza
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              Aggiungi regole, framework e setup al cervello di Anti-Gravity
            </p>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 28,
          backdropFilter: "blur(12px)",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Row: Tipologia + Funnel */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Tipologia *</label>
                <select
                  style={inputStyle}
                  value={form.kb_type}
                  onChange={e => setForm({ ...form, kb_type: e.target.value })}
                >
                  <option value="Regola">📋 Regola Strategica</option>
                  <option value="Framework">🧩 Framework Copy</option>
                  <option value="Setup">⚙️ Setup / Istruzioni AI</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Fase del Funnel</label>
                <select
                  style={inputStyle}
                  value={form.funnel_stage}
                  onChange={e => setForm({ ...form, funnel_stage: e.target.value })}
                >
                  <option value="">Tutte le fasi (Universale)</option>
                  <option value="discovery">🔍 Scoperta</option>
                  <option value="interest">💡 Interesse</option>
                  <option value="decision">🎯 Decisione</option>
                  <option value="action">🔥 Azione</option>
                </select>
              </div>
            </div>

            {/* Nome */}
            <div>
              <label style={labelStyle}>Nome Regola o Framework *</label>
              <input
                type="text"
                required
                placeholder="es. Regola dell'Urgenza, AIDA Framework, Hook Storytelling..."
                style={inputStyle}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Testo */}
            <div>
              <label style={labelStyle}>Istruzioni e Contenuti *</label>
              <textarea
                required
                rows={10}
                placeholder={"Scrivi qui il contenuto:\n\n• Come deve essere applicato dal sistema AI\n• Esempi pratici di utilizzo\n• Regole specifiche da seguire\n• Strategie pubblicitarie o organiche"}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                value={form.instructions}
                onChange={e => setForm({ ...form, instructions: e.target.value })}
              />
            </div>

            {/* Footer: messaggio + bottone */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {message && (
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 500,
                    color: message.type === "success" ? "#4ade80" : "#f87171",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                    {message.text}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !form.name || !form.instructions}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 22px",
                  background: loading ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #2563eb, #7c3aed)",
                  color: "#fff", border: "none", borderRadius: 12,
                  fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer",
                  opacity: (!form.name || !form.instructions) ? 0.4 : 1,
                  transition: "all .2s",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {loading ? "Salvataggio..." : "💾 Salva nel Database"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
