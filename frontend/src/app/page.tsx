"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  PlusIcon, TrashIcon, CheckIcon,
  CalendarIcon, XMarkIcon,
  ClipboardDocumentListIcon, PaintBrushIcon,
  LightBulbIcon, DocumentTextIcon, PencilSquareIcon,
  ChevronRightIcon, SparklesIcon, ArrowPathIcon,
  PhotoIcon, MagnifyingGlassIcon, UserIcon, MapPinIcon, TagIcon, ShoppingBagIcon, BookmarkSquareIcon,
  ChartBarIcon, ArrowTrendingUpIcon, ChevronDownIcon, InboxIcon, CheckCircleIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { FlagIcon as FlagIconSolid, Bars3Icon } from "@heroicons/react/24/solid";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import TasksSection from "@/components/TasksSection";
import SmartListEditor from "@/components/SmartListEditor";
import { Client, Task } from "@/types";



const API = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? 'https://antigravity-backend-production-41ee.up.railway.app' : 'http://127.0.0.1:8001');

/* ─── helpers ─── */
const AVATAR_COLORS = [
  "#003366", "#0a4a8a", "#7c3aed", "#0369a1", "#15803d",
  "#b45309", "#be185d", "#0f766e", "#c2410c", "#1d4ed8",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function formatLocalISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function FormatText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const renderInline = (s: string) => {
    const parts = s.split(/\*\*(.*?)\*\*/g);
    return parts.map((p, j) =>
      j % 2 === 1 ? <strong key={j} style={{ color: "#111827", fontWeight: 700 }}>{p}</strong> : <span key={j}>{p}</span>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 4 }} />;
        if (t.startsWith("- ") || t.startsWith("• "))
          return <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}><span style={{ color: "#ff9e1c", marginTop: 2, flexShrink: 0 }}>•</span><span>{renderInline(t.slice(2))}</span></div>;
        const nm = t.match(/^(\d+)[.)]\s+(.+)$/);
        if (nm) return <div key={i} style={{ display: "flex", gap: 7 }}><span style={{ color: "#ff9e1c", fontWeight: 700, fontSize: 11, minWidth: 16 }}>{nm[1]}.</span><span>{renderInline(nm[2])}</span></div>;
        const hm = t.match(/^#{1,3}\s+(.+)$/);
        if (hm) return <p key={i} style={{ fontWeight: 700, color: "#111827", fontSize: 13 }}>{renderInline(hm[1])}</p>;
        return <p key={i} style={{ lineHeight: 1.75 }}>{renderInline(t)}</p>;
      })}
    </div>
  );
}




type WsSection = "tasks" | "grafiche" | "angoli" | "script" | "copy" | "live-ads";
const STATUS_CYCLE: Record<string, string> = { todo: "doing", doing: "done", done: "todo" };
const PRIORITY_ORDER: Record<string, number> = { alta: 0, media: 1, bassa: 2 };
const GFX_FORMATS = ["Feed IG (1:1)", "Feed IG (4:5)", "Stories (9:16)", "Banner (16:9)", "Carosello", "LinkedIn (1.91:1)", "Pinterest (2:3)"];
const FUNNEL_STAGES = [
  { key: "discovery", emoji: "🔍", label: "Scoperta", desc: "Non conosce il brand" },
  { key: "interest", emoji: "💡", label: "Interesse", desc: "Conosce, non è convinto" },
  { key: "decision", emoji: "🎯", label: "Decisione", desc: "Valuta l'acquisto" },
  { key: "action", emoji: "🔥", label: "Azione", desc: "Pronto a comprare" },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [section, setSection] = useState<WsSection>("tasks");
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Modals
  const [clientModal, setClientModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", industry: "", links: "", competitors: "" });
  const [taskForm, setTaskForm] = useState({ title: "", client_id: "", client_name: "", priority: "media", due_date: "", notes: "", estimated_time: "" });
  const [activeSmartList, setActiveSmartList] = useState<string>("all");
  const [activeCustomListId, setActiveCustomListId] = useState<string | null>(null);
  const [customLists, setCustomLists] = useState<any[]>([]);
  const [smartLists, setSmartLists] = useState<any[]>([]);
  const [smartListEditorOpen, setSmartListEditorOpen] = useState(false);
  const [editingSmartList, setEditingSmartList] = useState<any | null>(null);
  const [smartListCtxMenu, setSmartListCtxMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null);

  useGSAP(() => {
    // Initial staggered entry for smart lists and general cards
    gsap.fromTo(
      ".smart-list-card",
      { y: 20, opacity: 0, scale: 0.95, rotationX: 10 },
      { y: 0, opacity: 1, scale: 1, rotationX: 0, duration: 0.5, stagger: 0.05, ease: "back.out(1.2)", delay: 0.1, clearProps: "all" }
    );
    gsap.fromTo(
      ".card, .angle-card, .persona-card, .report-card",
      { y: 20, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.04, ease: "power2.out", clearProps: "all" }
    );
  }, { scope: containerRef, dependencies: [section, smartLists] });

  // Sidebar enhancements
  const [clientSearch, setClientSearch] = useState("");
  const [activeClientFilter, setActiveClientFilter] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragSrc = useRef<string | null>(null);
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  // Sidebar inline task add
  const [sidebarInlineAdd, setSidebarInlineAdd] = useState<string | null>(null);
  const [sidebarInlineText, setSidebarInlineText] = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Task filters
  const [fStatus, setFStatus] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const [fPriority, setFPriority] = useState("all");
  const [fTime, setFTime] = useState("all");

  // Calendar view
  const [taskView, setTaskView] = useState<"list" | "calendar">("list");
  const [calWeekStart, setCalWeekStart] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Monday
    return d;
  });
  const [calDragOverDay, setCalDragOverDay] = useState<string | null>(null);
  const calDragTaskRef = useRef<string | null>(null);

  async function calDropTaskOnDay(dateStr: string) {
    const taskId = calDragTaskRef.current;
    if (!taskId) return;
    setCalDragOverDay(null);
    calDragTaskRef.current = null;
    const r = await fetch(`${API}/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_date: dateStr })
    });
    if (r.ok) {
      const updated = await r.json();
      setTasks(p => p.map(t => t.id === taskId ? updated : t));
    }
  }


  // Grafiche
  const [gfxClientId, setGfxClientId] = useState("");
  const [gfxRefFilename, setGfxRefFilename] = useState<string | null>(null);
  const [gfxFormats, setGfxFormats] = useState<string[]>(["Feed IG (4:5)"]);
  const [gfxModel, setGfxModel] = useState<string>("fal-ai/flux-pro/v1.1-ultra");
  const [gfxPrompt, setGfxPrompt] = useState("");
  type GfxImageRef = { data: string; mime: string; name: string; selected: boolean };
  const [gfxSlotLogo, setGfxSlotLogo] = useState<GfxImageRef[]>([]);
  const [gfxSlotPersona, setGfxSlotPersona] = useState<GfxImageRef[]>([]);
  const [gfxSlotProdotto, setGfxSlotProdotto] = useState<GfxImageRef[]>([]);
  const [gfxSlotContesto, setGfxSlotContesto] = useState<GfxImageRef[]>([]);
  const [gfxLoading, setGfxLoading] = useState(false);
  const [gfxResult, setGfxResult] = useState<{ filename: string; url: string; enhanced_prompt: string } | null>(null);
  const [gfxGallery, setGfxGallery] = useState<any[]>([]);

  // Angoli
  const [angCliId, setAngCliId] = useState("");
  const [angFunnel, setAngFunnel] = useState("");
  const [angPrompt, setAngPrompt] = useState("");
  const [angles, setAngles] = useState<any[]>([]);
  const [angLoading, setAngLoading] = useState(false);

  // Script
  const [scrCliId, setScrCliId] = useState("");
  const [scrCliAngles, setScrCliAngles] = useState<any[]>([]);
  const [scrAngle, setScrAngle] = useState<any>(null);
  const [scrInstr, setScrInstr] = useState("");
  const [scrCount, setScrCount] = useState(1);
  const [allScripts, setAllScripts] = useState<{ content: string }[]>([]);
  const [scrIdx, setScrIdx] = useState(0);
  const [scrText, setScrText] = useState("");
  const [scrFeedback, setScrFeedback] = useState("");
  const [scrLoading, setScrLoading] = useState(false);
  const [scrAngLoading, setScrAngLoading] = useState(false);

  // Copy
  const [cpyCliId, setCpyCliId] = useState("");
  const [cpyType, setCpyType] = useState("caption");
  const [cpyPrompt, setCpyPrompt] = useState("");
  const [cpyOutput, setCpyOutput] = useState("");
  const [cpyLoading, setCpyLoading] = useState(false);

  // Live Ads
  const [ladsPeriod, setLadsPeriod] = useState("last_30d");
  const [ladsOverview, setLadsOverview] = useState<any>(null);
  const [ladsLoading, setLadsLoading] = useState(false);
  const [ladsError, setLadsError] = useState<string | null>(null);
  const [ladsExpanded, setLadsExpanded] = useState<string | null>(null);
  const [ladsCampaigns, setLadsCampaigns] = useState<Record<string, any[]>>({});
  const [ladsCampLoading, setLadsCampLoading] = useState<string | null>(null);
  const [ladsChat, setLadsChat] = useState<Record<string, { role: "user" | "assistant"; content: string }[]>>({});
  const [ladsChatInput, setLadsChatInput] = useState<Record<string, string>>({});
  const [ladsChatSending, setLadsChatSending] = useState<string | null>(null);
  const [ladsAnalyzing, setLadsAnalyzing] = useState<string | null>(null);
  const [ladsClientFilter, setLadsClientFilter] = useState("");
  const [ladsDateSince, setLadsDateSince] = useState("");
  const [ladsDateUntil, setLadsDateUntil] = useState("");

  // Vault Modal
  const [vaultModal, setVaultModal] = useState(false);
  const [vaultData, setVaultData] = useState({ title: "", text: "", type: "copy", funnel_stage: "", format: "", img_link: "", client_id: "", sector: "" });
  const [vaultSaving, setVaultSaving] = useState(false);

  // Function to load data from backend
  const loadData = useCallback(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout - Railway always-on backend

    setLoading(true);
    Promise.all([
      fetch(`${API}/clients`, { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject("Clients failed")),
      fetch(`${API}/tasks`, { signal: controller.signal }).then(r => r.ok ? r.json() : (r.status === 404 ? [] : Promise.reject("Tasks failed"))),
      fetch(`${API}/lists`, { signal: controller.signal }).then(r => r.ok ? r.json() : (r.status === 404 ? [] : Promise.reject("Lists failed"))),
      fetch(`${API}/smart-lists`, { signal: controller.signal }).then(r => r.ok ? r.json() : []).catch(() => []), // Fallback to empty array if endpoint doesn't exist yet
    ]).then(([c, t, l, s]) => {
      clearTimeout(timeout);
      // Success: update state and local cache
      const savedOrder: string[] = JSON.parse(localStorage.getItem("ag_clientOrder") || "[]");
      const sorted = savedOrder.length
        ? [...c].sort((a: Client, b: Client) => {
          const ai = savedOrder.indexOf(a.id), bi = savedOrder.indexOf(b.id);
          return ai === -1 ? 1 : bi === -1 ? -1 : ai - bi;
        })
        : c;
      setClients(sorted);
      setTasks(t);
      setCustomLists(l);
      setSmartLists(s);
      setLoading(false);
      setIsOffline(false);
      setBackendError(false);
      // Save for offline use
      localStorage.setItem("ag_clients_cache", JSON.stringify(sorted));
      localStorage.setItem("ag_tasks_cache", JSON.stringify(t));
      localStorage.setItem("ag_lists_cache", JSON.stringify(l));
      localStorage.setItem("ag_smart_lists_cache", JSON.stringify(s));
    }).catch(err => {
      clearTimeout(timeout);
      console.warn("Backend not reachable, loading from cache...", err);

      // Try to load from localStorage cache
      const cachedClients = JSON.parse(localStorage.getItem("ag_clients_cache") || "[]");
      const cachedTasks = JSON.parse(localStorage.getItem("ag_tasks_cache") || "[]");
      const cachedLists = JSON.parse(localStorage.getItem("ag_lists_cache") || "[]");
      const cachedSmartLists = JSON.parse(localStorage.getItem("ag_smart_lists_cache") || "[]");

      setClients(cachedClients);
      setTasks(cachedTasks);
      setCustomLists(cachedLists);
      setSmartLists(cachedSmartLists);
      setLoading(false);
      setIsOffline(true);
      setBackendError(true);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  function saveOrder(list: Client[]) {
    localStorage.setItem("ag_clientOrder", JSON.stringify(list.map(c => c.id)));
  }
  function handleDragStart(id: string) { dragSrc.current = id; }
  function handleDragEnter(id: string) { setDragOver(id); }
  function handleDrop(targetId: string) {
    const srcId = dragSrc.current;
    if (!srcId || srcId === targetId) { setDragOver(null); return; }
    setClients(prev => {
      const arr = [...prev];
      const si = arr.findIndex(c => c.id === srcId);
      const ti = arr.findIndex(c => c.id === targetId);
      const [r] = arr.splice(si, 1); arr.splice(ti, 0, r);
      saveOrder(arr); return arr;
    });
    setDragOver(null);
  }
  /* ─── client helpers ─── */
  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    const linksArray = clientForm.links.split("\n").filter(Boolean).map(l => ({ url: l, description: "" }));
    const competitorsArray = clientForm.competitors.split("\n").filter(Boolean).map(c => {
      if (c.startsWith("http")) return { name: c, links: [{ url: c, label: "" }] };
      return { name: c, links: [] };
    });

    const r = await fetch(`${API}/clients`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: clientForm.name,
        industry: clientForm.industry,
        links: linksArray,
        competitors: competitorsArray
      })
    });
    if (r.ok) {
      const { client_id } = await r.json();
      setClients(p => [...p, { id: client_id, name: clientForm.name }]);
      setClientModal(false); setClientForm({ name: "", industry: "", links: "", competitors: "" });
    }
  }
  async function deleteClient(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Eliminare questo cliente?")) return;
    const r = await fetch(`${API}/clients/${id}`, { method: "DELETE" });
    if (r.ok) setClients(p => p.filter(c => c.id !== id));
  }

  /* ─── tasks helpers ─── */
  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`${API}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskForm)
    });
    if (r.ok) {
      const t = await r.json();
      setTasks(p => [t, ...p]);
      setTaskModal(false); setTaskForm({ title: "", client_id: "", client_name: "", priority: "media", due_date: "", notes: "", estimated_time: "" });

    }
  }
  async function cycleStatus(task: Task) {
    const ns = STATUS_CYCLE[task.status] || "todo";
    const r = await fetch(`${API}/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: ns }) });
    if (r.ok) setTasks(p => p.map(t => t.id === task.id ? { ...t, status: ns } : t));
  }

  /* ─── vault helpers ─── */
  async function openVaultModal(type: "copy" | "angle" | "graphic" | "angle", defTitle: string, defText: string, clientId: string, funnel: string = "", format: string = "", imgLink: string = "") {
    // Recupera l'industria dal cliente se possibile
    let clientIndustry = "";
    try {
      if (clientId) {
        const res = await fetch(`${API}/clients/${clientId}`);
        if (res.ok) {
          const metadata = await res.json();
          clientIndustry = metadata.industry || "";
        }
      }
    } catch (e) { console.error("Could not fetch client industry", e); }

    // Per le grafiche, inizializziamo il testo (note) come vuoto invece che col prompt
    const initialText = type === "graphic" ? "" : defText;

    setVaultData({ title: defTitle, text: initialText, type, client_id: clientId, funnel_stage: funnel, format, img_link: imgLink, sector: clientIndustry });
    setVaultModal(true);
  }

  async function saveToVault() {
    setVaultSaving(true);
    try {
      const res = await fetch(`${API}/clients/${vaultData.client_id}/vault/${vaultData.type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: vaultData.title,
          text: vaultData.text,
          sector: vaultData.sector, // Aggiunto settore
          funnel_stage: vaultData.funnel_stage,
          format: vaultData.format,
          img_link: vaultData.img_link
        })
      });
      if (res.ok) {
        setVaultModal(false);
      } else {
        alert("Errore durante il salvataggio su Notion.");
      }
    } catch (e) {
      alert("Errore di rete.");
    } finally {
      setVaultSaving(false);
    }
  }
  async function deleteTask(id: string) {
    if (!confirm("Eliminare la task?")) return;
    const r = await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
    if (r.ok) setTasks(p => p.filter(t => t.id !== id));
  }

  /* ─── angoli helpers ─── */
  async function genAngles() {
    if (!angCliId) return;
    setAngLoading(true);
    const r = await fetch(`${API}/clients/${angCliId}/angles`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_prompt: angPrompt, funnel_stage: angFunnel })
    });
    if (r.ok) setAngles(await r.json());
    setAngLoading(false);
  }

  /* ─── script helpers ─── */
  const loadClientAngles = useCallback(async (clientId: string) => {
    if (!clientId) { setScrCliAngles([]); return; }
    setScrAngLoading(true);
    const r = await fetch(`${API}/clients/${clientId}/angles`);
    if (r.ok) setScrCliAngles(await r.json());
    setScrAngLoading(false);
  }, []);

  async function genScript() {
    if (!scrAngle || !scrCliId) return;
    setScrLoading(true);
    const r = await fetch(`${API}/clients/${scrCliId}/scripts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: scrAngle.title, description: scrAngle.description || "", emotion: scrAngle.emotion || "", script_instructions: scrInstr, count: scrCount })
    });
    const data = await r.json();
    const arr = Array.isArray(data) ? data : [data];
    setAllScripts(arr); setScrIdx(0); setScrText(arr[0]?.content || "");
    setScrLoading(false);
  }
  async function submitScrFeedback() {
    if (!scrFeedback || !scrCliId) return;
    setScrLoading(true);
    try {
      const currentScript = allScripts[scrIdx];
      const r = await fetch(`${API}/clients/${scrCliId}/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: scrFeedback,
          angle_title: scrAngle?.title || "",
          script_id: `script_${scrIdx + 1}`
        })
      });
      if (!r.ok) throw new Error("Errore durante la ridefinizione.");
      const d = await r.json();
      setScrText(d.content);
      setScrFeedback("");
      // Update the current script in the list with the new version if needed
      // For now we just update the text view
    } catch (e) {
      alert("Errore nella ridefinizione dello script. Riprova.");
    } finally {
      setScrLoading(false);
    }
  }

  /* ─── copy helpers ─── */
  async function genCopy() {
    if (!cpyCliId) return;
    setCpyLoading(true);
    // Use existing script endpoint with copy-focused instructions
    const r = await fetch(`${API}/clients/${cpyCliId}/scripts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Copy ${cpyType}`,
        description: cpyPrompt || `Crea copy per ${cpyType}`,
        script_instructions: `TIPO DI COPY: ${cpyType.toUpperCase()}. ${cpyPrompt}. Non scrivere uno script video. Crea copy ottimizzato per ${cpyType}.`,
        count: 1
      })
    });
    const data = await r.json();
    const arr = Array.isArray(data) ? data : [data];
    setCpyOutput(arr[0]?.content || "");
    setCpyLoading(false);
  }

  /* ─── quick add ─── */
  async function quickAddTask() {
    if (!quickAdd.trim()) return;
    setQuickAddLoading(true);
    const clientId = activeClientFilter || "";
    const clientName = clientId ? (clients.find(c => c.id === clientId)?.name || "") : "";
    const r = await fetch(`${API}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: quickAdd.trim(), client_id: clientId, client_name: clientName, priority: "media", due_date: quickAddDate, notes: "", estimated_time: "" })
    });
    if (r.ok) { const t = await r.json(); setTasks(p => [t, ...p]); }
    setQuickAdd("");
    setQuickAddDate("");
    setQuickAddLoading(false);
  }

  /* ─── sidebar inline task add ─── */
  async function createSidebarTask() {
    if (!sidebarInlineAdd || !sidebarInlineText.trim()) {
      setSidebarInlineAdd(null);
      setSidebarInlineText("");
      return;
    }
    const clientName = clients.find(c => c.id === sidebarInlineAdd)?.name || "";
    const r = await fetch(`${API}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        title: sidebarInlineText.trim(), 
        client_id: sidebarInlineAdd, 
        client_name: clientName, 
        priority: "media", 
        due_date: "", 
        notes: "", 
        estimated_time: "",
        list_id: activeCustomListId || "" 
      })
    });
    if (r.ok) { const t = await r.json(); setTasks(p => [t, ...p]); }
    setSidebarInlineText("");
    setSidebarInlineAdd(null);
  }

  /* ─── list helpers ─── */
  async function createCustomList() {
    const title = prompt("Nome della nuova lista:");
    if (!title) return;
    const color = "#007aff";
    const r = await fetch(`${API}/lists`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, color, icon: "list" })
    });
    if (r.ok) {
      const newList = await r.json();
      setCustomLists(p => [...p, newList]);
      setActiveCustomListId(newList.id);
      setActiveSmartList("all"); // Switch to focus on custom list
      setSection("tasks");
    }
  }

  async function deleteCustomList(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questa lista? Le task non verranno eliminate ma rimosse dalla lista.")) return;
    const r = await fetch(`${API}/lists/${id}`, { method: "DELETE" });
    if (r.ok) {
      setCustomLists(p => p.filter(l => l.id !== id));
      if (activeCustomListId === id) setActiveCustomListId(null);
    }
  }

  /* ─── Smart Lists Management ─── */
  async function loadSmartLists() {
    try {
      const r = await fetch(`${API}/smart-lists`);
      if (r.ok) {
        const data = await r.json();
        setSmartLists(data);
      }
    } catch (error) {
      console.error("Failed to load smart lists:", error);
    }
  }

  async function createSmartList(data: any) {
    try {
      const r = await fetch(`${API}/smart-lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        const newList = await r.json();
        setSmartLists(p => [...p, newList]);
        setActiveSmartList(newList.id);
        setSmartListEditorOpen(false);
      }
    } catch (error) {
      console.error("Failed to create smart list:", error);
    }
  }

  async function updateSmartList(id: string, data: any) {
    try {
      const r = await fetch(`${API}/smart-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        const updated = await r.json();
        setSmartLists(p => p.map(l => l.id === id ? updated : l));
        setSmartListEditorOpen(false);
        setEditingSmartList(null);
      }
    } catch (error) {
      console.error("Failed to update smart list:", error);
    }
  }

  async function deleteSmartList(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questa lista intelligente?")) return;
    try {
      const r = await fetch(`${API}/smart-lists/${id}`, { method: "DELETE" });
      if (r.ok) {
        setSmartLists(p => p.filter(l => l.id !== id));
        if (activeSmartList === id) setActiveSmartList("all");
      }
    } catch (error) {
      console.error("Failed to delete smart list:", error);
    }
  }

  function openSmartListEditor(list?: any) {
    setEditingSmartList(list || null);
    setSmartListEditorOpen(true);
  }

  function handleSmartListSave(data: any) {
    if (editingSmartList) {
      updateSmartList(editingSmartList.id, data);
    } else {
      createSmartList(data);
    }
  }

  /* ─── AI sort ─── */
  async function runAiSort() {
    setAiSorting(true); setAiSortResult(null); setAiSortOrderIds(null);
    const r = await fetch(`${API}/tasks/sort`, { method: "POST" });
    if (r.ok) {
      const data = await r.json();
      setAiSortResult({ reasoning: data.reasoning || "", quick_wins: data.quick_wins || [], focus_tip: data.focus_tip || "" });
      setAiSortOrderIds(data.order || null);
    }
    setAiSorting(false);
  }

  /* ─── task manual drag-drop ─── */
  const taskDragSrc = useRef<string | null>(null);
  const [taskDragOver, setTaskDragOver] = useState<string | null>(null);
  const [taskManualOrder, setTaskManualOrder] = useState<string[] | null>(null);

  function handleTaskDragStart(id: string) { taskDragSrc.current = id; }
  function handleTaskDragEnter(id: string) { setTaskDragOver(id); }
  function handleTaskDrop(targetId: string, currentList: Task[]) {
    const srcId = taskDragSrc.current;
    if (!srcId || srcId === targetId) { setTaskDragOver(null); return; }
    const arr = [...currentList];
    const si = arr.findIndex(t => t.id === srcId);
    const ti = arr.findIndex(t => t.id === targetId);
    const [r] = arr.splice(si, 1); arr.splice(ti, 0, r);
    setTaskManualOrder(arr.map(t => t.id));
    setAiSortOrderIds(null);
    setTaskDragOver(null);
  }

  /* ─── edit task ─── */
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", client_id: "", client_name: "", priority: "media", due_date: "", notes: "", estimated_time: "", status: "todo" });
  function openEditTask(task: Task) {
    setEditForm({ title: task.title, client_id: task.client_id, client_name: task.client_name, priority: task.priority, due_date: task.due_date, notes: task.notes, estimated_time: task.estimated_time || "", status: task.status });
    setEditTaskId(task.id);
  }
  async function saveEditTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editTaskId) return;
    const r = await fetch(`${API}/tasks/${editTaskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editForm.title, client_id: editForm.client_id, client_name: editForm.client_name, priority: editForm.priority, due_date: editForm.due_date, notes: editForm.notes, estimated_time: editForm.estimated_time, status: editForm.status })
    });
    if (r.ok) {
      const updated = await r.json();
      setTasks(p => p.map(t => t.id === editTaskId ? updated : t));
      setEditTaskId(null);
    }
  }

  /* ─── delete confirm (inline, no browser confirm()) ─── */
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  async function confirmDeleteTask(id: string) {
    const r = await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
    if (r.ok) setTasks(p => p.filter(t => t.id !== id));
    setDeleteConfirmId(null);
  }

  /* ─── computed ─── */
  // Helper function to apply Smart List filtering
  function applySmartListFilter(taskList: Task[]): Task[] {
    const activeList = smartLists.find(sl => sl.id === activeSmartList);
    if (!activeList || !activeList.criteria) return taskList;

    const { match, filters } = activeList.criteria;

    const matchesFilter = (task: Task, filter: any): boolean => {
      const { field, operator, value } = filter;
      const taskValue = (task as any)[field];

      // Handle special date values
      let compareValue = value;
      if (value === "today") {
        compareValue = new Date().toISOString().split("T")[0];
      } else if (value === "tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        compareValue = tomorrow.toISOString().split("T")[0];
      }

      // Apply operator
      switch (operator) {
        case "equals":
          return taskValue === compareValue;
        case "not_equals":
          return taskValue !== compareValue;
        case "contains":
          if (Array.isArray(taskValue)) return taskValue.includes(compareValue);
          if (typeof taskValue === "string") return taskValue.toLowerCase().includes(compareValue.toLowerCase());
          return false;
        case "not_contains":
          if (Array.isArray(taskValue)) return !taskValue.includes(compareValue);
          if (typeof taskValue === "string") return !taskValue.toLowerCase().includes(compareValue.toLowerCase());
          return true;
        case "exists":
          return compareValue === true ? (taskValue !== null && taskValue !== undefined && taskValue !== "") : (taskValue === null || taskValue === undefined || taskValue === "");
        case "greater_than":
          return parseFloat(taskValue || "0") > parseFloat(compareValue);
        case "less_than":
          return parseFloat(taskValue || "0") < parseFloat(compareValue);
        case "before":
          if (!taskValue) return false;
          return new Date(taskValue) < new Date(compareValue);
        case "after":
          if (!taskValue) return false;
          return new Date(taskValue) > new Date(compareValue);
        default:
          return false;
      }
    };

    return taskList.filter(task => {
      if (match === "all") {
        // ALL filters must match (AND)
        return filters.every((f: any) => matchesFilter(task, f));
      } else {
        // ANY filter must match (OR)
        return filters.some((f: any) => matchesFilter(task, f));
      }
    });
  }

  let filtTasks = tasks
    .filter(t => fStatus === "all" || t.status === fStatus)
    .filter(t => fPriority === "all" || t.priority === fPriority)
    .filter(t => !activeClientFilter || t.client_id === activeClientFilter);

  // Apply Smart List filtering if a Smart List is active
  if (activeSmartList) {
    filtTasks = applySmartListFilter(filtTasks);
  }

  filtTasks = filtTasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // Helper function to calculate task count for a Smart List
  const getSmartListCount = (smartList: any): number => {
    if (!smartList || !smartList.criteria) return 0;

    const { match, filters } = smartList.criteria;

    const matchesFilter = (task: Task, filter: any): boolean => {
      const { field, operator, value } = filter;
      const taskValue = (task as any)[field];

      let compareValue = value;
      if (value === "today") {
        compareValue = new Date().toISOString().split("T")[0];
      } else if (value === "tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        compareValue = tomorrow.toISOString().split("T")[0];
      }

      switch (operator) {
        case "equals":
          return taskValue === compareValue;
        case "not_equals":
          return taskValue !== compareValue;
        case "contains":
          if (Array.isArray(taskValue)) return taskValue.includes(compareValue);
          if (typeof taskValue === "string") return taskValue.toLowerCase().includes(compareValue.toLowerCase());
          return false;
        case "not_contains":
          if (Array.isArray(taskValue)) return !taskValue.includes(compareValue);
          if (typeof taskValue === "string") return !taskValue.toLowerCase().includes(compareValue.toLowerCase());
          return true;
        case "exists":
          return compareValue === true ? (taskValue !== null && taskValue !== undefined && taskValue !== "") : (taskValue === null || taskValue === undefined || taskValue === "");
        case "greater_than":
          return parseFloat(taskValue || "0") > parseFloat(compareValue);
        case "less_than":
          return parseFloat(taskValue || "0") < parseFloat(compareValue);
        case "before":
          if (!taskValue) return false;
          return new Date(taskValue) < new Date(compareValue);
        case "after":
          if (!taskValue) return false;
          return new Date(taskValue) > new Date(compareValue);
        default:
          return false;
      }
    };

    return tasks.filter(task => {
      if (match === "all") {
        return filters.every((f: any) => matchesFilter(task, f));
      } else {
        return filters.some((f: any) => matchesFilter(task, f));
      }
    }).length;
  };

  const todoCount = tasks.filter(t => t.status === "todo").length;

  // Quick add state
  const [quickAdd, setQuickAdd] = useState("");
  const [quickAddDate, setQuickAddDate] = useState("");
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // AI sort state
  const [aiSorting, setAiSorting] = useState(false);
  const [aiSortResult, setAiSortResult] = useState<{ reasoning: string; quick_wins: string[]; focus_tip: string } | null>(null);
  const [aiSortOrderIds, setAiSortOrderIds] = useState<string[] | null>(null);


  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--navy)", gap: 16, color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
      <div className="spinner" />
      <div style={{ textAlign: "center" }}>
        <div>Caricamento...</div>
      </div>
    </div>
  );



  /* ─── client selector widget ─── */
  function ClientSelector({ value, onChange, label = "Cliente" }: { value: string; onChange: (id: string) => void; label?: string }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" }}>{label}</label>
        <select className="input" style={{ maxWidth: 280 }} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Seleziona cliente...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {value && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div className="client-list-avatar" style={{ width: 26, height: 26, borderRadius: 6, background: avatarColor(clients.find(c => c.id === value)?.name || ""), fontSize: 10 }}>
              {initials(clients.find(c => c.id === value)?.name || "")}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{clients.find(c => c.id === value)?.name}</span>
          </div>
        )}
      </div>
    );
  }

  async function loadLiveAds(period: string) {
    setLadsLoading(true); setLadsError(null);
    try {
      const params = period === "custom" && ladsDateSince && ladsDateUntil
        ? `since=${ladsDateSince}&until=${ladsDateUntil}`
        : `date_preset=${period}`;
      const r = await fetch(`${API}/live-ads/overview?${params}`);
      if (!r.ok) throw new Error((await r.json()).detail || "Errore API");
      setLadsOverview(await r.json());
    } catch (e: any) { setLadsError(e.message); }
    finally { setLadsLoading(false); }
  }

  async function loadCampaigns(clientId: string, period: string) {
    setLadsCampLoading(clientId);
    try {
      const params = period === "custom" && ladsDateSince && ladsDateUntil
        ? `since=${ladsDateSince}&until=${ladsDateUntil}`
        : `date_preset=${period}`;
      const r = await fetch(`${API}/live-ads/campaigns/${clientId}?${params}`);
      if (!r.ok) throw new Error((await r.json()).detail || "Errore campagne");
      const d = await r.json();
      setLadsCampaigns(p => ({ ...p, [clientId]: d.campaigns }));
    } catch { setLadsCampaigns(p => ({ ...p, [clientId]: [] })); }
    finally { setLadsCampLoading(null); }
  }

  async function analyzeClient(clientId: string, campaigns: any[], period: string) {
    setLadsAnalyzing(clientId);
    try {
      const r = await fetch(`${API}/live-ads/analyze/${clientId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_preset: period, campaigns })
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Errore analisi");
      const d = await r.json();
      setLadsChat(p => ({ ...p, [clientId]: [{ role: "assistant", content: d.analysis }] }));
    } catch (e: any) { alert(e.message); }
    finally { setLadsAnalyzing(null); }
  }

  async function sendChatMessage(clientId: string, campaigns: any[]) {
    const input = (ladsChatInput[clientId] || "").trim();
    if (!input) return;
    const currentChat = ladsChat[clientId] || [];
    const updatedChat = [...currentChat, { role: "user" as const, content: input }];
    setLadsChat(p => ({ ...p, [clientId]: updatedChat }));
    setLadsChatInput(p => ({ ...p, [clientId]: "" }));
    setLadsChatSending(clientId);
    try {
      const r = await fetch(`${API}/live-ads/chat/${clientId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedChat, campaigns, date_preset: ladsPeriod })
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Errore chat");
      const d = await r.json();
      setLadsChat(p => ({ ...p, [clientId]: [...updatedChat, { role: "assistant", content: d.message }] }));
    } catch (e: any) {
      alert(e.message);
      setLadsChat(p => ({ ...p, [clientId]: currentChat }));
      setLadsChatInput(p => ({ ...p, [clientId]: input }));
    } finally { setLadsChatSending(null); }
  }

  const topNavItems: { key: WsSection; icon: any; label: string; badge?: number }[] = [
    { key: "tasks", icon: ClipboardDocumentListIcon, label: "Tasks" },
    { key: "angoli", icon: LightBulbIcon, label: "Angoli" },
    { key: "script", icon: DocumentTextIcon, label: "Script Video" },
    { key: "copy", icon: PencilSquareIcon, label: "Copy" },
    { key: "grafiche", icon: PaintBrushIcon, label: "Grafiche" },
    { key: "live-ads", icon: ChartBarIcon, label: "Live Ads" },
  ];

  return (
    <div className="home-layout" ref={containerRef}>
      {/* Mobile sidebar overlay */}
      <div className={`sidebar-overlay ${mobileMenuOpen ? 'visible' : ''}`} onClick={() => setMobileMenuOpen(false)} />

      {/* ═══ SIDEBAR (Clienti soltanto) ═══ */}
      <aside className={`home-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="home-sidebar-header">
          <div className="home-sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo.png" alt="Alessio Ferlizzo" style={{ height: '26px', width: 'auto', borderRadius: '4px' }} />
            <div>Alessio <span>Ferlizzo</span></div>
          </div>
          <div className="home-sidebar-sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Operative Manager
            <a href="/knowledge" style={{ display: "flex", alignItems: "center", gap: 4, color: "#9ca3af", fontSize: 11, background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: 6, textDecoration: "none" }}>
              <BookmarkSquareIcon width={14} /> Knowledge
            </a>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 12px 6px", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <MagnifyingGlassIcon style={{ width: 13, height: 13, color: "rgba(255,255,255,0.3)", position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Cerca cliente..."
              style={{
                width: "100%", padding: "7px 10px 7px 28px", background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff",
                fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box"
              }}
            />
          </div>
        </div>

        <div className="home-sidebar-scroll">
          {/* ═══ Apple Smart Lists ═══ */}
          <div style={{ padding: "0 8px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Smart Lists</span>
              <button
                onClick={() => openSmartListEditor()}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  display: "flex",
                  padding: 4,
                  borderRadius: 4,
                  transition: "all 0.15s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                title="Crea nuova Smart List"
              >
                <PlusIcon width={14} height={14} />
              </button>
            </div>
          </div>

          <div className="smart-lists-grid">
            {smartLists.map(sl => {
              const iconMap: Record<string, any> = {
                "calendar": CalendarIcon,
                "inbox": InboxIcon,
                "flag": FlagIconSolid,
                "check-circle": CheckCircleIcon,
                "list": InboxIcon,
                "star": FlagIconSolid,
              };
              const IconComponent = iconMap[sl.icon] || InboxIcon;
              const isActive = activeSmartList === sl.id;
              return (
                <div
                  key={sl.id}
                  className={`smart-list-card ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSmartList(sl.id);
                    setActiveClientFilter(null);
                    setActiveCustomListId(null);
                    setSection("tasks");
                  }}
                  onContextMenu={(e) => {
                    if (!sl.is_system) {
                      e.preventDefault();
                      e.stopPropagation();
                      setSmartListCtxMenu({ id: sl.id, title: sl.title, x: e.clientX, y: e.clientY });
                    }
                  }}
                >
                  <div className="smart-list-card-header">
                    <div className="smart-list-icon" style={{ backgroundColor: sl.color }}>
                      <IconComponent width={18} height={18} />
                    </div>
                    <div className="smart-list-count">{getSmartListCount(sl)}</div>
                  </div>
                  <div className="smart-list-label">{sl.title}</div>

                  {/* Delete button — visible on hover, Apple style */}
                  {!sl.is_system && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSmartListCtxMenu({ id: sl.id, title: sl.title, x: e.clientX, y: e.clientY });
                      }}
                      style={{
                        position: "absolute",
                        top: 6, right: 6,
                        background: "rgba(0,0,0,0.35)",
                        border: "none",
                        color: "rgba(255,255,255,0.5)",
                        cursor: "pointer",
                        fontSize: 13,
                        width: 20, height: 20,
                        borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: 0,
                        transition: "opacity 0.15s",
                        lineHeight: 1,
                      }}
                      className="smart-list-delete-btn"
                      title="Opzioni"
                    >···</button>
                  )}
                </div>
              );
            })}
          </div>


          <div className="home-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 14px 8px" }}>
            <span className="home-section-label" style={{ padding: 0, margin: 0 }}>Mie Liste</span>
            <button onClick={createCustomList} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", display: "flex" }}>
              <PlusIcon width={14} height={14} />
            </button>
          </div>

          <div className="custom-lists-container">
            {customLists.map(list => (
              <div
                key={list.id}
                className={`custom-list-item ${activeCustomListId === list.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCustomListId(list.id);
                  setActiveSmartList("all");
                  setActiveClientFilter(null);
                  setSection("tasks");
                }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", cursor: "pointer", position: "relative" }}
              >
                <div className="list-bullet" style={{ backgroundColor: list.color || "#007aff" }} />
                <span style={{ flex: 1, fontSize: 13, color: activeCustomListId === list.id ? "#fff" : "rgba(255,255,255,0.7)" }}>{list.title}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                  {tasks.filter(t => t.status !== "done" && t.list_id === list.id).length}
                </span>
                <button
                  className="list-delete-btn"
                  onClick={(e) => { e.stopPropagation(); deleteCustomList(list.id); }}
                  style={{ background: "none", border: "none", color: "rgba(239,68,68,0.5)", cursor: "pointer", fontSize: 10, padding: 4 }}
                >✕</button>
              </div>
            ))}
          </div>

          <div className="home-section-label">Clienti</div>

          {clients
            .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
            .map(c => {
              const clientTaskCount = tasks.filter(t => t.status !== "done" && t.client_id === c.id).length;
              const isActive = activeClientFilter === c.id;
              const isInlineOpen = sidebarInlineAdd === c.id;
              return (
                <div key={c.id}>
                  <div
                    draggable
                    onDragStart={() => handleDragStart(c.id)}
                    onDragOver={e => { e.preventDefault(); handleDragEnter(c.id); }}
                    onDrop={() => handleDrop(c.id)}
                    onDragEnd={() => setDragOver(null)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "7px 12px 7px 10px",
                      background: dragOver === c.id
                        ? "rgba(199,239,0,0.12)"
                        : isActive ? "rgba(199,239,0,0.08)" : "transparent",
                      borderLeft: `3px solid ${isActive ? "var(--lime)" : "transparent"}`,
                      cursor: "grab", transition: "background 0.12s",
                      borderTop: dragOver === c.id ? "2px solid var(--lime)" : "2px solid transparent",
                    }}
                  >
                    {/* Drag handle */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2.5, flexShrink: 0, opacity: 0.25, paddingRight: 2, cursor: "grab" }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 12, height: 1.5, background: "#fff", borderRadius: 2 }} />)}
                    </div>

                    {/* Avatar with logo */}
                    <div
                      className="client-list-avatar"
                      style={{ background: avatarColor(c.name), overflow: "hidden", flexShrink: 0, position: "relative" }}
                      onClick={() => {
                        const newFilter = isActive ? null : c.id;
                        setActiveClientFilter(newFilter);
                        setSection("tasks");
                        if (newFilter) setTimeout(() => quickAddRef.current?.focus(), 150);
                      }}
                    >
                      {logoErrors[c.id] ? (
                        <span style={{ fontSize: 11 }}>{initials(c.name)}</span>
                      ) : (
                        <img
                          src={`${API}/clients/${c.id}/logo`}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={() => setLogoErrors(p => ({ ...p, [c.id]: true }))}
                        />
                      )}
                    </div>

                    {/* Name — click to filter tasks */}
                    <span
                      className="client-list-name"
                      style={{ color: isActive ? "var(--lime)" : "rgba(255,255,255,0.75)", fontWeight: isActive ? 600 : 500, flex: 1, cursor: "pointer" }}
                      onClick={() => {
                        const newFilter = isActive ? null : c.id;
                        setActiveClientFilter(newFilter);
                        setSection("tasks");
                        if (newFilter) setTimeout(() => quickAddRef.current?.focus(), 150);
                      }}
                    >
                      {c.name}
                    </span>

                    {/* Task count badge */}
                    {clientTaskCount > 0 && !isInlineOpen && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--lime)", background: "rgba(199,239,0,0.12)", padding: "1px 7px", borderRadius: 10, flexShrink: 0, border: "1px solid rgba(199,239,0,0.2)" }}>
                        {clientTaskCount}
                      </span>
                    )}

                    {/* Arrow — click to open client page */}
                    <button
                      onClick={() => window.location.href = `/client/${c.id}`}
                      title="Apri scheda cliente"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: 5, display: "flex", alignItems: "center", flexShrink: 0, transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                    >
                      <ChevronRightIcon style={{ width: 13, height: 13, color: "rgba(255,255,255,0.35)" }} />
                    </button>
                  </div>

                  {/* Inline task input */}
                  {isInlineOpen && (
                    <div style={{ padding: "6px 12px 8px 44px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.07)", borderRadius: 8, border: "1px solid rgba(199,239,0,0.25)", padding: "6px 10px" }}>
                        <input
                          autoFocus
                          value={sidebarInlineText}
                          onChange={e => setSidebarInlineText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") createSidebarTask();
                            if (e.key === "Escape") { setSidebarInlineAdd(null); setSidebarInlineText(""); }
                          }}
                          placeholder="Nuova task... (Invio)"
                          style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12, color: "#fff", fontFamily: "inherit" }}
                        />
                        {sidebarInlineText && (
                          <button onClick={createSidebarTask} style={{ background: "var(--lime)", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#1a2600", cursor: "pointer", flexShrink: 0 }}>↵</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && clientSearch && (
            <p style={{ padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>Nessun cliente trovato</p>
          )}

          <button onClick={() => setClientModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "inherit", fontWeight: 600, transition: "color 0.15s", marginTop: 4 }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"}>
            <PlusIcon style={{ width: 13, height: 13 }} /> Nuovo Cliente
          </button>
        </div>
      </aside>


      {/* ═══ MAIN ═══ */}
      <div className="home-main" style={{ padding: 0, display: "flex", flexDirection: "column" }}>

        {/* TOP NAV */}
        <div style={{ background: "var(--navy-card)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 16px 0 12px", display: "flex", alignItems: "center", gap: 2, height: 52, flexShrink: 0 }}>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(v => !v)}>
            <Bars3Icon style={{ width: 20, height: 20 }} />
          </button>
          {topNavItems.map(({ key, icon: Icon, label, badge }) => (
            <button key={key} onClick={() => { setSection(key); setMobileMenuOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "0 16px", height: "100%",
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: section === key ? 700 : 500,
                color: section === key ? "var(--lime)" : "rgba(255,255,255,0.55)",
                borderBottom: `2px solid ${section === key ? "var(--lime)" : "transparent"}`,
                transition: "all 0.15s", position: "relative"
              }}
              onMouseEnter={e => { if (section !== key) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"; }}
              onMouseLeave={e => { if (section !== key) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}>
              <Icon style={{ width: 15, height: 15 }} />
              {label}
              {badge !== undefined && badge > 0 && (
                <span style={{ background: "rgba(255,158,28,0.2)", color: "var(--orange)", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 10 }}>{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* SECTION CONTENT */}
        <div className="home-content-scroll" style={{ flex: 1, overflow: "auto" }}>

          {/* ══ TASKS ══ */}
          {section === "tasks" && (
            <div className="tasks-section-container" style={{ flex: 1, display: "flex", justifyContent: "center", width: "100%" }}>
              <div className="tasks-section-brute-force-centered" style={{ width: "100%", maxWidth: 1200, display: "flex", flexDirection: "column", height: "100%", padding: "0 24px" }}>
                <TasksSection
                  tasks={tasks}
                  setTasks={setTasks}
                  clients={clients}
                  activeClientFilter={activeClientFilter}
                  setActiveClientFilter={setActiveClientFilter}
                  activeSmartList={activeSmartList as any}
                  setActiveSmartList={setActiveSmartList as any}
                  activeCustomListId={activeCustomListId}
                  setActiveCustomListId={setActiveCustomListId}
                  customLists={customLists}
                  onAiSort={() => {
                    setAiSorting(true);
                    const todoAndDoing = tasks.filter(t => t.status !== "done");
                    fetch(`${API}/tasks/ai-sort`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tasks: todoAndDoing })
                    }).then(r => r.ok ? r.json() : null).then(data => {
                      if (data?.order) setAiSortOrderIds(data.order);
                    }).finally(() => setAiSorting(false));
                  }}
                  aiSorting={aiSorting}
                  isOffline={isOffline}
                  onRetryConnection={loadData}
                />
              </div>
            </div>
          )}

          {/* ══ ANGOLI ══ */}
          {section === "angoli" && (
            <div>
              <h1 className="page-title" style={{ marginBottom: 6 }}>Angoli Comunicativi</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Genera angoli strategici targettizzati per fase del funnel</p>

              <div className="card" style={{ marginBottom: 16, padding: "16px 20px" }}>
                <ClientSelector value={angCliId} onChange={id => { setAngCliId(id); setAngles([]); }} label="Cliente" />
              </div>

              {angCliId && (<>
                <div className="card" style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 12 }}>Fase del Funnel</p>
                  <div className="funnel-row">
                    {FUNNEL_STAGES.map(st => (
                      <button key={st.key} className={`funnel-btn ${angFunnel === st.key ? "active" : ""}`} onClick={() => setAngFunnel(angFunnel === st.key ? "" : st.key)}>
                        <span className="funnel-emoji">{st.emoji}</span>
                        <span className="funnel-label">{st.label}</span>
                        <span className="funnel-desc">{st.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label className="label" style={{ display: "block", marginBottom: 6 }}>Istruzioni (opzionale)</label>
                      <input className="input" placeholder="Es: Promuovere il lancio del nuovo servizio..." value={angPrompt} onChange={e => setAngPrompt(e.target.value)} />
                    </div>
                    <button className="btn btn-primary" onClick={genAngles} disabled={angLoading}>
                      {angLoading ? <><div className="spinner" />Generando...</> : <><LightBulbIcon style={{ width: 15, height: 15 }} />Genera 5 Angoli</>}
                    </button>
                  </div>
                </div>

                {angles.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>Angoli generati {angFunnel && `· ${FUNNEL_STAGES.find(s => s.key === angFunnel)?.label}`}</p>
                    {angles.map((angle: any, i: number) => (
                      <div key={i} className="angle-card"
                        onClick={() => { setScrCliId(angCliId); setScrAngle(angle); loadClientAngles(angCliId); setSection("script"); }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 4 }}>{angle.title}</p>
                          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{angle.description}</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                          <span className="angle-emotion-badge">{angle.emotion}</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>→ Script</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 8px", fontSize: 11, marginTop: 4, display: "flex", gap: 4, alignItems: "center" }}
                            onClick={(e) => { e.stopPropagation(); openVaultModal("angle", angle.title, angle.description, angCliId, angFunnel); }}
                          >
                            <BookmarkSquareIcon style={{ width: 14, height: 14 }} /> Salva in Vault
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>)}

              {!angCliId && (
                <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                  <LightBulbIcon style={{ width: 40, height: 40, color: "#9ca3af", margin: "0 auto 12px" }} />
                  <p style={{ color: "#6b7280", fontSize: 13 }}>Seleziona un cliente per generare gli angoli comunicativi</p>
                </div>
              )}
            </div>
          )}

          {/* ══ SCRIPT VIDEO ══ */}
          {section === "script" && (
            <div>
              <h1 className="page-title" style={{ marginBottom: 6 }}>Script Video</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Genera script a partire dagli angoli comunicativi</p>

              <div className="card" style={{ marginBottom: 16, padding: "16px 20px" }}>
                <ClientSelector value={scrCliId} onChange={id => { setScrCliId(id); loadClientAngles(id); setScrAngle(null); setAllScripts([]); }} label="Cliente" />
              </div>

              {scrCliId && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label className="label" style={{ display: "block", marginBottom: 6 }}>Tipo di Generazione</label>
                        <select className="input"
                          value={scrAngle?.title === "Script Rapido (Usa tua idea)" ? "quick" : scrAngle?.title || ""}
                          onChange={e => {
                            if (e.target.value === "quick") {
                              setScrAngle({ title: "Script Rapido (Usa tua idea)", description: "L'utente fornisce un'idea specifica o un menù che l'IA deve seguire pedissequamente." });
                            } else {
                              const a = scrCliAngles.find((a: any) => a.title === e.target.value);
                              if (a) setScrAngle(a);
                              else setScrAngle(null);
                            }
                          }}
                        >
                          <option value="">Seleziona angolo...</option>
                          <option value="quick" style={{ fontWeight: "bold", color: "var(--orange-dark)" }}>🚀 SCRIPT RAPIDO (Incolla tua idea/menù)</option>
                          {scrCliAngles.map((a: any, i: number) => <option key={i} value={a.title}>{a.title}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label" style={{ display: "block", marginBottom: 6 }}>Quantità Variazioni</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          {[1, 2, 3].map(n => (
                            <button key={n} onClick={() => setScrCount(n)}
                              style={{
                                flex: 1, height: 38, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
                                border: `1.5px solid ${scrCount === n ? "var(--orange)" : "#e5e7eb"}`,
                                background: scrCount === n ? "var(--orange)" : "#fff",
                                color: scrCount === n ? "#fff" : "#64748b",
                                transition: "all 0.15s"
                              }}
                            >
                              {n} {n === 1 ? "versione" : "versioni"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: 6 }}>
                        {scrAngle?.title === "Script Rapido (Usa tua idea)"
                          ? "Incolla qui il tuo Menù, l'evento o la tua idea specifica"
                          : "Framework o Istruzioni Extra (opzionale)"}
                      </label>
                      <textarea
                        className="input"
                        rows={scrAngle?.title === "Script Rapido (Usa tua idea)" ? 6 : 2}
                        placeholder={scrAngle?.title === "Script Rapido (Usa tua idea)"
                          ? "Es: Menù di Pasqua: Antipasto di bufala, Lasagna, Carrè di agnello... Atmosfera con musica live e tavoli allestiti."
                          : "AIDA, PAS, Tono più ironico, o istruzioni specifiche..."}
                        value={scrInstr}
                        onChange={e => setScrInstr(e.target.value)}
                        style={{ resize: "vertical" }}
                      />
                    </div>

                    <button className="btn btn-primary" onClick={genScript} disabled={!scrAngle || scrLoading || (scrAngle?.title === "Script Rapido (Usa tua idea)" && !scrInstr.trim())} style={{ width: "100%", height: 44, fontSize: 14 }}>
                      {scrLoading ? <><div className="spinner" />Sto scrivendo...</> : (
                        <><SparklesIcon style={{ width: 18, height: 18 }} /> {scrAngle?.title === "Script Rapido (Usa tua idea)" ? "Crea lo Script dal mio Menù/Idea" : "Genera Script dall'Angolo"}</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {scrLoading ? (
                <div className="card" style={{ textAlign: "center", padding: "60px 0" }}>
                  <div className="spinner" style={{ margin: "0 auto 12px", width: 24, height: 24 }} />
                  <p style={{ color: "#6b7280", fontSize: 13 }}>Generando {scrCount > 1 ? `${scrCount} script` : "script"}...</p>
                </div>
              ) : allScripts.length > 0 ? (
                <div className="card">
                  {allScripts.length > 1 && (
                    <div className="tab-row">
                      {allScripts.map((_, i) => (
                        <button key={i} className={`tab ${scrIdx === i ? "active" : ""}`} onClick={() => { setScrIdx(i); setScrText(allScripts[i].content); }}>Script {i + 1}</button>
                      ))}
                    </div>
                  )}
                  <div className="script-output" style={{ marginBottom: 24, fontSize: 14, color: "#374151" }}>
                    <FormatText text={scrText} />
                  </div>
                  <hr className="divider" />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 200 }}>
                      <input className="input" placeholder="Rifinisci: 'più ironico', 'cambia il gancio', 'più corto'..." value={scrFeedback} onChange={e => setScrFeedback(e.target.value)} onKeyDown={e => e.key === "Enter" && submitScrFeedback()} />
                      <button className="btn btn-primary" onClick={submitScrFeedback} disabled={!scrFeedback || scrLoading}>
                        <ArrowPathIcon style={{ width: 15, height: 15 }} />Rifinisci
                      </button>
                    </div>
                    <button className="btn btn-ghost" onClick={() => openVaultModal("copy", scrAngle?.title || "Script Video", scrText, scrCliId, scrAngle?.funnel_stage, "Script Video")} style={{ display: "flex", gap: 6 }}>
                      <BookmarkSquareIcon style={{ width: 16, height: 16 }} /> Salva in Vault
                    </button>
                  </div>
                </div>
              ) : !scrCliId ? (
                <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                  <DocumentTextIcon style={{ width: 40, height: 40, color: "#9ca3af", margin: "0 auto 12px" }} />
                  <p style={{ color: "#6b7280", fontSize: 13 }}>Seleziona un cliente per generare gli script</p>
                </div>
              ) : null}
            </div>
          )}

          {/* ══ COPY ══ */}
          {section === "copy" && (
            <div>
              <h1 className="page-title" style={{ marginBottom: 6 }}>Generatore Copy</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Crea copy ottimizzato per ogni formato</p>

              <div className="card" style={{ marginBottom: 16, padding: "16px 20px" }}>
                <ClientSelector value={cpyCliId} onChange={setCpyCliId} label="Cliente" />
              </div>

              {cpyCliId && (<>
                <div className="card" style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 12 }}>Tipo di copy</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {[
                      { key: "caption", label: "📱 Caption Instagram" },
                      { key: "headline", label: "🎯 Headline Ads" },
                      { key: "email", label: "📧 Email Marketing" },
                      { key: "cta", label: "🔥 CTA Button" },
                      { key: "bio", label: "👤 Bio Profilo" },
                      { key: "whatsapp", label: "💬 WhatsApp Message" },
                      { key: "landing", label: "🖥️ Landing Page" },
                      { key: "story", label: "⚡ Story Caption" },
                    ].map(t => (
                      <button key={t.key} className={`format-chip ${cpyType === t.key ? "active" : ""}`} onClick={() => setCpyType(t.key)}>{t.label}</button>
                    ))}
                  </div>

                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#6b7280", marginBottom: 6 }}>Istruzioni aggiuntive</label>
                  <textarea className="input" rows={3} placeholder="Es: Focus sul risparmio di tempo, tono informale, includi emoji, max 150 caratteri..."
                    value={cpyPrompt} onChange={e => setCpyPrompt(e.target.value)} />

                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={genCopy} disabled={cpyLoading}>
                    {cpyLoading ? <><div className="spinner" />Generando...</> : <><SparklesIcon style={{ width: 15, height: 15 }} />Genera Copy</>}
                  </button>
                </div>

                {cpyOutput && (
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>✍️ Copy Generato</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openVaultModal("copy", `Copy ${cpyType}`, cpyOutput, cpyCliId, "", cpyType)}>
                          <BookmarkSquareIcon style={{ width: 14, height: 14 }} /> Salva in Vault
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(cpyOutput)}>
                          Copia
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#374151" }}>
                      <FormatText text={cpyOutput} />
                    </div>
                    <hr className="divider" />
                    <button className="btn btn-ghost btn-sm" onClick={genCopy} disabled={cpyLoading}>
                      <ArrowPathIcon style={{ width: 13, height: 13 }} />Rigenera
                    </button>
                  </div>
                )}
              </>)}

              {!cpyCliId && (
                <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                  <PencilSquareIcon style={{ width: 40, height: 40, color: "#9ca3af", margin: "0 auto 12px" }} />
                  <p style={{ color: "#6b7280", fontSize: 13 }}>Seleziona un cliente per generare il copy</p>
                </div>
              )}
            </div>
          )}

          {/* ══ GRAFICHE ══ */}
          {section === "grafiche" && (() => {
            // Load gallery when entering section
            const loadGallery = async (clientId: string) => {
              if (!clientId) { setGfxGallery([]); return; }
              try {
                const res = await fetch(`${API}/clients/${clientId}/graphics`);
                if (res.ok) setGfxGallery(await res.json());
              } catch { /* ignore */ }
            };

            // Handle file upload for a specific slot
            const handleSlotUpload = (files: FileList | null, setter: React.Dispatch<React.SetStateAction<GfxImageRef[]>>) => {
              if (!files || files.length === 0) return;
              Array.from(files).forEach(file => {
                if (!file.type.startsWith("image/")) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const b64 = (reader.result as string).split(",")[1];
                  setter(prev => [...prev, { data: b64, mime: file.type, name: file.name, selected: true }]);
                };
                reader.readAsDataURL(file);
              });
            };

            // Collect all reference images from slots
            const allRefImages = [
              ...gfxSlotLogo.filter(r => r.selected).map(r => ({ type: "logo", ...r })),
              ...gfxSlotPersona.filter(r => r.selected).map(r => ({ type: "persona", ...r })),
              ...gfxSlotProdotto.filter(r => r.selected).map(r => ({ type: "prodotto", ...r })),
              ...gfxSlotContesto.filter(r => r.selected).map(r => ({ type: "contesto", ...r }))
            ];

            // Generate image
            const generateImage = async () => {
              if (!gfxClientId || !gfxPrompt.trim()) return;
              setGfxLoading(true);
              setGfxResult(null);

              const formatsToGen = gfxFormats.length > 0 ? gfxFormats : ["Feed IG (4:5)"];
              let lastData = null;

              try {
                for (const fmt of formatsToGen) {
                  const body = {
                    prompt: gfxPrompt,
                    client_id: gfxClientId,
                    format: fmt,
                    references: allRefImages.map(r => ({ type: r.type, data: r.data, mime: r.mime })),
                    use_rag: true,
                    model_id: gfxModel,
                    reference_filename: gfxRefFilename
                  };
                  const res = await fetch(`${API}/generate-image`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: "Errore sconosciuto" }));
                    alert(`Errore per formato ${fmt}: ${err.detail || res.statusText}`);
                    continue;
                  }
                  lastData = await res.json();
                }

                if (lastData) {
                  setGfxResult({ filename: lastData.filename, url: lastData.url, enhanced_prompt: lastData.enhanced_prompt });
                }
                loadGallery(gfxClientId);
              } catch (err: any) {
                alert(`Errore di rete: ${err.message}`);
              } finally {
                setGfxLoading(false);
              }
            };

            const deleteGraphic = async (filename: string) => {
              if (!confirm("Sei sicuro di voler eliminare questa grafica?")) return;
              try {
                const res = await fetch(`${API}/clients/${gfxClientId}/graphics/${filename}`, { method: "DELETE" });
                if (res.ok) {
                  loadGallery(gfxClientId);
                  if (gfxResult?.filename === filename) setGfxResult(null);
                }
              } catch (err) {
                console.error("Failed to delete graphic", err);
              }
            };

            const downloadImage = async (url: string, filename: string) => {
              try {
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
              } catch (err) {
                console.error("Download failed", err);
                window.open(url, "_blank");
              }
            };

            return (
              <div>
                <h1 className="page-title" style={{ marginBottom: 6 }}>Generatore Immagini AI</h1>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Scegli il modello e crea i tuoi asset · Cloud Backend</p>

                {/* Client selector */}
                <div className="card" style={{ marginBottom: 16, padding: "16px 20px" }}>
                  <ClientSelector value={gfxClientId} onChange={(id: string) => { setGfxClientId(id); loadGallery(id); }} label="Cliente" />
                </div>

                {/* Format */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 12 }}>Formato</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {GFX_FORMATS.map(f => (
                      <button key={f} className={`format-chip ${gfxFormats.includes(f) ? "active" : ""}`}
                        onClick={() => setGfxFormats(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f])}>{f}</button>
                    ))}
                  </div>
                </div>

                {/* Modello AI Selector */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Modello AI Corrente</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 14 }}>Scegli il "pittore" che genererà l'immagine. Modelli diversi hanno abilità e costi diversi.</p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {[
                      {
                        id: "gemini-image",
                        name: "Gemini 3.1 Flash",
                        sub: "Google AI (Diretto)",
                        cost: "Gratuito",
                        desc: "🔥 Passa le tue foto DIRETTAMENTE a Gemini. Rapido ed economico."
                      },
                      {
                        id: "gemini-image-pro",
                        name: "Gemini 3 Pro",
                        sub: "Google AI Pro (Diretto)",
                        cost: "Gratuito",
                        desc: "⭐ Versione PRO. Maggiore qualità, migliore gestione di mani e riflessi. Consigliato per ads finali."
                      },
                      {
                        id: "fal-ai/flux-pro/v1.1-ultra",
                        name: "Flux Pro 1.1 Ultra",
                        sub: "Black Forest Labs",
                        cost: "$0.05",
                        desc: "Il top di gamma di Black Forest Labs. Dettaglio estremo, realismo e testi perfetti."
                      },
                      {
                        id: "fal-ai/flux-realism",
                        name: "Flux Realism",
                        sub: "Black Forest Labs",
                        cost: "$0.03",
                        desc: "Sviluppato da Black Forest Labs. Ottimizzato per volti, pelle e fotografia lifestyle realistica."
                      }
                    ].map(m => (
                      <div key={m.id}
                        onClick={() => setGfxModel(m.id)}
                        style={{
                          display: "flex", flexDirection: "column", height: "100%",
                          background: gfxModel === m.id ? "rgba(255,158,28,0.08)" : "rgba(255,255,255,0.03)",
                          border: gfxModel === m.id ? "2px solid var(--orange)" : "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "all 0.15s",
                          position: "relative",
                          boxShadow: gfxModel === m.id ? "0 4px 12px rgba(255,158,28,0.15)" : "none"
                        }}>

                        {gfxModel === m.id && <div style={{ position: "absolute", top: 12, right: 12, color: "var(--orange)" }}><CheckIcon style={{ width: 18, height: 18, strokeWidth: 2.5 }} /></div>}

                        <div style={{ display: "flex", flexDirection: "column", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: gfxModel === m.id ? "var(--orange)" : "#fff" }}>{m.name}</span>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase" }}>{m.sub}</span>
                        </div>

                        <div style={{ display: "inline-block", padding: "2px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 10, fontWeight: 700, color: "var(--orange)", marginBottom: 10 }}>
                          Costo stimato: {m.cost}
                        </div>

                        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4, fontWeight: 500 }}>{m.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reference images — 4 slots */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Riferimenti immagine</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>Carica le immagini che vuoi usare come riferimento nei 4 slot separati. Puoi combinarli tutti.</p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {([{ key: "logo", label: "Logo", subLabel: "Carica il logo", icon: <TagIcon style={{ width: 42, height: 42, strokeWidth: 1.2 }} />, state: gfxSlotLogo, setter: setGfxSlotLogo },
                    { key: "persona", label: "Persona", subLabel: "Soggetto principale", icon: <UserIcon style={{ width: 42, height: 42, strokeWidth: 1.2 }} />, state: gfxSlotPersona, setter: setGfxSlotPersona },
                    { key: "prodotto", label: "Prodotto", subLabel: "Oggetto da vendere", icon: <ShoppingBagIcon style={{ width: 42, height: 42, strokeWidth: 1.2 }} />, state: gfxSlotProdotto, setter: setGfxSlotProdotto },
                    { key: "contesto", label: "Contesto", subLabel: "Sfondo e ambiente", icon: <MapPinIcon style={{ width: 42, height: 42, strokeWidth: 1.2 }} />, state: gfxSlotContesto, setter: setGfxSlotContesto },
                    ] as const).map(slot => {
                      const hasSelected = slot.state.some((img: any) => img.selected);
                      return (
                        <div key={slot.key} className="card"
                          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--orange)"; }}
                          onDragLeave={e => { e.currentTarget.style.borderColor = hasSelected ? "var(--orange)" : "transparent"; }}
                          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = hasSelected ? "var(--orange)" : "transparent"; handleSlotUpload(e.dataTransfer.files, slot.setter as any); }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest(".img-thumb-container")) return;
                            const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = "image/*"; inp.onchange = () => handleSlotUpload(inp.files, slot.setter as any); inp.click();
                          }}
                          style={{
                            border: hasSelected ? "2px solid var(--orange)" : "2px dashed transparent",
                            padding: "16px 10px", textAlign: "center", cursor: "pointer",
                            transition: "all 0.15s", minHeight: 120, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 8, position: "relative",
                            marginBottom: 0
                          }}
                        >
                          {slot.state.length > 0 ? (
                            <div style={{ width: "100%" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                {slot.label} ({slot.state.length})
                              </div>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                                {slot.state.map((img, i) => (
                                  <div key={i} className="img-thumb-container"
                                    onClick={(e) => { e.stopPropagation(); slot.setter((prev: any) => { const n = [...prev]; n[i].selected = !n[i].selected; return n; }); }}
                                    style={{ position: "relative", width: 56, height: 56, borderRadius: 8, border: img.selected ? "2px solid #2563eb" : "2px solid transparent", opacity: img.selected ? 1 : 0.4, transition: "all 0.2s" }}
                                  >
                                    <img src={`data:${img.mime};base64,${img.data}`} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                                    <button onClick={e => { e.stopPropagation(); slot.setter((prev: any) => prev.filter((_: any, j: number) => j !== i)); }}
                                      style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>✕</button>
                                    {img.selected && <div style={{ position: "absolute", bottom: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>✓</div>}
                                  </div>
                                ))}
                                <div style={{ width: 56, height: 56, borderRadius: 8, border: "1px dashed rgba(37,99,235,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(37,99,235,0.7)" }}><PlusIcon style={{ width: 22, height: 22 }} /></div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: 0.8, transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}>
                              <div style={{ color: "#3b82f6" }}>{slot.icon}</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "#ffffff", letterSpacing: "0.02em", textTransform: "uppercase" }}>{slot.label}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{slot.subLabel}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Prompt */}
                <div className="card" style={{ marginBottom: 20, position: "relative" }}>
                  {gfxRefFilename && (
                    <div style={{ padding: "6px 12px", background: "rgba(255,158,28,0.1)", borderRadius: "8px 8px 0 0", borderBottom: "1px solid rgba(255,158,28,0.2)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)" }}>🔄 MODIFICANDO: {gfxRefFilename}</span>
                      <button onClick={() => setGfxRefFilename(null)} style={{ background: "none", border: "none", color: "var(--orange)", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  )}
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Prompt</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>Descrivi la grafica che vuoi o le modifiche da applicare.</p>
                  <textarea className="input" rows={4} placeholder="Es: Una donna sorridente che usa il nostro prodotto..."
                    value={gfxPrompt} onChange={e => setGfxPrompt(e.target.value)}
                    style={{ fontSize: 13, lineHeight: 1.5 }} />
                </div>

                {/* Generate button */}
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 24 }}>
                  <button disabled={!gfxClientId || !gfxPrompt.trim() || gfxLoading}
                    onClick={generateImage}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 28px", background: (!gfxClientId || !gfxPrompt.trim() || gfxLoading) ? "rgba(255,158,28,0.3)" : "var(--orange)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: (!gfxClientId || !gfxPrompt.trim() || gfxLoading) ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.2s", boxShadow: "0 4px 14px rgba(255,158,28,0.25)" }}>
                    {gfxLoading ? (
                      <><div className="spinner" style={{ width: 16, height: 16 }} />Generando con AI...</>
                    ) : (
                      <><PhotoIcon style={{ width: 17, height: 17 }} />🎨 Genera Grafica</>
                    )}
                  </button>
                  {allRefImages.length > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{allRefImages.length} immagini di riferimento</span>}
                </div>

                {/* Generated result */}
                {gfxResult && (
                  <div className="card" style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 12 }}>✨ Risultato</p>
                    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", maxWidth: 400, flex: "0 0 auto" }}>
                        <img src={`${API}${gfxResult.url}`} alt="Generated" style={{ width: "100%", display: "block" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Prompt arricchito da Claude:</p>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: 16, maxHeight: 200, overflowY: "auto", padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>{gfxResult.enhanced_prompt}</p>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => downloadImage(`${API}${gfxResult.url}`, gfxResult.filename)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(255,158,28,0.1)", border: "1px solid var(--orange)", borderRadius: 8, color: "var(--orange)", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>⬇️ Scarica PNG</button>
                          <button onClick={() => openVaultModal("graphic", gfxPrompt.substring(0, 30) + "...", gfxResult.enhanced_prompt, gfxClientId, "", gfxFormats[0] || "Feed IG (4:5)", `${API}${gfxResult.url}`)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--orange)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", boxShadow: "0 4px 10px rgba(255,158,28,0.2)" }}>
                            <BookmarkSquareIcon style={{ width: 15, height: 15 }} /> Salva in Notion
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Gallery */}
                {gfxGallery.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 12 }}>📸 Grafiche generate</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                      {gfxGallery.map((g: any, i: number) => (
                        <div key={i} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", position: "relative" }}>

                          <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4, zIndex: 10 }}>
                            <button onClick={(e) => { e.stopPropagation(); setGfxRefFilename(g.filename); setGfxPrompt(g.prompt || ""); const el = document.getElementById("gfx-top"); el?.scrollIntoView({ behavior: "smooth" }); }}
                              title="Modifica"
                              style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", transition: "all 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.background = "var(--orange)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.6)"}
                            >
                              <PencilSquareIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setGfxRefFilename(g.filename); setGfxPrompt(g.prompt || ""); const el = document.getElementById("gfx-top"); el?.scrollIntoView({ behavior: "smooth" }); }}
                              title="Aggiungi Formato"
                              style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", transition: "all 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#8b5cf6"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.6)"}
                            >
                              <PlusIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openVaultModal("graphic", g.prompt ? g.prompt.substring(0, 30) + "..." : "Grafica", g.enhanced_prompt || "", gfxClientId, "", g.format || "Feed IG (4:5)", `${API}/clients/${gfxClientId}/graphics/${g.filename}`); }}
                              title="Salva in Notion"
                              style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", transition: "all 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#eab308"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.6)"}
                            >
                              <BookmarkSquareIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); downloadImage(`${API}/clients/${gfxClientId}/graphics/${g.filename}`, g.filename); }}
                              style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", transition: "all 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#2563eb"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.6)"}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteGraphic(g.filename); }}
                              style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", transition: "all 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#ef4444"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.6)"}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          </div>

                          <img src={`${API}/clients/${gfxClientId}/graphics/${g.filename}`} alt={g.prompt}
                            onClick={() => window.open(`${API}/clients/${gfxClientId}/graphics/${g.filename}`, "_blank")}
                            style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", cursor: "zoom-in" }} />
                          <div style={{ padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{g.prompt}</div>
                            <div style={{ fontSize: 9, color: "var(--orange)", fontWeight: 700, marginTop: 4 }}>{g.format} · <span style={{ color: "rgba(255,255,255,0.3)" }}>{new Date(g.created_at).toLocaleDateString("it-IT")}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══ LIVE ADS ══ */}
          {section === "live-ads" && (() => {
            const PERIODS = [
              { value: "today", label: "Oggi" },
              { value: "last_7d", label: "7 giorni" },
              { value: "last_14d", label: "14 giorni" },
              { value: "last_30d", label: "30 giorni" },
              { value: "last_month", label: "Mese scorso" },
              { value: "this_month", label: "Mese corrente" },
              { value: "last_quarter", label: "Trimestre" },
              { value: "custom", label: "📅 Personalizzato" },
            ];
            const fmt = (v: number | null | undefined, sym = "") => v != null ? `${sym}${v.toLocaleString("it-IT")}` : "—";
            const activePeriodLabel = ladsPeriod === "custom"
              ? (ladsDateSince && ladsDateUntil ? `${new Date(ladsDateSince + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" })} → ${new Date(ladsDateUntil + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" })}` : "Seleziona date")
              : (PERIODS.find(p => p.value === ladsPeriod)?.label || "");
            const filteredClients = ladsOverview
              ? ladsOverview.clients.filter((cl: any) => !ladsClientFilter || cl.client_id === ladsClientFilter)
              : [];

            return (
              <div>
                {/* ── Header ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>Live Ads</h1>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>Facebook Ads · {activePeriodLabel}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={ladsClientFilter} onChange={e => setLadsClientFilter(e.target.value)}
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
                      <option value="" style={{ background: "#002852" }}>Tutti i clienti</option>
                      {clients.map(c => <option key={c.id} value={c.id} style={{ background: "#002852" }}>{c.name}</option>)}
                    </select>
                    <select value={ladsPeriod} onChange={e => { setLadsPeriod(e.target.value); setLadsOverview(null); }}
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
                      {PERIODS.map(p => <option key={p.value} value={p.value} style={{ background: "#002852" }}>{p.label}</option>)}
                    </select>
                    {ladsPeriod === "custom" && (
                      <>
                        <input type="date" value={ladsDateSince} onChange={e => setLadsDateSince(e.target.value)}
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit", colorScheme: "dark" as any }} />
                        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>→</span>
                        <input type="date" value={ladsDateUntil} onChange={e => setLadsDateUntil(e.target.value)}
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit", colorScheme: "dark" as any }} />
                      </>
                    )}
                    <button
                      onClick={() => loadLiveAds(ladsPeriod)}
                      disabled={ladsLoading || (ladsPeriod === "custom" && (!ladsDateSince || !ladsDateUntil))}
                      style={{ background: "var(--orange)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, opacity: (ladsLoading || (ladsPeriod === "custom" && (!ladsDateSince || !ladsDateUntil))) ? 0.5 : 1, transition: "opacity 0.15s", boxShadow: "0 4px 14px rgba(255,158,28,0.35)" }}>
                      {ladsLoading ? <><div className="spinner" style={{ width: 13, height: 13 }} />Carico...</> : <><ArrowTrendingUpIcon style={{ width: 15, height: 15 }} />Aggiorna</>}
                    </button>
                  </div>
                </div>

                {ladsError && (
                  <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 13, marginBottom: 20 }}>⚠️ {ladsError}</div>
                )}

                {!ladsOverview && !ladsLoading && (
                  <div style={{ textAlign: "center", padding: "80px 20px" }}>
                    <ChartBarIcon style={{ width: 48, height: 48, color: "rgba(255,255,255,0.1)", margin: "0 auto 16px" }} />
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nessun dato caricato</p>
                    <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Seleziona un periodo e clicca Aggiorna</p>
                  </div>
                )}

                {ladsOverview && (() => {
                  const { totals } = ladsOverview;
                  return (
                    <>
                      {/* Client cards grid */}
                      {!ladsExpanded && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                          {filteredClients.map((cl: any) => (
                            <div
                              key={cl.client_id}
                              onClick={() => {
                                if (cl.error) return;
                                setLadsExpanded(cl.client_id);
                                if (!ladsCampaigns[cl.client_id]) loadCampaigns(cl.client_id, ladsPeriod);
                              }}
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "18px 20px", cursor: cl.error ? "default" : "pointer", transition: "all 0.15s" }}
                              onMouseEnter={e => { if (!cl.error) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.2)"; } }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 9, background: avatarColor(cl.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                                  {initials(cl.name)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cl.name}</div>
                                  {cl.error && <div style={{ fontSize: 10, color: "#f87171", marginTop: 1 }}>⚠️ Errore API</div>}
                                </div>
                                {!cl.error && <ChevronRightIcon style={{ width: 14, height: 14, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />}
                              </div>
                              {!cl.error && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                                  {[
                                    { label: "Spesa", value: `€${fmt(cl.spend)}`, color: "#10b981" },
                                    { label: "CTR", value: `${fmt(cl.ctr)}%`, color: (cl.ctr || 0) >= 1 ? "#10b981" : (cl.ctr || 0) >= 0.5 ? "#f59e0b" : "#ef4444" },
                                    { label: "CPM", value: `€${fmt(cl.cpm)}`, color: "rgba(255,255,255,0.65)" },
                                    { label: "Conv.", value: cl.conversioni ? fmt(cl.conversioni) : "—", color: cl.conversioni ? "var(--lime)" : "rgba(255,255,255,0.35)" },
                                  ].map(m => (
                                    <div key={m.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: "8px 10px" }}>
                                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{m.label}</div>
                                      <div style={{ fontSize: 16, fontWeight: 800, color: m.color, letterSpacing: "-0.02em" }}>{m.value}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Expanded client detail */}
                      {ladsExpanded && (() => {
                        const cl = ladsOverview.clients.find((c: any) => c.client_id === ladsExpanded);
                        if (!cl) return null;
                        const campaigns = ladsCampaigns[cl.client_id] || [];
                        const chat = ladsChat[cl.client_id];
                        const isAnalyzing = ladsAnalyzing === cl.client_id;
                        const isSending = ladsChatSending === cl.client_id;
                        return (
                          <div>
                            {/* Back + client header */}
                            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                              <button onClick={() => setLadsExpanded(null)}
                                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "7px 14px", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}>
                                ← Tutti i clienti
                              </button>
                              <div style={{ width: 38, height: 38, borderRadius: 10, background: avatarColor(cl.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                                {initials(cl.name)}
                              </div>
                              <div>
                                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>{cl.name}</h2>
                                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{activePeriodLabel}</p>
                              </div>
                            </div>

                            {/* Client KPIs */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
                              {[
                                { label: "Spesa", value: `€${fmt(cl.spend)}`, color: "#10b981" },
                                { label: "CTR", value: `${fmt(cl.ctr)}%`, color: (cl.ctr || 0) >= 1 ? "#10b981" : "#f59e0b" },
                                { label: "CPM", value: `€${fmt(cl.cpm)}`, color: "rgba(255,255,255,0.8)" },
                                { label: "Impressioni", value: fmt(cl.impressions), color: "rgba(255,255,255,0.8)" },
                                { label: "Conversioni", value: cl.conversioni ? fmt(cl.conversioni) : "—", color: "var(--lime)" },
                                ...(cl.cpa ? [{ label: "CPA", value: `€${fmt(cl.cpa)}`, color: "rgba(255,255,255,0.8)" }] : []),
                              ].map(kpi => (
                                <div key={kpi.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "14px 16px" }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>{kpi.label}</div>
                                  <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, letterSpacing: "-0.02em" }}>{kpi.value}</div>
                                </div>
                              ))}
                            </div>

                            {/* Campaigns table */}
                            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
                              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>Campagne</span>
                                {ladsCampLoading === cl.client_id && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.35)" }}><div className="spinner" style={{ width: 12, height: 12 }} />Caricamento...</div>}
                              </div>
                              {campaigns.length > 0 && (
                                <div style={{ overflowX: "auto" as const }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                                        {["Campagna", "Spesa (€)", "Impr.", "Click", "CTR %", "CPM €", "Conv.", "CPA €"].map(h => (
                                          <th key={h} style={{ padding: "9px 14px", textAlign: h === "Campagna" ? "left" as const : "right" as const, color: "rgba(255,255,255,0.35)", fontWeight: 700, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".05em", whiteSpace: "nowrap" as const }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {campaigns.map((camp: any, i: number) => (
                                        <tr key={camp.campaign_id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                          <td style={{ padding: "11px 14px", fontWeight: 600, color: "rgba(255,255,255,0.85)", maxWidth: 280 }}>
                                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }} title={camp.campaign_name}>{camp.campaign_name}</div>
                                          </td>
                                          <td style={{ padding: "11px 14px", textAlign: "right" as const, color: "#10b981", fontWeight: 700 }}>{fmt(camp.spend)}</td>
                                          <td style={{ padding: "11px 14px", textAlign: "right" as const, color: "rgba(255,255,255,0.55)" }}>{fmt(camp.impressions)}</td>
                                          <td style={{ padding: "11px 14px", textAlign: "right" as const, color: "rgba(255,255,255,0.55)" }}>{fmt(camp.clicks)}</td>
                                          <td style={{ padding: "11px 14px", textAlign: "right" as const, fontWeight: 700, color: (camp.ctr || 0) >= 1 ? "#10b981" : (camp.ctr || 0) >= 0.5 ? "#f59e0b" : "#ef4444" }}>{fmt(camp.ctr)}</td>
                                          <td style={{ padding: "11px 14px", textAlign: "right" as const, color: "rgba(255,255,255,0.55)" }}>{fmt(camp.cpm)}</td>
                                          <td style={{ padding: "11px 14px", textAlign: "right" as const, color: "rgba(255,255,255,0.55)" }}>{fmt(camp.conversioni)}</td>
                                          <td style={{ padding: "11px 14px", textAlign: "right" as const, color: "rgba(255,255,255,0.55)" }}>{camp.cpa ? fmt(camp.cpa) : "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {ladsCampLoading !== cl.client_id && campaigns.length === 0 && (
                                <div style={{ padding: 28, textAlign: "center" as const, color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                                  Nessuna campagna trovata per questo periodo
                                </div>
                              )}
                            </div>

                            {/* AI Analysis */}
                            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "18px 20px" }}>
                              {!chat && (
                                <button onClick={() => analyzeClient(cl.client_id, campaigns, ladsPeriod)} disabled={isAnalyzing || campaigns.length === 0}
                                  style={{ background: "rgba(199,239,0,0.08)", border: "1px solid rgba(199,239,0,0.22)", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: "var(--lime)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, opacity: (isAnalyzing || campaigns.length === 0) ? 0.5 : 1, transition: "all 0.15s" }}>
                                  {isAnalyzing ? <><div className="spinner" style={{ width: 13, height: 13 }} />Analisi in corso...</> : <>✦ Avvia Esperto Andromeda</>}
                                </button>
                              )}
                              {chat && (
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>✦ Esperto Andromeda — {cl.name}</span>
                                    <button onClick={() => setLadsChat(p => { const n = { ...p }; delete n[cl.client_id]; return n; })}
                                      style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                                      ✕ Chiudi
                                    </button>
                                  </div>
                                  <div style={{ maxHeight: 380, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 12 }}>
                                    {chat.map((msg, i) => (
                                      <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" as const : "flex-start" as const }}>
                                        <div style={{
                                          maxWidth: "86%", padding: "10px 14px", fontSize: 13, lineHeight: 1.75,
                                          borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                                          background: msg.role === "user" ? "var(--orange)" : "rgba(255,255,255,0.06)",
                                          border: msg.role === "user" ? "none" : "1px solid rgba(255,255,255,0.1)",
                                          color: msg.role === "user" ? "#fff" : "rgba(255,255,255,0.82)",
                                        }}>
                                          {msg.role === "assistant" ? <FormatText text={msg.content} /> : msg.content}
                                        </div>
                                      </div>
                                    ))}
                                    {isSending && (
                                      <div style={{ display: "flex" }}>
                                        <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 2px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                          <div className="spinner" style={{ width: 11, height: 11 }} />Sto analizzando...
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                      style={{ flex: 1, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                                      placeholder="Fai una domanda… (Invio per inviare)"
                                      value={ladsChatInput[cl.client_id] || ""}
                                      onChange={e => setLadsChatInput(p => ({ ...p, [cl.client_id]: e.target.value }))}
                                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(cl.client_id, campaigns); } }}
                                      disabled={isSending}
                                    />
                                    <button onClick={() => sendChatMessage(cl.client_id, campaigns)} disabled={isSending || !(ladsChatInput[cl.client_id] || "").trim()}
                                      style={{ background: "var(--orange)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: (isSending || !(ladsChatInput[cl.client_id] || "").trim()) ? 0.5 : 1, transition: "opacity 0.15s" }}>
                                      Invia
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>
            );
          })()}

        </div>
      </div>

      {/* ══ MODAL NUOVO CLIENTE ══ */}
      {clientModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>Nuovo Cliente</h2>
              <button onClick={() => setClientModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
            </div>
            <form onSubmit={createClient} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Nome Business *", key: "name", placeholder: "Es: Pizzeria da Mario", type: "input" },
                { label: "Settore o Industria", key: "industry", placeholder: "Es: Wellness, Food, Tech...", type: "input" },
                { label: "Link (uno per riga)", key: "links", placeholder: "https://instagram.com/...", type: "textarea" },
                { label: "Competitor (uno per riga)", key: "competitors", placeholder: "Nome o link competitor...", type: "textarea" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280", marginBottom: 6 }}>{f.label}</label>
                  {f.type === "input"
                    ? <input required className="input" value={(clientForm as any)[f.key]} onChange={e => setClientForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                    : <textarea className="input" rows={3} value={(clientForm as any)[f.key]} onChange={e => setClientForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                  }
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setClientModal(false)} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Annulla</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>Crea Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL MODIFICA TASK (LATERAL DRAWER) ══ */}
      {editTaskId && (
        <div className={`lateral-drawer ${editTaskId ? 'open' : ''}`}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: "1px solid rgba(0,0,0,0.05)"
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Dettagli</h2>
            <button 
              onClick={() => setEditTaskId(null)} 
              className="btn btn-ghost btn-sm"
              style={{ color: "#007aff", fontWeight: 600 }}
            >
              Fine
            </button>
          </div>

          <form onSubmit={saveEditTask} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "#f2f2f7", borderRadius: 10, padding: "12px 16px" }}>
              <input 
                autoFocus 
                value={editForm.title} 
                onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                style={{ 
                  width: "100%", 
                  background: "none", 
                  border: "none", 
                  fontSize: 17, 
                  fontWeight: 400, 
                  color: "#1a1a1a",
                  outline: "none"
                }} 
              />
              <textarea 
                placeholder="Note"
                value={editForm.notes} 
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                style={{ 
                  width: "100%", 
                  background: "none", 
                  border: "none", 
                  fontSize: 14, 
                  color: "#3c3c43", 
                  marginTop: 8,
                  minHeight: 80,
                  outline: "none",
                  resize: "none"
                }} 
              />
            </div>

            <div style={{ background: "#f2f2f7", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 15, color: "#1a1a1a" }}>Data</span>
                <DatePicker
                  selected={editForm.due_date ? new Date(editForm.due_date + "T12:00:00") : null}
                  onChange={(date: Date | null) => setEditForm(p => ({ ...p, due_date: date ? formatLocalISO(date) : "" }))}
                  dateFormat="dd/MM/yyyy"
                  customInput={<button type="button" style={{ background: "none", border: "none", color: "#007aff", fontSize: 15 }}>{editForm.due_date || "Scegli..."}</button>}
                />
              </div>
              <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 15, color: "#1a1a1a" }}>Priorità</span>
                <select 
                  value={editForm.priority} 
                  onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}
                  style={{ background: "none", border: "none", color: "#007aff", fontSize: 15, outline: "none", cursor: "pointer" }}
                >
                  <option value="bassa">Bassa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </div>

            <div style={{ background: "#f2f2f7", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, color: "#1a1a1a" }}>Sposta in</span>
              <select 
                value={editForm.client_id} 
                onChange={e => {
                  const c = clients.find(c => c.id === e.target.value);
                  setEditForm(p => ({ ...p, client_id: e.target.value, client_name: c?.name || "" }));
                }}
                style={{ background: "none", border: "none", color: "#007aff", fontSize: 15, outline: "none", cursor: "pointer", maxWidth: 150 }}
              >
                <option value="">Nessun cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <button 
              type="button" 
              onClick={() => { setDeleteConfirmId(editTaskId); setEditTaskId(null); }}
              style={{ 
                marginTop: 20,
                color: "#ff3b30",
                fontSize: 17,
                textAlign: "left",
                padding: "12px 16px",
                background: "#f2f2f7",
                borderRadius: 10,
                border: "none",
                width: "100%",
                cursor: "pointer"
              }}
            >
              Elimina promemoria
            </button>

            <button type="submit" style={{ display: "none" }}>Salva</button>
          </form>
        </div>
      )}

      {/* ══ MODAL NUOVA TASK ══ */}
      {taskModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setTaskModal(false); }}>
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>✨ Nuova Task</h2>
              <button onClick={() => setTaskModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#111827"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"}><XMarkIcon style={{ width: 22, height: 22 }} /></button>
            </div>
            <form onSubmit={createTask} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Titolo */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280", marginBottom: 8 }}>Titolo *</label>
                <input autoFocus required value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="Es: Creare carosello campagna Marzo"
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 14px", color: "#111827", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                  onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--orange)"}
                  onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "#d1d5db"} />
              </div>

              {/* Cliente + Priorità */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280", marginBottom: 8 }}>Cliente</label>
                  <select value={taskForm.client_id} onChange={e => {
                    const c = clients.find(c => c.id === e.target.value);
                    setTaskForm(p => ({ ...p, client_id: e.target.value, client_name: c?.name || "" }));
                  }} style={{ width: "100%", background: "#ffffff", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 14px", color: "#111827", fontSize: 14, outline: "none", fontFamily: "inherit", appearance: "none", cursor: "pointer" }}>
                    <option value="">Nessuno</option>
                    {clients.map(c => <option key={c.id} value={c.id} style={{ color: "#000" }}>{c.name}</option>)}
                  </select>
                  {taskForm.client_id && <p style={{ fontSize: 10, color: "var(--lime)", marginTop: 6, fontWeight: 600 }}>✓ Pre-selezionato</p>}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280", marginBottom: 8 }}>Priorità</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["alta", "🔴", "#ef4444"], ["media", "🟡", "#f59e0b"], ["bassa", "🟢", "#22c55e"]].map(([v, e, c]) => (
                      <button type="button" key={v} onClick={() => setTaskForm(p => ({ ...p, priority: v }))}
                        style={{
                          flex: 1, padding: "10px 4px", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                          border: "1px solid",
                          borderColor: taskForm.priority === v ? c : "#e5e7eb",
                          background: taskForm.priority === v ? `${c}20` : "#f9fafb",
                          color: taskForm.priority === v ? "#111827" : "#6b7280",
                          transition: "all 0.2s"
                        }}>
                        <span style={{ fontSize: 14 }}>{e}</span> <span style={{ textTransform: "capitalize" }}>{v}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scadenza + Tempo stimato */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280", marginBottom: 8 }}>Scadenza</label>
                  <DatePicker
                    selected={taskForm.due_date ? new Date(taskForm.due_date + "T12:00:00") : null}
                    onChange={(date: Date | null) => {
                      if (date) {
                        setTaskForm(p => ({ ...p, due_date: formatLocalISO(date) }));
                      } else {
                        setTaskForm(p => ({ ...p, due_date: "" }));
                      }
                    }}
                    minDate={new Date()}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="gg/mm/aaaa"
                    className="custom-datepicker"
                    wrapperClassName="w-full"
                  />
                  {/* Quick date shortcuts */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {[["Oggi", 0], ["Dom.", 1], ["7gg", 7]].map(([lbl, days]) => {
                      const d = new Date(); d.setDate(d.getDate() + Number(days));
                      const val = formatLocalISO(d);
                      return <button type="button" key={lbl as string} onClick={() => setTaskForm(p => ({ ...p, due_date: val }))}
                        style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid", borderColor: taskForm.due_date === val ? "var(--orange)" : "#e5e7eb", background: taskForm.due_date === val ? "rgba(255,158,28,0.1)" : "transparent", color: taskForm.due_date === val ? "var(--orange-dark)" : "#6b7280", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, transition: "all 0.15s" }}>{lbl as string}</button>;
                    })}
                    {taskForm.due_date && <button type="button" onClick={() => setTaskForm(p => ({ ...p, due_date: "" }))}
                      style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#dc2626", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>✕ Rimuovi</button>}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280", marginBottom: 8 }}>⏱ Tempo stimato</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["15m", "30m", "1h", "2h", "3h", "4h+"].map(t => (
                      <button type="button" key={t} onClick={() => setTaskForm(p => ({ ...p, estimated_time: p.estimated_time === t ? "" : t }))}
                        style={{
                          padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          border: "1px solid", borderColor: taskForm.estimated_time === t ? "var(--lime-dark)" : "#e5e7eb",
                          background: taskForm.estimated_time === t ? "var(--lime)" : "#f9fafb",
                          color: taskForm.estimated_time === t ? "#111827" : "#6b7280",
                          transition: "all 0.15s"
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280", marginBottom: 8 }}>Note</label>
                <textarea rows={2} value={taskForm.notes} onChange={e => setTaskForm(p => ({ ...p, notes: e.target.value }))} placeholder="Aggiungi contesto, link o appunti..."
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 14px", color: "#111827", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical" }}
                  onFocus={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--orange)"}
                  onBlur={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "#d1d5db"} />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button type="button" onClick={() => setTaskModal(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", color: "#4b5563", fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"}>Annulla</button>
                <button type="submit"
                  style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: "var(--orange)", color: "#fff", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(255,158,28,0.3)", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}>Crea Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Vault Modal ── */}
      {vaultModal && (
        <div className="modal-overlay" onClick={() => setVaultModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">Salva in Notion Vault</h2>
              <button className="modal-close" onClick={() => setVaultModal(false)}><XMarkIcon style={{ width: 24, height: 24 }} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Titolo</label>
              <input className="input" value={vaultData.title} onChange={e => setVaultData({ ...vaultData, title: e.target.value })} />
            </div>

            {(vaultData.type === "copy" || vaultData.type === "angle") && (
              <div style={{ marginBottom: 16 }}>
                <label className="label">Contenuto ({vaultData.type})</label>
                <textarea className="input" rows={6} value={vaultData.text} onChange={e => setVaultData({ ...vaultData, text: e.target.value })} />
              </div>
            )}

            {vaultData.type === "graphic" && (
              <div style={{ marginBottom: 16 }}>
                <label className="label">Link Ads Library (opzionale)</label>
                <input className="input" placeholder="Incolla qui il link della libreria ads..."
                  value={vaultData.img_link.includes('http') && !vaultData.img_link.includes('api/vault') && !vaultData.img_link.includes('fal.media') ? vaultData.img_link : ""}
                  onChange={e => setVaultData({ ...vaultData, img_link: e.target.value })}
                />
                <p style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                  Nota: L'immagine generata verrà salvata comunque su Notion. Qui puoi aggiungere un link di riferimento esterno.
                </p>
                {/* Anteprima immagine se disponibile */}
                {vaultData.img_link && (vaultData.img_link.includes('api/vault') || vaultData.img_link.includes('fal.media')) && (
                  <div style={{ marginTop: 12 }}>
                    <label className="label" style={{ fontSize: 10 }}>Anteprima Generazione</label>
                    <img src={vaultData.img_link} alt="preview" style={{ borderRadius: 8, maxHeight: 150, width: "100%", objectFit: "cover", border: "1px solid #e5e7eb" }} />
                  </div>
                )}
              </div>
            )}

            {/* Note per Grafiche */}
            {vaultData.type === "graphic" && (
              <div style={{ marginBottom: 16 }}>
                <label className="label">Note Personali (opzionale)</label>
                <textarea className="input" rows={3} placeholder="Es: Funziona perché il prodotto è centrale, aggiungi bullet points..."
                  value={vaultData.text} onChange={e => setVaultData({ ...vaultData, text: e.target.value })} />
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label className="label">Fase del Funnel</label>
                <select className="input" value={vaultData.funnel_stage} onChange={e => setVaultData({ ...vaultData, funnel_stage: e.target.value })}>
                  <option value="">Seleziona...</option>
                  {FUNNEL_STAGES.map(s => <option key={s.key} value={s.label}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Settore</label>
                <input className="input" placeholder="Es: Wellness" value={vaultData.sector} onChange={e => setVaultData({ ...vaultData, sector: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Client</label>
              <select className="input" value={vaultData.client_id} onChange={e => {
                const cid = e.target.value;
                setVaultData({ ...vaultData, client_id: cid });
                // Re-trigger openVaultModal-like logic to get sector if changed? 
                // Or just leave it as is if they change client.
              }}>
                <option value="">Seleziona Cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setVaultModal(false)}>Annulla</button>
              <button className="btn btn-primary" disabled={vaultSaving || !vaultData.client_id} onClick={saveToVault}>
                {vaultSaving ? <div className="spinner" /> : <BookmarkSquareIcon style={{ width: 16, height: 16 }} />}
                {vaultSaving ? "Salvataggio..." : "Salva in Notion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Smart List Editor ═══ */}
      <SmartListEditor
        isOpen={smartListEditorOpen}
        onClose={() => {
          setSmartListEditorOpen(false);
          setEditingSmartList(null);
        }}
        onSave={handleSmartListSave}
        initialData={editingSmartList}
      />


      {/* ═══ Smart List Context Menu ═══ */}
      {smartListCtxMenu && (
        <>
          <div
            onClick={() => setSmartListCtxMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setSmartListCtxMenu(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          />
          <div
            style={{
              position: 'fixed',
              left: Math.min(smartListCtxMenu.x, window.innerWidth - 200),
              top: Math.min(smartListCtxMenu.y, window.innerHeight - 120),
              zIndex: 9999,
              background: 'rgba(30,30,32,0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              minWidth: 190,
              overflow: 'hidden',
              animation: 'applePopIn 0.18s cubic-bezier(0.34,1.4,0.64,1) forwards',
            }}
          >
            <div style={{ padding: '8px 14px 4px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {smartListCtxMenu.title}
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
            <button
              onClick={() => {
                const sl = smartLists.find((s: any) => s.id === smartListCtxMenu.id);
                if (sl) openSmartListEditor(sl);
                setSmartListCtxMenu(null);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', textAlign: 'left' as const }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ opacity: 0.6, flexShrink: 0 }}><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>
              Modifica lista
            </button>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <button
              onClick={() => { deleteSmartList(smartListCtxMenu.id); setSmartListCtxMenu(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#ff453a', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', textAlign: 'left' as const }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,69,58,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ flexShrink: 0 }}><polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14H6L5 6'/><path d='M10 11v6M14 11v6'/><path d='M9 6V4h6v2'/></svg>
              Elimina lista
            </button>
          </div>
        </>
      )}


    </div>
  );
}
