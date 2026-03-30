"use client";

import { useState, useRef, useEffect } from "react";
import {
  SparklesIcon, PaperAirplaneIcon, ArrowPathIcon,
  ChatBubbleLeftRightIcon, HandThumbUpIcon, HandThumbDownIcon,
  ChevronDownIcon, ChevronUpIcon, ClockIcon, CheckCircleIcon,
  ExclamationTriangleIcon, BoltIcon, BeakerIcon, LockClosedIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon as SparklesSolid } from "@heroicons/react/24/solid";
import { Client } from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL || "https://antigravity-backend-production-41ee.up.railway.app";

// ── Types ─────────────────────────────────────────────────────────────────
interface ARIAMessage {
  id: string;
  role: "user" | "aria";
  content: string;
  result?: any;
  steps?: any[];
  confidence?: number;
  outputType?: string;
  timestamp: Date;
  status?: "thinking" | "done" | "error";
  // Track context for regeneration
  originalTask?: string;
  clientId?: string;
}

interface ARIAMemoryStats {
  total_outputs_generated: number;
  outputs_kept: number;
  approval_rate: number;
  learned_vocabulary_count: number;
}

// ── Quick prompts ─────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: "🎯 5 Angoli TOFU", task: "Genera 5 angoli comunicativi potenti per la fase TOFU (top of funnel / scoperta) basandoti su tutto quello che sai di questo cliente." },
  { label: "✍️ Copy Completo", task: "Crea un copy completo per Meta Ads (headline + testo + CTA) sfruttando l'angolo più forte che riesci a trovare dall'analisi." },
  { label: "🎬 Script Video 30s", task: "Scrivi uno script video da 30 secondi per un Reel Instagram. Deve essere immediato, umano e conversazionale." },
  { label: "🔍 Analisi Mercato", task: "Fai un'analisi di mercato approfondita: competitor, target, dolori principali, vocabolario reale del pubblico. Poi dimmi i 3 angoli più forti." },
  { label: "📋 Piano Contenuti", task: "Proponi un piano contenuti per 2 settimane su Instagram: mix di Reel, Stories e Post. Per ogni giorno indica topic e angolo comunicativo." },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const label = score >= 80 ? "Alta" : score >= 60 ? "Media" : "Bassa";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: `${color}22`, color, border: `1px solid ${color}44`
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      Confidenza {label} ({score}%)
    </span>
  );
}

function StepsBadge({ steps }: { steps: any[] }) {
  const [open, setOpen] = useState(false);
  const toolSteps = steps.filter(s => s.tool);
  if (!toolSteps.length) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(p => !p)} style={{
        display: "flex", alignItems: "center", gap: 4,
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "rgba(255,255,255,0.5)",
        cursor: "pointer"
      }}>
        <BeakerIcon width={12} /> {toolSteps.length} strumenti usati
        {open ? <ChevronUpIcon width={12} /> : <ChevronDownIcon width={12} />}
      </button>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: "2px solid rgba(255,255,255,0.1)" }}>
          {toolSteps.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "2px 0" }}>
              <span style={{ color: "#3b82f6", fontWeight: 700 }}>→ {s.tool}</span>
              {s.input && <span style={{ marginLeft: 4 }}>({JSON.stringify(s.input).slice(0, 60)}...)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultRenderer({ result, onFeedback, onRegen, messageId, clientId }: {
  result: any;
  onFeedback: (kept: boolean, feedback: string, outputContent: string, outputType: string) => void;
  onRegen: (feedback: string, outputContent: string, outputType: string) => void;
  messageId: string;
  clientId: string;
}) {
  const [feedbackSent, setFeedbackSent] = useState<"kept" | "discarded" | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [pendingAction, setPendingAction] = useState<"keep" | "regen" | null>(null);

  if (!result) return null;

  const getOutputType = () =>
    result.angles ? "angle" : result.scripts ? "script" : result.copy ? "copy" : "general";

  const handleKeep = () => {
    if (!showFeedbackInput) {
      setPendingAction("keep");
      setShowFeedbackInput(true);
      return;
    }
    const outputContent = JSON.stringify(result).slice(0, 500);
    const outputType = getOutputType();
    onFeedback(true, feedbackText || "Approvato", outputContent, outputType);
    setFeedbackSent("kept");
    setShowFeedbackInput(false);
  };

  // FIX: "Rifai" now passes context so ARIA knows what to fix
  const handleRegen = () => {
    if (!showFeedbackInput) {
      setPendingAction("regen");
      setShowFeedbackInput(true);
      return;
    }
    if (!feedbackText.trim()) {
      // Force user to write feedback before regenerating
      return;
    }
    const outputContent = JSON.stringify(result).slice(0, 500);
    const outputType = getOutputType();
    // Save negative feedback
    onFeedback(false, feedbackText, outputContent, outputType);
    // Trigger regeneration with context
    onRegen(feedbackText, outputContent, outputType);
    setFeedbackSent("discarded");
    setShowFeedbackInput(false);
  };

  const FeedbackSection = () => (
    <div style={{ marginTop: 10 }}>
      {showFeedbackInput && (
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
            {pendingAction === "regen"
              ? "✏️ Cosa non va? Scrivi il motivo (obbligatorio per rigenerare):"
              : "💬 Commento opzionale:"}
          </div>
          <textarea
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            placeholder={
              pendingAction === "regen"
                ? "Es: 'troppo generico', 'hook non efficace', 'tono troppo formale'..."
                : "Es: 'perfetto il tono', 'hook efficace'..."
            }
            autoFocus
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8,
              border: `1px solid ${pendingAction === "regen" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.15)"}`,
              background: "rgba(255,255,255,0.05)",
              color: "#fff", fontSize: 12, resize: "vertical", minHeight: 60,
              fontFamily: "inherit", marginBottom: 8
            }}
          />
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleKeep} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e"
        }}>
          <HandThumbUpIcon width={14} /> Tieni questo
        </button>
        <button onClick={handleRegen} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
          background: pendingAction === "regen" && !feedbackText.trim()
            ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
          border: `1px solid ${pendingAction === "regen" && !feedbackText.trim()
            ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
          color: pendingAction === "regen" && !feedbackText.trim() ? "#ef4444" : "#f59e0b"
        }}>
          <ArrowPathIcon width={14} />
          {pendingAction === "regen" && !feedbackText.trim() ? "Scrivi il motivo prima" : "Rifai"}
        </button>
      </div>
    </div>
  );

  // Render angles
  if (result.angles && Array.isArray(result.angles)) {
    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {result.angles.map((angle: any, i: number) => (
            <div key={i} style={{
              background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: 10, padding: "10px 14px"
            }}>
              <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 4, fontSize: 13 }}>
                {i + 1}. {angle.title}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{angle.description}</div>
              {angle.emotion && (
                <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  Emozione dominante: <span style={{ color: "#f59e0b" }}>{angle.emotion}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {!feedbackSent ? (
          <FeedbackSection />
        ) : (
          <div style={{ marginTop: 8, fontSize: 11, color: feedbackSent === "kept" ? "#22c55e" : "#f59e0b" }}>
            {feedbackSent === "kept" ? "✓ ARIA ha memorizzato questo successo!" : "↺ Feedback registrato — ARIA sta rigenerando..."}
          </div>
        )}
      </div>
    );
  }

  // Render scripts
  if (result.scripts && Array.isArray(result.scripts)) {
    return (
      <div>
        {result.scripts.map((script: string, i: number) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "12px 14px", marginTop: i > 0 ? 10 : 12,
            fontFamily: "monospace", fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.85)",
            whiteSpace: "pre-wrap"
          }}>
            {result.scripts.length > 1 && <div style={{ color: "#60a5fa", fontWeight: 700, marginBottom: 8, fontFamily: "system-ui" }}>Variante {i + 1}</div>}
            {script}
          </div>
        ))}
        {!feedbackSent ? (
          <FeedbackSection />
        ) : (
          <div style={{ marginTop: 8, fontSize: 11, color: feedbackSent === "kept" ? "#22c55e" : "#f59e0b" }}>
            {feedbackSent === "kept" ? "✓ ARIA ha memorizzato questo stile!" : "↺ Feedback registrato — ARIA sta rigenerando..."}
          </div>
        )}
      </div>
    );
  }

  // Render copy
  if (result.copy) {
    return (
      <div>
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "12px 14px", marginTop: 12,
          fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap"
        }}>
          {result.copy}
        </div>
        {!feedbackSent ? (
          <FeedbackSection />
        ) : (
          <div style={{ marginTop: 8, fontSize: 11, color: feedbackSent === "kept" ? "#22c55e" : "#f59e0b" }}>
            {feedbackSent === "kept" ? "✓ Feedback salvato." : "↺ Feedback registrato — ARIA sta rigenerando..."}
          </div>
        )}
      </div>
    );
  }

  // Render raw text
  if (result.text) {
    return (
      <div style={{
        marginTop: 10, fontSize: 13, lineHeight: 1.7,
        color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap"
      }}>
        {result.text}
      </div>
    );
  }

  return (
    <pre style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {JSON.stringify(result, null, 2).slice(0, 1000)}
    </pre>
  );
}


// ── Main Component ────────────────────────────────────────────────────────
export default function ARIAPanel({ clients }: { clients: Client[] }) {
  const [messages, setMessages] = useState<ARIAMessage[]>([{
    id: "welcome",
    role: "aria",
    content: "Ciao! Sono **ARIA**, il tuo agente AI strategico.\n\nSeleziona il cliente su cui vuoi lavorare, poi assegnami un task — creerò angoli, copy, script o analisi ragionando autonomamente sulle sorgenti disponibili e imparando dai tuoi feedback nel tempo.",
    timestamp: new Date(),
    status: "done",
  }]);
  const [input, setInput] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  // FIX 1: Lock client once conversation starts
  const [lockedClientId, setLockedClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [memoryStats, setMemoryStats] = useState<ARIAMemoryStats | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The active client is the locked one (if set) or the selected one
  const activeClientId = lockedClientId ?? selectedClientId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeClientId) loadMemoryStats(activeClientId);
  }, [activeClientId]);

  async function loadMemoryStats(clientId: string) {
    try {
      const r = await fetch(`${API}/aria/memory/${clientId}`);
      if (r.ok) setMemoryStats(await r.json());
    } catch (e) { /* silent */ }
  }

  // FIX 2: Core send function now accepts optional regeneration context
  async function sendMessage(
    overrideTask?: string,
    regenContext?: {
      is_regeneration: boolean;
      previous_output_type: string;
      previous_output: string;
      user_feedback: string;
    }
  ) {
    const taskText = overrideTask ?? input.trim();
    if (!taskText || !activeClientId || isLoading) return;

    if (!overrideTask) setInput("");

    // FIX 1: Lock the client to this conversation on first real message
    if (!lockedClientId && selectedClientId) {
      setLockedClientId(selectedClientId);
    }

    const clientId = lockedClientId ?? selectedClientId;

    const userMsg: ARIAMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: regenContext
        ? `↺ Rifai ${regenContext.previous_output_type} — "${regenContext.user_feedback}"`
        : taskText,
      timestamp: new Date(),
      clientId,
    };
    const ariaMsg: ARIAMessage = {
      id: crypto.randomUUID(),
      role: "aria",
      content: "",
      timestamp: new Date(),
      status: "thinking",
      clientId,
      originalTask: taskText,
    };
    setMessages(p => [...p, userMsg, ariaMsg]);
    setIsLoading(true);

    try {
      // FIX 2: Pass regeneration context + conversation history to backend
      // so ARIA knows what was generated before in this session
      const conversationHistory = messages
        .filter(m => m.role === "aria" && m.status === "done" && m.result)
        .slice(-3)
        .map(m => ({
          result_type: m.result?.angles ? "angle" : m.result?.scripts ? "script" : m.result?.copy ? "copy" : "text",
          summary: m.content,
          result_preview: JSON.stringify(m.result).slice(0, 600),
        }));

      const body: any = {
        task: taskText,
        client_id: clientId,
        context: {
          ...(regenContext ?? {}),
          ...(conversationHistory.length > 0 ? { conversation_history: conversationHistory } : {}),
        },
      };

      const r = await fetch(`${API}/aria/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { job_id } = await r.json();

      // Poll for result
      let result: any = null;
      for (let i = 0; i < 120; i++) {
        await new Promise(res => setTimeout(res, 2500));
        const poll = await fetch(`${API}/aria/task/${job_id}`);
        const data = await poll.json();
        if (data.status === "done") { result = data.result; break; }
        if (data.status === "error") { throw new Error(data.error || "Errore ARIA"); }
      }

      if (!result) throw new Error("Timeout: ARIA non ha risposto in tempo.");

      setMessages(p => p.map(m => m.id === ariaMsg.id ? {
        ...m,
        content: result.summary || "Ecco il risultato:",
        result: result.result,
        steps: result.steps,
        confidence: result.confidence,
        status: "done",
      } : m));

      loadMemoryStats(clientId);

    } catch (err: any) {
      setMessages(p => p.map(m => m.id === ariaMsg.id ? {
        ...m,
        content: `❌ Errore: ${err.message}`,
        status: "error",
      } : m));
    } finally {
      setIsLoading(false);
    }
  }

  async function sendFeedback(
    messageId: string,
    kept: boolean,
    feedback: string,
    outputContent: string,
    outputType: string
  ) {
    if (!activeClientId) return;
    try {
      await fetch(`${API}/aria/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: activeClientId,
          output_type: outputType,
          output_content: outputContent,
          feedback,
          kept,
        }),
      });
      loadMemoryStats(activeClientId);
    } catch (e) { /* silent */ }
  }

  // FIX 3: Triggered when user clicks "Rifai" — sends a proper regeneration task with context
  function handleRegenerate(
    originalMessage: ARIAMessage,
    userFeedback: string,
    outputContent: string,
    outputType: string
  ) {
    const originalTask = originalMessage.originalTask ?? "Crea un copy per Meta Ads";

    const regenTask = `Rigenera il ${outputType} precedente. TASK ORIGINALE: "${originalTask}". ` +
      `Il risultato NON andava bene per questo motivo: "${userFeedback}". ` +
      `Genera una versione completamente diversa, migliorata, tenendo conto del feedback.`;

    sendMessage(regenTask, {
      is_regeneration: true,
      previous_output_type: outputType,
      previous_output: outputContent,
      user_feedback: userFeedback,
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // FIX 1: Reset conversation
  function resetConversation() {
    setLockedClientId(null);
    setSelectedClientId("");
    setMessages([{
      id: "welcome",
      role: "aria",
      content: "Ciao! Sono **ARIA**, il tuo agente AI strategico.\n\nSeleziona il cliente su cui vuoi lavorare, poi assegnami un task — creerò angoli, copy, script o analisi ragionando autonomamente sulle sorgenti disponibili e imparando dai tuoi feedback nel tempo.",
      timestamp: new Date(),
      status: "done",
    }]);
    setMemoryStats(null);
  }

  const selectedClient = clients.find(c => c.id === activeClientId);
  const conversationStarted = messages.length > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>

      {/* Header */}
      <div style={{
        padding: "20px 28px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(4,37,88,0.6)", backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(59,130,246,0.4)"
          }}>
            <SparklesSolid style={{ width: 20, height: 20, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              ARIA <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: 0 }}>Agent</span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
              Ragiona · Genera · Impara
            </div>
          </div>
          {memoryStats && activeClientId && (
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Memoria</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>
                {memoryStats.approval_rate}% successo
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                {memoryStats.outputs_kept}/{memoryStats.total_outputs_generated} approvati · {memoryStats.learned_vocabulary_count} vocaboli
              </div>
            </div>
          )}
        </div>

        {/* FIX 1: Client selector — locks once conversation starts */}
        {!lockedClientId ? (
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: selectedClientId ? "#fff" : "rgba(255,255,255,0.35)", fontSize: 13,
              fontFamily: "inherit", cursor: "pointer", appearance: "none",
            }}
          >
            <option value="">↓ Seleziona il cliente su cui lavorare...</option>
            {clients.map(c => <option key={c.id} value={c.id} style={{ background: "#042558" }}>{c.name}</option>)}
          </select>
        ) : (
          // Locked state: show client name + reset button
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 12px", borderRadius: 8,
            background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LockClosedIcon width={14} style={{ color: "#60a5fa" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>
                {selectedClient?.name ?? "Cliente"}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>— sessione attiva</span>
            </div>
            <button
              onClick={resetConversation}
              style={{
                fontSize: 11, color: "rgba(255,255,255,0.4)", cursor: "pointer",
                background: "none", border: "none", padding: "2px 6px",
                borderRadius: 4, textDecoration: "underline"
              }}
            >
              Cambia cliente
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Quick prompts */}
        {messages.length <= 1 && activeClientId && (
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Task rapidi
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => { setInput(p.task); textareaRef.current?.focus(); }} style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#93c5fd"
                }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display: "flex", gap: 12, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: msg.role === "aria" ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {msg.role === "aria" ? <SparklesSolid style={{ width: 16, height: 16, color: "#fff" }} /> :
                <span style={{ fontSize: 14, color: "#fff" }}>👤</span>}
            </div>

            {/* Bubble */}
            <div style={{ maxWidth: "80%", minWidth: 0 }}>
              <div style={{
                padding: "12px 16px", borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                background: msg.role === "user" ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                border: msg.role === "user" ? "1px solid rgba(59,130,246,0.25)" : "1px solid rgba(255,255,255,0.08)",
              }}>
                {/* Content */}
                {msg.status === "thinking" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="aria-thinking-dots">
                      <span /><span /><span />
                    </div>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>ARIA sta ragionando...</span>
                    <BoltIcon width={14} style={{ color: "#f59e0b", animation: "pulse 1s infinite" }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                    {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
                  </div>
                )}

                {/* Result — FIX 3: pass onRegen callback with message context */}
                {msg.result && msg.role === "aria" && (
                  <ResultRenderer
                    result={msg.result}
                    messageId={msg.id}
                    clientId={activeClientId}
                    onFeedback={(kept, feedback, content, type) =>
                      sendFeedback(msg.id, kept, feedback, content, type)
                    }
                    onRegen={(feedback, content, type) =>
                      handleRegenerate(msg, feedback, content, type)
                    }
                  />
                )}

                {/* Meta */}
                {msg.role === "aria" && msg.status === "done" && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {msg.confidence !== undefined && <ConfidenceBadge score={msg.confidence} />}
                    {msg.steps && <StepsBadge steps={msg.steps} />}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4, paddingLeft: 4 }}>
                {msg.timestamp.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "16px 28px 20px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(4,37,88,0.6)", backdropFilter: "blur(20px)",
      }}>
        {!activeClientId && (
          <div style={{
            textAlign: "center", padding: "10px", borderRadius: 8, marginBottom: 12,
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
            fontSize: 12, color: "#f59e0b", fontWeight: 600,
          }}>
            ⚠️ Seleziona prima un cliente per attivare ARIA
          </div>
        )}
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-end",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14, padding: "10px 10px 10px 16px",
          opacity: activeClientId ? 1 : 0.5,
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={!activeClientId || isLoading}
            placeholder={activeClientId
              ? `Assegna un task ad ARIA per ${selectedClient?.name || "questo cliente"}... (Invio per inviare)`
              : "Seleziona prima un cliente..."}
            rows={2}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#fff", fontSize: 14, resize: "none", fontFamily: "inherit", lineHeight: 1.5,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || !activeClientId || isLoading}
            style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: input.trim() && activeClientId && !isLoading
                ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                : "rgba(255,255,255,0.1)",
              border: "none", cursor: input.trim() && activeClientId && !isLoading ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}
          >
            {isLoading
              ? <ArrowPathIcon width={18} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
              : <PaperAirplaneIcon width={18} style={{ color: "#fff" }} />}
          </button>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 6, textAlign: "center" }}>
          ARIA ragiona in autonomia · il feedback migliora il prossimo output · latenza stimata 20-60s
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .aria-thinking-dots { display: flex; gap: 4px; align-items: center; }
        .aria-thinking-dots span {
          width: 6px; height: 6px; border-radius: 50%;
          background: #3b82f6; animation: thinkBounce 1.2s ease-in-out infinite;
        }
        .aria-thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
        .aria-thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes thinkBounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
      `}</style>
    </div>
  );
}
