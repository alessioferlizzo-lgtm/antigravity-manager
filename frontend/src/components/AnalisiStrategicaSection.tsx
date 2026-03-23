"use client";

import { useState, useEffect } from "react";
import { ArrowPathIcon, DocumentTextIcon, ChevronDownIcon, ChevronRightIcon, SparklesIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

interface Props { clientId: string; apiUrl: string; }

// ── Markdown-aware text renderer ──────────────────────────────────────────────
function MD({ text }: { text: string }) {
    if (!text) return null;
    const lines = String(text).split("\n");
    return (
        <div style={{ lineHeight: 1.8 }}>
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <br key={i} />;
                // Bold **text**
                const parts = trimmed.split(/(\*\*.*?\*\*)/g);
                return (
                    <p key={i} style={{ marginBottom: 6 }}>
                        {parts.map((p, j) =>
                            p.startsWith("**") && p.endsWith("**")
                                ? <strong key={j} style={{ color: "var(--navy)" }}>{p.slice(2, -2)}</strong>
                                : <span key={j}>{p}</span>
                        )}
                    </p>
                );
            })}
        </div>
    );
}

// ── Generic object/array fallback ─────────────────────────────────────────────
function GenericValue({ value }: { value: any }) {
    if (value === null || value === undefined) return <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>;
    if (typeof value === "string") return <MD text={value} />;
    if (typeof value === "number" || typeof value === "boolean") return <span>{String(value)}</span>;
    if (Array.isArray(value)) {
        return (
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
                {value.map((item, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                        {typeof item === "object" ? <GenericValue value={item} /> : String(item)}
                    </li>
                ))}
            </ul>
        );
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(value).map(([k, v]) => (
                <div key={k} style={{ paddingLeft: 10, borderLeft: "3px solid var(--lime)", paddingBottom: 8 }}>
                    <strong style={{ fontSize: 12, textTransform: "capitalize", color: "var(--navy)", display: "block", marginBottom: 4 }}>
                        {k.replace(/_/g, " ")}
                    </strong>
                    <GenericValue value={v} />
                </div>
            ))}
        </div>
    );
}

// ── Chip / Tag ────────────────────────────────────────────────────────────────
function Chip({ label, color = "#3b82f6" }: { label: string; color?: string }) {
    return (
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}40`, marginRight: 6, marginBottom: 4 }}>
            {label}
        </span>
    );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function SCard({ children }: { children: React.ReactNode }) {
    return <div style={{ background: "#fafafa", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--border)" }}>{children}</div>;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION-SPECIFIC RENDERERS
// ══════════════════════════════════════════════════════════════════════════════

function BrandIdentityRenderer({ data }: { data: any }) {
    if (!data || typeof data !== "object") return <GenericValue value={data} />;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.mission && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🎯 Mission</div>
                    <MD text={data.mission} />
                    {data.mission_transformation && <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(99,102,241,0.06)", borderRadius: 8, fontSize: 13, color: "#4f46e5" }}><strong>Trasformazione:</strong> {data.mission_transformation}</div>}
                </SCard>
            )}
            {data.tone_of_voice && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🗣️ Tono di Voce</div>
                    {data.tone_of_voice.style && <p style={{ marginBottom: 8 }}><strong>Stile:</strong> {data.tone_of_voice.style}</p>}
                    {data.tone_of_voice.target_audience && <p style={{ marginBottom: 8 }}><strong>Target:</strong> {data.tone_of_voice.target_audience}</p>}
                    {data.tone_of_voice.linguistic_approach && <p style={{ marginBottom: 8 }}><strong>Approccio:</strong> {data.tone_of_voice.linguistic_approach}</p>}
                    {Array.isArray(data.tone_of_voice.vocabulary) && data.tone_of_voice.vocabulary.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <strong style={{ fontSize: 12, display: "block", marginBottom: 6 }}>Vocabolario chiave:</strong>
                            <div>{data.tone_of_voice.vocabulary.map((w: string, i: number) => <Chip key={i} label={w} color="#0ea5e9" />)}</div>
                        </div>
                    )}
                </SCard>
            )}
            {data.positioning && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📊 Posizionamento</div>
                    {data.positioning.market_tier && <Chip label={data.positioning.market_tier} color="#10b981" />}
                    {data.positioning.segment && <p style={{ marginTop: 8, marginBottom: 8 }}>{data.positioning.segment}</p>}
                    {Array.isArray(data.positioning.differentiators) && (
                        <ul style={{ paddingLeft: 18, margin: 0 }}>
                            {data.positioning.differentiators.map((d: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{d}</li>)}
                        </ul>
                    )}
                </SCard>
            )}
            {data.brand_statement && (
                <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(16,185,129,0.08))", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "14px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", marginBottom: 6 }}>✨ BRAND STATEMENT</div>
                    <p style={{ fontStyle: "italic", fontSize: 15, fontWeight: 600, color: "var(--navy)", margin: 0 }}>"{data.brand_statement}"</p>
                </div>
            )}
            {Array.isArray(data.strategic_notes) && data.strategic_notes.length > 0 && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>💡 Note Strategiche</div>
                    <ul style={{ paddingLeft: 18, margin: 0 }}>
                        {data.strategic_notes.map((n: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{n}</li>)}
                    </ul>
                </SCard>
            )}
        </div>
    );
}

function BrandValuesRenderer({ data }: { data: any }) {
    const pillars = data?.brand_pillars || (Array.isArray(data) ? data : null);
    if (!pillars) return <GenericValue value={data} />;
    const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9"];
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {pillars.map((p: any, i: number) => {
                const col = colors[i % colors.length];
                return (
                    <div key={i} style={{ borderLeft: `4px solid ${col}`, paddingLeft: 14, paddingBottom: 10 }}>
                        <div style={{ fontWeight: 700, color: col, fontSize: 14, marginBottom: 6 }}>{p.name || p.pillar || `Pilastro ${i + 1}`}</div>
                        <MD text={p.description || p.content || ""} />
                        {Array.isArray(p.evidence) && p.evidence.length > 0 && (
                            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                                <strong>Evidenze: </strong>{p.evidence.join(" • ")}
                            </div>
                        )}
                        {p.customer_impact && <div style={{ marginTop: 6, padding: "6px 10px", background: `${col}10`, borderRadius: 6, fontSize: 12, color: col }}>👤 {p.customer_impact}</div>}
                    </div>
                );
            })}
        </div>
    );
}

function ProductPortfolioRenderer({ data }: { data: any }) {
    let items: any[] = [];
    if (Array.isArray(data)) {
        items = data;
    } else if (data?.items || data?.products) {
        items = Array.isArray(data.items) ? data.items : data.products;
    } else if (data && typeof data === "object") {
        // Collect from any array fields (e.g. core_products, pre_during_products)
        Object.keys(data).forEach(key => {
            if (Array.isArray(data[key])) {
                items = items.concat(data[key].map((item: any) => ({ ...item, category: item.category || key.replace(/_/g, " ") })));
            }
        });
    }
    
    if (!items || !items.length) return <GenericValue value={data} />;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {items.map((item: any, i: number) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{item.name}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                            {item.category && <Chip label={item.category} color="#94a3b8" />}
                            {item.type && <Chip label={item.type === "service" ? "Servizio" : "Prodotto"} color={item.type === "service" ? "#6366f1" : "#10b981"} />}
                        </div>
                    </div>
                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                        {item.technical_analysis && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>🔬 Analisi Tecnica</div>
                                {item.technical_analysis.description && <MD text={item.technical_analysis.description} />}
                                {item.technical_analysis.technology && <p style={{ marginBottom: 4 }}><strong>Tecnologia:</strong> {item.technical_analysis.technology}</p>}
                                {Array.isArray(item.technical_analysis.key_elements) && <div style={{ marginTop: 4 }}>{item.technical_analysis.key_elements.map((e: string, j: number) => <Chip key={j} label={e} color="#64748b" />)}</div>}
                            </div>
                        )}
                        {item.marketing_strategy && (
                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 6, textTransform: "uppercase" }}>🎯 Strategia</div>
                                {item.marketing_strategy.customer_problem && <div style={{ padding: "6px 10px", background: "rgba(239,68,68,0.06)", borderRadius: 6, marginBottom: 8, fontSize: 13 }}>❗ <strong>Problema cliente:</strong> {item.marketing_strategy.customer_problem}</div>}
                                {Array.isArray(item.marketing_strategy.reasons_to_buy) && (
                                    <ul style={{ paddingLeft: 18, margin: "0 0 8px" }}>
                                        {item.marketing_strategy.reasons_to_buy.map((r: string, j: number) => <li key={j} style={{ marginBottom: 4 }}>{r}</li>)}
                                    </ul>
                                )}
                                {item.marketing_strategy.usp && <div style={{ padding: "6px 10px", background: "rgba(16,185,129,0.06)", borderRadius: 6, fontSize: 13 }}>⭐ <strong>USP:</strong> {item.marketing_strategy.usp}</div>}
                            </div>
                        )}
                        {Array.isArray(item.marketing_hooks) && item.marketing_hooks.length > 0 && (
                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 8, textTransform: "uppercase" }}>🎣 Marketing Hooks</div>
                                {item.marketing_hooks.map((h: string, j: number) => (
                                    <div key={j} style={{ padding: "6px 12px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, marginBottom: 6, fontStyle: "italic", fontSize: 13 }}>"{h}"</div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ReasonsToByRenderer({ data }: { data: any }) {
    const rational = data?.rational || data?.razionali || data?.rtb_rational || [];
    const emotional = data?.emotional || data?.emotivi || data?.rtb_emotional || [];
    const hasLists = Array.isArray(rational) || Array.isArray(emotional);
    if (!hasLists) return <GenericValue value={data} />;
    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9", marginBottom: 10 }}>🧠 Razionali (Logica)</div>
                {(Array.isArray(rational) ? rational : [rational]).map((r: any, i: number) => (
                    <div key={i} style={{ padding: "8px 12px", background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                        {typeof r === "string" ? r : r.description || r.reason || JSON.stringify(r)}
                    </div>
                ))}
            </div>
            <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ec4899", marginBottom: 10 }}>❤️ Emotivi (Cuore)</div>
                {(Array.isArray(emotional) ? emotional : [emotional]).map((e: any, i: number) => (
                    <div key={i} style={{ padding: "8px 12px", background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                        {typeof e === "string" ? e : e.description || e.reason || JSON.stringify(e)}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PersonasRenderer({ data }: { data: any }) {
    let personas = [];
    if (Array.isArray(data)) personas = data;
    else if (data?.personas || data?.customer_personas) personas = Array.isArray(data.personas) ? data.personas : data.customer_personas;
    else if (data && typeof data === "object") personas = Object.values(data).filter(v => v !== null);

    if (!personas || !personas.length) return <GenericValue value={data} />;
    const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {personas.map((p: any, i: number) => {
                const col = colors[i % colors.length];
                if (typeof p !== "object") {
                    return <div key={i} style={{ padding: "12px", border: `1px solid ${col}40`, borderRadius: 8, fontSize: 13 }}>{String(p)}</div>;
                }
                const name = p.who || p.persona_name || p.name || p.type || `Persona ${i + 1}`;
                return (
                    <div key={i} style={{ border: `1px solid ${col}30`, borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ background: `${col}12`, borderBottom: `1px solid ${col}20`, padding: "10px 14px" }}>
                            <div style={{ fontWeight: 700, color: col, fontSize: 14 }}>{name}</div>
                        </div>
                        <div style={{ padding: "10px 14px", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                            {Object.entries(p).filter(([k]) => !['who', 'persona_name', 'name', 'type'].includes(k)).map(([k, v]: [string, any], j) => (
                                <div key={j}>
                                    <strong style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}:</strong> {typeof v === "string" ? v : JSON.stringify(v)}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ContentMatrixRenderer({ data }: { data: any }) {
    const rows = Array.isArray(data) ? data : data?.matrix || data?.rows || [];
    if (!rows.length) return <GenericValue value={data} />;
    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                    <tr style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}>
                        {["ICP Target", "Hook Principale", "Paid Ads Strategy", "Organic Social Strategy"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--navy)", verticalAlign: "top", minWidth: 120 }}>{row.icp || row.persona || row.target || `ICP ${i + 1}`}</td>
                            <td style={{ padding: "10px 12px", fontStyle: "italic", verticalAlign: "top", color: "#6366f1" }}>"{row.hook || row.hook_principale || row.headline || "—"}"</td>
                            <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{row.paid_ads || row.paid || row.paid_strategy || "—"}</td>
                            <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{row.organic_social || row.organic || row.organic_strategy || "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function BrandVoiceRenderer({ data }: { data: any }) {
    if (!data || typeof data !== "object") return <GenericValue value={data} />;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.brand_persona && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", marginBottom: 8 }}>🎭 Brand Persona</div>
                    <MD text={typeof data.brand_persona === "string" ? data.brand_persona : JSON.stringify(data.brand_persona)} />
                </SCard>
            )}
            {(data.communication_pillars || data.pillars || data.i_pilastri) && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", marginBottom: 8 }}>🏛️ Pilastri Comunicazione</div>
                    <GenericValue value={data.communication_pillars || data.pillars || data.i_pilastri} />
                </SCard>
            )}
            {data.glossary && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", marginBottom: 8 }}>📖 Glossario Brand</div>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead><tr style={{ background: "#f1f5f9" }}><th style={{ padding: "8px 12px", textAlign: "left" }}>Invece di...</th><th style={{ padding: "8px 12px", textAlign: "left" }}>Usa...</th></tr></thead>
                            <tbody>
                                {(Array.isArray(data.glossary) ? data.glossary : Object.entries(data.glossary)).map((item: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "8px 12px", color: "#ef4444" }}>{Array.isArray(item) ? item[0] : item.instead_of || item.old}</td>
                                        <td style={{ padding: "8px 12px", color: "#10b981", fontWeight: 600 }}>{Array.isArray(item) ? item[1] : item.use || item.new}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SCard>
            )}
            {data.dos_donts && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <SCard>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>✅ DO</div>
                        <GenericValue value={data.dos_donts.dos || data.dos_donts.do} />
                    </SCard>
                    <SCard>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>❌ DON'T</div>
                        <GenericValue value={data.dos_donts.donts || data.dos_donts.dont} />
                    </SCard>
                </div>
            )}
            {data.emoji_strategy && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>😀 Emoji Strategy</div>
                    <MD text={typeof data.emoji_strategy === "string" ? data.emoji_strategy : JSON.stringify(data.emoji_strategy)} />
                </SCard>
            )}
        </div>
    );
}

function ObjectionsRenderer({ data }: { data: any }) {
    let items: any[] = [];
    if (Array.isArray(data)) {
        items = data;
    } else if (data?.objections || data?.gestione) {
        items = Array.isArray(data.objections) ? data.objections : data.gestione;
    } else if (data && typeof data === "object") {
        // Collect from keys like price_value, mechanics_subscription
        Object.keys(data).forEach(key => {
            if (Array.isArray(data[key])) {
                items = items.concat(data[key].map((obj: any) => ({ ...obj, category: key.replace(/_/g, " ") })));
            }
        });
    }

    if (!items || !items.length) return <GenericValue value={data} />;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map((obj: any, i: number) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ background: "rgba(239,68,68,0.06)", borderBottom: "1px solid rgba(239,68,68,0.15)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>❗ Obiezione #{i + 1}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{obj.user_says || obj.objection || obj.obiezione || obj.title || obj.question}</div>
                        </div>
                        {obj.category && <Chip label={obj.category} color="#ef4444" />}
                    </div>
                    <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.04)" }}>
                        <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, marginBottom: 4 }}>✅ Risposta (Script)</div>
                        <MD text={obj.script || obj.response || obj.risposta || obj.answer || ""} />
                        {(obj.psychological_angle || obj.psychology) && <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(99,102,241,0.08)", borderRadius: 6, fontSize: 12, color: "#6366f1" }}>🧠 Psicologia: {obj.psychological_angle || obj.psychology}</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ReviewsVoCRenderer({ data }: { data: any }) {
    if (!data || typeof data !== "object") return <GenericValue value={data} />;
    const hooks = Array.isArray(data.golden_hooks) ? data.golden_hooks : (Array.isArray(data.hooks) ? data.hooks : []);
    const vocab = Array.isArray(data.key_vocabulary) ? data.key_vocabulary : (typeof data.key_vocabulary === 'string' ? [data.key_vocabulary] : []);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {hooks.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 14 }}>🏆 Golden Hooks (Estrazione Agostinis)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {hooks.map((h: any, i: number) => {
                            if (typeof h === "string") {
                                return <div key={i} style={{ padding: "10px", background: "rgba(245,158,11,0.06)", borderRadius: 8, fontSize: 13 }}>"{h}"</div>;
                            }
                            return (
                                <div key={i} style={{ border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, overflow: "hidden" }}>
                                    <div style={{ background: "rgba(245,158,11,0.1)", padding: "8px 12px", borderBottom: "1px solid rgba(245,158,11,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontWeight: 700, color: "#d97706", fontSize: 13 }}>Gancio: {h.hook || `Hook #${i + 1}`}</div>
                                        {h.source && <div style={{ fontSize: 11, background: "#fff", padding: "2px 8px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", color: "#b45309" }}>{h.source}</div>}
                                    </div>
                                    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
                                        <div style={{ fontSize: 13, fontStyle: "italic", color: "var(--navy)", borderLeft: "3px solid #f59e0b", paddingLeft: 10 }}>
                                            "{h.verbatim || h.text || h.quote || "Nessuna citazione letterale trovata"}"
                                        </div>
                                        {h.marketing_use && (
                                            <div style={{ fontSize: 12, color: "#475569", display: "flex", gap: 6 }}>
                                                <span>💡</span> <span><strong>Pubblicità:</strong> {h.marketing_use}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {data.pain_points && Array.isArray(data.pain_points) && data.pain_points.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", marginBottom: 14 }}>🔴 Pain Points (Lamentele & Obiezioni)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {data.pain_points.map((p: any, i: number) => (
                            <div key={i} style={{ border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderBottom: "1px solid rgba(239,68,68,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontWeight: 700, color: "#b91c1c", fontSize: 13 }}>Gancio a contrasto: {p.pain || `Dolore #${i + 1}`}</div>
                                    {p.source && <div style={{ fontSize: 11, background: "#fff", padding: "2px 8px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", color: "#b91c1c" }}>{p.source}</div>}
                                </div>
                                <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{ fontSize: 13, fontStyle: "italic", color: "var(--navy)", borderLeft: "3px solid #ef4444", paddingLeft: 10 }}>
                                        "{p.verbatim || "Citazione non disponibile"}"
                                    </div>
                                    {p.marketing_use && (
                                        <div style={{ fontSize: 12, color: "#475569", display: "flex", gap: 6 }}>
                                            <span>💡</span> <span><strong>Copy Ads:</strong> {p.marketing_use}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {data.sentiment_analysis && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", marginBottom: 8 }}>📊 Sentiment</div>
                    <GenericValue value={data.sentiment_analysis} />
                </SCard>
            )}
            {vocab.length > 0 && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", marginBottom: 8 }}>💬 Vocabolario Reale</div>
                    <div>{vocab.map((v: string, i: number) => <Chip key={i} label={v} color="#8b5cf6" />)}</div>
                </SCard>
            )}
            {data.recurring_patterns && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", marginBottom: 8 }}>🔄 Pattern Ricorrenti</div>
                    <GenericValue value={data.recurring_patterns} />
                </SCard>
            )}
        </div>
    );
}

function BattlecardsRenderer({ data }: { data: any }) {
    let cards: any[] = [];
    if (Array.isArray(data)) {
        cards = data;
    } else if (data?.battlecards || data?.competitors) {
        cards = Array.isArray(data.battlecards) ? data.battlecards : data.competitors;
    } else if (data && typeof data === "object") {
        // AI returns dict like {"direct_competitor": {...}, "retail_giant": {...}, etc.}
        cards = Object.values(data).filter(v => v && typeof v === "object" && !Array.isArray(v));
    }

    if (!cards || !cards.length) return <GenericValue value={data} />;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {cards.map((card: any, i: number) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>⚔️ {card.who || card.competitor || card.name || `Competitor ${i + 1}`}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "12px 16px", gap: 12 }}>
                        {(card.strength || card.their_strengths) && <div><div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 4, textTransform: "uppercase" }}>💪 Punto di Forza Apparente</div><div style={{ fontSize: 13 }}>{card.strength || card.their_strengths}</div></div>}
                        {(card.weakness || card.their_weaknesses) && <div><div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 4, textTransform: "uppercase" }}>🎯 Vero Punto Debole</div><div style={{ fontSize: 13 }}>{card.weakness || card.their_weaknesses}</div></div>}
                        {(card.our_move || card.our_differentiators) && <div><div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", marginBottom: 4, textTransform: "uppercase" }}>⭐ La Nostra Mossa Vincente</div><div style={{ fontSize: 13 }}>{card.our_move || card.our_differentiators}</div></div>}
                    </div>
                    {(card.script || card.strategy) && (
                        <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.06)", borderTop: "1px solid rgba(245,158,11,0.15)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 4, textTransform: "uppercase" }}>💬 Script (Copy & Incolla)</div>
                            <div style={{ fontSize: 13, fontStyle: "italic", color: "#92400e" }}>"{card.script || card.strategy}"</div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function SeasonalRoadmapRenderer({ data }: { data: any }) {
    if (!data || typeof data !== "object") return <GenericValue value={data} />;
    
    // Extract the 4 quarters
    const quartersArray: any[] = [];
    Object.entries(data).forEach(([k, v]: [string, any]) => {
        if (k.startsWith("q") && v && typeof v === "object" && !Array.isArray(v)) {
            quartersArray.push({ id: k.replace(/_/g, " ").toUpperCase(), ...v });
        }
    });

    if (quartersArray.length === 0) return <GenericValue value={data} />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                {quartersArray.map((q: any, i: number) => (
                    <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                        <div style={{ background: "linear-gradient(135deg, #10b981, #059669)", padding: "12px 16px" }}>
                            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>📅 {q.id}</div>
                            {q.theme && <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 4 }}>Tema: {q.theme}</div>}
                        </div>
                        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
                            {q.hero_product && (
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>🏆 Hero Product</div>
                                    <div style={{ fontWeight: 600, color: "var(--navy)" }}>{q.hero_product}</div>
                                </div>
                            )}
                            {q.strategy && (
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>⚡ Strategia / Promo</div>
                                    <div>{q.strategy}</div>
                                </div>
                            )}
                            {q.target && (
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>🎯 Target (ICP)</div>
                                    <div>{q.target}</div>
                                </div>
                            )}
                            {q.hook_content && (
                                <div style={{ background: "rgba(16,185,129,0.06)", padding: "10px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)" }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", marginBottom: 4 }}>💡 Hook & Content Idea</div>
                                    <div style={{ fontStyle: "italic", color: "#065f46" }}>"{q.hook_content}"</div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {data.execution_tips && Array.isArray(data.execution_tips) && data.execution_tips.length > 0 && (
                <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "16px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 8 }}>📌 Tattiche di Esecuzione</div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--navy)", display: "flex", flexDirection: "column", gap: 6 }}>
                        {data.execution_tips.map((tip: any, idx: number) => <li key={idx}>{tip}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}

function PsychographicRenderer({ data }: { data: any }) {
    if (!data || typeof data !== "object") return <GenericValue value={data} />;
    
    // The AI might output keys like level_1_primary, level_2_secondary or any random dict.
    const sections = Object.entries(data).filter(([_, v]) => v !== null && (Array.isArray(v) || typeof v === "object"));
    if (sections.length === 0) return <GenericValue value={data} />;

    const colors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"];
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {sections.map(([key, items], idx) => {
                const arr = Array.isArray(items) ? items : [items];
                const color = colors[idx % colors.length];
                const label = key.replace(/_/g, " ").toUpperCase();
                return (
                    <div key={key}>
                        <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 10 }}>{label}</div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead><tr style={{ background: `${color}10` }}>
                                    {["Caratteristica", "Descrizione", "💡 Headline Promozionale"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color, borderBottom: `2px solid ${color}30` }}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {arr.map((item: any, i: number) => {
                                        if (typeof item !== "object") {
                                            return (
                                                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <td colSpan={3} style={{ padding: "8px 12px" }}>{String(item)}</td>
                                                </tr>
                                            );
                                        }
                                        // The AI might use "characteristic" or "trait" or "name", etc.
                                        const attrKey = Object.keys(item).find(k => k.match(/characteristic|trait|name|caratteristica|titolo|target/i)) || Object.keys(item)[0];
                                        const descKey = Object.keys(item).find(k => k.match(/description|descrizione|detail|drive/i)) || Object.keys(item)[1];
                                        const promoKey = Object.keys(item).find(k => k.match(/promo|headline|hook/i));
                                        
                                        return (
                                            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                                <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--navy)", verticalAlign: "top", width: "25%" }}>
                                                    {attrKey ? String(item[attrKey]) : `${i + 1}`}
                                                </td>
                                                <td style={{ padding: "10px 12px", verticalAlign: "top", width: "45%" }}>
                                                    {descKey ? String(item[descKey]) : ""}
                                                </td>
                                                <td style={{ padding: "10px 12px", verticalAlign: "top", width: "30%", fontStyle: "italic", color: "#64748b" }}>
                                                    {promoKey ? `"${String(item[promoKey])}"` : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function VisualBriefRenderer({ data }: { data: any }) {
    if (!data || typeof data !== "object") return <GenericValue value={data} />;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.color_palette && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ec4899", textTransform: "uppercase", marginBottom: 10 }}>🎨 Palette Colori</div>
                    {Array.isArray(data.color_palette) ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                            {data.color_palette.map((c: any, i: number) => {
                                const hex = typeof c === "string" ? c : c.color || c.hex || "#cccccc";
                                const label = typeof c === "string" ? c : c.name || c.label || hex;
                                return (
                                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: 8, background: hex, border: "2px solid rgba(0,0,0,0.1)" }} />
                                        <span style={{ fontSize: 10, fontFamily: "monospace" }}>{label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <MD text={String(data.color_palette)} />}
                </SCard>
            )}
            {(data.visual_style || data.style) && (
                <SCard>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", marginBottom: 8 }}>🖼️ Stile Visivo</div>
                    <MD text={typeof (data.visual_style || data.style) === "string" ? (data.visual_style || data.style) : JSON.stringify(data.visual_style || data.style)} />
                </SCard>
            )}
            {data.mood_board && <SCard><div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>🌟 Mood Board</div><GenericValue value={data.mood_board} /></SCard>}
            {data.ad_formats && <SCard><div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", marginBottom: 8 }}>📐 Formati Consigliati</div><GenericValue value={data.ad_formats} /></SCard>}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MACRO-AREAS CONFIG
// ══════════════════════════════════════════════════════════════════════════════

const MACRO_AREAS = [
    {
        title: "🏢 Brand & Posizionamento",
        color: "#6366f1",
        sections: [
            { key: "brand_identity", label: "1. Brand Identity & Posizionamento", Renderer: BrandIdentityRenderer },
            { key: "brand_values", label: "2. Valori del Brand (Brand Pillars)", Renderer: BrandValuesRenderer },
            { key: "brand_voice", label: "8. Brand Voice & Communication", Renderer: BrandVoiceRenderer },
        ],
    },
    {
        title: "🛍️ Prodotti & Mercato",
        color: "#10b981",
        sections: [
            { key: "product_portfolio", label: "3. Portafoglio Prodotti/Servizi", Renderer: ProductPortfolioRenderer },
            { key: "product_vertical", label: "7. Analisi Verticale Prodotti", Renderer: ProductPortfolioRenderer },
            { key: "reasons_to_buy", label: "4. Reasons to Buy (RTB)", Renderer: ReasonsToByRenderer },
            { key: "objections", label: "9. Gestione Obiezioni", Renderer: ObjectionsRenderer },
        ],
    },
    {
        title: "👥 Personas & Contenuti",
        color: "#8b5cf6",
        sections: [
            { key: "customer_personas", label: "5. Customer Personas (10 ICP)", Renderer: PersonasRenderer },
            { key: "psychographic_analysis", label: "13. Analisi Psicografica (3 Livelli)", Renderer: PsychographicRenderer },
            { key: "content_matrix", label: "6. Matrice Strategia Contenuti", Renderer: ContentMatrixRenderer },
            { key: "reviews_voc", label: "10. Voice of Customer (Recensioni)", Renderer: ReviewsVoCRenderer },
        ],
    },
    {
        title: "⚔️ Competitive Intelligence",
        color: "#f59e0b",
        sections: [
            { key: "battlecards", label: "11. Competitor Battlecards", Renderer: BattlecardsRenderer },
            { key: "seasonal_roadmap", label: "12. Roadmap Stagionale (12 mesi)", Renderer: SeasonalRoadmapRenderer },
        ],
    },
];

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function AnalisiStrategicaSection({ clientId, apiUrl }: Props) {
    const [analysis, setAnalysis] = useState<any>(null);
    const [generating, setGenerating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedMacros, setExpandedMacros] = useState<Set<number>>(new Set([0]));
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [generationStatus, setGenerationStatus] = useState<string>("");
    const [sectionLoading, setSectionLoading] = useState<Record<string, boolean>>({});

    // ── Fetch on mount ─────────────────────────────────────────────────────────
    useEffect(() => {
        fetchAnalysis();
    }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchAnalysis = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/clients/${clientId}/analysis/complete`);
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data === "object" && Object.keys(data).length > 0) {
                    setAnalysis(data);
                }
            }
        } catch (e) { /* ignore */ }
        setLoading(false);
    };

    const generateAnalysis = async () => {
        setGenerating(true);
        // Svuota subito l'analisi vecchia per non mostrare dati obsoleti
        setAnalysis(null);
        setGenerationStatus("Raccolta dati: sito web, social, recensioni e competitor…");
        const steps = [
            "🔍 Analisi sito web e contenuti…",
            "📸 Elaborazione dati Instagram…",
            "⭐ Analisi recensioni Google…",
            "📊 Lettura Meta Ads delle inserzioni competitor…",
            "🏢 Generazione Brand Identity…",
            "🧠 Creazione Customer Personas…",
            "📈 Matrice contenuti e angoli…",
            "⚔️ Battlecard competitor…",
            "📅 Roadmap stagionale…",
        ];
        let step = 0;
        const interval = setInterval(() => {
            step = (step + 1) % steps.length;
            setGenerationStatus(steps[step]);
        }, 15000);
        try {
            const res = await fetch(`${apiUrl}/clients/${clientId}/analysis/complete`, { method: "POST" });
            if (res.ok) {
                const result = await res.json();
                setAnalysis(result.analysis || result);
            }
        } catch (e) { /* ignore */ }
        clearInterval(interval);
        setGenerating(false);
        setGenerationStatus("");
    };

    const handleRegenerateSection = async (e: React.MouseEvent, stepId: string) => {
        e.preventDefault();
        e.stopPropagation();

        console.log(`[Regenerate] Starting for ${stepId}`);
        setSectionLoading(prev => ({ ...prev, [stepId]: true }));
        try {
            const res = await fetch(`${apiUrl}/clients/${clientId}/analysis/regenerate/${stepId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            if (res.ok) {
                const result = await res.json();
                console.log(`[Regenerate] Success:`, result);
                // Aggiorna lo stato locale con i nuovi dati
                if (result.new_data) {
                    setAnalysis((prev: any) => ({ ...prev, [stepId]: result.new_data }));
                } else if (result.analysis_step) {
                    setAnalysis((prev: any) => ({ ...prev, [stepId]: result.analysis_step }));
                } else if (result.analysis) {
                    setAnalysis(result.analysis);
                }
                // Nessun alert - l'UI si aggiorna automaticamente
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error(`[Regenerate] Error:`, res.status, errorData);
            }
        } catch (e) {
            console.error(`[Regenerate] Network Error:`, e);
        }
        setSectionLoading(prev => ({ ...prev, [stepId]: false }));
    };

    const toggleMacro = (i: number) => {
        const s = new Set(expandedMacros);
        s.has(i) ? s.delete(i) : s.add(i);
        setExpandedMacros(s);
    };

    const toggleSection = (key: string) => {
        const s = new Set(expandedSections);
        s.has(key) ? s.delete(key) : s.add(key);
        setExpandedSections(s);
    };

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
                <div className="spinner" style={{ width: 20, height: 20 }} />
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Caricamento analisi…</span>
            </div>
        );
    }

    // ── Empty state ────────────────────────────────────────────────────────────
    if (!analysis) {
        return (
            <div style={{ maxWidth: "100%" }}>
                <h1 className="page-title" style={{ marginBottom: 6 }}>Analisi Strategica</h1>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
                    Analisi completa in 14 sezioni — Brand, Prodotti, Personas, Competitive Intelligence
                </p>
                <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
                    <DocumentTextIcon style={{ width: 52, height: 52, color: "var(--text-muted)", margin: "0 auto 16px" }} />
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-header)", marginBottom: 8 }}>Nessuna analisi generata</h3>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, maxWidth: 520, margin: "0 auto 24px" }}>
                        Genera l&apos;analisi strategica completa in 14 sezioni basata sulla metodologia Francesco Agostinis per Meta Ads.
                    </p>
                    <div style={{ background: "rgba(149,191,71,0.05)", border: "1px solid rgba(149,191,71,0.2)", borderRadius: 12, padding: 20, marginBottom: 24, textAlign: "left", maxWidth: 560, margin: "0 auto 24px" }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--lime)", marginBottom: 10 }}>✨ Cosa verrà generato:</p>
                        <ul style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
                            {["Brand Identity & Posizionamento completo", "10 Customer Personas dettagliate (ICP)", "Competitor Battlecards", "Matrice contenuti Paid & Organic", "Voice of Customer da recensioni reali", "Roadmap stagionale 12 mesi", "+ altre 8 sezioni strategiche"].map(l => <li key={l}>{l}</li>)}
                        </ul>
                    </div>
                    <div style={{ background: "rgba(255,140,0,0.05)", border: "1px solid rgba(255,140,0,0.2)", borderRadius: 8, padding: "10px 16px", marginBottom: 24, fontSize: 12, color: "var(--orange)", maxWidth: 560, margin: "0 auto 24px" }}>
                        ⏱️ Tempo stimato: <strong>4-8 minuti</strong> • AI parallele orchestrate per velocità massima
                    </div>
                    <button className="btn btn-primary" style={{ fontSize: 15, padding: "14px 36px", fontWeight: 700 }} onClick={generateAnalysis} disabled={generating}>
                        {generating ? (<><div className="spinner" style={{ width: 14, height: 14 }} />{generationStatus || "Generazione in corso…"}</>) : (<><SparklesIcon style={{ width: 16, height: 16 }} />🚀 Genera Analisi Strategica Completa</>)}
                    </button>
                </div>
            </div>
        );
    }

    // ── Generated progress bar (during regeneration) ───────────────────────────
    const generatingOverlay = generating && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "var(--navy)", color: "#fff", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", zIndex: 1000, maxWidth: 360 }}>
            <div className="spinner" style={{ width: 16, height: 16, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "var(--lime)" }} />
            <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--lime)" }}>Rigenerazione in corso</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{generationStatus}</div>
            </div>
        </div>
    );

    // ── Completion badge ───────────────────────────────────────────────────────
    const allSections = MACRO_AREAS.flatMap(m => m.sections);
    const filledCount = allSections.filter(s => analysis[s.key] && (typeof analysis[s.key] !== "object" || Object.keys(analysis[s.key]).length > 0 || Array.isArray(analysis[s.key]))).length;

    return (
        <div style={{ maxWidth: "100%" }}>
            {generatingOverlay}

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
                <div>
                    <h1 className="page-title" style={{ marginBottom: 4 }}>Analisi Strategica</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <CheckCircleIcon style={{ width: 14, height: 14, color: "#10b981" }} />
                        <span>{filledCount}/{allSections.length} sezioni complete</span>
                        <span style={{ color: "var(--border)" }}>•</span>
                        <span>Metodologia Francesco Agostinis</span>
                    </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={generateAnalysis} disabled={generating}>
                    <ArrowPathIcon style={{ width: 13, height: 13 }} />{generating ? "Rigenerando…" : "Rigenera"}
                </button>
            </div>

            {/* Macro areas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {MACRO_AREAS.map((macro, macroIdx) => {
                    const isExpanded = expandedMacros.has(macroIdx);
                    const filledInMacro = macro.sections.filter(s => analysis[s.key]).length;
                    return (
                        <div key={macroIdx} className="card" style={{ padding: 0, overflow: "hidden" }}>
                            <div onClick={() => toggleMacro(macroIdx)} style={{ width: "100%", padding: "16px 20px", border: "none", background: `linear-gradient(135deg, ${macro.color}14, ${macro.color}06)`, borderLeft: `4px solid ${macro.color}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}>
                                {isExpanded ? <ChevronDownIcon style={{ width: 18, height: 18, color: macro.color }} /> : <ChevronRightIcon style={{ width: 18, height: 18, color: macro.color }} />}
                                <span style={{ fontSize: 15, fontWeight: 700, color: macro.color, flex: 1, textAlign: "left" }}>{macro.title}</span>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", background: "rgba(0,0,0,0.06)", padding: "3px 10px", borderRadius: 12 }}>
                                    {filledInMacro}/{macro.sections.length} sezioni
                                </span>
                            </div>

                            {isExpanded && (
                                <div style={{ padding: "0 16px 16px" }}>
                                    {macro.sections.map(({ key, label, Renderer }) => {
                                        const sectionData = analysis[key];
                                        const isOpen = expandedSections.has(key);
                                        const hasData = sectionData && (typeof sectionData !== "object" || Object.keys(sectionData).length > 0 || (Array.isArray(sectionData) && sectionData.length > 0));
                                        return (
                                            <div key={key} style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                                                <div onClick={() => toggleSection(key)} style={{ width: "100%", padding: "12px 16px", border: "none", background: isOpen ? "rgba(0,0,0,0.02)" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                                                    {isOpen ? <ChevronDownIcon style={{ width: 15, height: 15, color: "var(--navy)" }} /> : <ChevronRightIcon style={{ width: 15, height: 15, color: "var(--navy)" }} />}
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-header)", flex: 1, textAlign: "left" }}>{label}</span>
                                                    
                                                    {sectionLoading[key] ? (
                                                        <div className="spinner" style={{ width: 14, height: 14 }} />
                                                    ) : (
                                                        <button 
                                                            className="btn-icon" 
                                                            title="Rigenera solo questa sezione"
                                                            onClick={(e) => handleRegenerateSection(e, key)}
                                                            style={{ padding: 4, borderRadius: 4, color: "var(--text-muted)", hover: { background: "rgba(0,0,0,0.05)", color: "var(--lime)" } } as any}
                                                        >
                                                            <ArrowPathIcon style={{ width: 14, height: 14 }} />
                                                        </button>
                                                    )}

                                                    {hasData ? (
                                                        <CheckCircleIcon style={{ width: 15, height: 15, color: "#10b981" }} />
                                                    ) : (
                                                        <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 8 }}>Non generata</span>
                                                    )}
                                                </div>
                                                {isOpen && (
                                                    <div style={{ padding: 16, background: "#fafafa", fontSize: 13, color: "var(--text-dark-primary)", borderTop: "1px solid var(--border)" }}>
                                                        {hasData
                                                            ? <Renderer data={sectionData} />
                                                            : (
                                                                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>
                                                                    Questa sezione non è ancora stata generata. Clicca &quot;Rigenera&quot; per generare l&apos;analisi completa.
                                                                </div>
                                                            )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
