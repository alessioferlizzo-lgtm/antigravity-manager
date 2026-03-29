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
import "react-datepicker/dist/react-datepicker.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Client, Subtask, Task } from "@/types";


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
  const [fTimeRange, setFTimeRange] = useState("all");
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.fromTo(
      ".task-card",
      { y: 30, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.04, ease: "power2.out", clearProps: "all" }
    );
  }, { scope: containerRef, dependencies: [tasks, activeSmartList, activeClientFilter, fTimeRange, search] });

  /* ─── quick add ─── */
  const [quickAdd, setQuickAdd] = useState("");
  const [quickAddDate, setQuickAddDate] = useState("");
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const [useFormMode, setUseFormMode] = useState(false);
  const [formData, setFormData] = useState({ title: "", client_id: "", priority: "", due_date: "", notes: "", flagged: false });
  const [quickAddFocused, setQuickAddFocused] = useState(false);
  const [quickAddFlag, setQuickAddFlag] = useState(false);
  const [quickAddPriority, setQuickAddPriority] = useState("");
  const [quickAddDateTag, setQuickAddDateTag] = useState("");

  /* ─── task view ─── */
  const [view, setView] = useState<"list" | "scheduled" | "calendar">("list");

  /* ─── calendar state ─── */
  const [calWeekStart, setCalWeekStart] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d;
  });
  const [calDragOverDay, setCalDragOverDay] = useState<string | null>(null);
  const calDragTaskRef = useRef<string | null>(null);

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
    .filter(t => {
      if (fTimeRange === "all") return true;
      if (!t.due_date) return false;
      const today = todayStr();
      const tomorrow = tomorrowStr();
      const weekFromNow = formatLocalISO((() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })());
      if (fTimeRange === "oggi") return t.due_date === today;
      if (fTimeRange === "domani") return t.due_date === tomorrow;
      if (fTimeRange === "settimana") return t.due_date <= weekFromNow;
      return true;
    })
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

    const { title, clientId, clientName, priority: nlpPriority, dueDate: nlpDueDate, flagged: nlpFlagged } = nlpData;

    // Toolbar-set values override NLP parsing
    const finalPriority = quickAddPriority || nlpPriority || "";
    const finalDueDate = quickAddDateTag === "oggi"
      ? new Date().toISOString().split("T")[0]
      : quickAddDateTag === "domani"
        ? (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split("T")[0]; })()
        : nlpDueDate || "";
    const finalFlagged = quickAddFlag || nlpFlagged;

    const payload = {
      title,
      client_id: clientId || activeClientFilter || "",
      client_name: clientName || (activeClientFilter ? (clients.find(c => c.id === activeClientFilter)?.name || "") : ""),
      priority: finalPriority,
      due_date: finalDueDate,
      notes: "",
      estimated_time: "",
      list_id: activeCustomListId || "",
      flagged: finalFlagged
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
    setQuickAddPriority("");
    setQuickAddDateTag("");
    setQuickAddFlag(false);
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

    // Check if this is a temporary task (pre-creation)
    const isTemp = drawerTask.id.startsWith("temp-");

    if (isTemp) {
      // Create new task from drawer form
      const selectedClient = clients.find(c => c.id === drawerForm.client_id);
      const payload = {
        title: drawerForm.title || "Nuova task",
        client_id: drawerForm.client_id || "",
        client_name: selectedClient?.name || "",
        priority: drawerForm.priority !== undefined ? drawerForm.priority : "",
        due_date: drawerForm.due_date || "",
        due_time: drawerForm.due_time || "",
        notes: drawerForm.notes || "",
        estimated_time: drawerForm.estimated_time || "",
        list_id: drawerForm.list_id || activeCustomListId || "",
        flagged: drawerForm.flagged || false,
        recurring: drawerForm.recurring || false,
        recurring_frequency: drawerForm.recurring_frequency || "",
        reminder_at: drawerForm.reminder_at || ""
      };

      try {
        const r = await fetch(`${API}/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (r.ok) {
          const newTask = await r.json();
          setTasks(p => [newTask, ...p]);
          setDrawerTask(null); // Close drawer
          setQuickAdd(""); // Clear quick add input
        } else throw new Error("Server error");
      } catch (err) {
        console.error("Task creation failed:", err);
        alert("❌ Errore: Impossibile salvare la task online.");
      }
    } else {
      // Update existing task
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
          // drawerForm has the user's intended values; server response is the canonical data.
          // Merge: server response is base, but locally-set user fields take priority
          // (the server may not return all fields like flagged, due_time, priority="")
          const preservedFields = {
            flagged: drawerForm.flagged ?? updated.flagged ?? false,
            priority: drawerForm.priority !== undefined ? drawerForm.priority : updated.priority,
            due_time: drawerForm.due_time !== undefined ? drawerForm.due_time : updated.due_time,
            reminder_at: drawerForm.reminder_at !== undefined ? drawerForm.reminder_at : updated.reminder_at,
            recurring: drawerForm.recurring !== undefined ? drawerForm.recurring : updated.recurring,
            recurring_frequency: drawerForm.recurring_frequency !== undefined ? drawerForm.recurring_frequency : updated.recurring_frequency,
            list_id: drawerForm.list_id !== undefined ? drawerForm.list_id : updated.list_id,
          };
          const merged = { ...updated, ...preservedFields };
          setTasks(p => p.map(t => t.id === drawerTask.id ? merged : t));
          setDrawerTask(merged);
          setDrawerForm({ ...merged });
        } else throw new Error("Server error");
      } catch (err) {
        console.warn("Offline save, kept local changes");
      }
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

  /* ─── calendar drag & drop ─── */
  async function calDropTaskOnDay(dateStr: string) {
    const taskId = calDragTaskRef.current;
    if (!taskId) return;
    setCalDragOverDay(null);
    calDragTaskRef.current = null;
    try {
      const r = await fetch(`${API}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: dateStr })
      });
      if (r.ok) {
        const updated = await r.json();
        setTasks(p => p.map(t => t.id === taskId ? updated : t));
      }
    } catch (err) {
      console.error("Calendar drop failed:", err);
    }
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
    <div className="tasks-root" ref={containerRef}>
      <div className="tasks-section-wrapper">
        {/* ════ MAIN CONTENT ════ */}
        <div className="tasks-main">
          {/* Offline Banner */}
          {isOffline && (
            <div style={{ background: "rgba(255,149,0,0.15)", borderBottom: "1px solid rgba(255,149,0,0.3)", padding: "6px 20px", display: "flex", alignItems: "center", gap: 12, color: "#ff9500", fontSize: 11, fontWeight: 700 }}>
              <ExclamationTriangleIcon width={14} />
              <span style={{ flex: 1 }}>MODALITÀ OFFLINE — Il server non è raggiungibile. Prova a ricaricare la pagina.</span>
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
              className={`tasks-view-btn ${view !== "list" ? "active" : ""}`}
              onClick={() => setView(v => v === "list" ? "calendar" : v === "calendar" ? "scheduled" : "list")}
              title={view === "list" ? "Vista calendario" : view === "calendar" ? "Vista raggruppata" : "Vista lista"}
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

        {/* Quick Add — Apple Reminders style */}
        <div className="tasks-quickadd-container">
          <div className="tasks-quickadd">
            <div className="tasks-quickadd-circle">
              <PlusIcon width={14} />
            </div>
            <input
              ref={quickAddRef}
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onFocus={() => setQuickAddFocused(true)}
              onBlur={() => setTimeout(() => setQuickAddFocused(false), 200)}
              onKeyDown={e => {
                if (e.key === "Enter") handleQuickAdd();
                if (e.key === "Escape") { setQuickAdd(""); quickAddRef.current?.blur(); }
              }}
              placeholder="Nuova task..."
              className="tasks-quickadd-input"
            />
            {/* Info icon — open drawer */}
            <button
              onClick={() => {
                const dueDate = quickAddDateTag === "oggi"
                  ? new Date().toISOString().split("T")[0]
                  : quickAddDateTag === "domani"
                    ? (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split("T")[0]; })()
                    : "";
                const tempTask: Task = {
                  id: "temp-" + Date.now(),
                  title: quickAdd.trim() || "",
                  client_id: "", client_name: "",
                  priority: quickAddPriority,
                  status: "todo",
                  due_date: dueDate,
                  notes: "", estimated_time: "",
                  created_at: new Date().toISOString(),
                  task_type: "",
                  flagged: quickAddFlag,
                  subtasks: [], recurring: false, recurring_frequency: "", reminder_at: "", list_id: ""
                };
                setDrawerTask(tempTask);
                setDrawerForm({ ...tempTask });
              }}
              className="tasks-info-btn"
              title="Aggiungi dettagli"
              style={{ background: "none", border: "none", color: "#007aff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <text x="8" y="12" fontSize="11" fontWeight="600" textAnchor="middle" fill="currentColor">i</text>
              </svg>
            </button>
          </div>

          {/* Apple-style compact toolbar — slides in on focus */}
          <div
            className="tasks-apple-toolbar"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: quickAddFocused ? "6px 10px" : "0 10px",
              overflow: "hidden",
              maxHeight: quickAddFocused ? "48px" : "0px",
              opacity: quickAddFocused ? 1 : 0,
              transition: "max-height 0.22s ease, opacity 0.15s ease, padding 0.15s ease",
              borderTop: "1px solid rgba(255,255,255,0.06)"
            }}
          >
            <button
              className={`apple-toolbar-pill${quickAddDateTag === "oggi" ? " active date-active" : ""}`}
              onMouseDown={e => { e.preventDefault(); setQuickAddDateTag(quickAddDateTag === "oggi" ? "" : "oggi"); }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Oggi
            </button>
            <button
              className={`apple-toolbar-pill${quickAddDateTag === "domani" ? " active date-active" : ""}`}
              onMouseDown={e => { e.preventDefault(); setQuickAddDateTag(quickAddDateTag === "domani" ? "" : "domani"); }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Domani
            </button>

            <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", flexShrink: 0, margin: "0 2px" }} />

            <button
              className={`apple-toolbar-pill priority-pill${quickAddPriority === "alta" ? " active priority-alta" : ""}`}
              title="Alta"
              onMouseDown={e => { e.preventDefault(); setQuickAddPriority(quickAddPriority === "alta" ? "" : "alta"); }}
            >!!!
            </button>
            <button
              className={`apple-toolbar-pill priority-pill${quickAddPriority === "media" ? " active priority-media" : ""}`}
              title="Media"
              onMouseDown={e => { e.preventDefault(); setQuickAddPriority(quickAddPriority === "media" ? "" : "media"); }}
            >!!
            </button>
            <button
              className={`apple-toolbar-pill priority-pill${quickAddPriority === "bassa" ? " active priority-bassa" : ""}`}
              title="Bassa"
              onMouseDown={e => { e.preventDefault(); setQuickAddPriority(quickAddPriority === "bassa" ? "" : "bassa"); }}
            >!
            </button>

            <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", flexShrink: 0, margin: "0 2px" }} />

            <button
              className={`apple-toolbar-pill flag-pill${quickAddFlag ? " active flag-active" : ""}`}
              title="Contrassegna"
              onMouseDown={e => { e.preventDefault(); setQuickAddFlag(!quickAddFlag); }}
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill={quickAddFlag ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 1v18M4 13V1l12 6-12 6z"/>
              </svg>
            </button>

            <div style={{ flex: 1 }} />

            {quickAdd.trim() && (
              <button
                onMouseDown={e => { e.preventDefault(); handleQuickAdd(); }}
                disabled={quickAddLoading}
                style={{ background: "#007aff", border: "none", color: "#fff", borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              >
                {quickAddLoading ? "..." : "↵"}
              </button>
            )}
          </div>

          {/* NLP / active-tag feedback */}
          {(quickAdd.trim() || quickAddDateTag || quickAddPriority || quickAddFlag) && quickAddFocused && (
            <div className="tasks-nlp-feedback">
              {(quickAddDateTag || nlpData.dueDate) && (
                <span className="nlp-badge nlp-badge-date">📅 {quickAddDateTag || nlpData.dueDate}</span>
              )}
              {quickAddPriority && (
                <span className={`nlp-badge nlp-badge-priority priority-${quickAddPriority}`}>
                  {quickAddPriority === "alta" ? "!!!" : quickAddPriority === "media" ? "!!" : "!"} {quickAddPriority}
                </span>
              )}
              {nlpData.clientName && (
                <span className="nlp-badge nlp-badge-client">@ {nlpData.clientName}</span>
              )}
              {quickAddFlag && (
                <span className="nlp-badge nlp-badge-flag">🚩 Contrassegnata</span>
              )}
            </div>
          )}

          {false ? (
            /* Form Mode — kept for reference, no longer shown */
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
          ) : null}
        </div>

        {/* ─── Filters bar ─── */}
        <div className="tasks-filters">
          {[
            { key: "oggi", label: "Oggi", color: "#007aff" },
            { key: "domani", label: "Domani", color: "#ff9500" },
            { key: "settimana", label: "Questa settimana", color: "#34c759" }
          ].map(f => (
            <button
              key={f.key}
              className={`tasks-filter-chip ${fTimeRange === f.key ? "active" : ""}`}
              style={{ "--fc-color": f.color } as React.CSSProperties}
              onClick={() => setFTimeRange(fTimeRange === f.key ? "all" : f.key)}
            >
              {f.label}
            </button>
          ))}
          {(fTimeRange !== "all" || search || activeClientFilter) && (
            <button
              className="tasks-filter-clear"
              onClick={() => { setFTimeRange("all"); setSearch(""); setActiveClientFilter(null); }}
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
          {displayTasks.length === 0 && view !== "calendar" && (
            <div className="tasks-empty">
              <CheckCircleSolid width={48} style={{ color: "#2c2c2e", margin: "0 auto 12px" }} />
              <p>Nessuna task in questa lista 🎉</p>
            </div>
          )}

          {view === "calendar" ? (
            <CalendarView
              tasks={tasks}
              calWeekStart={calWeekStart}
              setCalWeekStart={setCalWeekStart}
              calDragOverDay={calDragOverDay}
              setCalDragOverDay={setCalDragOverDay}
              calDragTaskRef={calDragTaskRef}
              onDropTaskOnDay={calDropTaskOnDay}
              onTaskClick={openDrawer}
            />
          ) : view === "scheduled" && groupedScheduled ? (
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
                {dateBadge.label}{task.due_time && ` • ${task.due_time}`}
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
   IOS TOGGLE COMPONENT
════════════════════════════════════════════════════════════════ */
function IOSToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`ios-toggle ${on ? "on" : ""}`}
      role="switch"
      aria-checked={on}
    >
      <span className="ios-toggle-thumb" />
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════
   IOS ROW ICON
════════════════════════════════════════════════════════════════ */
function RowIcon({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="ios-row-icon" style={{ color }}>
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════
   TASK DRAWER — Apple Reminders Style
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
  const [dateEnabled, setDateEnabled] = useState(!!(form.due_date));
  const [timeEnabled, setTimeEnabled] = useState(!!(form.due_time));
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  function set(key: keyof Task, value: unknown) {
    setForm(p => ({ ...p, [key]: value }));
  }

  const selectedList = customLists.find(l => l.id === form.list_id);

  function formatDateShort(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "oggi";
    if (diff === -1) return "ieri";
    if (diff === 1) return "domani";
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  }

  return (
    <div className="task-drawer-container">
      <div className="task-drawer-backdrop" onClick={onClose} />
      <div className="task-drawer apple-drawer">

        {/* ── Header ── */}
        <div className="apple-drawer-header">
          <h3 className="apple-drawer-heading">Promemoria</h3>
          <button className="apple-drawer-close" onClick={onClose}>
            <XMarkIcon width={14} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="apple-drawer-body">

          {/* Title editable */}
          <div className="apple-drawer-title-section">
            {titleEdit ? (
              <input
                autoFocus
                value={form.title || ""}
                onChange={e => set("title", e.target.value)}
                onBlur={() => setTitleEdit(false)}
                onKeyDown={e => { if (e.key === "Enter") setTitleEdit(false); }}
                className="apple-drawer-title-input"
                placeholder="Titolo"
              />
            ) : (
              <div className="apple-drawer-title-btn" onClick={() => setTitleEdit(true)}>
                <span className="apple-drawer-title-text">{form.title || task.title || "Senza titolo"}</span>
              </div>
            )}
          </div>

          {/* Note — minimal auto-expand */}
          <div className="apple-drawer-free-section">
            <textarea
              value={form.notes || ""}
              onChange={e => {
                set("notes", e.target.value);
                // auto-expand
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              placeholder="Note"
              className="apple-notes-textarea"
              rows={1}
            />
            <div className="apple-free-url-row">URL</div>
          </div>

          {/* ── Data e ora ── */}
          <div className="apple-section-label">Data e ora</div>
          <div className="apple-group">

            {/* Data row */}
            <div className="apple-row">
              <div className="apple-row-left">
                <RowIcon color="#8E8E93">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </RowIcon>
                <div className="apple-row-label-stack">
                  <span className="apple-row-label">Data</span>
                  {dateEnabled && form.due_date && (
                    <span className="apple-row-sublabel">{formatDateShort(form.due_date)}</span>
                  )}
                </div>
              </div>
              <div className="apple-row-right">
                <IOSToggle on={dateEnabled} onChange={v => {
                  setDateEnabled(v);
                  if (!v) { set("due_date", ""); setTimeEnabled(false); set("due_time", ""); }
                  else if (!form.due_date) { set("due_date", new Date().toISOString().split("T")[0]); }
                }} />
              </div>
            </div>

            {/* Inline date picker when Data is ON */}
            {dateEnabled && (
              <div className="apple-picker-row apple-separator-top">
                <input
                  type="date"
                  value={form.due_date || ""}
                  onChange={e => set("due_date", e.target.value)}
                  className="apple-date-input-full"
                />
              </div>
            )}

            {/* Ora — only when date is ON */}
            {dateEnabled && (
              <div className="apple-row apple-separator-top">
                <div className="apple-row-left">
                  <RowIcon color="#8E8E93">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </RowIcon>
                  <div className="apple-row-label-stack">
                    <span className="apple-row-label">Ora</span>
                    {timeEnabled && form.due_time && (
                      <span className="apple-row-sublabel">{form.due_time}</span>
                    )}
                  </div>
                </div>
                <div className="apple-row-right">
                  <IOSToggle on={timeEnabled} onChange={v => {
                    setTimeEnabled(v);
                    if (!v) set("due_time", "");
                    else if (!form.due_time) set("due_time", "09:00");
                  }} />
                </div>
              </div>
            )}

            {/* Inline time picker when Ora is ON */}
            {dateEnabled && timeEnabled && (
              <div className="apple-picker-row apple-separator-top">
                <input
                  type="time"
                  value={form.due_time || ""}
                  onChange={e => set("due_time", e.target.value)}
                  className="apple-date-input-full"
                />
              </div>
            )}

            {/* Urgente */}
            <div className={`apple-row${dateEnabled ? " apple-separator-top" : ""}`}>
              <div className="apple-row-left">
                <RowIcon color="#8E8E93">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </RowIcon>
                <span className="apple-row-label">Urgente</span>
              </div>
              <div className="apple-row-right">
                <IOSToggle on={form.priority === "alta"} onChange={v => set("priority", v ? "alta" : (form.priority === "alta" ? "" : form.priority || ""))} />
              </div>
            </div>

            {!dateEnabled && (
              <p className="apple-hint">Per impostare una sveglia, segna il promemoria come urgente.</p>
            )}
          </div>

          {/* ── Ripetizione ── */}
          <div className="apple-section-label">Ripetizione</div>
          <div className="apple-group">
            <div className="apple-row">
              <div className="apple-row-left">
                <RowIcon color="#8E8E93">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                </RowIcon>
                <span className="apple-row-label">Ripetizione</span>
              </div>
              <div className="apple-row-right">
                <select className="apple-select" value={form.recurring_frequency || ""} onChange={e => { set("recurring_frequency", e.target.value); set("recurring", !!e.target.value); }}>
                  <option value="">Mai</option>
                  <option value="daily">Ogni giorno</option>
                  <option value="weekly">Ogni settimana</option>
                  <option value="monthly">Ogni mese</option>
                </select>
                <ChevronRightIcon width={12} className="apple-chevron" />
              </div>
            </div>

            <div className="apple-row apple-separator-top">
              <div className="apple-row-left">
                <RowIcon color="#8E8E93">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </RowIcon>
                <span className="apple-row-label">Avviso anticipato</span>
              </div>
              <div className="apple-row-right">
                <select className="apple-select" value={form.reminder_at || ""} onChange={e => set("reminder_at", e.target.value)}>
                  <option value="">Nessuno</option>
                  <option value="at_time">All&apos;orario</option>
                  <option value="5min">5 min prima</option>
                  <option value="15min">15 min prima</option>
                  <option value="30min">30 min prima</option>
                  <option value="1h">1 ora prima</option>
                  <option value="1d">1 giorno prima</option>
                  <option value="2d">2 giorni prima</option>
                  <option value="1w">1 settimana prima</option>
                </select>
                <ChevronRightIcon width={12} className="apple-chevron" />
              </div>
            </div>
          </div>

          {/* ── Organizzazione ── */}
          <div className="apple-section-label">Organizzazione</div>
          <div className="apple-group">
            <div className="apple-row">
              <div className="apple-row-left">
                <RowIcon color="#FF3B30">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </RowIcon>
                <span className="apple-row-label">Elenco</span>
              </div>
              <div className="apple-row-right">
                {selectedList && <span className="apple-list-dot" style={{ background: "#FF3B30" }} />}
                <select className="apple-select" value={form.list_id || ""} onChange={e => set("list_id", e.target.value)}>
                  <option value="">Nessuna lista</option>
                  {customLists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
                <ChevronRightIcon width={12} className="apple-chevron" />
              </div>
            </div>

            <div className="apple-row apple-separator-top">
              <div className="apple-row-left">
                <RowIcon color="#8E8E93">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </RowIcon>
                <span className="apple-row-label">Cliente</span>
              </div>
              <div className="apple-row-right">
                <select className="apple-select" value={form.client_id || ""} onChange={e => {
                  const c = clients.find(c => c.id === e.target.value);
                  set("client_id", e.target.value);
                  set("client_name", c?.name || "");
                }}>
                  <option value="">Nessuno</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronRightIcon width={12} className="apple-chevron" />
              </div>
            </div>

            <div className="apple-row apple-separator-top">
              <div className="apple-row-left">
                <RowIcon color="#FF9500">
                  <FlagIconSolid width={12} />
                </RowIcon>
                <span className="apple-row-label">Contrassegna</span>
              </div>
              <div className="apple-row-right">
                <IOSToggle on={!!form.flagged} onChange={v => set("flagged", v)} />
              </div>
            </div>

            <div className="apple-row apple-separator-top">
              <div className="apple-row-left">
                <RowIcon color="#8E8E93">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
                  </svg>
                </RowIcon>
                <span className="apple-row-label">Priorità</span>
              </div>
              <div className="apple-row-right">
                <select className="apple-select" value={form.priority || ""} onChange={e => set("priority", e.target.value)}>
                  <option value="">Nessuna</option>
                  <option value="bassa">Bassa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
                <ChevronRightIcon width={12} className="apple-chevron" />
              </div>
            </div>

            <div className="apple-row apple-separator-top">
              <div className="apple-row-left">
                <RowIcon color="#8E8E93">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </RowIcon>
                <span className="apple-row-label">Stato</span>
              </div>
              <div className="apple-row-right">
                <select className="apple-select" value={form.status || "todo"} onChange={e => set("status", e.target.value)}>
                  <option value="todo">Da fare</option>
                  <option value="doing">In corso</option>
                  <option value="done">Completato</option>
                </select>
                <ChevronRightIcon width={12} className="apple-chevron" />
              </div>
            </div>

            <div className="apple-row apple-separator-top">
              <div className="apple-row-left">
                <RowIcon color="#8E8E93">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/>
                  </svg>
                </RowIcon>
                <span className="apple-row-label">Tempo stimato</span>
              </div>
              <div className="apple-row-right">
                <select className="apple-select" value={form.estimated_time || ""} onChange={e => set("estimated_time", e.target.value)}>
                  <option value="">Nessuno</option>
                  {["15m","30m","45m","1h","1h30","2h","3h","4h","1g"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <ChevronRightIcon width={12} className="apple-chevron" />
              </div>
            </div>
          </div>

          {/* ── Subtask ── */}
          <div className="apple-section-label">Subtask</div>
          <div className="apple-group">
            {subtasks.map((st, idx) => (
              <div key={st.id} className={`apple-subtask-row${idx > 0 ? " apple-separator-top" : ""}`}>
                <button className={`apple-subtask-check${st.done ? " checked" : ""}`} onClick={() => onToggleSubtask(task, st.id)}>
                  {st.done && <CheckIcon width={9} strokeWidth={3} />}
                </button>
                <span className={`apple-subtask-text${st.done ? " done" : ""}`}>{st.text}</span>
                <button className="apple-subtask-del" onClick={() => onDeleteSubtask(task, st.id)}>
                  <XMarkIcon width={11} />
                </button>
              </div>
            ))}
            <div className={`apple-subtask-add${subtasks.length > 0 ? " apple-separator-top" : ""}`}>
              <span className="apple-subtask-add-icon"><PlusIcon width={11} /></span>
              <input value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onAddSubtask(); }} placeholder="Aggiungi subtask..." className="apple-subtask-add-input" />
            </div>
          </div>

          {subtasks.length > 0 && (
            <div className="apple-progress-section">
              <div className="apple-progress-labels"><span>Completate</span><span>{doneCount}/{subtasks.length}</span></div>
              <div className="apple-progress-bar"><div className="apple-progress-fill" style={{ width: `${(doneCount / subtasks.length) * 100}%` }} /></div>
            </div>
          )}

          <div style={{ height: 20 }} />
        </div>

        {/* ── Footer ── */}
        <div className="apple-drawer-footer">
          <button className="apple-drawer-cancel" onClick={onClose}>Annulla</button>
          <button className="apple-drawer-save" onClick={onSave} disabled={saving}>
            {saving ? <ArrowPathIcon width={13} style={{ animation: "spin 1s linear infinite" }} /> : <CheckIcon width={13} />}
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   CALENDAR VIEW
════════════════════════════════════════════════════════════════ */
interface CalendarViewProps {
  tasks: Task[];
  calWeekStart: Date;
  setCalWeekStart: (d: Date) => void;
  calDragOverDay: string | null;
  setCalDragOverDay: (d: string | null) => void;
  calDragTaskRef: React.MutableRefObject<string | null>;
  onDropTaskOnDay: (dateStr: string) => void;
  onTaskClick: (t: Task) => void;
}

function CalendarView({
  tasks,
  calWeekStart,
  setCalWeekStart,
  calDragOverDay,
  setCalDragOverDay,
  calDragTaskRef,
  onDropTaskOnDay,
  onTaskClick
}: CalendarViewProps) {
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(calWeekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const tasksByDay: Record<string, Task[]> = {};
  const unscheduled: Task[] = [];

  tasks.forEach(t => {
    if (t.status === "done") return;
    if (!t.due_date) {
      unscheduled.push(t);
    } else {
      if (!tasksByDay[t.due_date]) tasksByDay[t.due_date] = [];
      tasksByDay[t.due_date].push(t);
    }
  });

  const todayStr = formatLocalISO(new Date());

  function prevWeek() {
    const d = new Date(calWeekStart);
    d.setDate(d.getDate() - 7);
    setCalWeekStart(d);
  }

  function nextWeek() {
    const d = new Date(calWeekStart);
    d.setDate(d.getDate() + 7);
    setCalWeekStart(d);
  }

  return (
    <div>
      {/* Week Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={prevWeek} className="btn" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
          ← Settimana precedente
        </button>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600 }}>
          {calWeekStart.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
        </span>
        <button onClick={nextWeek} className="btn" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
          Prossima settimana →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="cal-grid">
        {weekDays.map((day, idx) => {
          const dateStr = formatLocalISO(day);
          const dayTasks = tasksByDay[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isDragOver = calDragOverDay === dateStr;

          return (
            <div
              key={idx}
              className={`cal-col ${isToday ? "cal-today" : ""} ${isDragOver ? "cal-drop-over" : ""}`}
              onDragOver={e => {
                e.preventDefault();
                setCalDragOverDay(dateStr);
              }}
              onDragLeave={() => setCalDragOverDay(null)}
              onDrop={() => {
                onDropTaskOnDay(dateStr);
              }}
            >
              <div className="cal-col-header">
                <div className="cal-day-name">{day.toLocaleDateString("it-IT", { weekday: "short" })}</div>
                <div className="cal-day-num">{day.getDate()}</div>
              </div>
              <div className="cal-col-body">
                {dayTasks.map(task => (
                  <div
                    key={task.id}
                    className={`cal-task ${task.status === "doing" ? "cal-task-doing" : ""} ${task.status === "done" ? "cal-task-done" : ""}`}
                    draggable
                    onDragStart={() => {
                      calDragTaskRef.current = task.id;
                    }}
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="cal-task-title">{task.title}</div>
                    {task.client_name && (
                      <div className="cal-task-meta">
                        <span className="cal-task-client">{task.client_name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled Tasks */}
      {unscheduled.length > 0 && (
        <div className="cal-unscheduled">
          <div className="cal-unscheduled-header">📋 Task senza data ({unscheduled.length})</div>
          <div className="cal-unscheduled-grid">
            {unscheduled.map(task => (
              <div
                key={task.id}
                className="cal-task"
                draggable
                onDragStart={() => {
                  calDragTaskRef.current = task.id;
                }}
                onClick={() => onTaskClick(task)}
              >
                <div className="cal-task-title">{task.title}</div>
                {task.client_name && (
                  <div className="cal-task-meta">
                    <span className="cal-task-client">{task.client_name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
