"use client";

import { useState, useEffect, use, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import AnalisiStrategicaSection from "@/components/AnalisiStrategicaSection";
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
    DocumentTextIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { Bars3Icon } from "@heroicons/react/24/solid";

const API = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? 'https://antigravity-backend-production-41ee.up.railway.app' : 'http://127.0.0.1:8001');

const LINK_TYPES = [
    { value: "website",         label: "🌐 Sito Web" },
    { value: "instagram",       label: "📸 Instagram" },
    { value: "facebook",        label: "📘 Facebook" },
    { value: "tiktok",          label: "🎵 TikTok" },
    { value: "youtube",         label: "▶️ YouTube" },
    { value: "reviews",         label: "⭐ Recensioni" },
    { value: "service",         label: "🛠️ Servizio / Landing Page" },
    { value: "google_business", label: "📍 Google My Business" },
    { value: "ads_library",     label: "📊 Libreria ADS Meta" },
    { value: "other",           label: "📎 Altro" },
];

const LINK_TYPE_COLORS: Record<string, string> = {
    website:         "#3b82f6",
    instagram:       "#e1306c",
    facebook:        "#1877f2",
    tiktok:          "#000000",
    youtube:         "#ff0000",
    reviews:         "#f59e0b",
    service:         "#8b5cf6",
    google_business: "#10b981",
    ads_library:     "#f97316",
    other:           "#6b7280",
};

type SectionType = "sorgenti" | "identita" | "analisi-strategica" | "personas" | "reports";


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
                ? <strong key={j} style={{ color: "var(--orange)", fontWeight: 700 }}>{p}</strong>
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
                        <p key={i} style={{ fontWeight: 800, color: "var(--lime)", fontSize, marginTop, marginBottom: 8, letterSpacing: "-0.01em" }}>
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
    const [newLinkType, setNewLinkType] = useState("website");
    const [newCompetitor, setNewCompetitor] = useState("");
    const [newCompetitorUrl, setNewCompetitorUrl] = useState("");
    const [newCompetitorType, setNewCompetitorType] = useState("website");
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

    // Personas Specifiche
    const [newPersonaTheme, setNewPersonaTheme] = useState("");
    const [personaLoading, setPersonaLoading] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    useGSAP(() => {
        gsap.fromTo(
            ".card, .angle-card, .persona-card, .report-card",
            { y: 20, opacity: 0, scale: 0.98 },
            { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.04, ease: "power2.out", clearProps: "all" }
        );
    }, { scope: containerRef, dependencies: [section, client, reports, battlecards] });

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
        const linkObj = { url: newLink.trim(), label: newLinkType, description: LINK_TYPES.find(t => t.value === newLinkType)?.label ?? newLinkType };
        const updatedLinks = [...(client.links || []), linkObj];
        await fetch(`${API}/clients/${id}/links`, { 
            method: "PATCH", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ links: updatedLinks }) 
        });
        setNewLink(""); setNewLinkType("website"); load();
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
            setNewCompetitorType("website");
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
        { key: "analisi-strategica", icon: DocumentTextIcon, label: "Analisi Strategica" },
        { key: "personas", icon: UserGroupIcon, label: "Buyer Personas" },
        { key: "reports", icon: ChartBarIcon, label: "Reports" },
    ];


    const swotData = [
        { key: "strengths", label: "Punti di Forza", css: "swot-s", icon: BoltIcon },
        { key: "weaknesses", label: "Punti Deboli", css: "swot-w", icon: ShieldExclamationIcon },
        { key: "opportunities", label: "Opportunità", css: "swot-o", icon: RocketLaunchIcon },
        { key: "threats", label: "Minacce", css: "swot-t", icon: ExclamationTriangleIcon },
    ];

    return (
        <div className="app-layout" ref={containerRef}>
            <div className={`sidebar-overlay ${mobileMenuOpen ? 'visible' : ''}`} onClick={() => setMobileMenuOpen(false)} />
            {/* ═══ SIDEBAR ═══ */}
            <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src="/logo.png" alt="Alessio Ferlizzo" style={{ height: '26px', width: 'auto', borderRadius: '4px' }} />
                        <div>Alessio <span>Ferlizzo</span></div>
                    </div>
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
                        <button key={key} onClick={() => { setSection(key); setMobileMenuOpen(false); }} className={`sidebar-link ${section === key ? "active" : ""}`}>
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
            <main className="main-content" style={{ display: "flex", flexDirection: "column" }}>
                <div className="mobile-only-header" style={{ display: "flex", gap: 12, padding: "12px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(4, 37, 88, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 40, width: "100%", flexDirection: "column", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                        <button onClick={() => window.location.href = "/"} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: 4, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <ArrowLeftIcon strokeWidth={2.5} style={{ width: 18, height: 18 }} />
                        </button>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{client.name || "Caricamento..."}</div>
                    </div>
                    {/* Mobile Tabs */}
                    <div className="mobile-tabs-scroll" style={{ display: "flex", width: "100%", overflowX: "auto", gap: 12, paddingBottom: 4, marginTop: 12, msOverflowStyle: "none", scrollbarWidth: "none" }}>
                        <style>{`.mobile-tabs-scroll::-webkit-scrollbar { display: none; }`}</style>
                        {navItems.map(({ key, label }) => (
                            <button key={key} onClick={() => setSection(key)} style={{
                                background: "none", border: "none", padding: "6px 2px",
                                fontSize: 14, fontWeight: section === key ? 700 : 500,
                                color: section === key ? "#fff" : "rgba(255,255,255,0.5)",
                                borderBottom: section === key ? "2px solid var(--lime)" : "2px solid transparent",
                                whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.15s"
                            }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div style={{ padding: "24px" }}>
                {/* ══ SORGENTI ══ */}
                {section === "sorgenti" && (
                    <div style={{ maxWidth: "1200px", margin: "0 auto", overflowX: "hidden" }}>
                        <h1 className="page-title" style={{ marginBottom: 6, color: "#ffffff" }}>Sorgenti</h1>
                        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 28 }}>Documenti, Link e Competitor di riferimento per la ricerca</p>

                        {/* Documenti */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <DocumentIcon style={{ width: 16, height: 16, color: "var(--lime)" }} />Documenti Caricati
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
                                <input type="file" className="hidden" style={{ display: "none" }} multiple accept=".pdf,.txt,.docx,.csv" onChange={uploadFile} />
                            </label>
                        </div>

                        {/* Links */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <LinkIcon style={{ width: 16, height: 16, color: "var(--orange)" }} />Link e Fonti Esterne
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {(client.links || []).map((l: any, i: number) => {
                                    const url = typeof l === 'string' ? l : l.url;
                                    const desc = typeof l === 'string' ? "" : (l.description || "");
                                    const linkType = typeof l === 'string' ? "other" : (l.label || "other");
                                    const typeColor = LINK_TYPE_COLORS[linkType] || LINK_TYPE_COLORS.other;
                                    const typeLabel = LINK_TYPES.find(t => t.value === linkType)?.label ?? linkType;
                                    return (
                                        <div key={i} className="link-item">
                                            <div style={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, background: `${typeColor}18`, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap", border: `1px solid ${typeColor}40` }}>
                                                        {typeLabel}
                                                    </span>
                                                </div>
                                                <a href={url} target="_blank" rel="noreferrer" className="link-url" style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{url}</a>
                                            </div>
                                            <button
                                                className="icon-btn"
                                                onClick={() => removeLink(i)}
                                                style={{
                                                    flexShrink: 0,
                                                    color: "#dc2626",
                                                    opacity: 0.7,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    padding: "6px"
                                                }}
                                            >
                                                <TrashIcon style={{ width: 16, height: 16 }} />
                                            </button>
                                        </div>
                                    );
                                })}
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.02)", border: "1px dashed var(--border)" }}>
                                    <input className="input" placeholder="Incolla l'URL del link (es. https://...)" value={newLink} onChange={e => setNewLink(e.target.value)} />
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <select
                                            className="input"
                                            style={{ flex: 1, cursor: "pointer" }}
                                            value={newLinkType}
                                            onChange={e => setNewLinkType(e.target.value)}
                                        >
                                            {LINK_TYPES.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
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
                                             <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{c.name || "Senza Nome"}</span>
                                             <button className="icon-btn" style={{ color: "var(--red)" }} onClick={() => removeCompetitor(i)}>
                                                 <TrashIcon style={{ width: 14, height: 14 }} />
                                             </button>
                                         </div>
                                         
                                         <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                                             {(c.links || []).map((l: any, li: number) => {
                                                 const compLinkType = l.label || "other";
                                                 const compTypeColor = LINK_TYPE_COLORS[compLinkType] || LINK_TYPE_COLORS.other;
                                                 const compTypeLabel = LINK_TYPES.find(t => t.value === compLinkType)?.label ?? l.label ?? "Link";
                                                 return (
                                                     <span key={li} className="tag" style={{ border: `1px solid ${compTypeColor}60`, background: `${compTypeColor}10`, color: compTypeColor, display: "flex", alignItems: "center", gap: 4 }}>
                                                         <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                                                             <div style={{ display: "flex", alignItems: "center" }}>
                                                                 <a href={l.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline", marginRight: 4, fontWeight: 600, fontSize: 11 }}>
                                                                     {compTypeLabel}
                                                                 </a>
                                                             </div>
                                                         </div>
                                                         <button className="icon-btn" onClick={() => removeCompetitorLink(i, li)}>
                                                             <XMarkIcon style={{ width: 12, height: 12 }} />
                                                         </button>
                                                     </span>
                                                 );
                                             })}
                                         </div>

                                         <div style={{ display: "flex", gap: 6, alignItems: "center", background: "#fff", padding: "4px 8px", borderRadius: 8, border: "1px dashed var(--border)" }}>
                                             <input 
                                                 className="input" 
                                                 style={{ border: "none", background: "transparent", fontSize: 12, flex: 2 }} 
                                                 placeholder="Incolla URL..." 
                                                 value={selectedCompIdx === i ? newCompetitorUrl : ""} 
                                                 onChange={e => { setSelectedCompIdx(i); setNewCompetitorUrl(e.target.value); }} 
                                             />
                                             <select
                                                 className="input"
                                                 style={{ border: "none", background: "transparent", fontSize: 12, flex: 1, cursor: "pointer" }}
                                                 value={selectedCompIdx === i ? newCompetitorType : "website"}
                                                 onChange={e => { setSelectedCompIdx(i); setNewCompetitorType(e.target.value); }}
                                             >
                                                 {LINK_TYPES.map(t => (
                                                     <option key={t.value} value={t.value}>{t.label}</option>
                                                 ))}
                                             </select>
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

                         {/* Istruzioni per Analisi Strategica */}
                         <div className="card" style={{ marginTop: 24, background: "rgba(149,191,71,0.05)", border: "1px solid rgba(149,191,71,0.2)" }}>
                             <div style={{ marginBottom: 12 }}>
                                 <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lime)" }}>
                                     <SparklesIcon style={{ width: 18, height: 18 }} />
                                     Pronto per l'Analisi Strategica?
                                 </span>
                             </div>
                             <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
                                 Dopo aver aggiunto link, competitor e documenti, vai alla sezione <strong>Analisi Strategica</strong> per generare l'analisi completa in 14 sezioni.
                             </p>
                             <p style={{ fontSize: 12, color: "rgba(149,191,71,0.8)", background: "rgba(149,191,71,0.1)", padding: "8px 12px", borderRadius: 6, marginBottom: 0 }}>
                                 💡 L'analisi raccoglierà automaticamente dati da sito web, social, recensioni Google e competitor.
                             </p>
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
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{client.name}</div>
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
                                            style={{ fontSize: 14, fontWeight: 600, color: "var(--lime)", height: 32, padding: "4px 8px" }}
                                            value={client.industry || ""} 
                                            onChange={e => setClient({ ...client, industry: e.target.value })}
                                            onBlur={e => patchIndustry(e.target.value)}
                                            autoFocus
                                        />
                                    ) : (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--lime)" }}>{client.industry || "Non definito"}</div>
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
                                        <label style={{ fontSize: 12, color: "var(--lime)", cursor: "pointer", textDecoration: "underline" }}>
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
                                    <IdentificationIcon style={{ width: 16, height: 16, color: "var(--lime)" }} />Tono di Voce
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
                                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Live Meta Ads</span>
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
                                    <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", margin: 0 }}>📊 Inserisci Dati Periodo</p>
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

                {/* ══ ANALISI COMPLETA ══ */}
                {/* ══ ANALISI COMPLETA ══ */}
                {section === "analisi-strategica" && (
                    <AnalisiStrategicaSection clientId={id} apiUrl={API} />
                )}
                </div>
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

