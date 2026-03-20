"use client";

import { useState, useEffect, use, useRef } from "react";
import {
    ArrowLeftIcon,
    UserGroupIcon,
    PaintBrushIcon,
    IdentificationIcon,
    DocumentIcon,
    TrashIcon,
    ArrowPathIcon,
    BoltIcon,
    FireIcon,
    PhotoIcon,
    PlusIcon,
    PencilSquareIcon,
    SwatchIcon,
    SparklesIcon,

    ShieldExclamationIcon,
    RocketLaunchIcon,
    ExclamationTriangleIcon,
    LinkIcon,
    MagnifyingGlassIcon,
    ChartBarIcon,
    CheckIcon,
    EyeIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

const API = process.env.NEXT_PUBLIC_API_URL || "${API}";

type SectionType = "sorgenti" | "identita" | "analisi" | "personas" | "reports" | "ads" | "intelligence";


interface Report {
    id: string; created_at: string; period_label?: string;
    budget_speso?: string; roas?: string; ctr?: string; cpc?: string; cpm?: string;
    conversioni?: string; revenue?: string; reach?: string; impressions?: string;
    note?: string; best_angles?: string; best_creatives?: string; best_copy?: string;
    ai_report?: string;
}


/* ─── FormatText: converts AI text into clean JSX ─── */
function FormatText({ text }: { text: any }) {
    if (!text) return null;
    
    const stringifyValue = (val: any): string => {
        if (!val) return "";
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return val.map(i => stringifyValue(i)).join("\n");
        if (typeof val === 'object') {
            return Object.entries(val)
                .map(([k, v]) => {
                    const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
                    const subValue = typeof v === 'string' ? v : (Array.isArray(v) ? v.join(", ") : JSON.stringify(v));
                    return `**${label}**: ${subValue}`;
                })
                .join("\n");
        }
        return String(val);
    };

    let content = "";
    if (typeof text === 'string') {
        content = text;
    } else if (typeof text === 'object') {
        content = Object.entries(text)
            .map(([k, v]) => {
                const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
                const value = stringifyValue(v);
                return `### ${label}\n${value}`;
            })
            .join("\n\n");
    } else {
        content = String(text);
    }
    
    // Normalize newlines and handle potential escaped \n from AI JSON
    const cleanText = content.replace(/\\n/g, "\n");
    const lines = cleanText.split("\n");

    const renderInline = (s: string) => {
        const parts = s.split(/\*\*(.*?)\*\*/g);
        return parts.map((p, j) =>
            j % 2 === 1
                ? <strong key={j} style={{ color: "var(--navy)", fontWeight: 700 }}>{p}</strong>
                : <span key={j}>{p}</span>
        );
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lines.map((line, i) => {
                const t = line.trim();
                // Increased spacing for empty lines to avoid "stuck together" look
                if (!t) return <div key={i} style={{ height: 16 }} />;
                
                if (/^-{3,}$/.test(t)) return <hr key={i} style={{ border: 0, borderTop: "1px solid var(--border)", margin: "20px 0" }} />;

                const hm = t.match(/^(#{1,3})\s+(.+)$/);
                if (hm) {
                    const level = hm[1].length;
                    const fontSize = level === 1 ? 20 : (level === 2 ? 17 : 14);
                    const marginTop = level === 1 ? 24 : (level === 2 ? 18 : 12);
                    return (
                        <p key={i} style={{ fontWeight: 800, color: "var(--navy)", fontSize, marginTop, marginBottom: 8, letterSpacing: "-0.01em" }}>
                            {renderInline(hm[2])}
                        </p>
                    );
                }

                // ALL CAPS section name from AI
                if (/^[A-ZÀÈÉÌÒÙ\s]{4,}$/.test(t) && t.length < 60 && t.length > 3)
                    return (
                        <p key={i} style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--orange)", marginTop: 20, marginBottom: 8 }}>
                            {t}
                        </p>
                    );

                if (t.startsWith("- ") || t.startsWith("• ") || t.startsWith("* ")) {
                    const content = t.replace(/^[-•*]\s+/, "");
                    return (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginLeft: 4, marginBottom: 6 }}>
                            <span style={{ color: "var(--orange)", marginTop: 4, flexShrink: 0, fontSize: 16 }}>•</span>
                            <span style={{ flex: 1, lineHeight: 1.7, color: "var(--text-main)" }}>{renderInline(content)}</span>
                        </div>
                    );
                }

                const nm = t.match(/^(\d+)[.)]\s+(.+)$/);
                if (nm) return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginLeft: 4, marginBottom: 6 }}>
                        <span style={{ color: "var(--orange)", fontWeight: 800, fontSize: 13, minWidth: 24, textAlign: "right", flexShrink: 0, marginTop: 2 }}>{nm[1]}.</span>
                        <span style={{ flex: 1, lineHeight: 1.7, color: "var(--text-main)" }}>{renderInline(nm[2])}</span>
                    </div>
                );

                return <p key={i} style={{ lineHeight: 1.7, marginBottom: 8, color: "var(--text-main)" }}>{renderInline(t)}</p>;
            })}
        </div>
    );
}


/* ─── ShopifyCard: connessione Shopify via OAuth o token manuale ─── */
function ShopifyCard({ clientId, client, setClient }: { clientId: string; client: any; setClient: any }) {
    const [manualMode, setManualMode] = useState(false);
    const [manualShop, setManualShop] = useState("");
    const [manualToken, setManualToken] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const connected = !!client.shopify_token;

    const saveManual = async () => {
        if (!manualShop || !manualToken) return;
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`${API}/clients/${clientId}/shopify/token`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shop: manualShop, access_token: manualToken }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.detail || "Errore salvataggio token"); return; }
            setClient((p: any) => ({ ...p, shopify_token: manualToken, shopify_domain: data.shop }));
            setManualMode(false);
            setManualToken("");
        } catch (e: any) {
            setError("Errore di rete");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card" style={{ marginBottom: 16, border: connected ? "1px solid rgba(149,191,71,0.3)" : "1px solid var(--border)" }}>
            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>🛍️</span> Shopify
                {connected && (
                    <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginLeft: 4 }}>● Connesso — {client.shopify_domain}</span>
                )}
            </span>

            {connected ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Store connesso. Ordini e clienti disponibili.</span>
                    <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                        onClick={async () => {
                            await fetch(`${API}/clients/${clientId}/shopify`, { method: "DELETE" });
                            setClient((p: any) => ({ ...p, shopify_token: "", shopify_domain: "" }));
                        }}
                    >Disconnetti</button>
                </div>
            ) : !manualMode ? (
                <>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                        Collega lo store Shopify per accedere a ordini, clienti e dati da incrociare con Meta Ads.
                    </p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                        <input
                            className="input"
                            style={{ maxWidth: 280 }}
                            placeholder="Es: nevohlab.myshopify.com"
                            value={client.shopify_domain || ""}
                            onChange={e => setClient((p: any) => ({ ...p, shopify_domain: e.target.value }))}
                        />
                        <button
                            className="btn btn-primary btn-sm"
                            disabled={!client.shopify_domain}
                            onClick={() => {
                                const shop = (client.shopify_domain || "").trim();
                                if (shop) window.location.href = `${API}/shopify/install?client_id=${clientId}&shop=${shop}`;
                            }}
                        >
                            <LinkIcon style={{ width: 14, height: 14 }} /> Connetti via OAuth
                        </button>
                    </div>
                    <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: "var(--text-muted)" }}
                        onClick={() => setManualMode(true)}
                    >
                        Inserisci token manualmente →
                    </button>
                </>
            ) : (
                <>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                        Incolla il token da una Custom App Shopify o da accesso collaboratore.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
                        <input
                            className="input"
                            placeholder="negozio.myshopify.com"
                            value={manualShop}
                            onChange={e => setManualShop(e.target.value)}
                        />
                        <input
                            className="input"
                            placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                            value={manualToken}
                            onChange={e => setManualToken(e.target.value)}
                            type="password"
                        />
                        {error && <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>}
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                className="btn btn-primary btn-sm"
                                disabled={saving || !manualShop || !manualToken}
                                onClick={saveManual}
                            >
                                {saving ? "Verifica..." : "Salva Token"}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setManualMode(false); setError(""); }}>
                                Annulla
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}


const DATE_PRESET_OPTIONS = [
    { value: "last_7d", label: "Ultimi 7 giorni" },
    { value: "last_14d", label: "Ultimi 14 giorni" },
    { value: "last_30d", label: "Ultimi 30 giorni" },
    { value: "last_month", label: "Mese scorso" },
    { value: "this_month", label: "Mese corrente" },
    { value: "last_quarter", label: "Ultimo trimestre" },
];

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    const [client, setClient] = useState<any>({});
    const [researchContent, setResearchContent] = useState("");
    const [files, setFiles] = useState<string[]>([]);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [section, setSection] = useState<SectionType>("sorgenti");
    const [editing, setEditing] = useState<Record<string, boolean>>({});
    const [newLink, setNewLink] = useState("");
    const [newLinkDesc, setNewLinkDesc] = useState("");
    const [newCompetitor, setNewCompetitor] = useState("");
    const [newCompetitorUrl, setNewCompetitorUrl] = useState("");
    const [newCompetitorType, setNewCompetitorType] = useState("");
    const [selectedCompIdx, setSelectedCompIdx] = useState<number | null>(null);
    const [newColor, setNewColor] = useState("#003366");
    const [researchUserPrompt, setResearchUserPrompt] = useState("");
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [reports, setReports] = useState<Report[]>([]);
    const [reportForm, setReportForm] = useState({
        period_label: "", budget_speso: "", roas: "", ctr: "",
        cpc: "", cpm: "", conversioni: "", revenue: "", reach: "",
        impressions: "", note: "", best_angles: "", best_creatives: "", best_copy: ""
    });
    const [initialValue, setInitialValue] = useState<string>("");
    const [showReportForm, setShowReportForm] = useState(false);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [metaDatePreset, setMetaDatePreset] = useState("last_30d");
    const [liveMetrics, setLiveMetrics] = useState<any>(null);
    const [liveLoading, setLiveLoading] = useState(false);
    const [liveError, setLiveError] = useState<string | null>(null);
    const [livePeriod, setLivePeriod] = useState("last_30d");

    // Ads / Creative Intelligence section
    const [adsDatePreset, setAdsDatePreset] = useState("last_90d");
    const [adCreatives, setAdCreatives] = useState<any[]>([]);
    const [adCreativesLoading, setAdCreativesLoading] = useState(false);
    const [adCreativesError, setAdCreativesError] = useState<string | null>(null);
    const [adsTotalCount, setAdsTotalCount] = useState(0);
    const [creativeAnalysis, setCreativeAnalysis] = useState<string | null>(null);
    const [creativeAnalysisLoading, setCreativeAnalysisLoading] = useState(false);
    const [savedIntelligence, setSavedIntelligence] = useState<any>(null);
    const [expandedAd, setExpandedAd] = useState<string | null>(null);

    // Intelligence section state
    const [battlecards, setBattlecards] = useState<any>(null);
    const [battlecardsLoading, setBattlecardsLoading] = useState(false);
    const [psychographic, setPsychographic] = useState<any>(null);
    const [psychographicLoading, setPsychographicLoading] = useState(false);
    const [visualBrief, setVisualBrief] = useState<any>(null);
    const [visualBriefLoading, setVisualBriefLoading] = useState(false);
    const [seasonality, setSeasonality] = useState<any>(null);
    const [seasonalityLoading, setSeasonalityLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // VoC / Review Mining
    const [vocReviews, setVocReviews] = useState("");
    const [vocGoogleUrl, setVocGoogleUrl] = useState("");
    const [vocLoading, setVocLoading] = useState(false);
    const [vocData, setVocData] = useState<any>(null);
    const [vocError, setVocError] = useState<string | null>(null);

    // Copy Generator
    const [copyFramework, setCopyFramework] = useState("PAS");
    const [copyAngle, setCopyAngle] = useState("");
    const [copyAngleDesc, setCopyAngleDesc] = useState("");
    const [copyVariations, setCopyVariations] = useState(2);
    const [copyLoading, setCopyLoading] = useState(false);
    const [copyResult, setCopyResult] = useState<any>(null);
    const [copyError, setCopyError] = useState<string | null>(null);

    // Personas Specifiche
    const [newPersonaTheme, setNewPersonaTheme] = useState("");
    const [personaLoading, setPersonaLoading] = useState(false);

    // Ref to always have the latest client state in closures (prevents race conditions on blur)
    const clientRef = useRef<any>(client);
    useEffect(() => {
        clientRef.current = client;
    }, [client]);

    useEffect(() => {
        load();
    }, [id]);

    // Auto-fetch live Meta Ads metrics when entering Reports section
    useEffect(() => {
        if (section === "reports" && client.ad_account_id) {
            fetchLiveMetrics(livePeriod);
        }
    }, [section, client.ad_account_id, livePeriod]);

    // Load saved creative intelligence when entering Ads section
    useEffect(() => {
        if (section === "ads" && client.ad_account_id) {
            fetch(`${API}/live-ads/creative-intelligence/${id}`)
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d?.analysis) setSavedIntelligence(d); })
                .catch(() => {});
        }
    }, [section, client.ad_account_id]);

    async function fetchLiveMetrics(period: string) {
        setLiveLoading(true);
        setLiveError(null);
        try {
            const r = await fetch(`${API}/clients/${id}/meta-ads-insights?date_preset=${period}`);
            if (r.ok) {
                setLiveMetrics(await r.json());
            } else {
                const err = await r.json();
                setLiveError(err.detail || "Errore nel caricamento metriche Meta.");
            }
        } catch {
            setLiveError("Errore di rete. Verifica che il backend sia attivo.");
        }
        setLiveLoading(false);
    }

    async function fetchAdCreatives() {
        if (!client.ad_account_id) return;
        setAdCreativesLoading(true);
        setAdCreativesError(null);
        try {
            const r = await fetch(`${API}/live-ads/creatives/${id}?date_preset=${adsDatePreset}`);
            if (r.ok) {
                const d = await r.json();
                setAdCreatives(d.ads || []);
                setAdsTotalCount(d.total_ads || 0);
            } else {
                const err = await r.json();
                setAdCreativesError(err.detail || "Errore nel caricamento delle inserzioni.");
            }
        } catch {
            setAdCreativesError("Errore di rete. Verifica che il backend sia attivo.");
        }
        setAdCreativesLoading(false);
    }

    async function analyzeCreatives() {
        if (!adCreatives.length) return;
        setCreativeAnalysisLoading(true);
        try {
            const r = await fetch(`${API}/live-ads/analyze-creatives/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ads: adCreatives, date_preset: adsDatePreset }),
            });
            if (r.ok) {
                const d = await r.json();
                setCreativeAnalysis(d.analysis);
                setSavedIntelligence(d);
            }
        } catch { /* noop */ }
        setCreativeAnalysisLoading(false);
    }

    async function load() {
        const [meta, res, fil] = await Promise.all([
            fetch(`${API}/clients/${id}`).then(r => r.json()),
            fetch(`${API}/clients/${id}/research`).then(r => r.json()),
            fetch(`${API}/clients/${id}/files?t=${Date.now()}`).then(r => r.ok ? r.json() : []),
        ]);
        setClient(meta); setResearchContent(res.content); setFiles(fil);
        if (meta.brand_identity?.logo) setLogoUrl(`${API}/clients/${id}/logo?t=${Date.now()}`);
        // Load reports
        const reps = await fetch(`${API}/clients/${id}/reports`).then(r => r.ok ? r.json() : []);
        setReports(reps);
        // Load VoC if exists
        fetch(`${API}/clients/${id}/voc`).then(r => r.ok ? r.json() : null).then(d => {
            if (d?.data) setVocData(d);
        }).catch(() => {});
        // Load intelligence data
        fetch(`${API}/clients/${id}/battlecards`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setBattlecards(d); }).catch(() => {});
        fetch(`${API}/clients/${id}/psychographic`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setPsychographic(d); }).catch(() => {});
        fetch(`${API}/clients/${id}/visual-brief`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setVisualBrief(d); }).catch(() => {});
        fetch(`${API}/clients/${id}/seasonality`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setSeasonality(d); }).catch(() => {});
    }


    const setLoad = (k: string, v: boolean) => setLoading(p => ({ ...p, [k]: v }));
    const toggleEdit = (k: string) => setEditing(p => ({ ...p, [k]: !p[k] }));

    async function runResearch() {
        setLoad("research", true);
        const r = await fetch(`${API}/clients/${id}/research`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ user_prompt: researchUserPrompt }) 
        });
        const d = await r.json(); setResearchContent(d.research);
        setLoad("research", false); load();
    }

    async function saveResearch() {
        await fetch(`${API}/clients/${id}/research`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: researchContent }) });
        toggleEdit("research");
    }

    async function addLink() {
        if (!newLink.trim()) return;
        const linkObj = { url: newLink.trim(), description: newLinkDesc.trim() };
        const updatedLinks = [...(client.links || []), linkObj];
        await fetch(`${API}/clients/${id}/links`, { 
            method: "PATCH", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ links: updatedLinks }) 
        });
        setNewLink(""); setNewLinkDesc(""); load();
    }

    async function removeLink(index: number) {
        const updatedLinks = (client.links || []).filter((_: any, i: number) => i !== index);
        // Map to standard object structure just in case
        const normalized = updatedLinks.map((l: any) => {
            if (typeof l === 'string') return { url: l, description: "", label: "" };
            return {
                url: l.url || "",
                description: l.description || "",
                label: l.label || ""
            };
        });

        await fetch(`${API}/clients/${id}/links`, { 
            method: "PATCH", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ links: normalized }) 
        });
        load();
    }

    async function addCompetitor() {
        if (!newCompetitor.trim()) return;
        const newComp = { name: newCompetitor.trim(), links: [] };
        const updated = [...(client.competitors || []), newComp];
        const r = await fetch(`${API}/clients/${id}/competitors`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competitors: updated })
        });
        if (r.ok) {
            setNewCompetitor("");
            load();
        }
    }

    async function addCompetitorLink(compIdx: number) {
        if (!newCompetitorUrl.trim()) return;
        const newLink = { 
            url: newCompetitorUrl.trim(), 
            label: newCompetitorType.trim() 
        };
        const updated = [...(client.competitors || [])];
        const comp = updated[compIdx];
        updated[compIdx] = { ...comp, links: [...(comp.links || []), newLink] };
        
        const r = await fetch(`${API}/clients/${id}/competitors`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competitors: updated })
        });
        if (r.ok) {
            setNewCompetitorUrl("");
            setNewCompetitorType("");
            load();
        }
    }

    async function removeCompetitor(idx: number) {
        const updated = (client.competitors || []).filter((_: any, i: number) => i !== idx);
        await fetch(`${API}/clients/${id}/competitors`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competitors: updated })
        });
        load();
    }

    async function removeCompetitorLink(compIdx: number, linkIdx: number) {
        const updated = [...(client.competitors || [])];
        const comp = updated[compIdx];
        updated[compIdx] = { 
            ...comp, 
            links: (comp.links || []).filter((_: any, i: number) => i !== linkIdx) 
        };
        await fetch(`${API}/clients/${id}/competitors`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competitors: updated })
        });
        load();
    }

    async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0) return;
        setLoad("upload", true);
        const f = new FormData(); 
        Array.from(e.target.files).forEach(fi => f.append("files", fi));
        
        try {
            const r = await fetch(`${API}/clients/${id}/files`, { 
                method: "POST", 
                body: f 
            });
            
            if (!r.ok) {
                const txt = await r.text();
                alert(`Errore caricamento: ${txt}`);
            } else {
                await load();
            }
        } catch (err) {
            console.error(err);
            alert("Errore di rete durante il caricamento.");
        } finally {
            setLoad("upload", false);
            if (e.target) e.target.value = ""; // Reset for same file re-upload
        }
    }

    async function deleteFile(filename: string) {
        if (!confirm(`Sei sicuro di voler eliminare ${filename}?`)) return;
        await fetch(`${API}/clients/${id}/files/${filename}`, { method: "DELETE" });
        load();
    }

    async function patchBrand(updates: any) {
        const r = await fetch(`${API}/clients/${id}/brand`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
        const d = await r.json(); 
        // FIX: The backend returns the brand_identity object directly now, or we need to be careful with nesting.
        // Let's force a reload or merge properly.
        setClient((p: any) => ({ ...p, brand_identity: { ...(p.brand_identity || {}), ...d } }));
    }

    async function patchIndustry(val: string) {
        await fetch(`${API}/clients/${id}/industry`, { 
            method: "PATCH", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ industry: val }) 
        });
        setClient((p: any) => ({ ...p, industry: val }));
    }

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return;
        const f = new FormData(); f.append("file", e.target.files[0]);
        await fetch(`${API}/clients/${id}/logo`, { method: "POST", body: f });
        setLogoUrl(`${API}/clients/${id}/logo?t=${Date.now()}`); load();
    }

    async function deleteLogo() {
        await fetch(`${API}/clients/${id}/logo`, { method: "DELETE" }); setLogoUrl(null); load();
    }

    async function addColor() {
        const curr = client.brand_identity?.colors || [];
        if (curr.includes(newColor)) return;
        patchBrand({ colors: [...curr, newColor] });
    }

    async function removeColor(i: number) {
        const c = [...(client.brand_identity?.colors || [])]; c.splice(i, 1); patchBrand({ colors: c });
    }

    async function extractColors() {
        if (!logoUrl) {
            alert("Carica prima un logo per estrarne i colori.");
            return;
        }
        try {
            const res = await fetch(`${API}/clients/${id}/extract-colors`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                alert(`Errore estrazione colori: ${data.detail || "Errore sconosciuto"}`);
                return;
            }
            const colors = data.colors || [];
            if (colors.length > 0) {
                const currentColors = client.brand_identity?.colors || [];
                const updatedColors = [...currentColors, ...colors];
                const uniqueColors = [...new Set(updatedColors)];
                setClient((p: any) => ({ ...p, brand_identity: { ...(p.brand_identity || {}), colors: uniqueColors } }));
                patchBrand({ colors: uniqueColors });
            }
        } catch (err) {
            alert("Errore di rete durante l'estrazione dei colori.");
        }
    }

    async function extractIndustry() {
        try {
            const res = await fetch(`${API}/clients/${id}/extract-industry`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                alert(data.detail || "Errore durante l'estrazione del settore.");
                return;
            }
            if (data.industry) {
                setClient((p: any) => ({ ...p, industry: data.industry }));
            }
        } catch (err) {
            alert("Errore di rete durante l'estrazione del settore.");
        }
    }

    async function patchSWOT(k: string, v: string) {
        await fetch(`${API}/clients/${id}/swot`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [k]: v }) });
    }

    async function runDeepAnalysis() {
        setLoad("deep", true);
        await fetch(`${API}/clients/${id}/deep-analysis`, { method: "POST" });
        await load();
        setLoad("deep", false);
    }

    async function syncWithNotion() {
        setLoad("sync", true);
        try {
            const r = await fetch(`${API}/clients/${id}/notion-sync`);
            if (r.ok) {
                alert("Sincronizzazione completata con successo!");
            } else {
                alert("Errore durante la sincronizzazione con Notion.");
            }
        } catch (e) {
            alert("Errore di rete.");
        } finally {
            setLoad("sync", false);
        }
    }

    async function createSpecificPersona() {
        if (!newPersonaTheme.trim()) return;
        setPersonaLoading(true);
        try {
            const r = await fetch(`${API}/clients/${id}/personas-specifiche`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target_service: newPersonaTheme })
            });
            if (r.ok) {
                setNewPersonaTheme("");
                await load(); // Reload client data to get new personas
            } else {
                alert("Errore durante la generazione della Buyer Persona specifica.");
            }
        } catch (e) {
            alert("Errore di rete.");
        } finally {
            setPersonaLoading(false);
        }
    }

    async function deleteClient() {
        if (!confirm("Eliminare tutti i dati del cliente?")) return;
        await fetch(`${API}/clients/${id}`, { method: "DELETE" }); window.location.href = "/";
    }

    function updatePersonaLocal(idx: number, field: string, value: string) {
        setClient((p: any) => {
            if (!p.brand_identity) return p;
            const personas = [...(p.brand_identity.buyer_personas || [])];
            if (!personas[idx]) return p;
            personas[idx] = { ...personas[idx], [field]: value };
            return {
                ...p,
                brand_identity: { ...p.brand_identity, buyer_personas: personas }
            };
        });
    }

    const navItems: { key: SectionType; icon: any; label: string }[] = [
        { key: "sorgenti", icon: LinkIcon, label: "Sorgenti" },
        { key: "identita", icon: PaintBrushIcon, label: "Identità" },
        { key: "analisi", icon: ChartBarIcon, label: "Analisi & VoC" },
        { key: "intelligence", icon: BoltIcon, label: "Strategic Intelligence" },
        { key: "personas", icon: UserGroupIcon, label: "Buyer Personas" },
        { key: "reports", icon: ChartBarIcon, label: "Reports" },
        { key: "ads", icon: RocketLaunchIcon, label: "Creatività Ads" },
    ];


    const swotData = [
        { key: "strengths", label: "Punti di Forza", css: "swot-s", icon: BoltIcon },
        { key: "weaknesses", label: "Punti Deboli", css: "swot-w", icon: ShieldExclamationIcon },
        { key: "opportunities", label: "Opportunità", css: "swot-o", icon: RocketLaunchIcon },
        { key: "threats", label: "Minacce", css: "swot-t", icon: ExclamationTriangleIcon },
    ];

    return (
        <div className="app-layout">
            {/* ═══ SIDEBAR ═══ */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">Anti<span>gravity</span></div>
                    <button onClick={() => window.location.href = "/"} className="sidebar-back">
                        <ArrowLeftIcon style={{ width: 12, height: 12 }} /> Dashboard
                    </button>
                    <div className="sidebar-client">{client.name}</div>
                    <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={syncWithNotion} 
                        disabled={loading.sync}
                        style={{ width: "100%", marginTop: 8, borderColor: "rgba(199,239,0,0.3)", color: "var(--lime)", fontSize: 11 }}
                    >
                        {loading.sync ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <ArrowPathIcon style={{ width: 12, height: 12 }} />}
                        Sincronizza Notion
                    </button>
                </div>

                <div className="sidebar-section-label">Dati Cliente</div>
                <nav className="sidebar-nav">
                    {navItems.map(({ key, icon: Icon, label }) => (
                        <button key={key} onClick={() => setSection(key)} className={`sidebar-link ${section === key ? "active" : ""}`}>
                            <Icon />{label}
                            {key === "reports" && reports.length > 0 && (
                                <span style={{ marginLeft: "auto", fontSize: 10, background: "rgba(199,239,0,0.15)", color: "var(--lime)", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
                                    {reports.length}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>



                <div className="sidebar-footer">
                    <button
                        onClick={async () => {
                            setExportLoading(true);
                            try {
                                const r = await fetch(`${API}/clients/${id}/export`);
                                if (r.ok) {
                                    const html = await r.text();
                                    const blob = new Blob([html], { type: "text/html" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `${client.name || id}-analisi-strategica.html`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }
                            } catch { /* noop */ }
                            setExportLoading(false);
                        }}
                        disabled={exportLoading}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--lime)", background: "rgba(199,239,0,0.08)", border: "1px solid rgba(199,239,0,0.25)", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", padding: "8px 12px", width: "100%", marginBottom: 10, fontWeight: 600 }}
                    >
                        {exportLoading ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <DocumentIcon style={{ width: 13, height: 13 }} />}
                        Esporta Report PDF
                    </button>
                    <button onClick={deleteClient} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>
                        <TrashIcon style={{ width: 13, height: 13 }} /> Elimina cliente
                    </button>
                </div>
            </aside>

            {/* ═══ MAIN ═══ */}
            <main className="main-content">

                {/* ══ SORGENTI ══ */}
                {section === "sorgenti" && (
                    <div style={{ maxWidth: "1200px", margin: "0 auto", overflowX: "hidden" }}>
                        <h1 className="page-title" style={{ marginBottom: 6, color: "#ffffff" }}>Sorgenti</h1>
                        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 28 }}>Documenti, Link e Competitor di riferimento per la ricerca</p>

                        {/* Documenti */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <DocumentIcon style={{ width: 16, height: 16, color: "var(--navy)" }} />Documenti Caricati
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                                {files.map((f, i) => (
                                    <span key={i} className="tag" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <DocumentIcon style={{ width: 13, height: 13 }} />
                                        {f}
                                        <button className="icon-btn" onClick={() => deleteFile(f)} style={{ marginLeft: 4, display: "flex", alignItems: "center" }}>
                                            <XMarkIcon style={{ width: 12, height: 12 }} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                                <PlusIcon style={{ width: 14, height: 14 }} />Carica documento
                                <input type="file" className="hidden" style={{ display: "none" }} multiple accept=".pdf,.txt,.docx" onChange={uploadFile} />
                            </label>
                        </div>

                        {/* Links */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <LinkIcon style={{ width: 16, height: 16, color: "var(--navy)" }} />Link e Fonti Esterne
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {(client.links || []).map((l: any, i: number) => {
                                    const url = typeof l === 'string' ? l : l.url;
                                    const desc = typeof l === 'string' ? "" : l.description;
                                    return (
                                        <div key={i} className="link-item" style={{ border: "1px solid var(--border)", padding: "10px 12px", overflow: "hidden" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", overflow: "hidden" }}>
                                                <div style={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
                                                    <a href={url} target="_blank" rel="noreferrer" className="link-url" style={{ display: "block", marginBottom: desc ? 4 : 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{url}</a>
                                                    {desc && <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.8 }}>{desc}</span>}
                                                </div>
                                                <button className="icon-btn" onClick={() => removeLink(i)}><TrashIcon style={{ width: 14, height: 14 }} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.02)", border: "1px dashed var(--border)" }}>
                                    <input className="input" placeholder="Incolla l'URL del link (es. https://google.com/...)" value={newLink} onChange={e => setNewLink(e.target.value)} />
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <input className="input" style={{ flex: 1 }} placeholder="Cosa contiene questo link? (es. Recensioni Google)" value={newLinkDesc} onChange={e => setNewLinkDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && addLink()} />
                                        <button className="btn btn-primary btn-sm" onClick={addLink}><PlusIcon style={{ width: 14, height: 14 }} />Aggiungi</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Competitor */}
                         <div className="card" style={{ marginBottom: 16 }}>
                             <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                 <UserGroupIcon style={{ width: 16, height: 16, color: "var(--orange)" }} />Competitor Suggeriti
                             </span>
                             
                             <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                 {(client.competitors || []).map((c: any, i: number) => (
                                     <div key={i} style={{ background: "rgba(0,0,0,0.02)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
                                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                             <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-header)" }}>{c.name || "Senza Nome"}</span>
                                             <button className="icon-btn" style={{ color: "var(--red)" }} onClick={() => removeCompetitor(i)}>
                                                 <TrashIcon style={{ width: 14, height: 14 }} />
                                             </button>
                                         </div>
                                         
                                         <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                                             {(c.links || []).map((l: any, li: number) => (
                                                 <span key={li} className="tag" style={{ border: "1px solid var(--orange)", background: "rgba(255,140,0,0.05)", color: "var(--orange)", display: "flex", alignItems: "center", gap: 4 }}>
                                                     <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                                                         <div style={{ display: "flex", alignItems: "center" }}>
                                                             <a href={l.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline", marginRight: 4, fontWeight: 600 }}>
                                                                 {l.label || "Link"}
                                                             </a>
                                                         </div>
                                                     </div>
                                                     <button className="icon-btn" onClick={() => removeCompetitorLink(i, li)}>
                                                         <XMarkIcon style={{ width: 12, height: 12 }} />
                                                     </button>
                                                 </span>
                                             ))}
                                         </div>

                                         <div style={{ display: "flex", gap: 6, alignItems: "center", background: "#fff", padding: "4px 8px", borderRadius: 8, border: "1px dashed var(--border)" }}>
                                             <input 
                                                 className="input" 
                                                 style={{ border: "none", background: "transparent", fontSize: 12, flex: 2 }} 
                                                 placeholder="Incolla URL..." 
                                                 value={selectedCompIdx === i ? newCompetitorUrl : ""} 
                                                 onChange={e => { setSelectedCompIdx(i); setNewCompetitorUrl(e.target.value); }} 
                                             />
                                             <input 
                                                 className="input" 
                                                 style={{ border: "none", background: "transparent", fontSize: 12, flex: 1 }} 
                                                 placeholder="Tipo (es. Instagram)" 
                                                 value={selectedCompIdx === i ? newCompetitorType : ""} 
                                                 onChange={e => { setSelectedCompIdx(i); setNewCompetitorType(e.target.value); }}
                                                 onKeyDown={e => e.key === "Enter" && addCompetitorLink(i)}
                                             />
                                             <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }} onClick={() => addCompetitorLink(i)}>
                                                 <PlusIcon style={{ width: 14, height: 14 }} />
                                             </button>
                                         </div>
                                     </div>
                                 ))}

                                 {/* Add New Competitor Group */}
                                 <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                     <input 
                                         className="input" 
                                         placeholder="Nuovo Competitor (es. Centro Estetico Rossi)" 
                                         value={newCompetitor} 
                                         onChange={e => setNewCompetitor(e.target.value)} 
                                         onKeyDown={e => e.key === "Enter" && addCompetitor()} 
                                     />
                                     <button className="btn btn-primary btn-sm" onClick={addCompetitor}>
                                         <PlusIcon style={{ width: 14, height: 14 }} />Nuovo Competitor
                                     </button>
                                 </div>
                             </div>
                         </div>

                         {/* Meta Ads Account */}
                         <div className="card" style={{ marginBottom: 16 }}>
                             <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                 <span style={{ fontSize: 16 }}>📊</span> Meta Ads Account
                             </span>
                             <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                                 Collega l&apos;Ad Account del cliente per importare automaticamente le metriche nei Reports.
                             </p>
                             <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                 <input
                                     className="input"
                                     style={{ maxWidth: 320 }}
                                     placeholder="Es: act_123456789 oppure solo 123456789"
                                     value={client.ad_account_id || ""}
                                     onChange={e => setClient((p: any) => ({ ...p, ad_account_id: e.target.value }))}
                                     onBlur={async e => {
                                         const val = e.target.value.trim();
                                         await fetch(`${API}/clients/${id}/ad-account`, {
                                             method: "PATCH",
                                             headers: { "Content-Type": "application/json" },
                                             body: JSON.stringify({ ad_account_id: val })
                                         });
                                     }}
                                 />
                                 {client.ad_account_id && (
                                     <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ Configurato</span>
                                 )}
                             </div>
                         </div>

                         {/* Meta Pixel ID */}
                         <div className="card" style={{ marginBottom: 16 }}>
                             <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                 <span style={{ fontSize: 16 }}>📡</span> Meta Pixel & Token
                             </span>
                             <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                                 Pixel ID per il tracciamento conversioni. Token opzionale solo se diverso da quello globale.
                             </p>
                             <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                 <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                     <input
                                         className="input"
                                         style={{ maxWidth: 320 }}
                                         placeholder="Es: 1234567890123456"
                                         value={client.pixel_id || ""}
                                         onChange={e => setClient((p: any) => ({ ...p, pixel_id: e.target.value }))}
                                         onBlur={async e => {
                                             await fetch(`${API}/clients/${id}/meta-pixel`, {
                                                 method: "PATCH",
                                                 headers: { "Content-Type": "application/json" },
                                                 body: JSON.stringify({ pixel_id: e.target.value.trim(), meta_access_token: client.meta_access_token || "" })
                                             });
                                         }}
                                     />
                                     <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pixel ID</span>
                                     {client.pixel_id && <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ Configurato</span>}
                                 </div>
                                 <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                     <input
                                         className="input"
                                         style={{ maxWidth: 320 }}
                                         type="password"
                                         placeholder="Token specifico cliente (opzionale)"
                                         value={client.meta_access_token || ""}
                                         onChange={e => setClient((p: any) => ({ ...p, meta_access_token: e.target.value }))}
                                         onBlur={async e => {
                                             await fetch(`${API}/clients/${id}/meta-pixel`, {
                                                 method: "PATCH",
                                                 headers: { "Content-Type": "application/json" },
                                                 body: JSON.stringify({ pixel_id: client.pixel_id || "", meta_access_token: e.target.value.trim() })
                                             });
                                         }}
                                     />
                                     <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Token (override)</span>
                                     {client.meta_access_token && <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ Impostato</span>}
                                 </div>
                             </div>
                         </div>

                         {/* Shopify Connection */}
                         <ShopifyCard clientId={id} client={client} setClient={setClient} />

                         {/* Avvia Ricerca (Perplexity) */}
                         <div className="card" style={{ marginTop: 24, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                             <div style={{ marginBottom: 16 }}>
                                 <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
                                     <MagnifyingGlassIcon style={{ width: 18, height: 18, color: "var(--orange)" }} />
                                     Avvia Ricerca di Mercato
                                 </span>
                             </div>

                             <div style={{ marginBottom: 0 }}>
                                 <label className="label" style={{ fontSize: 11, marginBottom: 8, display: "block", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Istruzioni Aggiuntive per Claude (opzionale)</label>
                                 <textarea 
                                     className="input" 
                                     rows={3} 
                                     placeholder='Es: "Focalizzati sugli angoli di vendita per l&apos;e-commerce", "Analizza gli script video caricati"...'
                                     value={researchUserPrompt}
                                     onChange={e => setResearchUserPrompt(e.target.value)}
                                     style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.3)", fontSize: 13, width: "100%", borderRadius: 10, padding: "12px 14px", color: "#fff", outline: "none", fontFamily: "inherit", resize: "vertical" }}
                                 />
                                 
                                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                                     <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>I risultati della ricerca verranno visualizzati nella sezione <strong>Analisi</strong>.</p>
                                     <button className="btn btn-orange" style={{ padding: "14px 32px", fontSize: 15, minWidth: 220, fontWeight: 800 }} onClick={runResearch} disabled={loading.research}>
                                         {loading.research ? <><div className="spinner" />Ricercando...</> : <><SparklesIcon style={{ width: 18, height: 18 }} />Avvia Ricerca approfondita</>}
                                     </button>
                                 </div>
                             </div>
                         </div>

                    </div>
                )}

                {/* ══ IDENTITÀ ══ */}
                {section === "identita" && (
                    <div style={{ maxWidth: "100%" }}>
                        <h1 className="page-title" style={{ marginBottom: 6 }}>Identità del Brand</h1>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>Visione d&apos;insieme, Branding e Obiettivi</p>

                        {/* Profilo Cliente */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <IdentificationIcon style={{ width: 16, height: 16, color: "var(--lime)" }} />Profilo Cliente
                            </span>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                <div>
                                    <label className="label" style={{ fontSize: 10, opacity: 0.6, marginBottom: 4, display: "block" }}>Nome Cliente</label>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-header)" }}>{client.name}</div>
                                </div>
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                        <label className="label" style={{ fontSize: 10, opacity: 0.6 }}>Settore / Categoria</label>
                                        <button className="icon-btn" onClick={() => toggleEdit("industry")}>
                                            {editing.industry ? <CheckIcon style={{ width: 12, height: 12 }} /> : <PencilSquareIcon style={{ width: 12, height: 12 }} />}
                                        </button>
                                    </div>
                                    {editing.industry ? (
                                        <input 
                                            className="input" 
                                            style={{ fontSize: 14, fontWeight: 600, color: "var(--lime-deep)", height: 32, padding: "4px 8px" }}
                                            value={client.industry || ""} 
                                            onChange={e => setClient({ ...client, industry: e.target.value })}
                                            onBlur={e => patchIndustry(e.target.value)}
                                            autoFocus
                                        />
                                    ) : (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--lime-deep)" }}>{client.industry || "Non definito"}</div>
                                            {!client.industry && (
                                                <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", fontSize: 10 }} onClick={extractIndustry} title="Estrai settore dall'analisi esistente">
                                                    <SparklesIcon style={{ width: 12, height: 12 }} /> Estrai dall&apos;Analisi
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Logo + Colori side by side */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                            <div className="card">
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                    <PhotoIcon style={{ width: 16, height: 16, color: "var(--orange)" }} />Logo
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    {logoUrl ? (
                                        <div style={{ position: "relative" }}>
                                            <img src={logoUrl} alt="Logo" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 10, border: "1px solid var(--border)", padding: 8, background: "var(--bg-inset)" }} />
                                            <button className="icon-btn" onClick={deleteLogo} style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", borderRadius: "50%", padding: 4, color: "#fff", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <TrashIcon style={{ width: 10, height: 10 }} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label style={{ width: 80, height: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1.5px dashed var(--border)", cursor: "pointer", gap: 4 }}>
                                            <PhotoIcon style={{ width: 24, height: 24, color: "var(--text-muted)" }} />
                                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Carica</span>
                                            <input type="file" style={{ display: "none" }} accept="image/*" onChange={handleLogoUpload} />
                                        </label>
                                    )}
                                    {logoUrl && (
                                        <label style={{ fontSize: 12, color: "var(--navy)", cursor: "pointer", textDecoration: "underline" }}>
                                            Cambia<input type="file" style={{ display: "none" }} accept="image/*" onChange={handleLogoUpload} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="card">
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                    <SwatchIcon style={{ width: 16, height: 16, color: "var(--orange)" }} />Colori del Brand
                                </span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                                    {(client.brand_identity?.colors || []).map((color: string, i: number) => (
                                        <div key={i} className="color-chip">
                                            <div style={{ width: 20, height: 20, borderRadius: 4, background: color, border: "1px solid rgba(0,0,0,0.1)" }} />
                                            <span style={{ fontFamily: "monospace", fontSize: 12 }}>{color.toUpperCase()}</span>
                                            <button className="icon-btn" onClick={() => removeColor(i)}><TrashIcon style={{ width: 12, height: 12 }} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 36, height: 36, border: "none", background: "none", cursor: "pointer", borderRadius: 6 }} />
                                    <input className="input" style={{ flex: 1, fontFamily: "monospace" }} value={newColor} onChange={e => setNewColor(e.target.value)} />
                                    <button className="btn btn-primary btn-sm" onClick={addColor}><PlusIcon style={{ width: 14, height: 14 }} />Aggiungi</button>
                                    <button className="btn btn-ghost btn-sm" onClick={extractColors} title="Estrai colori dal logo">
                                        <SwatchIcon style={{ width: 14, height: 14 }} /> Estrai dal Logo
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tono di voce */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <IdentificationIcon style={{ width: 16, height: 16, color: "var(--navy)" }} />Tono di Voce
                                </span>
                                <button className="btn btn-ghost btn-sm" onClick={() => toggleEdit("tone")}>
                                    {editing.tone ? <><EyeIcon style={{ width: 14, height: 14 }} />Anteprima</> : <><PencilSquareIcon style={{ width: 14, height: 14 }} />Modifica</>}
                                </button>
                            </div>
                            {editing.tone ? (
                                <textarea className="input" rows={8} value={client.brand_identity?.tone || ""} onChange={e => setClient({ ...client, brand_identity: { ...client.brand_identity, tone: e.target.value } })} onBlur={e => patchBrand({ tone: e.target.value })} placeholder="Descrivi il tono di voce..." />
                            ) : (
                                <div style={{ fontSize: 13, lineHeight: 1.75 }}>
                                    {client.brand_identity?.tone
                                        ? <FormatText text={client.brand_identity.tone} />
                                        : <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Nessun tono definito. Genera dalla scheda Analisi, o clicca Modifica.</p>
                                    }
                                </div>
                            )}
                        </div>

                        {/* Obiettivi */}
                        <div className="card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <FireIcon style={{ width: 16, height: 16, color: "#ea580c" }} />Obiettivi Strategici
                                </span>
                                <button className="icon-btn" onClick={() => toggleEdit("objectives")}>
                                    {editing.objectives ? <CheckIcon style={{ width: 14, height: 14 }} /> : <PencilSquareIcon style={{ width: 14, height: 14 }} />}
                                </button>
                            </div>
                            {editing.objectives ? (
                                <textarea className="input" rows={6} value={client.objectives || ""} onChange={e => setClient({ ...client, objectives: e.target.value })} onBlur={e => fetch(`${API}/clients/${id}/objectives`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: e.target.value }) })} />
                            ) : (
                                <div style={{ fontSize: 13, lineHeight: 1.75 }}>
                                    {client.objectives
                                        ? <FormatText text={client.objectives} />
                                        : <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Clicca la matita per definire gli obiettivi</p>
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══ ANALISI ══ */}
                {section === "analisi" && (
                    <div style={{ maxWidth: "100%" }}>
                        <h1 className="page-title" style={{ marginBottom: 6 }}>Analisi</h1>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>SWOT, obiettivi e strategia</p>

                        {/* CTA Genera */}
                        <div className="card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: 13, color: "var(--navy)" }}>Genera SWOT, Personas e Tono</p>
                                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Compila automaticamente tutti i campi dall&apos;analisi di ricerca</p>
                            </div>
                            <button className="btn btn-orange" onClick={runDeepAnalysis} disabled={loading.deep || !researchContent}>
                                {loading.deep ? <><div className="spinner" />Analizzando...</> : <><BoltIcon style={{ width: 15, height: 15 }} />Genera analisi</>}
                            </button>
                        </div>

                        {/* SWOT */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <ChartBarIcon style={{ width: 16, height: 16, color: "var(--navy)" }} />Analisi SWOT
                            </span>
                            <div className="swot-grid">
                                {swotData.map(({ key, label, css }: any) => (
                                    <div key={key} className={`swot-block ${css}`}>
                                        <div className="swot-header">
                                            <span className="swot-label">{label}</span>
                                            <button className="icon-btn" style={{ color: "inherit" }} onClick={() => toggleEdit(`swot_${key}`)}>
                                                {editing[`swot_${key}`] ? <CheckIcon style={{ width: 14, height: 14 }} /> : <PencilSquareIcon style={{ width: 14, height: 14 }} />}
                                            </button>
                                        </div>
                                        <div className="swot-body">
                                            {editing[`swot_${key}`] ? (
                                                <textarea className="input" rows={6} value={client.swot?.[key] || ""} onChange={e => setClient({ ...client, swot: { ...client.swot, [key]: e.target.value } })} onBlur={e => patchSWOT(key, e.target.value)} />
                                            ) : (
                                                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                                                    {client.swot?.[key] ? <FormatText text={client.swot[key]} /> : <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>Clicca la matita per aggiungere</p>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Strategia */}
                        <div className="card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <RocketLaunchIcon style={{ width: 16, height: 16, color: "var(--navy)" }} />Strategia di Crescita
                                </span>
                                <button className="icon-btn" onClick={() => toggleEdit("strategy")}>
                                    {editing.strategy ? <CheckIcon style={{ width: 14, height: 14 }} /> : <PencilSquareIcon style={{ width: 14, height: 14 }} />}
                                </button>
                            </div>
                            {editing.strategy ? (
                                <textarea className="input" rows={12} value={client.strategy || ""} onChange={e => setClient({ ...client, strategy: e.target.value })} onBlur={e => fetch(`${API}/clients/${id}/strategy`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: e.target.value }) })} />
                            ) : (
                                <div style={{ fontSize: 13, lineHeight: 1.75 }}>
                                    {client.strategy
                                        ? <FormatText text={client.strategy} />
                                        : <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Clicca la matita per definire la strategia</p>
                                    }
                                </div>
                            )}
                        </div>
                        {/* Ricerca di Mercato */}
                        <div className="card" style={{ marginTop: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <MagnifyingGlassIcon style={{ width: 18, height: 18, color: "var(--orange)" }} />
                                    Risultati Ricerca di Mercato
                                </span>
                                {researchContent && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => editing.research ? saveResearch() : toggleEdit("research")}>
                                        {editing.research ? <><CheckIcon style={{ width: 14, height: 14 }} />Salva</> : <><PencilSquareIcon style={{ width: 14, height: 14 }} />Modifica Risultati</>}
                                    </button>
                                )}
                            </div>

                            {editing.research ? (
                                <textarea className="input" rows={18} value={researchContent} onChange={e => setResearchContent(e.target.value)} />
                            ) : researchContent ? (
                                <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-body)", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                    <FormatText text={researchContent} />
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "40px 0" }}>
                                    <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, marginBottom: 12 }}>
                                        Nessuna ricerca presente per questo cliente.
                                    </p>
                                    <button className="btn btn-navy" onClick={() => setSection("sorgenti")}>
                                        Vai in Sorgenti per avviare la ricerca
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── VoC & Review Mining ── */}
                        <div className="card" style={{ marginTop: 24 }}>
                            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 16 }}>🎯</span> Voice of Customer — Review Mining
                            </span>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                                Inserisci i link e il sistema raccoglie automaticamente commenti Instagram e recensioni Google.
                                Se i dati sono scarsi, analizza anche i competitor già salvati nel profilo.
                            </p>

                            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", display: "block", marginBottom: 6 }}>
                                        Instagram del brand
                                    </label>
                                    <input
                                        className="input"
                                        style={{ maxWidth: 420 }}
                                        placeholder="https://www.instagram.com/nomebrand/"
                                        value={vocReviews}
                                        onChange={e => setVocReviews(e.target.value)}
                                    />
                                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                        Recupera commenti recenti dai post tramite Meta API (richiede token configurato in Sorgenti)
                                    </p>
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", display: "block", marginBottom: 6 }}>
                                        Google Reviews
                                    </label>
                                    <input
                                        className="input"
                                        style={{ maxWidth: 420 }}
                                        placeholder="https://maps.google.com/... oppure https://g.page/..."
                                        value={vocGoogleUrl}
                                        onChange={e => setVocGoogleUrl(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
                                <button
                                    className="btn btn-orange"
                                    disabled={vocLoading || (!vocReviews.trim() && !vocGoogleUrl.trim())}
                                    onClick={async () => {
                                        setVocLoading(true);
                                        setVocError(null);
                                        try {
                                            const r = await fetch(`${API}/clients/${id}/voc/analyze`, {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    instagram_url: vocReviews.trim(),
                                                    google_reviews_url: vocGoogleUrl.trim(),
                                                    include_competitors: true
                                                })
                                            });
                                            if (r.ok) {
                                                const d = await r.json();
                                                setVocData(d);
                                            } else {
                                                const err = await r.json();
                                                setVocError(err.detail || "Errore analisi");
                                            }
                                        } catch { setVocError("Errore di rete"); }
                                        setVocLoading(false);
                                    }}
                                >
                                    {vocLoading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Raccolta dati in corso...</> : <><SparklesIcon style={{ width: 15, height: 15 }} />Avvia VoC Analysis</>}
                                </button>
                                {vocData?.generated_at && (
                                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                        Ultima analisi: {new Date(vocData.generated_at).toLocaleDateString("it-IT")}
                                        {vocData.sources?.length > 0 && ` — ${vocData.sources.join(", ")}`}
                                    </span>
                                )}
                            </div>
                            {vocError && <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>⚠️ {vocError}</p>}

                            {/* VoC Results */}
                            {vocData?.data && (() => {
                                const d = vocData.data;
                                const vocSections = [
                                    { key: "golden_hooks", label: "Golden Hooks", icon: "🪝", color: "#f59e0b", desc: "Frasi esatte dei clienti da usare letteralmente nel copy" },
                                    { key: "pain_points", label: "Pain Points", icon: "😤", color: "#ef4444", desc: "Frustrazioni e problemi prima del prodotto" },
                                    { key: "desires_outcomes", label: "Desideri & Outcome", icon: "✨", color: "#10b981", desc: "Trasformazioni e risultati desiderati" },
                                    { key: "objections", label: "Obiezioni Ricorrenti", icon: "🤔", color: "#6366f1", desc: "Dubbi ed esitazioni da smontare nel copy" },
                                    { key: "psychographic_triggers", label: "Trigger Psicografici", icon: "🧠", color: "#8b5cf6", desc: "Motivazioni profonde e valori del cliente ideale" },
                                    { key: "top_copy_phrases", label: "Frasi Pronte per Copy", icon: "✍️", color: "var(--orange)", desc: "Usa queste direttamente negli ads" },
                                ];
                                return (
                                    <div>
                                        {d.icp_summary && (
                                            <div style={{ background: "rgba(199,239,0,0.08)", border: "1px solid rgba(199,239,0,0.2)", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--lime)", letterSpacing: ".07em", marginBottom: 6 }}>ICP Summary</p>
                                                <p style={{ fontSize: 13, color: "var(--text-dark-primary)", lineHeight: 1.7, margin: 0 }}>{d.icp_summary}</p>
                                            </div>
                                        )}
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginBottom: 20 }}>
                                            {vocSections.map(({ key, label, icon, color, desc }) => {
                                                const items: string[] = d[key] || [];
                                                if (!items.length) return null;
                                                return (
                                                    <div key={key} style={{ background: "rgba(0,0,0,0.04)", border: `1px solid ${color}33`, borderRadius: 10, padding: "14px 16px" }}>
                                                        <p style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>{icon} {label}</p>
                                                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 10 }}>{desc}</p>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                            {items.map((item, i) => (
                                                                <div key={i} style={{ fontSize: 12, color: "var(--text-dark-primary)", lineHeight: 1.6, display: "flex", gap: 8, alignItems: "flex-start" }}>
                                                                    <span style={{ color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>›</span>
                                                                    <span style={{ fontStyle: key === "golden_hooks" || key === "top_copy_phrases" ? "italic" : "normal" }}>&ldquo;{item}&rdquo;</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {d.strategic_insights && (
                                            <div style={{ background: "rgba(255,158,28,0.06)", border: "1px solid rgba(255,158,28,0.2)", borderRadius: 10, padding: "14px 18px" }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--orange)", letterSpacing: ".07em", marginBottom: 8 }}>Insights Strategici</p>
                                                <p style={{ fontSize: 13, color: "var(--text-dark-primary)", lineHeight: 1.7, margin: 0 }}>{d.strategic_insights}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
                {/* ══ STRATEGIC INTELLIGENCE ══ */}
                {section === "intelligence" && (
                    <div style={{ maxWidth: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
                            <div>
                                <h1 className="page-title" style={{ marginBottom: 6 }}>Strategic Intelligence</h1>
                                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Battlecard competitive, analisi psicografica 3 livelli, visual brief e roadmap stagionale</p>
                            </div>
                        </div>

                        {/* Generate all button */}
                        <div className="card" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <p style={{ fontWeight: 700, fontSize: 13, color: "var(--navy)" }}>Genera tutta l&apos;intelligence in una volta</p>
                                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Battlecards + Psicografica + Visual Brief + Stagionalità — tutto in parallelo</p>
                            </div>
                            <button
                                className="btn btn-orange"
                                disabled={battlecardsLoading || psychographicLoading || visualBriefLoading || seasonalityLoading}
                                onClick={async () => {
                                    setBattlecardsLoading(true); setPsychographicLoading(true); setVisualBriefLoading(true); setSeasonalityLoading(true);
                                    await Promise.allSettled([
                                        fetch(`${API}/clients/${id}/battlecards`, { method: "POST" }).then(r => r.ok ? r.json() : null).then(d => { if (d) setBattlecards(d); }),
                                        fetch(`${API}/clients/${id}/psychographic`, { method: "POST" }).then(r => r.ok ? r.json() : null).then(d => { if (d) setPsychographic(d); }),
                                        fetch(`${API}/clients/${id}/visual-brief`, { method: "POST" }).then(r => r.ok ? r.json() : null).then(d => { if (d) setVisualBrief(d); }),
                                        fetch(`${API}/clients/${id}/seasonality`, { method: "POST" }).then(r => r.ok ? r.json() : null).then(d => { if (d) setSeasonality(d); }),
                                    ]);
                                    setBattlecardsLoading(false); setPsychographicLoading(false); setVisualBriefLoading(false); setSeasonalityLoading(false);
                                }}
                            >
                                {(battlecardsLoading || psychographicLoading || visualBriefLoading || seasonalityLoading)
                                    ? <><div className="spinner" style={{ width: 14, height: 14 }} />Generazione in corso...</>
                                    : <><SparklesIcon style={{ width: 15, height: 15 }} />Genera tutto</>}
                            </button>
                        </div>

                        {/* ── COMPETITOR BATTLECARDS ── */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>⚔️</span> Competitor Battlecards
                                </span>
                                <button className="btn btn-ghost btn-sm" disabled={battlecardsLoading} onClick={async () => {
                                    setBattlecardsLoading(true);
                                    const r = await fetch(`${API}/clients/${id}/battlecards`, { method: "POST" });
                                    if (r.ok) setBattlecards(await r.json());
                                    setBattlecardsLoading(false);
                                }}>
                                    {battlecardsLoading ? <><div className="spinner" style={{ width: 12, height: 12 }} />Generazione...</> : <><ArrowPathIcon style={{ width: 13, height: 13 }} />{battlecards?.data ? "Rigenera" : "Genera"}</>}
                                </button>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Analisi competitiva strutturata: punti di forza/debolezza dei competitor, i loro angoli comunicativi e come batterli.</p>

                            {battlecards?.data ? (
                                <div>
                                    {battlecards.overall && (
                                        <div style={{ background: "rgba(199,239,0,0.07)", border: "1px solid rgba(199,239,0,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                                            <p style={{ fontSize: 12, color: "var(--text-dark-primary)", lineHeight: 1.7 }}>{battlecards.overall}</p>
                                        </div>
                                    )}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {(Array.isArray(battlecards.data) ? battlecards.data : []).map((bc: any, i: number) => (
                                            <div key={i} style={{ background: "rgba(0,0,0,0.03)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px" }}>
                                                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>vs {bc.competitor_name}</p>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                                    <div>
                                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#ef4444", letterSpacing: ".07em", marginBottom: 6 }}>Loro punti forti</p>
                                                        {(bc.strengths || []).map((s: string, j: number) => <div key={j} style={{ fontSize: 12, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "#ef4444" }}>›</span>{s}</div>)}
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#10b981", letterSpacing: ".07em", marginBottom: 6 }}>Loro debolezze</p>
                                                        {(bc.weaknesses || []).map((s: string, j: number) => <div key={j} style={{ fontSize: 12, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "#10b981" }}>›</span>{s}</div>)}
                                                    </div>
                                                </div>
                                                <div style={{ background: "rgba(199,239,0,0.08)", border: "1px solid rgba(199,239,0,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                                                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--lime)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>⚡ Nostro vantaggio</p>
                                                    <p style={{ fontSize: 13, color: "var(--text-dark-primary)" }}>{bc.our_advantage}</p>
                                                </div>
                                                {bc.steal_customers_hooks?.length > 0 && (
                                                    <div>
                                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--orange)", letterSpacing: ".07em", marginBottom: 6 }}>Hook per sottrarre i loro clienti</p>
                                                        {bc.steal_customers_hooks.map((h: string, j: number) => <div key={j} style={{ fontSize: 12, marginBottom: 4, fontStyle: "italic", display: "flex", gap: 6 }}><span style={{ color: "var(--orange)" }}>›</span>&ldquo;{h}&rdquo;</div>)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : !battlecardsLoading && (
                                <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessuna battlecard generata. Assicurati di avere competitor nella sezione Sorgenti.</p>
                            )}
                        </div>

                        {/* ── PSYCHOGRAPHIC ANALYSIS ── */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>🧠</span> Analisi Psicografica — 3 Livelli
                                </span>
                                <button className="btn btn-ghost btn-sm" disabled={psychographicLoading} onClick={async () => {
                                    setPsychographicLoading(true);
                                    const r = await fetch(`${API}/clients/${id}/psychographic`, { method: "POST" });
                                    if (r.ok) setPsychographic(await r.json());
                                    setPsychographicLoading(false);
                                }}>
                                    {psychographicLoading ? <><div className="spinner" style={{ width: 12, height: 12 }} />Analisi...</> : <><ArrowPathIcon style={{ width: 13, height: 13 }} />{psychographic?.data ? "Rigenera" : "Genera"}</>}
                                </button>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Tre livelli di profondità: consapevole, identitario e inconscio. La base per copy che tocca le corde giuste.</p>

                            {psychographic?.data ? (() => {
                                const d = psychographic.data;
                                const l1 = d.level_1_primary || {};
                                const l2 = d.level_2_secondary || {};
                                const l3 = d.level_3_unconscious || {};
                                const ci = d.copywriting_implications || {};
                                return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {[
                                            { level: "LIVELLO 1", title: "Psicografia Primaria — Consapevole", color: "#3b82f6", border: "rgba(59,130,246,0.15)", bg: "rgba(59,130,246,0.04)",
                                              content: <><p style={{ fontSize: 13, marginBottom: 8 }}><strong>Cosa vuole:</strong> {l1.desires}</p>{(l1.explicit_goals||[]).map((g:string,i:number) => <div key={i} style={{ fontSize: 12, display: "flex", gap: 6, marginBottom: 3 }}><span style={{ color: "#3b82f6" }}>›</span>{g}</div>)}</> },
                                            { level: "LIVELLO 2", title: "Psicografia Secondaria — Identitaria", color: "#8b5cf6", border: "rgba(139,92,246,0.15)", bg: "rgba(139,92,246,0.04)",
                                              content: <><p style={{ fontSize: 13, marginBottom: 6 }}><strong>Identità aspirazionale:</strong> {l2.aspirational_identity}</p><p style={{ fontSize: 13, marginBottom: 6 }}><strong>Tribù:</strong> {l2.tribe}</p>{l2.identity_statement && <p style={{ fontSize: 13, fontStyle: "italic", color: "#8b5cf6", fontWeight: 600 }}>&ldquo;{l2.identity_statement}&rdquo;</p>}</> },
                                            { level: "LIVELLO 3", title: "Psicografia Terziaria — Inconscia", color: "#ec4899", border: "rgba(236,72,153,0.15)", bg: "rgba(236,72,153,0.04)",
                                              content: <><p style={{ fontSize: 13, marginBottom: 6 }}><strong>Archetipi:</strong> {l3.archetypes}</p><p style={{ fontSize: 13, marginBottom: 6 }}><strong>Vera ragione d&apos;acquisto:</strong> {l3.real_purchase_reason}</p><p style={{ fontSize: 13 }}><strong>Conflitto risolto:</strong> {l3.identity_conflict}</p></> },
                                        ].map(({ level, title, color, border, bg, content }) => (
                                            <div key={level} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px" }}>
                                                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: "#999", marginBottom: 6 }}>{level}</p>
                                                <p style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 12 }}>{title}</p>
                                                {content}
                                            </div>
                                        ))}
                                        {ci.words_that_activate?.length > 0 && (
                                            <div style={{ background: "rgba(255,158,28,0.05)", border: "1px solid rgba(255,158,28,0.2)", borderRadius: 10, padding: "14px 18px" }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--orange)", letterSpacing: ".07em", marginBottom: 10 }}>Implicazioni Copywriting</p>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                                    <div><p style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>Parole che attivano</p>{ci.words_that_activate.map((w:string,i:number) => <span key={i} style={{ display: "inline-block", fontSize: 11, fontWeight: 600, background: "rgba(16,185,129,0.1)", color: "#10b981", padding: "2px 8px", borderRadius: 4, margin: "2px 3px" }}>{w}</span>)}</div>
                                                    <div><p style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>Parole da evitare</p>{(ci.words_to_avoid||[]).map((w:string,i:number) => <span key={i} style={{ display: "inline-block", fontSize: 11, fontWeight: 600, background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "2px 8px", borderRadius: 4, margin: "2px 3px" }}>{w}</span>)}</div>
                                                </div>
                                                {ci.narrative_arc && <p style={{ fontSize: 12, color: "var(--text-dark-primary)", marginTop: 10 }}><strong>Narrative arc:</strong> {ci.narrative_arc}</p>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })() : !psychographicLoading && (
                                <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessuna analisi psicografica. Genera prima la ricerca di mercato per risultati migliori.</p>
                            )}
                        </div>

                        {/* ── VISUAL BRIEF ── */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>🎨</span> Visual Brief
                                </span>
                                <button className="btn btn-ghost btn-sm" disabled={visualBriefLoading} onClick={async () => {
                                    setVisualBriefLoading(true);
                                    const r = await fetch(`${API}/clients/${id}/visual-brief`, { method: "POST" });
                                    if (r.ok) setVisualBrief(await r.json());
                                    setVisualBriefLoading(false);
                                }}>
                                    {visualBriefLoading ? <><div className="spinner" style={{ width: 12, height: 12 }} />Generazione...</> : <><ArrowPathIcon style={{ width: 13, height: 13 }} />{visualBrief?.data ? "Rigenera" : "Genera"}</>}
                                </button>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Brief completo per designer e videomaker: mood, palette, Do&apos;s/Don&apos;ts, hook visivi e struttura video.</p>

                            {visualBrief?.data ? (() => {
                                const d = visualBrief.data;
                                const vs = d.video_structure || {};
                                return (
                                    <div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                                            <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: 14 }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Mood & Aesthetic</p>
                                                <p style={{ fontSize: 13 }}>{d.mood_aesthetic}</p>
                                            </div>
                                            <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: 14 }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Reference Aesthetic</p>
                                                <p style={{ fontSize: 13 }}>{d.reference_aesthetic}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                                            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: 14 }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>✅ Do&apos;s</p>
                                                {(d.dos||[]).map((s:string,i:number) => <div key={i} style={{ fontSize: 12, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "#10b981" }}>✓</span>{s}</div>)}
                                            </div>
                                            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: 14 }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>❌ Don&apos;ts</p>
                                                {(d.donts||[]).map((s:string,i:number) => <div key={i} style={{ fontSize: 12, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "#ef4444" }}>✗</span>{s}</div>)}
                                            </div>
                                        </div>
                                        {d.visual_hooks_3sec?.length > 0 && (
                                            <div style={{ background: "rgba(255,158,28,0.05)", border: "1px solid rgba(255,158,28,0.2)", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>🪝 Hook visivi — primi 3 secondi</p>
                                                {d.visual_hooks_3sec.map((h:string,i:number) => <div key={i} style={{ fontSize: 12, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "var(--orange)" }}>›</span>{h}</div>)}
                                            </div>
                                        )}
                                        {vs["0_3s"] && (
                                            <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: 14 }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>📱 Struttura Video</p>
                                                {[["0–3s", vs["0_3s"]], ["3–15s", vs["3_15s"]], ["15–30s", vs["15_30s"]]].map(([t,v]) => v && (
                                                    <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, background: "#003366", color: "white", padding: "2px 8px", borderRadius: 4, flexShrink: 0, whiteSpace: "nowrap" }}>{t}</span>
                                                        <p style={{ fontSize: 13, color: "var(--text-dark-primary)", margin: 0 }}>{v}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })() : !visualBriefLoading && (
                                <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessun visual brief. Genera prima brand identity e ricerca per risultati ottimali.</p>
                            )}
                        </div>

                        {/* ── SEASONALITY ROADMAP ── */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>📅</span> Seasonality Roadmap
                                </span>
                                <button className="btn btn-ghost btn-sm" disabled={seasonalityLoading} onClick={async () => {
                                    setSeasonalityLoading(true);
                                    const r = await fetch(`${API}/clients/${id}/seasonality`, { method: "POST" });
                                    if (r.ok) setSeasonality(await r.json());
                                    setSeasonalityLoading(false);
                                }}>
                                    {seasonalityLoading ? <><div className="spinner" style={{ width: 12, height: 12 }} />Generazione...</> : <><ArrowPathIcon style={{ width: 13, height: 13 }} />{seasonality?.data ? "Rigenera" : "Genera"}</>}
                                </button>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Calendario angoli e offerte per tutto l&apos;anno, con periodi di picco e priorità di budget.</p>

                            {seasonality?.data ? (() => {
                                const d = seasonality.data;
                                const months = d.months || [];
                                const priorityColor: Record<string,string> = { alta: "#ef4444", media: "#f59e0b", bassa: "#6b7280" };
                                return (
                                    <div>
                                        {d.year_overview && (
                                            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                                                <p style={{ fontSize: 13, color: "var(--text-dark-primary)", lineHeight: 1.7 }}>{d.year_overview}</p>
                                            </div>
                                        )}
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
                                            {months.map((m: any, i: number) => {
                                                const prio = (m.budget_priority || "media").toLowerCase();
                                                return (
                                                    <div key={i} style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: "12px 14px", borderTop: `3px solid ${priorityColor[prio] || "#6b7280"}` }}>
                                                        <p style={{ fontSize: 13, fontWeight: 800, color: "var(--navy)", marginBottom: 6 }}>{m.month}</p>
                                                        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--text-dark-primary)" }}>{m.recommended_angle}</p>
                                                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>💰 {m.offer_type}</p>
                                                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>⚡ {m.urgency_trigger}</p>
                                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: priorityColor[prio] || "#6b7280" }}>Budget: {prio}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {d.peak_periods?.length > 0 && (
                                            <div style={{ background: "rgba(255,158,28,0.06)", border: "1px solid rgba(255,158,28,0.2)", borderRadius: 8, padding: "12px 16px" }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Periodi di picco</p>
                                                <p style={{ fontSize: 13 }}>{d.peak_periods.join(" · ")}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })() : !seasonalityLoading && (
                                <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessuna roadmap stagionale. Completa prima la ricerca di mercato.</p>
                            )}
                        </div>
                    </div>
                )}

                {section === "personas" && (
                    <div style={{ maxWidth: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
                            <div>
                                <h1 className="page-title" style={{ marginBottom: 6 }}>Buyer Personas</h1>
                                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Profilo, desideri e paure di ogni persona</p>
                                {!researchContent && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Avvia prima la ricerca in Sorgenti</p>}
                            </div>

                            {researchContent && (
                                <button className="btn btn-secondary" onClick={runDeepAnalysis} disabled={loading.deep}>
                                    {loading.deep ? <><div className="spinner" />Rigenerando...</> : <><ArrowPathIcon style={{ width: 15, height: 15 }} />Rigenera Personas</>}
                                </button>
                            )}
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <label className="label" style={{ display: "block", marginBottom: 6 }}>Genera Persona Specifica (Es. "Servizi antimacchia", "Rimozione Tatuaggi")</label>
                                    <input 
                                        className="input" 
                                        placeholder="Inserisci il target o servizio specifico..." 
                                        value={newPersonaTheme} 
                                        onChange={e => setNewPersonaTheme(e.target.value)} 
                                        onKeyDown={e => e.key === "Enter" && createSpecificPersona()} 
                                    />
                                </div>
                                <button className="btn btn-primary" onClick={createSpecificPersona} disabled={personaLoading || !newPersonaTheme.trim()}>
                                    {personaLoading ? <><div className="spinner" />Generando...</> : <><SparklesIcon style={{ width: 15, height: 15 }} />Genera Specifica</>}
                                </button>
                            </div>
                        </div>

                        {Array.isArray(client.brand_identity?.buyer_personas) && client.brand_identity.buyer_personas.length > 0 ? (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                                {client.brand_identity.buyer_personas.map((p: any, idx: number) => (
                                    <div key={idx} className="persona-card">
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>
                                            {p.servizio_specifico ? `Target: ${p.servizio_specifico}` : "Persona Generica"}
                                        </div>
                                        <input
                                            className="persona-name"
                                            value={p.name || ""}
                                            placeholder="Nome Persona"
                                            onFocus={(e) => setInitialValue(e.target.value)}
                                            onChange={e => updatePersonaLocal(idx, "name", e.target.value)}
                                            onBlur={(e) => {
                                                if (e.target.value !== initialValue) {
                                                    patchBrand({ buyer_personas: clientRef.current.brand_identity.buyer_personas });
                                                }
                                            }}
                                            style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}
                                        />
                                        <input
                                            className="persona-type"
                                            value={p.type || ""}
                                            placeholder="Tipo (es: Il manager stressato)"
                                            onFocus={(e) => setInitialValue(e.target.value)}
                                            onChange={e => updatePersonaLocal(idx, "type", e.target.value)}
                                            onBlur={(e) => {
                                                if (e.target.value !== initialValue) {
                                                    patchBrand({ buyer_personas: clientRef.current.brand_identity.buyer_personas });
                                                }
                                            }}
                                            style={{ 
                                                width: "100%", background: "none", border: "none", color: "var(--text-muted)", 
                                                fontSize: 12, fontWeight: 600, fontStyle: "italic", outline: "none", marginBottom: 10 
                                            }}
                                        />
                                        <hr className="divider" style={{ margin: "10px 0" }} />
                                        {[
                                            { field: "profile", label: "Profilo e Psicografia", cls: "pf-profile" },
                                            { field: "buying_habits", label: "Abitudini d'Acquisto", cls: "pf-habits" },
                                            { field: "desires", label: "Desideri Profondi", cls: "pf-desires" },
                                            { field: "fears", label: "Paure e Obiezioni", cls: "pf-fears" },
                                            { field: "critical_info", label: "Info Indispensabili", cls: "pf-info" },
                                        ].map(f => (
                                            <div key={f.field} style={{ marginBottom: 12 }}>
                                                <p className={`persona-field-label ${f.cls}`}>{f.label}</p>
                                                <textarea
                                                    className="persona-textarea"
                                                    value={p[f.field] || ""}
                                                    placeholder={`${f.label} della persona...`}
                                                    onFocus={(e) => setInitialValue(e.target.value)}
                                                    onChange={e => { updatePersonaLocal(idx, f.field, e.target.value); }}
                                                    onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                                                    onBlur={(e) => {
                                                        if (e.target.value !== initialValue) {
                                                            patchBrand({ buyer_personas: clientRef.current.brand_identity.buyer_personas });
                                                        }
                                                    }}
                                                    style={{ height: "auto", minHeight: 48 }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                                <UserGroupIcon style={{ width: 40, height: 40, color: "var(--text-muted)", margin: "0 auto 12px" }} />
                                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Nessuna buyer persona. Avvia la ricerca e clicca &quot;Genera analisi&quot;.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ══ REPORTS ══ */}
                {section === "reports" && (
                    <div style={{ maxWidth: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
                            <div>
                                <h1 className="page-title" style={{ marginBottom: 6 }}>Reports di Performance</h1>
                                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Inserisci i KPI e genera analisi AI dei risultati</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => setShowReportForm(!showReportForm)}>
                                <PlusIcon style={{ width: 15, height: 15 }} />
                                {showReportForm ? "Annulla" : "Nuovo Report"}
                            </button>
                        </div>

                        {/* Live Meta Ads Dashboard */}
                        {client.ad_account_id && (
                            <div className="card" style={{ marginBottom: 20, border: "1px solid rgba(24,144,255,0.25)", background: "rgba(24,144,255,0.03)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 14 }}>📡</span>
                                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-dark-primary)" }}>Live Meta Ads</span>
                                        {liveLoading && <div className="spinner" />}
                                        {!liveLoading && liveMetrics && (
                                            <span style={{ fontSize: 10, color: "#10b981", fontWeight: 600, background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 99 }}>● LIVE</span>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <select
                                            className="input"
                                            style={{ fontSize: 12, padding: "4px 8px", maxWidth: 160 }}
                                            value={livePeriod}
                                            onChange={e => setLivePeriod(e.target.value)}
                                        >
                                            {DATE_PRESET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ padding: "4px 10px", fontSize: 12 }}
                                            disabled={liveLoading}
                                            onClick={() => fetchLiveMetrics(livePeriod)}
                                        >
                                            <ArrowPathIcon style={{ width: 13, height: 13 }} />
                                        </button>
                                    </div>
                                </div>

                                {liveError && (
                                    <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>⚠️ {liveError}</p>
                                )}

                                {liveMetrics && !liveError && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                        {[
                                            { k: "budget_speso", l: "Budget Speso", suffix: "€", color: "#6366f1" },
                                            { k: "cpm", l: "CPM", suffix: "€", color: "#f59e0b" },
                                            { k: "ctr", l: "CTR", suffix: "%", color: "#10b981" },
                                            { k: "cpc", l: "CPC", suffix: "€", color: "#3b82f6" },
                                            { k: "cpa", l: "CPA", suffix: "€", color: "#ec4899" },
                                            { k: "impressions", l: "Impressioni", suffix: "", color: "#8b5cf6" },
                                            { k: "reach", l: "Reach", suffix: "", color: "#14b8a6" },
                                            { k: "conversioni", l: "Conversioni", suffix: "", color: "#f97316" },
                                        ].filter(f => liveMetrics[f.k] !== "" && liveMetrics[f.k] != null).map(f => (
                                            <div key={f.k} style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", border: `1px solid ${f.color}22`, minWidth: 100, flex: "0 0 auto" }}>
                                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#9ca3af", marginBottom: 4 }}>{f.l}</div>
                                                <div style={{ fontSize: 18, fontWeight: 800, color: f.color }}>
                                                    {typeof liveMetrics[f.k] === "number"
                                                        ? Number(liveMetrics[f.k]).toLocaleString("it-IT")
                                                        : liveMetrics[f.k]}{f.suffix}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!liveMetrics && !liveLoading && !liveError && (
                                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Caricamento metriche in corso...</p>
                                )}
                            </div>
                        )}

                        {/* Form nuovo report */}
                        {showReportForm && (
                            <div className="card" style={{ marginBottom: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-dark-primary)", margin: 0 }}>📊 Inserisci Dati Periodo</p>
                                    {client.ad_account_id && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <select
                                                className="input"
                                                style={{ fontSize: 12, padding: "4px 8px", maxWidth: 160 }}
                                                value={metaDatePreset}
                                                onChange={e => setMetaDatePreset(e.target.value)}
                                            >
                                                {DATE_PRESET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ fontSize: 12, padding: "6px 14px", whiteSpace: "nowrap" }}
                                                disabled={loading.meta_import}
                                                onClick={async () => {
                                                    setLoad("meta_import", true);
                                                    try {
                                                        const r = await fetch(`${API}/clients/${id}/meta-ads-insights?date_preset=${metaDatePreset}`);
                                                        if (!r.ok) {
                                                            const err = await r.json();
                                                            alert(`Errore Meta Ads: ${err.detail}`);
                                                        } else {
                                                            const d = await r.json();
                                                            setReportForm(p => ({
                                                                ...p,
                                                                budget_speso: d.budget_speso !== "" ? String(d.budget_speso) : p.budget_speso,
                                                                cpm: d.cpm !== "" ? String(d.cpm) : p.cpm,
                                                                ctr: d.ctr !== "" ? String(d.ctr) : p.ctr,
                                                                cpc: d.cpc !== "" ? String(d.cpc) : p.cpc,
                                                                impressions: d.impressions !== "" ? String(d.impressions) : p.impressions,
                                                                reach: d.reach !== "" ? String(d.reach) : p.reach,
                                                                conversioni: d.conversioni !== "" ? String(d.conversioni) : p.conversioni,
                                                            }));
                                                        }
                                                    } catch {
                                                        alert("Errore di rete durante l'importazione da Meta Ads.");
                                                    }
                                                    setLoad("meta_import", false);
                                                }}
                                            >
                                                {loading.meta_import ? <><div className="spinner" />Importando...</> : <>📥 Importa da Meta</>}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Periodo */}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#6b7280", marginBottom: 6 }}>Periodo</label>
                                    <input className="input" style={{ maxWidth: 280 }} placeholder="Es: Febbraio 2026"
                                        value={reportForm.period_label} onChange={e => setReportForm(p => ({ ...p, period_label: e.target.value }))} />
                                </div>

                                {/* KPI grid */}
                                <div className="kpi-grid" style={{ marginBottom: 16 }}>
                                    {[
                                        { key: "budget_speso", label: "Budget Speso (€)", placeholder: "Es: 1500" },
                                        { key: "roas", label: "ROAS", placeholder: "Es: 3.2" },
                                        { key: "ctr", label: "CTR (%)", placeholder: "Es: 2.4" },
                                        { key: "cpc", label: "CPC (€)", placeholder: "Es: 0.45" },
                                        { key: "cpm", label: "CPM (€)", placeholder: "Es: 12" },
                                        { key: "conversioni", label: "Conversioni", placeholder: "Es: 48" },
                                        { key: "revenue", label: "Revenue (€)", placeholder: "Es: 4800" },
                                        { key: "reach", label: "Reach", placeholder: "Es: 25000" },
                                        { key: "impressions", label: "Impressioni", placeholder: "Es: 80000" },
                                    ].map(f => (
                                        <div key={f.key} className="kpi-field">
                                            <label>{f.label}</label>
                                            <input className="input" placeholder={f.placeholder}
                                                value={(reportForm as any)[f.key]}
                                                onChange={e => setReportForm(p => ({ ...p, [f.key]: e.target.value }))} />
                                        </div>
                                    ))}
                                </div>

                                {/* Best performers */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                                    {[
                                        { key: "best_angles", label: "🎯 Angoli migliori", placeholder: "Es: Problema-Soluzione, Story..." },
                                        { key: "best_creatives", label: "🎨 Creatività migliori", placeholder: "Es: Video UGC, Statica prodotto..." },
                                        { key: "best_copy", label: "✍️ Copy migliori", placeholder: "Es: Hook domanda, lista benefici..." },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#6b7280", marginBottom: 6 }}>{f.label}</label>
                                            <textarea className="input" rows={2} placeholder={f.placeholder}
                                                value={(reportForm as any)[f.key]}
                                                onChange={e => setReportForm(p => ({ ...p, [f.key]: e.target.value }))} />
                                        </div>
                                    ))}
                                </div>

                                {/* Note libere */}
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#6b7280", marginBottom: 6 }}>Note libere</label>
                                    <textarea className="input" rows={3} placeholder="Qualsiasi osservazione aggiuntiva..."
                                        value={reportForm.note} onChange={e => setReportForm(p => ({ ...p, note: e.target.value }))} />
                                </div>

                                <div style={{ display: "flex", gap: 10 }}>
                                    <button className="btn btn-ghost" onClick={() => setShowReportForm(false)}>Annulla</button>
                                    <button className="btn btn-primary" onClick={async () => {
                                        setLoad("save_report", true);
                                        const r = await fetch(`${API}/clients/${id}/reports`, {
                                            method: "POST", headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(reportForm)
                                        });
                                        if (r.ok) {
                                            const rep = await r.json();
                                            setReports(p => [rep, ...p]);
                                            setShowReportForm(false);
                                            setReportForm({ period_label: "", budget_speso: "", roas: "", ctr: "", cpc: "", cpm: "", conversioni: "", revenue: "", reach: "", impressions: "", note: "", best_angles: "", best_creatives: "", best_copy: "" });
                                        }
                                        setLoad("save_report", false);
                                    }} disabled={loading.save_report}>
                                        {loading.save_report ? <><div className="spinner" />Salvando...</> : <><CheckIcon style={{ width: 15, height: 15 }} />Salva Report</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Lista report */}
                        {reports.length === 0 && !showReportForm ? (
                            <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                                <ChartBarIcon style={{ width: 40, height: 40, color: "var(--text-muted)", margin: "0 auto 12px" }} />
                                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Nessun report. Clicca &quot;Nuovo Report&quot; per iniziare.</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {reports.map(rep => (
                                    <div key={rep.id} className="report-card">
                                        {/* Header report */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                                                    {rep.period_label || new Date(rep.created_at).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
                                                </p>
                                                <p style={{ fontSize: 11, color: "#9ca3af" }}>{new Date(rep.created_at).toLocaleDateString("it-IT")} {new Date(rep.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>
                                            </div>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                {!rep.ai_report && (
                                                    <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}
                                                        disabled={loading[`gen_${rep.id}`]}
                                                        onClick={async () => {
                                                            setLoad(`gen_${rep.id}`, true);
                                                            const r = await fetch(`${API}/clients/${id}/reports/${rep.id}/generate`, { method: "POST" });
                                                            if (r.ok) {
                                                                const updated = await r.json();
                                                                setReports(p => p.map(r => r.id === rep.id ? updated : r));
                                                                setExpandedReport(rep.id);
                                                            }
                                                            setLoad(`gen_${rep.id}`, false);
                                                        }}>
                                                        {loading[`gen_${rep.id}`] ? <><div className="spinner" />Analizzando...</> : <><SparklesIcon style={{ width: 13, height: 13 }} />Genera AI</>}
                                                    </button>
                                                )}
                                                <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: 12 }}
                                                    onClick={() => setExpandedReport(expandedReport === rep.id ? null : rep.id)}>
                                                    {expandedReport === rep.id ? "Chiudi" : "Espandi"}
                                                </button>
                                                <button style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 6 }}
                                                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"}
                                                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#d1d5db"}
                                                    onClick={async () => {
                                                        if (!confirm("Eliminare questo report?")) return;
                                                        await fetch(`${API}/clients/${id}/reports/${rep.id}`, { method: "DELETE" });
                                                        setReports(p => p.filter(r => r.id !== rep.id));
                                                    }}>
                                                    <TrashIcon style={{ width: 14, height: 14 }} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* KPI pills */}
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: expandedReport === rep.id ? 16 : 0 }}>
                                            {[
                                                { k: "budget_speso", l: "Budget", suffix: "€" },
                                                { k: "roas", l: "ROAS", suffix: "x" },
                                                { k: "ctr", l: "CTR", suffix: "%" },
                                                { k: "cpc", l: "CPC", suffix: "€" },
                                                { k: "cpm", l: "CPM", suffix: "€" },
                                                { k: "conversioni", l: "Conv.", suffix: "" },
                                                { k: "revenue", l: "Revenue", suffix: "€" },
                                                { k: "reach", l: "Reach", suffix: "" },
                                            ].filter(f => (rep as any)[f.k]).map(f => (
                                                <div key={f.k} style={{ background: "#f3f4f6", borderRadius: 8, padding: "5px 10px", display: "flex", flexDirection: "column", gap: 1 }}>
                                                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#9ca3af" }}>{f.l}</span>
                                                    <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{(rep as any)[f.k]}{f.suffix}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Expanded view */}
                                        {expandedReport === rep.id && (
                                            <div>
                                                {/* Best performers */}
                                                {(rep.best_angles || rep.best_creatives || rep.best_copy) && (
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                                                        {rep.best_angles && (
                                                            <div style={{ background: "#f3f4f6", borderRadius: 8, padding: 12 }}>
                                                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>🎯 Angoli top</p>
                                                                <p style={{ fontSize: 12, color: "#111827" }}>{rep.best_angles}</p>
                                                            </div>
                                                        )}
                                                        {rep.best_creatives && (
                                                            <div style={{ background: "#f3f4f6", borderRadius: 8, padding: 12 }}>
                                                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>🎨 Creatività top</p>
                                                                <p style={{ fontSize: 12, color: "#111827" }}>{rep.best_creatives}</p>
                                                            </div>
                                                        )}
                                                        {rep.best_copy && (
                                                            <div style={{ background: "#f3f4f6", borderRadius: 8, padding: 12 }}>
                                                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>✍️ Copy top</p>
                                                                <p style={{ fontSize: 12, color: "#111827" }}>{rep.best_copy}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {rep.note && (
                                                    <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#b45309", marginBottom: 4 }}>📝 Note</p>
                                                        <p style={{ fontSize: 13, color: "#374151" }}>{rep.note}</p>
                                                    </div>
                                                )}

                                                {/* AI report */}
                                                {rep.ai_report && (
                                                    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                                            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>🤖 Analisi AI</p>
                                                            <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }}
                                                                disabled={loading[`gen_${rep.id}`]}
                                                                onClick={async () => {
                                                                    setLoad(`gen_${rep.id}`, true);
                                                                    const r = await fetch(`${API}/clients/${id}/reports/${rep.id}/generate`, { method: "POST" });
                                                                    if (r.ok) {
                                                                        const updated = await r.json();
                                                                        setReports(p => p.map(r => r.id === rep.id ? updated : r));
                                                                    }
                                                                    setLoad(`gen_${rep.id}`, false);
                                                                }}>
                                                                {loading[`gen_${rep.id}`] ? <><div className="spinner" />Rigenerando</> : <><ArrowPathIcon style={{ width: 12, height: 12 }} />Rigenera</>}
                                                            </button>
                                                        </div>
                                                        <div style={{ fontSize: 13, lineHeight: 1.75, color: "#374151" }}>
                                                            <FormatText text={rep.ai_report} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══ ADS / CREATIVE INTELLIGENCE ══ */}
                {section === "ads" && (
                    <div style={{ maxWidth: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
                            <div>
                                <h1 className="page-title" style={{ marginBottom: 6 }}>Creatività & Intelligence Ads</h1>
                                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Copy generator, analisi inserzioni reali, angoli vincenti</p>
                            </div>
                        </div>

                        {/* ── Copy Generator ── */}
                        <div className="card" style={{ marginBottom: 24 }}>
                            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 16 }}>✍️</span> Copy Generator — Meta Ads
                            </span>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                                Genera copy strutturato con framework professionali (PAS, AIDA, BAB…) partendo dall&apos;angolo scelto e dalla VoC analysis.
                            </p>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", display: "block", marginBottom: 6 }}>Framework</label>
                                    <select className="input" value={copyFramework} onChange={e => setCopyFramework(e.target.value)}>
                                        <option value="PAS">PAS — Problem · Agitate · Solution</option>
                                        <option value="AIDA">AIDA — Attention · Interest · Desire · Action</option>
                                        <option value="BAB">BAB — Before · After · Bridge</option>
                                        <option value="HOOK_BODY_CTA">Hook · Body · CTA</option>
                                        <option value="4C">4C — Clear · Concise · Compelling · Credible</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", display: "block", marginBottom: 6 }}>Variazioni</label>
                                    <select className="input" value={copyVariations} onChange={e => setCopyVariations(Number(e.target.value))}>
                                        <option value={1}>1 variazione</option>
                                        <option value={2}>2 variazioni</option>
                                        <option value={3}>3 variazioni</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", display: "block", marginBottom: 6 }}>Angolo / Titolo</label>
                                <input
                                    className="input"
                                    style={{ width: "100%" }}
                                    placeholder="Es: 'La paura di invecchiare male' oppure 'Smetti di sprecare soldi in palestra'"
                                    value={copyAngle}
                                    onChange={e => setCopyAngle(e.target.value)}
                                />
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", display: "block", marginBottom: 6 }}>Descrizione angolo (opzionale)</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    style={{ width: "100%", fontSize: 12 }}
                                    placeholder="Contesto aggiuntivo sull'angolo, target specifico, tone of voice..."
                                    value={copyAngleDesc}
                                    onChange={e => setCopyAngleDesc(e.target.value)}
                                />
                            </div>

                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <button
                                    className="btn btn-orange"
                                    disabled={copyLoading || !copyAngle.trim()}
                                    onClick={async () => {
                                        setCopyLoading(true);
                                        setCopyError(null);
                                        try {
                                            const r = await fetch(`${API}/clients/${id}/copy/generate`, {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    framework: copyFramework,
                                                    angle_title: copyAngle,
                                                    angle_description: copyAngleDesc,
                                                    product_name: client.name || "",
                                                    variations: copyVariations
                                                })
                                            });
                                            if (r.ok) {
                                                setCopyResult(await r.json());
                                            } else {
                                                const err = await r.json();
                                                setCopyError(err.detail || "Errore generazione copy");
                                            }
                                        } catch { setCopyError("Errore di rete"); }
                                        setCopyLoading(false);
                                    }}
                                >
                                    {copyLoading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Generazione copy...</> : <><SparklesIcon style={{ width: 15, height: 15 }} />Genera Copy</>}
                                </button>
                                {vocData?.data && (
                                    <span style={{ fontSize: 11, color: "var(--lime)", fontWeight: 600 }}>● VoC caricata — il copy userà Golden Hooks reali</span>
                                )}
                            </div>
                            {copyError && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 10 }}>⚠️ {copyError}</p>}

                            {/* Copy Results */}
                            {copyResult?.variations && (
                                <div style={{ marginTop: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", margin: 0 }}>
                                            {copyResult.variations.length} {copyResult.framework_used} variation{copyResult.variations.length > 1 ? "i" : "e"} generate
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                        {copyResult.variations.map((v: any, i: number) => (
                                            <div key={i} style={{ background: "rgba(0,0,0,0.04)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>Variazione {i + 1}</p>
                                                {v.hook && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: ".07em", marginBottom: 4 }}>Hook</p>
                                                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark-primary)", margin: 0, lineHeight: 1.5 }}>{v.hook}</p>
                                                    </div>
                                                )}
                                                {v.primary_text && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: ".07em", marginBottom: 4 }}>Primary Text</p>
                                                        <p style={{ fontSize: 13, color: "var(--text-dark-primary)", margin: 0, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{v.primary_text}</p>
                                                    </div>
                                                )}
                                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                                    {v.headline && (
                                                        <div>
                                                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: ".07em", marginBottom: 3 }}>Headline</p>
                                                            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", margin: 0 }}>{v.headline}</p>
                                                        </div>
                                                    )}
                                                    {v.description && (
                                                        <div>
                                                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: ".07em", marginBottom: 3 }}>Descrizione</p>
                                                            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{v.description}</p>
                                                        </div>
                                                    )}
                                                    {v.cta_button && (
                                                        <div>
                                                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: ".07em", marginBottom: 3 }}>CTA Button</p>
                                                            <span style={{ fontSize: 12, fontWeight: 700, color: "white", background: "var(--orange)", borderRadius: 6, padding: "3px 10px" }}>{v.cta_button}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {copyResult.copy_notes && (
                                        <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8 }}>
                                            <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Note Strategiche</p>
                                            <p style={{ fontSize: 12, color: "var(--text-dark-primary)", margin: 0, lineHeight: 1.7 }}>{copyResult.copy_notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {!client.ad_account_id && (
                            <div className="card" style={{ textAlign: "center", padding: 40 }}>
                                <RocketLaunchIcon style={{ width: 40, height: 40, color: "var(--text-muted)", margin: "0 auto 12px" }} />
                                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Configura un Ad Account Meta nella sezione Sorgenti per abilitare l&apos;analisi creatività.</p>
                            </div>
                        )}

                        {client.ad_account_id && (
                            <>
                                {/* Saved intelligence banner */}
                                {savedIntelligence && !creativeAnalysis && (
                                    <div className="card" style={{ marginBottom: 20, border: "1px solid rgba(199,239,0,0.2)", background: "rgba(199,239,0,0.03)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontSize: 14 }}>🧠</span>
                                                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-dark-primary)" }}>Ultima Analisi Salvata</span>
                                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                                    {savedIntelligence.ads_count} ads · {savedIntelligence.period} · {new Date(savedIntelligence.generated_at).toLocaleDateString("it-IT")}
                                                </span>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{ fontSize: 11 }}
                                                onClick={() => setCreativeAnalysis(savedIntelligence.analysis)}
                                            >
                                                <EyeIcon style={{ width: 13, height: 13 }} /> Visualizza
                                            </button>
                                        </div>
                                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                                            Questa intelligence è già disponibile all&apos;Esperto Andromeda e alla generazione angoli.
                                        </p>
                                    </div>
                                )}

                                {/* Fetch controls */}
                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                        <select
                                            className="input"
                                            style={{ fontSize: 12, padding: "6px 10px", maxWidth: 200 }}
                                            value={adsDatePreset}
                                            onChange={e => setAdsDatePreset(e.target.value)}
                                        >
                                            <option value="last_30d">Ultimi 30 giorni</option>
                                            <option value="last_90d">Ultimi 90 giorni</option>
                                            <option value="last_quarter">Ultimo trimestre</option>
                                            <option value="last_year">Ultimo anno</option>
                                            <option value="maximum">Tutto lo storico</option>
                                        </select>
                                        <button
                                            className="btn btn-primary"
                                            onClick={fetchAdCreatives}
                                            disabled={adCreativesLoading}
                                        >
                                            {adCreativesLoading
                                                ? <><div className="spinner" style={{ width: 14, height: 14 }} />Caricamento ads...</>
                                                : <><MagnifyingGlassIcon style={{ width: 15, height: 15 }} />Carica Inserzioni</>
                                            }
                                        </button>
                                        {adCreatives.length > 0 && (
                                            <button
                                                className="btn btn-secondary"
                                                onClick={analyzeCreatives}
                                                disabled={creativeAnalysisLoading}
                                            >
                                                {creativeAnalysisLoading
                                                    ? <><div className="spinner" style={{ width: 14, height: 14 }} />Analisi AI in corso...</>
                                                    : <><SparklesIcon style={{ width: 15, height: 15 }} />Analizza con AI</>
                                                }
                                            </button>
                                        )}
                                        {adCreatives.length > 0 && (
                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                {adCreatives.length} ads caricate (su {adsTotalCount} totali)
                                            </span>
                                        )}
                                    </div>
                                    {adCreativesError && (
                                        <p style={{ fontSize: 12, color: "#ef4444", marginTop: 10, marginBottom: 0 }}>⚠️ {adCreativesError}</p>
                                    )}
                                </div>

                                {/* AI Analysis result */}
                                {(creativeAnalysis || creativeAnalysisLoading) && (
                                    <div className="card" style={{ marginBottom: 20, border: "1px solid rgba(199,239,0,0.2)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <SparklesIcon style={{ width: 16, height: 16, color: "var(--lime)" }} />
                                                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-dark-primary)" }}>Analisi Strategica Creatività</span>
                                                {creativeAnalysisLoading && <div className="spinner" />}
                                            </div>
                                            {creativeAnalysis && (
                                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setCreativeAnalysis(null)}>
                                                    <XMarkIcon style={{ width: 13, height: 13 }} /> Chiudi
                                                </button>
                                            )}
                                        </div>
                                        {creativeAnalysis && (
                                            <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-dark-primary)" }}>
                                                <FormatText text={creativeAnalysis} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Ads list */}
                                {adCreatives.length > 0 && (
                                    <div>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>
                                            Inserzioni — ordinate per CTR
                                        </p>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {[...adCreatives].sort((a, b) => (b.ctr || 0) - (a.ctr || 0)).map((ad, i) => {
                                                const key = ad.ad_id || String(i);
                                                const isExpanded = expandedAd === key;
                                                const hasCreative = ad.body || ad.title;
                                                const imgUrl = ad.thumbnail_url || ad.image_url;
                                                return (
                                                    <div
                                                        key={key}
                                                        className="card"
                                                        style={{ padding: "12px 16px", cursor: hasCreative ? "pointer" : "default", transition: "border-color .15s", border: isExpanded ? "1px solid rgba(199,239,0,0.35)" : "1px solid var(--border)" }}
                                                        onClick={() => hasCreative && setExpandedAd(isExpanded ? null : key)}
                                                    >
                                                        {/* Row summary */}
                                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                            {imgUrl && (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={imgUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                                                            )}
                                                            {!imgUrl && (
                                                                <div style={{ width: 48, height: 48, borderRadius: 6, background: "rgba(0,0,0,0.06)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                                    <PhotoIcon style={{ width: 20, height: 20, color: "var(--text-muted)" }} />
                                                                </div>
                                                            )}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dark-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                    {ad.ad_name || "—"}
                                                                </div>
                                                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                    {ad.campaign_name}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: "flex", gap: 12, flexShrink: 0, fontSize: 12 }}>
                                                                {[
                                                                    { l: "Spend", v: `€${ad.spend}`, c: "#6366f1" },
                                                                    { l: "CTR", v: `${ad.ctr}%`, c: ad.ctr >= 2 ? "#10b981" : ad.ctr >= 1 ? "#f59e0b" : "#ef4444" },
                                                                    { l: "CPC", v: `€${ad.cpc}`, c: "#3b82f6" },
                                                                    { l: "Conv", v: ad.conversioni || "—", c: "#f97316" },
                                                                    { l: "CPA", v: ad.cpa ? `€${ad.cpa}` : "—", c: "#ec4899" },
                                                                ].map(m => (
                                                                    <div key={m.l} style={{ textAlign: "center" }}>
                                                                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", letterSpacing: ".06em" }}>{m.l}</div>
                                                                        <div style={{ fontWeight: 700, color: m.c }}>{m.v}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {hasCreative && (
                                                                <ChevronIcon expanded={isExpanded} />
                                                            )}
                                                        </div>

                                                        {/* Expanded creative */}
                                                        {isExpanded && (
                                                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                                                                {ad.title && (
                                                                    <div style={{ marginBottom: 8 }}>
                                                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: ".07em" }}>Headline</span>
                                                                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dark-primary)", marginTop: 4, marginBottom: 0 }}>{ad.title}</p>
                                                                    </div>
                                                                )}
                                                                {ad.body && (
                                                                    <div style={{ marginBottom: 8 }}>
                                                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: ".07em" }}>Copy</span>
                                                                        <p style={{ fontSize: 13, color: "var(--text-dark-primary)", marginTop: 4, marginBottom: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ad.body}</p>
                                                                    </div>
                                                                )}
                                                                {ad.description && (
                                                                    <div>
                                                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: ".07em" }}>Descrizione</span>
                                                                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>{ad.description}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {!adCreatives.length && !adCreativesLoading && !adCreativesError && (
                                    <div className="card" style={{ textAlign: "center", padding: 40 }}>
                                        <MagnifyingGlassIcon style={{ width: 36, height: 36, color: "var(--text-muted)", margin: "0 auto 12px" }} />
                                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 0 }}>
                                            Seleziona un periodo e clicca &quot;Carica Inserzioni&quot; per analizzare le creatività.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
    return (
        <svg style={{ width: 16, height: 16, color: "var(--text-muted)", flexShrink: 0, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    );
}

