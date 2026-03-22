"use client";

import { useState } from "react";
import { ArrowPathIcon, DocumentTextIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface AnalisiStrategicaSectionProps {
    clientId: string;
    apiUrl: string;
}

export default function AnalisiStrategicaSection({ clientId, apiUrl }: AnalisiStrategicaSectionProps) {
    const [analysis, setAnalysis] = useState<any>(null);
    const [generating, setGenerating] = useState(false);
    const [expandedMacros, setExpandedMacros] = useState<Set<number>>(new Set([0]));
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // Fetch analisi esistente
    const fetchAnalysis = async () => {
        try {
            const res = await fetch(`${apiUrl}/clients/${clientId}/analysis/complete`);
            if (res.ok) {
                const data = await res.json();
                setAnalysis(data);
            }
        } catch (error) {
            console.error("Errore caricamento analisi:", error);
        }
    };

    // Genera nuova analisi
    const generateAnalysis = async () => {
        setGenerating(true);
        try {
            const res = await fetch(`${apiUrl}/clients/${clientId}/analysis/complete`, { method: "POST" });
            if (res.ok) {
                const result = await res.json();
                setAnalysis(result.analysis);
            }
        } catch (error) {
            console.error("Errore generazione:", error);
        } finally {
            setGenerating(false);
        }
    };

    // Toggle macro area
    const toggleMacro = (index: number) => {
        const newSet = new Set(expandedMacros);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setExpandedMacros(newSet);
    };

    // Toggle sezione interna
    const toggleSection = (key: string) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedSections(newSet);
    };

    // Render valore intelligente con supporto tabelle e formattazione avanzata
    const renderValue = (value: any, key?: string): React.ReactNode => {
        if (!value) return <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Non disponibile</span>;

        // Gestione stringhe (con supporto markdown base)
        if (typeof value === "string") {
            // Se è un testo lungo, aggiungi più spaziatura
            const lines = value.split('\n');
            return (
                <div style={{ lineHeight: 1.8, marginBottom: 16 }}>
                    {lines.map((line, idx) => {
                        // Supporto base per grassetto **text**
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        return (
                            <p key={idx} style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>
                                {parts.map((part, i) => {
                                    if (part.startsWith('**') && part.endsWith('**')) {
                                        return <strong key={i} style={{ color: "var(--navy)" }}>{part.slice(2, -2)}</strong>;
                                    }
                                    return <span key={i}>{part}</span>;
                                })}
                            </p>
                        );
                    })}
                </div>
            );
        }

        // Gestione array - TABELLE per analisi psicografica
        if (Array.isArray(value)) {
            // Se è analisi psicografica (level_1_primary, level_2_secondary, level_3_tertiary)
            if (key && (key.includes('level_') || key === 'customer_personas')) {
                return (
                    <div style={{ overflowX: "auto", marginTop: 16 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "var(--navy)", color: "white" }}>
                                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>
                                        {key.includes('level_') ? 'Caratteristica' : 'Persona'}
                                    </th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Descrizione</th>
                                    {value[0]?.headline && (
                                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Headline</th>
                                    )}
                                    {value[0]?.subtitle && (
                                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Sottotitolo</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {value.map((item: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "12px", fontWeight: 600, color: "var(--navy)", verticalAlign: "top" }}>
                                            {item.characteristic || item.persona_name || item.name || `Item ${idx + 1}`}
                                        </td>
                                        <td style={{ padding: "12px", lineHeight: 1.6, verticalAlign: "top" }}>
                                            {item.description || item.who || renderValue(item)}
                                        </td>
                                        {item.headline && (
                                            <td style={{ padding: "12px", fontStyle: "italic", color: "var(--text-muted)", verticalAlign: "top" }}>
                                                "{item.headline}"
                                            </td>
                                        )}
                                        {item.subtitle && (
                                            <td style={{ padding: "12px", fontSize: 12, color: "var(--text-muted)", verticalAlign: "top" }}>
                                                {item.subtitle}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }

            // Array normale (non tabella)
            return (
                <ul style={{ margin: "12px 0", paddingLeft: 24, lineHeight: 1.8 }}>
                    {value.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: 12 }}>
                            {typeof item === "object" ? renderValue(item) : item}
                        </li>
                    ))}
                </ul>
            );
        }

        // Gestione oggetti
        if (typeof value === "object") {
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
                    {Object.entries(value).map(([k, v]) => (
                        <div key={k} style={{ paddingLeft: 12, borderLeft: "3px solid var(--lime)", paddingBottom: 12 }}>
                            <strong style={{ color: "var(--navy)", textTransform: "capitalize", fontSize: 14, display: "block", marginBottom: 8 }}>
                                {k.replace(/_/g, " ")}
                            </strong>
                            <div style={{ marginTop: 4, paddingLeft: 8 }}>{renderValue(v, k)}</div>
                        </div>
                    ))}
                </div>
            );
        }

        return String(value);
    };

    // Macro aree con sezioni
    const macroAreas = [
        {
            title: "🏢 BRAND & POSIZIONAMENTO",
            icon: "🏢",
            color: "#3b82f6",
            sections: [
                { key: "brand_identity", label: "1. Brand Identity & Posizionamento" },
                { key: "brand_values", label: "2. Valori del Brand" },
                { key: "brand_voice", label: "8. Brand Voice & Guidelines" },
            ],
        },
        {
            title: "🛍️ PRODOTTI & MERCATO",
            icon: "🛍️",
            color: "#10b981",
            sections: [
                { key: "product_portfolio", label: "3. Portafoglio Prodotti" },
                { key: "product_vertical", label: "7. Analisi Verticale Prodotti" },
                { key: "reasons_to_buy", label: "4. Reasons to Buy (RTB)" },
                { key: "objections", label: "9. Gestione Obiezioni" },
            ],
        },
        {
            title: "👥 PERSONAS & STRATEGIA CONTENUTI",
            icon: "👥",
            color: "#8b5cf6",
            sections: [
                { key: "customer_personas", label: "5. Customer Personas (10 ICP)" },
                { key: "psychographic_analysis", label: "13. Analisi Psicografica (3 livelli)" },
                { key: "content_matrix", label: "6. Matrice Strategia Contenuti" },
                { key: "reviews_voc", label: "10. Voice of Customer (Recensioni)" },
            ],
        },
        {
            title: "⚔️ COMPETITIVE INTELLIGENCE",
            icon: "⚔️",
            color: "#f59e0b",
            sections: [
                { key: "battlecards", label: "11. Competitor Battlecards" },
                { key: "seasonal_roadmap", label: "12. Roadmap Stagionale" },
                { key: "visual_brief", label: "14. Visual Brief" },
            ],
        },
    ];

    // Fetch on mount
    useState(() => {
        fetchAnalysis();
    });

    if (!analysis) {
        return (
            <div style={{ maxWidth: "100%" }}>
                <h1 className="page-title" style={{ marginBottom: 6 }}>Analisi Strategica</h1>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
                    Analisi completa in 14 sezioni divise per macro-aree strategiche
                </p>

                <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                    <DocumentTextIcon style={{ width: 48, height: 48, color: "var(--text-muted)", margin: "0 auto 16px" }} />
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-header)", marginBottom: 8 }}>
                        Analisi Strategica Completa
                    </h3>
                    <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, maxWidth: 500, margin: "0 auto 24px" }}>
                        Genera l&apos;analisi strategica completa in 14 sezioni basata su metodologia Francesco Agostinis per Meta Ads.
                    </p>

                    <div style={{ background: "rgba(149,191,71,0.05)", border: "1px solid rgba(149,191,71,0.2)", borderRadius: 12, padding: "20px", marginBottom: 24, textAlign: "left", maxWidth: 600, margin: "0 auto 24px" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--lime)", marginBottom: 12 }}>✨ Cosa verrà generato:</p>
                        <ul style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
                            <li>Brand Identity & Posizionamento completo (Mission, Tone, Visual Identity)</li>
                            <li>Analisi SWOT aggiornata con dati reali</li>
                            <li>10 Customer Personas dettagliate</li>
                            <li>Competitor Battlecards e strategie</li>
                            <li>Matrice contenuti e angoli comunicativi</li>
                            <li>Voice of Customer da recensioni reali</li>
                            <li>+ altre 8 sezioni strategiche</li>
                        </ul>
                    </div>

                    <div style={{ background: "rgba(255,140,0,0.05)", border: "1px solid rgba(255,140,0,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "var(--orange)" }}>
                        ⏱️ Tempo stimato: <strong>8-12 minuti</strong> • Raccoglie dati da sito, social, recensioni e competitor
                    </div>

                    <button className="btn btn-primary" style={{ fontSize: 15, padding: "14px 32px", fontWeight: 700 }} onClick={generateAnalysis} disabled={generating}>
                        {generating ? (
                            <>
                                <div className="spinner" style={{ width: 14, height: 14 }} />
                                Generazione in corso... (può richiedere 10+ minuti)
                            </>
                        ) : (
                            <>
                                <ArrowPathIcon style={{ width: 15, height: 15 }} />
                                🚀 Genera Analisi Strategica Completa
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
                <div>
                    <h1 className="page-title" style={{ marginBottom: 6 }}>Analisi Strategica</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                        14 sezioni complete — Brand, Prodotti, Personas, Competitive Intelligence
                    </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={generateAnalysis} disabled={generating}>
                    {generating ? (
                        <>
                            <div className="spinner" style={{ width: 12, height: 12 }} />
                            Rigenerando...
                        </>
                    ) : (
                        <>
                            <ArrowPathIcon style={{ width: 13, height: 13 }} />
                            Rigenera
                        </>
                    )}
                </button>
            </div>

            {/* 4 Macro-Aree Accordion */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {macroAreas.map((macro, macroIdx) => {
                    const isExpanded = expandedMacros.has(macroIdx);

                    return (
                        <div key={macroIdx} className="card" style={{ padding: 0, overflow: "hidden" }}>
                            {/* Header Macro Area */}
                            <button
                                onClick={() => toggleMacro(macroIdx)}
                                style={{
                                    width: "100%",
                                    padding: "18px 20px",
                                    border: "none",
                                    background: `linear-gradient(135deg, ${macro.color}15, ${macro.color}05)`,
                                    borderLeft: `4px solid ${macro.color}`,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    transition: "all 0.2s",
                                }}
                            >
                                {isExpanded ? (
                                    <ChevronDownIcon style={{ width: 18, height: 18, color: macro.color }} />
                                ) : (
                                    <ChevronRightIcon style={{ width: 18, height: 18, color: macro.color }} />
                                )}
                                <span style={{ fontSize: 24 }}>{macro.icon}</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: macro.color, flex: 1, textAlign: "left" }}>
                                    {macro.title}
                                </span>
                                <span style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(0,0,0,0.05)", padding: "4px 10px", borderRadius: 12 }}>
                                    {macro.sections.length} sezioni
                                </span>
                            </button>

                            {/* Sezioni interne */}
                            {isExpanded && (
                                <div style={{ padding: "0 20px 20px" }}>
                                    {macro.sections.map((section) => {
                                        const sectionData = analysis[section.key];
                                        const isSectionExpanded = expandedSections.has(section.key);

                                        return (
                                            <div key={section.key} style={{ marginTop: 16, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                                                {/* Header Sezione */}
                                                <button
                                                    onClick={() => toggleSection(section.key)}
                                                    style={{
                                                        width: "100%",
                                                        padding: "14px 16px",
                                                        border: "none",
                                                        background: isSectionExpanded ? "rgba(0,0,0,0.02)" : "#fff",
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 10,
                                                    }}
                                                >
                                                    {isSectionExpanded ? (
                                                        <ChevronDownIcon style={{ width: 16, height: 16, color: "var(--navy)" }} />
                                                    ) : (
                                                        <ChevronRightIcon style={{ width: 16, height: 16, color: "var(--navy)" }} />
                                                    )}
                                                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-header)", flex: 1, textAlign: "left" }}>
                                                        {section.label}
                                                    </span>
                                                </button>

                                                {/* Contenuto Sezione */}
                                                {isSectionExpanded && (
                                                    <div style={{ padding: 16, background: "#fafafa", fontSize: 13, color: "var(--text-dark-primary)" }}>
                                                        {renderValue(sectionData)}
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
