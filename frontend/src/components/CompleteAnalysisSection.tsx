"use client";

import { useState } from "react";
import {
    ChevronDownIcon,
    ChevronRightIcon,
    SparklesIcon,
    ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface CompleteAnalysisSectionProps {
    clientId: string;
    apiUrl: string;
}

export default function CompleteAnalysisSection({ clientId, apiUrl }: CompleteAnalysisSectionProps) {
    const [analysis, setAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0])); // Espandi prima sezione di default

    // Carica analisi esistente
    const loadAnalysis = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/clients/${clientId}/analysis/complete`);
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    setAnalysis(data);
                }
            }
        } catch (err) {
            console.error("Errore caricamento analisi:", err);
        } finally {
            setLoading(false);
        }
    };

    // Genera nuova analisi completa
    const generateAnalysis = async () => {
        if (!confirm("Generare l'analisi completa? Il processo richiede 8-12 minuti.\n\nVerrà analizzato il sito, i dati Instagram, Meta Ads e i documenti caricati.")) {
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch(`${apiUrl}/clients/${clientId}/analysis/complete`, {
                method: "POST",
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.analysis) {
                    setAnalysis(data.analysis);
                    alert("✅ Analisi completa generata con successo!");
                }
            } else {
                const error = await res.json();
                alert(`❌ Errore: ${error.detail || "Errore sconosciuto"}`);
            }
        } catch (err) {
            console.error("Errore generazione analisi:", err);
            alert("❌ Errore durante la generazione dell'analisi");
        } finally {
            setGenerating(false);
        }
    };

    // Toggle sezione expanded
    const toggleSection = (index: number) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedSections(newExpanded);
    };

    // Carica analisi al mount se non già caricata
    useState(() => {
        if (!analysis && !loading) {
            loadAnalysis();
        }
    });

    const sections = [
        { title: "1. Brand Identity & Posizionamento", key: "brand_identity", fields: ["mission", "tono_di_voce", "estetica", "posizionamento", "statement"] },
        { title: "2. Valori del Brand", key: "brand_values", fields: ["inclusivita", "sostenibilita", "formulazioni", "qualita_premium"] },
        { title: "3. Analisi Portafoglio Prodotti", key: "product_portfolio", fields: ["categorie"] },
        { title: "4. Reasons to Buy (RTB)", key: "reasons_to_buy", fields: ["rtb_razionali", "rtb_emotive"] },
        { title: "5. Customer Personas (10 ICP)", key: "customer_personas", array: true },
        { title: "6. Matrice Strategia Contenuti", key: "content_matrix", array: true },
        { title: "7. Analisi Verticale Prodotti", key: "product_vertical", array: true },
        { title: "8. Brand Voice & Communication Guidelines", key: "brand_voice", fields: ["brand_persona", "pilastri_comunicazione", "analisi_linguistica", "glossario", "dos_donts", "strumenti_tattici"] },
        { title: "9. Gestione Obiezioni", key: "objections", fields: ["obiezioni_prezzo", "obiezioni_meccanica", "obiezioni_prodotto", "obiezioni_etica", "formati_risposta"] },
        { title: "10. Voice of Customer (Recensioni)", key: "reviews_voc", fields: ["golden_hooks", "pain_points", "keywords_ricorrenti", "conclusione"] },
        { title: "11. Battlecards Competitor", key: "battlecards", fields: ["competitor_diretto", "gigante_retail", "abitudine_sostituto", "soluzione_definitiva", "cheat_sheet", "idee_ads_comparative"] },
        { title: "12. Roadmap Stagionale", key: "seasonal_roadmap", fields: ["q1_recovery", "q2_preparazione", "q3_peak", "q4_monetizzazione", "consigli_tattici"] },
    ];

    const renderValue = (value: any): React.ReactNode => {
        if (!value) return <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>N/D</span>;

        if (typeof value === "string") {
            return <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{value}</div>;
        }

        if (Array.isArray(value)) {
            return (
                <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                    {value.map((item, i) => (
                        <li key={i} style={{ marginBottom: 8, lineHeight: 1.6 }}>
                            {typeof item === "string" ? item : JSON.stringify(item, null, 2)}
                        </li>
                    ))}
                </ul>
            );
        }

        if (typeof value === "object") {
            return (
                <div style={{ marginTop: 12 }}>
                    {Object.entries(value).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: 6, textTransform: "capitalize" }}>
                                {k.replace(/_/g, " ")}
                            </div>
                            <div style={{ paddingLeft: 16, borderLeft: "2px solid var(--border)" }}>
                                {renderValue(v)}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return String(value);
    };

    const renderSection = (section: any, index: number) => {
        const isExpanded = expandedSections.has(index);
        const data = analysis?.[section.key];
        const hasData = data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);

        return (
            <div key={index} className="card" style={{ marginBottom: 12 }}>
                <button
                    onClick={() => toggleSection(index)}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {isExpanded ? (
                            <ChevronDownIcon style={{ width: 18, height: 18, color: "var(--orange)" }} />
                        ) : (
                            <ChevronRightIcon style={{ width: 18, height: 18, color: "var(--text-muted)" }} />
                        )}
                        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-header)" }}>
                            {section.title}
                        </span>
                    </div>
                    {hasData && (
                        <span style={{ fontSize: 11, color: "var(--lime)", background: "rgba(199,239,0,0.15)", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                            ✓
                        </span>
                    )}
                </button>

                {isExpanded && (
                    <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
                        {!hasData ? (
                            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                                Nessun dato disponibile per questa sezione
                            </div>
                        ) : section.array ? (
                            <div style={{ marginTop: 16 }}>
                                {data.map((item: any, i: number) => (
                                    <div key={i} style={{ marginBottom: 20, padding: 16, background: "rgba(0,0,0,0.02)", borderRadius: 8, border: "1px solid var(--border)" }}>
                                        {renderValue(item)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ marginTop: 16 }}>
                                {section.fields ? (
                                    section.fields.map((field: string) => (
                                        <div key={field} style={{ marginBottom: 20 }}>
                                            <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: 8, textTransform: "capitalize" }}>
                                                {field.replace(/_/g, " ")}
                                            </div>
                                            <div style={{ paddingLeft: 16, borderLeft: "2px solid var(--orange)" }}>
                                                {renderValue(data[field])}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    renderValue(data)
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <h1 className="page-title" style={{ marginBottom: 6, color: "#ffffff" }}>
                Analisi Completa
            </h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 28 }}>
                Analisi strategica completa in 12 sezioni seguendo la metodologia professionale
            </p>

            <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, rgba(255,140,0,0.08), rgba(199,239,0,0.08))", border: "1px solid rgba(255,140,0,0.2)" }}>
                <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-header)", marginBottom: 4 }}>
                            Genera Analisi Strategica Completa
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                            Include: Brand Identity, Valori, Prodotti, RTB, 10 Personas, Content Matrix, Brand Voice, Obiezioni, VoC, Battlecards, Roadmap
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        {analysis && (
                            <button className="btn btn-ghost btn-sm" onClick={loadAnalysis} disabled={loading}>
                                {loading ? (
                                    <div className="spinner" style={{ width: 14, height: 14 }} />
                                ) : (
                                    <ArrowPathIcon style={{ width: 14, height: 14 }} />
                                )}
                                Ricarica
                            </button>
                        )}
                        <button
                            className="btn btn-primary"
                            onClick={generateAnalysis}
                            disabled={generating}
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                            {generating ? (
                                <>
                                    <div className="spinner" style={{ width: 14, height: 14 }} />
                                    Generazione in corso... (8-12 min)
                                </>
                            ) : (
                                <>
                                    <SparklesIcon style={{ width: 16, height: 16 }} />
                                    Genera Analisi Completa
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {generating && (
                <div className="card" style={{ marginBottom: 24, background: "rgba(199,239,0,0.08)", border: "1px solid rgba(199,239,0,0.3)" }}>
                    <div style={{ padding: 20, textAlign: "center" }}>
                        <div className="spinner" style={{ width: 24, height: 24, margin: "0 auto 12px", borderColor: "var(--lime)", borderTopColor: "transparent" }} />
                        <div style={{ fontWeight: 600, color: "var(--lime)", marginBottom: 6 }}>
                            Generazione Analisi in Corso...
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                            Sto analizzando sito web, Instagram, Meta Ads e documenti. Tempo stimato: 8-12 minuti.
                            <br />
                            Puoi chiudere questa pagina, l'analisi continuerà in background.
                        </div>
                    </div>
                </div>
            )}

            {!analysis && !loading && !generating && (
                <div className="card" style={{ padding: 40, textAlign: "center" }}>
                    <SparklesIcon style={{ width: 48, height: 48, color: "var(--orange)", margin: "0 auto 16px", opacity: 0.5 }} />
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
                        Nessuna analisi completa disponibile per questo cliente.
                        <br />
                        Clicca sul pulsante sopra per generarla.
                    </div>
                </div>
            )}

            {analysis && !generating && (
                <div>
                    {sections.map((section, index) => renderSection(section, index))}
                </div>
            )}
        </div>
    );
}
