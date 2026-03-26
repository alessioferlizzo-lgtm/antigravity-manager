"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  PlusIcon, TrashIcon, CheckIcon, CalendarIcon, XMarkIcon,
  ClipboardDocumentListIcon, ChevronRightIcon, SparklesIcon,
  ArrowPathIcon, MagnifyingGlassIcon, InboxIcon, CheckCircleIcon,
  ExclamationTriangleIcon, BellIcon, BellSlashIcon, ArrowTrendingUpIcon,
  ChevronDownIcon, ChevronUpIcon, PencilIcon, EllipsisHorizontalIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid, FlagIcon as FlagIconSolid } from "@heroicons/react/24/solid";
import DatePicker from "react-datepicker";
import { Client, Subtask, Task } from "@/types";


const API = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? 'https://antigravity-backend-d72s.onrender.com' : 'http://127.0.0.1:8001');

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
function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function formatLocalISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() { return formatLocalISO(new Date()); }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return formatLocalISO(d);
}
function isOverdue(dateStr: string, status: string) {
  if (!dateStr || status === "done") return false;
  return dateStr < todayStr();
}
function isToday(dateStr: string) { return dateStr === todayStr(); }
function isTomorrow(dateStr: string) { return dateStr === tomorrowStr(); }

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "Nessuna data";
  if (isToday(dateStr)) return "Oggi";
  if (isTomorrow(dateStr)) return "Domani";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

function formatDateBadge(dateStr: string, status: string) {
  if (!dateStr) return null;
  if (isOverdue(dateStr, status)) return { label: "Scaduta", color: "#ff3b30", pulse: true };
  if (isToday(dateStr)) return { label: "Oggi", color: "#ff9500", pulse: false };
  if (isTomorrow(dateStr)) return { label: "Domani", color: "#ffcc00", pulse: false };
  const d = new Date(dateStr + "T00:00:00");
  return { label: d.toLocaleDateString("it-IT", { day: "numeric", month: "short" }), color: "#636366", pulse: false };
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Ogni giorno", weekly: "Ogni settimana", monthly: "Ogni mese"
};




export type SmartListId = "oggi" | "scadute" | "scheduled" | "all" | "completed" | "flagged";

interface TasksSectionProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  clients: Client[];
  activeClientFilter: string | null;
  setActiveClientFilter: (id: string | null) => void;
  activeSmartList: SmartListId;
  setActiveSmartList: (id: SmartListId) => void;
  activeCustomListId: string | null;
  setActiveCustomListId: (id: string | null) => void;
  customLists: any[];
  onAiSort: () => void;
  aiSorting: boolean;
  isOffline?: boolean;
  onRetryConnection?: () => void;
}


const STATUS_CYCLE: Record<string, string> = { todo: "doing", doing: "done", done: "todo" };
const PRIORITY_ORDER: Record<string, number> = { alta: 0, media: 1, bassa: 2 };


/* ════════════════════════════════════════════════════════════════
   TASKS SECTION COMPONENT
════════════════════════════════════════════════════════════════ */
export default function TasksSection({
  tasks, setTasks, clients,
  activeClientFilter, setActiveClientFilter,
  activeSmartList, setActiveSmartList,
  activeCustomListId, setActiveCustomListId,
  customLists,
  onAiSort, aiSorting, isOffline,
  onRetryConnection
}: TasksSectionProps) {


  /* ─── internal filters ─── */
  const [fPriority, setFPriority] = useState("all");
  const [search, setSearch] = useState("");

  /* ─── quick add ─── */
  const [quickAdd, setQuickAdd] = useState("");
  const [quickAddDate, setQuickAddDate] = useState("");
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const [useFormMode, setUseFormMode] = useState(false); // Toggle between quick add and form
  const [formData, setFormData] = useState({ title: "", client_id: "", priority: "media", due_date: "", notes: "", flagged: false });

  /* ─── task view ─── */
  const [view, setView] = useState<"list" | "scheduled">("list");

  /* ─── drawer ─── */
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [drawerForm, setDrawerForm] = useState<Partial<Task>>({});
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerSubtaskInput, setDrawerSubtaskInput] = useState("");

  /* ─── completion animation ─── */
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  /* ─── delete confirm inline ─── */
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  /* ─── notifications ─── */
  const [notifGranted, setNotifGranted] = useState(false);
  const notifTimer = useRef<NodeJS.Timeout | null>(null);

  /* ─── drag ─── */
  const dragSrc = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);

  /* ─── AI sort ─── */
  const [aiSortOrderIds, setAiSortOrderIds] = useState<string[] | null>(null);

  /* ─── Request notification permission on mount ─── */
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(p => setNotifGranted(p === "granted"));
    } else if ("Notification" in window && Notification.permission === "granted") {
      setNotifGranted(true);
    }
  }, []);

  /* ─── Notification polling ─── */
  useEffect(() => {
    if (!notifGranted) return;
    const check = () => {
      const now = new Date();
      tasks.forEach(t => {
        if (!t.reminder_at || t.status === "done") return;
        const rAt = new Date(t.reminder_at);
        const diff = rAt.getTime() - now.getTime();
        if (diff > 0 && diff < 60000) {
          new Notification(`⏰ ${t.title}`, {
            body: t.client_name ? `Cliente: ${t.client_name}` : "Promemoria task",
            icon: "/logo.png"
          });
        }
      });
    };
    notifTimer.current = setInterval(check, 30000);
    return () => { if (notifTimer.current) clearInterval(notifTimer.current); };
  }, [tasks, notifGranted]);

  /* ─── Keyboard shortcut 'n' for quick add ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !(e.target as HTMLElement).matches("input,textarea")) {
        e.preventDefault();
        quickAddRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ─── computed counts ─── */
  const todayTasks = tasks.filter(t => t.status !== "done" && t.due_date === todayStr());
  const overdueTasks = tasks.filter(t => isOverdue(t.due_date, t.status));
  const scheduledTasks = tasks.filter(t => t.status !== "done" && t.due_date);
  const allOpenTasks = tasks.filter(t => t.status !== "done");
  const completedTasks = tasks.filter(t => t.status === "done");

  /* ─── filtered + ordered list ─── */
  const getBaseList = (): Task[] => {
    switch (activeSmartList) {
      case "oggi": return todayTasks;
      case "scadute": return overdueTasks;
      case "scheduled": return scheduledTasks;
      case "completed": return completedTasks;
      case "flagged": return tasks.filter(t => t.status !== "done" && t.flagged);
      default: return allOpenTasks;
    }
  };

  const filteredTasks = getBaseList()
    .filter(t => !activeClientFilter || t.client_id === activeClientFilter)
    .filter(t => !activeCustomListId || t.list_id === activeCustomListId)
    .filter(t => fPriority === "all" || t.priority === fPriority)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.client_name?.toLowerCase().includes(search.toLowerCase()));

  const displayTasks: Task[] = (() => {
    if (aiSortOrderIds) {
      const map = new Map(filteredTasks.map(t => [t.id, t]));
      return [
        ...aiSortOrderIds.map(id => map.get(id)).filter(Boolean) as Task[],
        ...filteredTasks.filter(t => !aiSortOrderIds.includes(t.id))
      ];
    }
    if (manualOrder) {
      const map = new Map(filteredTasks.map(t => [t.id, t]));
      return [
        ...manualOrder.map(id => map.get(id)).filter(Boolean) as Task[],
        ...filteredTasks.filter(t => !manualOrder.includes(t.id))
      ];
    }
    return [...filteredTasks].sort((a, b) => {
      if (activeSmartList === "scheduled") {
        return (a.due_date || "9999").localeCompare(b.due_date || "9999") || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
  })();

  /* ─── group by date for scheduled view ─── */
  const groupedScheduled = (() => {
    if (view !== "scheduled") return null;
    const groups: Record<string, Task[]> = {};
    displayTasks.forEach(t => {
      const key = t.due_date || "no-date";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  })();

  /* ─── Flag/Unflag ─── */
  async function toggleFlag(task: Task) {
    const newVal = !task.flagged;
    try {
      const r = await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged: newVal })
      });
      if (r.ok) {
        setTasks(p => p.map(t => t.id === task.id ? { ...t, flagged: newVal } : t));
      }
    } catch (err) { console.error("Flag toggle failed:", err); }
  }

  /* ─── NLP Parsing Logic ─── */
  const parseNLP = (text: string) => {
    let title = text;
    let clientId = "";
    let clientName = "";
    let priority = "media";
    let dueDate = "";

    // 1. Extract Client (@ClientName)
    const clientMatch = text.match(/@(\w+)/);
    if (clientMatch) {
      const slug = clientMatch[1].toLowerCase();
      const found = clients.find(c => c.name.toLowerCase().includes(slug));
      if (found) {
        clientId = found.id;
        clientName = found.name;
        title = title.replace(clientMatch[0], "").trim();
      }
    }

    // 2. Extract Priority (!alta, !media, !bassa or !1, !2, !3)
    const priorityMatch = text.match(/!(\w+|[1-3])/);
    if (priorityMatch) {
      const p = priorityMatch[1].toLowerCase();
      if (p === "alta" || p === "1") priority = "alta";
      else if (p === "bassa" || p === "3") priority = "bassa";
      else priority = "media";
      title = title.replace(priorityMatch[0], "").trim();
    }

    // 3. Extract Dates (oggi, domani, lunedi, etc.)
    const dateKeywords: Record<string, number> = {
      "oggi": 0, "domani": 1, "dopodomani": 2,
      "lunedi": 1, "lunedì": 1,
      "martedi": 2, "martedì": 2,
      "mercoledi": 3, "mercoledì": 3,
      "giovedi": 4, "giovedì": 4,
      "venerdi": 5, "venerdì": 5,
      "sabato": 6,
      "domenica": 0
    };
    
    // Simple word match for dates
    const words = title.toLowerCase().split(" ");
    for (const word of words) {
      if (dateKeywords[word] !== undefined) {
        const d = new Date();
        if (word === "oggi" || word === "domani" || word === "dopodomani") {
          d.setDate(d.getDate() + dateKeywords[word]);
        } else {
          // day of week
          const targetDay = dateKeywords[word];
          const currentDay = d.getDay();
          let diff = targetDay - currentDay;
          if (diff <= 0) diff += 7;
          d.setDate(d.getDate() + diff);
        }
        dueDate = d.toISOString().split("T")[0];
        // Remove the date word from title if it's a known keyword
        title = title.split(" ").filter(w => w.toLowerCase() !== word).join(" ");
        break;
      }
    }
    
    // Check for "prossima settimana"
    if (title.toLowerCase().includes("prossima settimana")) {
       const d = new Date();
       d.setDate(d.getDate() + 7);
       dueDate = d.toISOString().split("T")[0];
       title = title.replace(/prossima settimana/i, "").trim();
    }

    // Fallback to manual date if NLP didn't find one but quickAddDate is set
    if (!dueDate && quickAddDate) dueDate = quickAddDate;

    const flagged = text.includes("#flag");
    if (flagged) title = title.replace("#flag", "").trim();

    return { title: title || "Nuova task", clientId, clientName, priority, dueDate, flagged };
  };

  const nlpData = parseNLP(quickAdd);

  /* ─── quick add ─── */
  async function handleQuickAdd() {
    if (!quickAdd.trim()) return;
    setQuickAddLoading(true);

    const { title, clientId, clientName, priority, dueDate, flagged } = nlpData;

    const payload = {
      title,
      client_id: clientId || activeClientFilter || "",
      client_name: clientName || (activeClientFilter ? (clients.find(c => c.id === activeClientFilter)?.name || "") : ""),
      priority,
      due_date: dueDate,
      notes: "",
      estimated_time: "",
      list_id: activeCustomListId || "",
      flagged: flagged
    };

    try {
      const r = await fetch(`${API}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        const t = await r.json();
        setTasks(p => [t, ...p]);
      } else throw new Error("Server error");
    } catch (err) {
      console.error("Task creation failed:", err);
      alert("❌ Errore: Impossibile salvare la task online.");
    }
    setQuickAdd("");
    setQuickAddDate("");
    setQuickAddLoading(false);
  }

  /* ─── form add ─── */
  async function handleFormAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setQuickAddLoading(true);

    const selectedClient = clients.find(c => c.id === formData.client_id);
    const payload = {
      title: formData.title,
      client_id: formData.client_id,
      client_name: selectedClient?.name || "",
      priority: formData.priority,
      due_date: formData.due_date,
      notes: formData.notes,
      estimated_time: "",
      list_id: activeCustomListId || "",
      flagged: formData.flagged
    };

    try {
      const r = await fetch(`${API}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        const t = await r.json();
        setTasks(p => [t, ...p]);
        setFormData({ title: "", client_id: "", priority: "media", due_date: "", notes: "", flagged: false });
      } else throw new Error("Server error");
    } catch (err) {
      console.error("Task creation failed:", err);
      alert("❌ Errore: Impossibile salvare la task online.");
    }
    setQuickAddLoading(false);
  }



  async function completeTask(task: Task) {
    const isNowDone = task.status !== "done";
    const now = new Date().toISOString();

    try {
      const r = await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: isNowDone ? "done" : "todo", 
          completed_at: isNowDone ? now : null 
        })
      });
      if (r.ok) {
        setTasks(p => p.map(t => t.id === task.id ? { 
          ...t, 
          status: isNowDone ? "done" : "todo", 
          completed_at: isNowDone ? now : null 
        } : t));

        if (isNowDone) {
          setCompletingIds(p => new Set(p).add(task.id));
          setTimeout(() => {
            setHiddenIds(p => new Set(p).add(task.id));
            setTimeout(() => {
              setCompletingIds(p => { const s = new Set(p); s.delete(task.id); return s; });
              setHiddenIds(p => { const s = new Set(p); s.delete(task.id); return s; });
            }, 400);
          }, 500);
        }
      } else throw new Error("Server error");
    } catch (err) {
      console.error("Task completion failed:", err);
      alert("❌ Errore: Impossibile salvare il completamento online.");
    }

    // If recurring, create next occurrence
    if (isNowDone && task.recurring && task.recurring_frequency && task.due_date) {
      const d = new Date(task.due_date + "T00:00:00");
      if (task.recurring_frequency === "daily") d.setDate(d.getDate() + 1);
      else if (task.recurring_frequency === "weekly") d.setDate(d.getDate() + 7);
      else if (task.recurring_frequency === "monthly") d.setMonth(d.getMonth() + 1);
      
      const recurringPayload = {
        title: task.title, client_id: task.client_id, client_name: task.client_name,
        priority: task.priority, due_date: formatLocalISO(d), notes: task.notes,
        estimated_time: task.estimated_time, task_type: task.task_type,
        recurring: true, recurring_frequency: task.recurring_frequency,
        reminder_at: task.reminder_at,
      };

      try {
        const r = await fetch(`${API}/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recurringPayload)
        });
        if (r.ok) {
          const t = await r.json();
          setTasks(p => [...p, t]);
        }
      } catch (err) {
          console.error("Recurring task creation failed", err);
      }
    }
  }




  /* ─── delete task ─── */
  async function deleteTask(id: string) {
    // Optimistic local delete
    setTasks(p => p.filter(t => t.id !== id));
    setDeleteConfirmId(null);
    if (drawerTask?.id === id) setDrawerTask(null);

    try {
      const r = await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Server error");
    } catch (err) {
      console.warn("Offline delete, kept local state");
    }
  }


  /* ─── open drawer ─── */
  function openDrawer(task: Task) {
    setDrawerTask(task);
    setDrawerForm({ ...task });
  }

  /* ─── save drawer ─── */
  async function saveDrawer() {
    if (!drawerTask) return;
    setDrawerSaving(true);
    
    // Optimistic cache
    const updatedLocally = { ...drawerTask, ...drawerForm } as Task;
    setTasks(p => p.map(t => t.id === drawerTask.id ? updatedLocally : t));
    setDrawerTask(updatedLocally);

    try {
      const r = await fetch(`${API}/tasks/${drawerTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drawerForm)
      });
      if (r.ok) {
        const updated = await r.json();
        setTasks(p => p.map(t => t.id === drawerTask.id ? updated : t));
        setDrawerTask(updated);
        setDrawerForm({ ...updated });
      } else throw new Error("Server error");
    } catch (err) {
      console.warn("Offline save, kept local changes");
    }
    setDrawerSaving(false);
  }


  /* ─── subtask toggle ─── */
  async function toggleSubtask(task: Task, stId: string) {
    const subtasks = (task.subtasks || []).map(s =>
      s.id === stId ? { ...s, done: !s.done } : s
    );
    
    // Optimistic local update
    const updatedLocally = { ...task, subtasks };
    setTasks(p => p.map(t => t.id === task.id ? updatedLocally : t));
    if (drawerTask?.id === task.id) { setDrawerTask(updatedLocally); setDrawerForm({ ...updatedLocally }); }

    try {
      const r = await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks })
      });
      if (!r.ok) throw new Error("Server error");
      const updated = await r.json();
      setTasks(p => p.map(t => t.id === task.id ? updated : t));
      if (drawerTask?.id === task.id) { setDrawerTask(updated); setDrawerForm({ ...updated }); }
    } catch (err) {
      console.warn("Offline subtask toggle, kept local state");
    }
  }


  /* ─── add subtask ─── */
  async function addSubtask() {
    if (!drawerSubtaskInput.trim() || !drawerTask) return;
    const newSt: Subtask = { id: crypto.randomUUID(), text: drawerSubtaskInput.trim(), done: false };
    const subtasks = [...(drawerTask.subtasks || []), newSt];
    
    // Optimistic local update
    const updatedLocally = { ...drawerTask, subtasks };
    setTasks(p => p.map(t => t.id === drawerTask.id ? updatedLocally : t));
    setDrawerTask(updatedLocally);
    setDrawerForm({ ...updatedLocally });

    try {
      const r = await fetch(`${API}/tasks/${drawerTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks })
      });
      if (!r.ok) throw new Error("Server error");
      const updated = await r.json();
      setTasks(p => p.map(t => t.id === drawerTask.id ? updated : t));
      setDrawerTask(updated);
      setDrawerForm({ ...updated });
    } catch (err) {
      console.warn("Offline subtask add");
    }
    setDrawerSubtaskInput("");
  }


  /* ─── delete subtask ─── */
  async function deleteSubtask(task: Task, stId: string) {
    const subtasks = (task.subtasks || []).filter(s => s.id !== stId);
    
    // Optimistic local update
    const updatedLocally = { ...task, subtasks };
    setTasks(p => p.map(t => t.id === task.id ? updatedLocally : t));
    setDrawerTask(updatedLocally);
    setDrawerForm({ ...updatedLocally });

    try {
      const r = await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks })
      });
      if (!r.ok) throw new Error("Server error");
      const updated = await r.json();
      setTasks(p => p.map(t => t.id === task.id ? updated : t));
      setDrawerTask(updated);
      setDrawerForm({ ...updated });
    } catch (err) {
      console.warn("Offline subtask delete");
    }
  }


  /* ─── drag ─── */
  function onDragStart(id: string) { dragSrc.current = id; }
  function onDragEnter(id: string) { setDragOver(id); }
  function onDrop(targetId: string) {
    const srcId = dragSrc.current;
    if (!srcId || srcId === targetId) { setDragOver(null); return; }
    const arr = [...displayTasks];
    const si = arr.findIndex(t => t.id === srcId);
    const ti = arr.findIndex(t => t.id === targetId);
    const [r] = arr.splice(si, 1); arr.splice(ti, 0, r);
    setManualOrder(arr.map(t => t.id));
    setAiSortOrderIds(null);
    setDragOver(null);
  }

  /* ─── smart lists config ─── */
  const smartLists = [
    { id: "oggi" as SmartListId, label: "Oggi", icon: CalendarIcon, color: "#007aff", count: todayTasks.length },
    { id: "scadute" as SmartListId, label: "Scadute", icon: ExclamationTriangleIcon, color: "#ff3b30", count: overdueTasks.length },
    { id: "scheduled" as SmartListId, label: "Programmate", icon: CalendarIcon, color: "#ff9500", count: scheduledTasks.length },
    { id: "all" as SmartListId, label: "Tutte", icon: InboxIcon, color: "#1c1c1e", count: allOpenTasks.length },
    { id: "completed" as SmartListId, label: "Completate", icon: CheckCircleIcon, color: "#636366", count: completedTasks.length },
  ];

  return (
    <div className="tasks-root">
      <div className="tasks-section-wrapper">
        {/* ════ MAIN CONTENT ════ */}
        <div className="tasks-main">
          {/* Offline Banner */}
          {isOffline && (
            <div style={{ background: "rgba(255,149,0,0.15)", borderBottom: "1px solid rgba(255,149,0,0.3)", padding: "6px 20px", display: "flex", alignItems: "center", gap: 12, color: "#ff9500", fontSize: 11, fontWeight: 700 }}>
              <ExclamationTriangleIcon width={14} />
              <span style={{ flex: 1 }}>MODALITÀ OFFLINE — Il server non è raggiungibile. Attendi che si riattivi (richiede 30-60 secondi).</span>
              {onRetryConnection && (
                <button
                  onClick={onRetryConnection}
                  style={{
                    background: "var(--orange)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <ArrowPathIcon width={12} />
                  RICONNETTI
                </button>
              )}
            </div>
          )}

        {/* Header */}

        <div className="tasks-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 className="tasks-title">
              {smartLists.find(s => s.id === activeSmartList)?.label || "Task"}
              {activeClientFilter && (
                <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
                  · {clients.find(c => c.id === activeClientFilter)?.name}
                </span>
              )}
            </h2>
            {overdueTasks.length > 0 && activeSmartList !== "scadute" && (
              <span className="tasks-overdue-badge">
                ⚠️ {overdueTasks.length} scadut{overdueTasks.length === 1 ? "a" : "e"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <MagnifyingGlassIcon style={{ width: 13, height: 13, position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca..."
                className="tasks-search-input"
              />
            </div>
            {/* View toggle */}
            <button
              className={`tasks-view-btn ${view === "scheduled" ? "active" : ""}`}
              onClick={() => setView(v => v === "list" ? "scheduled" : "list")}
              title="Vista per data"
            >
              <CalendarIcon width={15} />
            </button>
            {/* AI Sort */}
            <button
              className="tasks-ai-btn"
              onClick={onAiSort}
              disabled={aiSorting}
              title="AI Sort"
            >
              {aiSorting ? <ArrowPathIcon width={14} style={{ animation: "spin 1s linear infinite" }} /> : <SparklesIcon width={14} />}
              AI Sort
            </button>
            {/* Notification toggle */}
            <button
              className="tasks-icon-btn"
              onClick={() => {
                if (Notification.permission === "granted") setNotifGranted(p => !p);
                else Notification.requestPermission().then(p => setNotifGranted(p === "granted"));
              }}
              title={notifGranted ? "Notifiche attive" : "Attiva notifiche"}
            >
              {notifGranted ? <BellIcon width={15} /> : <BellSlashIcon width={15} />}
            </button>
          </div>
        </div>

        {/* ─── Add Task Section ─── */}
        <div className="tasks-quickadd-container">
          {/* Toggle Button */}
          <div className="tasks-form-toggle-row">
            <button
              onClick={() => setUseFormMode(!useFormMode)}
              className="tasks-form-toggle-btn"
            >
              {useFormMode ? "← Quick Add" : "Dettagli →"}
            </button>
          </div>

          {!useFormMode ? (
            /* Quick Add Mode */
            <>
              <div className="tasks-quickadd">
                <div className="tasks-quickadd-circle">
                  <PlusIcon width={14} />
                </div>
                <input
                  ref={quickAddRef}
                  value={quickAdd}
                  onChange={e => setQuickAdd(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleQuickAdd(); }}
                  placeholder='Nuova task... (es: Draft @Cliente !alta domani)'
                  className="tasks-quickadd-input"
                />
                <button
                  onClick={handleQuickAdd}
                  disabled={!quickAdd.trim() || quickAddLoading}
                  className="tasks-quickadd-btn"
                >
                  {quickAddLoading ? "..." : "Aggiungi"}
                </button>
              </div>

              <div className="tasks-quickadd-toolbar" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "16px", marginTop: "12px" }}>
                <div className="toolbar-left" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button className="toolbar-icon-btn" title="Aggiungi data">
                    <CalendarIcon width={16} />
                  </button>
                  <button
                    className={`toolbar-icon-btn ${nlpData.priority !== "media" ? "active" : ""}`}
                    title="Imposta priorità"
                    onClick={() => {
                      const nextP = nlpData.priority === "bassa" ? "alta" : nlpData.priority === "alta" ? "media" : "bassa";
                      setQuickAdd(prev => {
                        const clean = prev.replace(/!(alta|media|bassa|[1-3])/, "").trim();
                        return `${clean} !${nextP}`;
                      });
                    }}
                  >
                    <ExclamationTriangleIcon width={16} />
                  </button>
                  <button
                    className="toolbar-icon-btn"
                    title="Contrassegna"
                    onClick={() => {
                      setQuickAdd(prev => prev.includes("#flag") ? prev.replace("#flag", "").trim() : `${prev} #flag`);
                    }}
                  >
                    <FlagIcon width={16} />
                  </button>
                  <button className="toolbar-icon-btn" title="Assegna cliente">
                    <ClipboardDocumentListIcon width={16} />
                  </button>
                </div>

                {/* NLP Feedback Badges */}
                {quickAdd.trim() && (
                  <div className="tasks-nlp-feedback">
                    {nlpData.clientName && (
                      <span className="nlp-badge nlp-badge-client">@ {nlpData.clientName}</span>
                    )}
                    {nlpData.dueDate && (
                      <span className="nlp-badge nlp-badge-date">📅 {nlpData.dueDate}</span>
                    )}
                    <span className={`nlp-badge nlp-badge-priority priority-${nlpData.priority}`}>
                      {nlpData.priority === "alta" ? "!!!" : nlpData.priority === "media" ? "!!" : "!"} {nlpData.priority}
                    </span>
                    {quickAdd.includes("#flag") && (
                      <span className="nlp-badge nlp-badge-flag">🚩 Contrassegnata</span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Form Mode */
            /* Form Mode (Full Apple Style) */
            <form onSubmit={handleFormAdd} className="tasks-full-form">
              <div className="form-row main-field">
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Titolo della task..."
                  className="form-title-input"
                  autoFocus
                />
              </div>
              
              <div className="form-grid">
                <div className="form-field">
                  <label>Cliente</label>
                  <select
                    value={formData.client_id}
                    onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                  >
                    <option value="">Nessun cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                <div className="form-field">
                  <label>Priorità</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className={`priority-select priority-${formData.priority}`}
                  >
                    <option value="bassa">Bassa</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Scadenza</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>

                <div className="form-field checkbox-field">
                  <label onClick={() => setFormData({ ...formData, flagged: !formData.flagged })}>
                    <FlagIconSolid className={formData.flagged ? "active" : ""} width={16} />
                    <span>Contrassegna</span>
                  </label>
                </div>
              </div>

              <div className="form-row">
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Aggiungi note..."
                  rows={2}
                />
              </div>

              <div className="form-footer">
                <button
                  type="submit"
                  disabled={!formData.title.trim() || quickAddLoading}
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                >
                  {quickAddLoading ? "Creazione..." : "Crea Task"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ─── Filters bar ─── */}
        <div className="tasks-filters">
          {["alta", "media", "bassa"].map(p => (
            <button
              key={p}
              className={`tasks-filter-chip ${fPriority === p ? "active" : ""}`}
              style={{ "--fc-color": p === "alta" ? "#ff3b30" : p === "media" ? "#ff9500" : "#636366" } as React.CSSProperties}
              onClick={() => setFPriority(fPriority === p ? "all" : p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          {(fPriority !== "all" || search || activeClientFilter) && (
            <button
              className="tasks-filter-clear"
              onClick={() => { setFPriority("all"); setSearch(""); setActiveClientFilter(null); }}
            >
              <XMarkIcon width={12} /> Pulisci
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
            {displayTasks.length} task{displayTasks.length !== 1 ? "" : ""}
          </span>
        </div>

        {/* ─── Task list ─── */}
        <div className="tasks-list">
          {displayTasks.length === 0 && (
            <div className="tasks-empty">
              <CheckCircleSolid width={48} style={{ color: "#2c2c2e", margin: "0 auto 12px" }} />
              <p>Nessuna task in questa lista 🎉</p>
            </div>
          )}

          {view === "scheduled" && groupedScheduled ? (
            groupedScheduled.map(([dateKey, groupTasks]) => (
              <div key={dateKey}>
                <div className="tasks-group-header">
                  <span>{dateKey === "no-date" ? "Senza data" : formatDateLabel(dateKey)}</span>
                  <span style={{ opacity: 0.5, fontSize: 12 }}>{groupTasks.length}</span>
                </div>
                {groupTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={completeTask}
                    onOpen={openDrawer}
                    onToggleFlag={toggleFlag}
                    onDelete={id => setDeleteConfirmId(id)}
                    onSubtaskToggle={toggleSubtask}
                    onDragStart={onDragStart}
                    onDragEnter={onDragEnter}
                    onDrop={onDrop}
                    onDragEnd={() => setDragOver(null)}
                    dragOver={dragOver === task.id}
                    completing={completingIds.has(task.id)}
                    hidden={hiddenIds.has(task.id)}
                    deleteConfirm={deleteConfirmId === task.id}
                    onDeleteConfirm={deleteTask}
                    onDeleteCancel={() => setDeleteConfirmId(null)}
                  />
                ))}
              </div>
            ))
          ) : (
            displayTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={completeTask}
                onOpen={openDrawer}
                onToggleFlag={toggleFlag}
                onDelete={id => setDeleteConfirmId(id)}
                onSubtaskToggle={toggleSubtask}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDrop={onDrop}
                onDragEnd={() => setDragOver(null)}
                dragOver={dragOver === task.id}
                completing={completingIds.has(task.id)}
                hidden={hiddenIds.has(task.id)}
                deleteConfirm={deleteConfirmId === task.id}
                onDeleteConfirm={deleteTask}
                onDeleteCancel={() => setDeleteConfirmId(null)}
              />
            ))
          )}
        </div>
        </div>
      </div>

      {/* ════ DRAWER ════ */}
      {drawerTask && (
        <TaskDrawer
          task={drawerTask}
          form={drawerForm}
          setForm={setDrawerForm}
          clients={clients}
          customLists={customLists}
          saving={drawerSaving}
          onSave={saveDrawer}
          onClose={() => setDrawerTask(null)}
          onAddSubtask={addSubtask}
          subtaskInput={drawerSubtaskInput}
          setSubtaskInput={setDrawerSubtaskInput}
          onToggleSubtask={toggleSubtask}
          onDeleteSubtask={deleteSubtask}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TASK CARD
════════════════════════════════════════════════════════════════ */
interface TaskCardProps {
  task: Task;
  onComplete: (t: Task) => void;
  onOpen: (t: Task) => void;
  onToggleFlag: (t: Task) => void;
  onDelete: (id: string) => void;
  onSubtaskToggle: (t: Task, stId: string) => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
  dragOver: boolean;
  completing: boolean;
  hidden: boolean;
  deleteConfirm: boolean;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

function TaskCard({
  task, onComplete, onOpen, onToggleFlag, onDelete, onSubtaskToggle,
  onDragStart, onDragEnter, onDrop, onDragEnd,
  dragOver, completing, hidden, deleteConfirm, onDeleteConfirm, onDeleteCancel
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isDone = task.status === "done";
  const dateBadge = formatDateBadge(task.due_date, task.status);
  const doneSubtasks = (task.subtasks || []).filter(s => s.done).length;
  const totalSubtasks = (task.subtasks || []).length;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragOver={e => { e.preventDefault(); onDragEnter(task.id); }}
      onDrop={() => onDrop(task.id)}
      onDragEnd={onDragEnd}
      className={`task-card ${isDone ? "done" : ""} ${completing ? "completing" : ""} ${hidden ? "hiding" : ""} ${dragOver ? "drag-over" : ""}`}
      style={{
        "--task-type-color": "transparent",
      } as React.CSSProperties}
    >
      {/* Left border accent */}
      <div className="task-card-accent" />

      <div className="task-card-inner">
        {/* Checkbox */}
        <button
          className={`task-checkbox ${isDone ? "checked" : ""} ${completing ? "completing" : ""}`}
          onClick={e => { e.stopPropagation(); onComplete(task); }}
          aria-label="Completa task"
        >
          {(isDone || completing) && <CheckIcon width={14} strokeWidth={4} />}
        </button>

        {/* Content */}
        <div className="task-card-content" onClick={() => onOpen(task)}>
          <div className="task-card-flag-container" onClick={(e) => {
            e.stopPropagation();
            onToggleFlag(task);
          }}>
            {task.flagged ? <FlagIconSolid className="task-flag-btn active" width={16} /> : <FlagIcon className="task-flag-btn" width={16} />}
          </div>
          <div className="task-card-title-row">
            {task.priority !== "bassa" && (
              <span className={`task-priority-marker priority-${task.priority}`}>
                {task.priority === "alta" ? "!!!" : "!!"}
              </span>
            )}
            <span className={`task-card-title ${isDone ? "done" : ""}`}>{task.title}</span>
            {task.recurring && <span className="task-recurring-badge" title={FREQ_LABELS[task.recurring_frequency || ""] || "Ricorrente"}>🔁</span>}
            {task.flagged && <FlagIconSolid className="task-flag-icon active" width={14} />}
          </div>

          {/* Badges row */}
          <div className="task-badges">
            {task.client_name && (
              <span className="task-badge task-badge-client">
                <span className="task-badge-avatar" style={{ background: avatarColor(task.client_name) }}>
                  {initials(task.client_name)}
                </span>
                {task.client_name}
              </span>
            )}
            {dateBadge && (
              <span
                className={`task-badge task-badge-date ${dateBadge.pulse ? "pulse" : ""}`}
                style={{ color: dateBadge.color }}
              >
                {dateBadge.label}
              </span>
            )}
            {task.estimated_time && (
              <span className="task-badge task-badge-time">{task.estimated_time}</span>
            )}
            {totalSubtasks > 0 && (
              <span className="task-badge task-badge-subtasks">
                {doneSubtasks}/{totalSubtasks} sotto-task
              </span>
            )}
          </div>

          {/* Subtask progress bar */}
          {totalSubtasks > 0 && (
            <div className="task-subtask-progress">
              <div className="task-subtask-bar" style={{ width: `${(doneSubtasks / totalSubtasks) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="task-card-actions">
          {totalSubtasks > 0 && (
            <button
              className="task-action-btn"
              onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}
            >
              {expanded ? <ChevronUpIcon width={14} /> : <ChevronDownIcon width={14} />}
            </button>
          )}
          {!deleteConfirm ? (
            <button className="task-action-btn danger" onClick={e => { e.stopPropagation(); onDelete(task.id); }}>
              <TrashIcon width={14} />
            </button>
          ) : (
            <div className="task-delete-confirm" onClick={e => e.stopPropagation()}>
              <button className="task-delete-yes" onClick={() => onDeleteConfirm(task.id)}>Elimina</button>
              <button className="task-delete-no" onClick={onDeleteCancel}>Annulla</button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable subtasks inline */}
      {expanded && totalSubtasks > 0 && (
        <div className="task-subtasks-inline">
          {(task.subtasks || []).map(st => (
            <div key={st.id} className={`task-subtask-row ${st.done ? "done" : ""}`}>
              <button
                className={`task-subtask-check ${st.done ? "checked" : ""}`}
                onClick={e => { e.stopPropagation(); onSubtaskToggle(task, st.id); }}
              >
                {st.done && <CheckIcon width={9} strokeWidth={3} />}
              </button>
              <span>{st.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TASK DRAWER
════════════════════════════════════════════════════════════════ */
interface TaskDrawerProps {
  task: Task;
  form: Partial<Task>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Task>>>;
  clients: Client[];
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onAddSubtask: () => void;
  subtaskInput: string;
  setSubtaskInput: (v: string) => void;
  onToggleSubtask: (t: Task, stId: string) => void;
  onDeleteSubtask: (t: Task, stId: string) => void;
  customLists: any[];
}

function TaskDrawer({
  task, form, setForm, clients, saving, onSave, onClose,
  onAddSubtask, subtaskInput, setSubtaskInput, onToggleSubtask, onDeleteSubtask,
  customLists
}: TaskDrawerProps) {
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter(s => s.done).length;
  const [titleEdit, setTitleEdit] = useState(false);

  function set(key: keyof Task, value: unknown) {
    setForm(p => ({ ...p, [key]: value }));
  }

  return (
    <div className="task-drawer-container">
      <div className="task-drawer-backdrop" onClick={onClose} />
      <div className="task-drawer">
        {/* Header */}
        <div className="task-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {titleEdit ? (
              <input
                autoFocus
                value={form.title || ""}
                onChange={e => set("title", e.target.value)}
                onBlur={() => setTitleEdit(false)}
                onKeyDown={e => { if (e.key === "Enter") setTitleEdit(false); }}
                className="task-drawer-title-input"
              />
            ) : (
              <h3 className="task-drawer-title" onClick={() => setTitleEdit(true)}>
                {form.title || task.title}
                <PencilIcon width={14} style={{ marginLeft: 6, opacity: 0.4 }} />
              </h3>
            )}
          </div>
          <button className="task-drawer-close" onClick={onClose}><XMarkIcon width={20} /></button>
        </div>

        <div className="task-drawer-body">
          {/* Subtasks progress */}
          {subtasks.length > 0 && (
            <div className="task-drawer-progress">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
                <span>Progress subtask</span>
                <span>{doneCount}/{subtasks.length}</span>
              </div>
              <div className="task-drawer-progressbar">
                <div className="task-drawer-progressbar-fill" style={{ width: `${subtasks.length > 0 ? (doneCount / subtasks.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* Two column fields */}
          <div className="task-drawer-fields">
            {/* Cliente */}
            <div className="task-drawer-field">
              <label>Cliente</label>
              <select value={form.client_id || ""} onChange={e => {
                const c = clients.find(c => c.id === e.target.value);
                set("client_id", e.target.value);
                set("client_name", c?.name || "");
              }}>
                <option value="">— nessuno —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Lista */}
            <div className="task-drawer-field">
              <label>Lista</label>
              <select value={form.list_id || ""} onChange={e => set("list_id", e.target.value)}>
                <option value="">— Nessuna lista —</option>
                {customLists.map(l => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>

            {/* Priorità */}
            <div className="task-drawer-field">
              <label>Priorità</label>
              <div className="task-drawer-priority-btns">
                {["alta", "media", "bassa"].map(p => (
                  <button
                    key={p}
                    className={`task-prio-btn ${form.priority === p ? "active" : ""}`}
                    style={{ "--pc": p === "alta" ? "#ff3b30" : p === "media" ? "#ff9500" : "#636366" } as React.CSSProperties}
                    onClick={() => set("priority", p)}
                  >
                    {p === "alta" ? "🔴" : p === "media" ? "🟠" : "⚪"} {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Stato */}
            <div className="task-drawer-field">
              <label>Stato</label>
              <div className="task-drawer-priority-btns">
                {(["todo", "doing", "done"] as const).map(s => (
                  <button
                    key={s}
                    className={`task-prio-btn ${form.status === s ? "active" : ""}`}
                    style={{ "--pc": s === "done" ? "#34c759" : s === "doing" ? "#ff9500" : "#636366" } as React.CSSProperties}
                    onClick={() => set("status", s)}
                  >
                    {s === "done" ? "✅" : s === "doing" ? "🔄" : "⬜"} {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Scadenza */}
            <div className="task-drawer-field">
              <label>Scadenza</label>
              <input type="date" value={form.due_date || ""} onChange={e => set("due_date", e.target.value)} />
            </div>

            {/* Tempo stimato */}
            <div className="task-drawer-field">
              <label>Tempo stimato</label>
              <select value={form.estimated_time || ""} onChange={e => set("estimated_time", e.target.value)}>
                <option value="">—</option>
                {["15m","30m","45m","1h","1h30","2h","3h","4h","1g"].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Promemoria */}
            <div className="task-drawer-field">
              <label>Promemoria</label>
              <input
                type="datetime-local"
                value={form.reminder_at ? form.reminder_at.slice(0, 16) : ""}
                onChange={e => set("reminder_at", e.target.value ? e.target.value + ":00" : "")}
              />
            </div>

            {/* Ricorrenza */}
            <div className="task-drawer-field">
              <label>Ripeti</label>
              <select
                value={form.recurring_frequency || ""}
                onChange={e => {
                  set("recurring_frequency", e.target.value);
                  set("recurring", !!e.target.value);
                }}
              >
                <option value="">Mai</option>
                <option value="daily">Ogni giorno</option>
                <option value="weekly">Ogni settimana</option>
                <option value="monthly">Ogni mese</option>
              </select>
            </div>
          </div>

          {/* Note */}
          <div className="task-drawer-notes">
            <label>Note</label>
            <textarea
              value={form.notes || ""}
              onChange={e => set("notes", e.target.value)}
              placeholder="Aggiungi note..."
              rows={3}
            />
          </div>

          {/* Subtasks */}
          <div className="task-drawer-subtasks">
            <label>Subtask</label>
            <div className="task-drawer-subtask-list">
              {subtasks.map(st => (
                <div key={st.id} className={`task-drawer-subtask-row ${st.done ? "done" : ""}`}>
                  <button
                    className={`task-subtask-check ${st.done ? "checked" : ""}`}
                    onClick={() => onToggleSubtask(task, st.id)}
                  >
                    {st.done && <CheckIcon width={9} strokeWidth={3} />}
                  </button>
                  <span>{st.text}</span>
                  <button className="task-subtask-del" onClick={() => onDeleteSubtask(task, st.id)}>
                    <XMarkIcon width={12} />
                  </button>
                </div>
              ))}
              <div className="task-subtask-add-row">
                <input
                  value={subtaskInput}
                  onChange={e => setSubtaskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") onAddSubtask(); }}
                  placeholder="Aggiungi subtask... (Invio)"
                  className="task-subtask-input"
                />
                <button className="task-subtask-add-btn" onClick={onAddSubtask}>
                  <PlusIcon width={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="task-drawer-footer">
          <button className="task-drawer-cancel" onClick={onClose}>Annulla</button>
          <button className="task-drawer-save" onClick={onSave} disabled={saving}>
            {saving ? <ArrowPathIcon width={14} style={{ animation: "spin 1s linear infinite" }} /> : <CheckIcon width={14} />}
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
