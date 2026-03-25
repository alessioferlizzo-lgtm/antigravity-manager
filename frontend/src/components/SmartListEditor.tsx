"use client";

import { useState } from "react";
import { XMarkIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

interface FilterCriterion {
  field: string;
  operator: string;
  value: any;
}

interface SmartListCriteria {
  match: "all" | "any";
  filters: FilterCriterion[];
}

interface SmartListEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; color: string; icon: string; criteria: SmartListCriteria }) => void;
  initialData?: {
    title?: string;
    color?: string;
    icon?: string;
    criteria?: SmartListCriteria;
  };
}

const FIELD_OPTIONS = [
  { value: "due_date", label: "Scadenza" },
  { value: "priority", label: "Priorità" },
  { value: "status", label: "Stato" },
  { value: "flagged", label: "Contrassegnata" },
  { value: "tags", label: "Tag" },
  { value: "client_id", label: "Cliente" },
  { value: "estimated_time", label: "Tempo stimato" },
];

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  due_date: [
    { value: "equals", label: "è" },
    { value: "not_equals", label: "non è" },
    { value: "before", label: "prima di" },
    { value: "after", label: "dopo" },
    { value: "exists", label: "esiste" },
  ],
  priority: [
    { value: "equals", label: "è" },
    { value: "not_equals", label: "non è" },
  ],
  status: [
    { value: "equals", label: "è" },
    { value: "not_equals", label: "non è" },
  ],
  flagged: [
    { value: "equals", label: "è" },
  ],
  tags: [
    { value: "contains", label: "contiene" },
    { value: "not_contains", label: "non contiene" },
  ],
  client_id: [
    { value: "equals", label: "è" },
    { value: "not_equals", label: "non è" },
  ],
  estimated_time: [
    { value: "exists", label: "esiste" },
    { value: "greater_than", label: "maggiore di" },
    { value: "less_than", label: "minore di" },
  ],
};

const VALUE_OPTIONS: Record<string, Record<string, any[]>> = {
  due_date: {
    equals: [
      { value: "today", label: "Oggi" },
      { value: "tomorrow", label: "Domani" },
      { value: "this_week", label: "Questa settimana" },
    ],
  },
  priority: {
    equals: [
      { value: "alta", label: "Alta" },
      { value: "media", label: "Media" },
      { value: "bassa", label: "Bassa" },
    ],
  },
  status: {
    equals: [
      { value: "todo", label: "Da fare" },
      { value: "doing", label: "In corso" },
      { value: "done", label: "Completata" },
    ],
  },
  flagged: {
    equals: [
      { value: true, label: "Sì" },
      { value: false, label: "No" },
    ],
  },
};

const COLOR_OPTIONS = [
  { value: "#007aff", label: "Blu" },
  { value: "#ff3b30", label: "Rosso" },
  { value: "#ff9500", label: "Arancione" },
  { value: "#ffcc00", label: "Giallo" },
  { value: "#4cd964", label: "Verde" },
  { value: "#5856d6", label: "Viola" },
  { value: "#ff2d55", label: "Rosa" },
  { value: "#8e8e93", label: "Grigio" },
];

const ICON_OPTIONS = [
  { value: "list", label: "📋 Lista" },
  { value: "star", label: "⭐ Stella" },
  { value: "flag", label: "🚩 Bandiera" },
  { value: "calendar", label: "📅 Calendario" },
  { value: "check", label: "✅ Spunta" },
  { value: "fire", label: "🔥 Fuoco" },
  { value: "target", label: "🎯 Obiettivo" },
  { value: "rocket", label: "🚀 Razzo" },
];

export default function SmartListEditor({ isOpen, onClose, onSave, initialData }: SmartListEditorProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [color, setColor] = useState(initialData?.color || "#007aff");
  const [icon, setIcon] = useState(initialData?.icon || "list");
  const [matchMode, setMatchMode] = useState<"all" | "any">(initialData?.criteria?.match || "all");
  const [filters, setFilters] = useState<FilterCriterion[]>(
    initialData?.criteria?.filters || [{ field: "status", operator: "not_equals", value: "done" }]
  );

  if (!isOpen) return null;

  const addFilter = () => {
    setFilters([...filters, { field: "due_date", operator: "equals", value: "today" }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<FilterCriterion>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setFilters(newFilters);
  };

  const handleSave = () => {
    onSave({
      title,
      color,
      icon,
      criteria: {
        match: matchMode,
        filters,
      },
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1c1c1e",
          borderRadius: 16,
          width: "90%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {initialData ? "Modifica Lista Intelligente" : "Nuova Lista Intelligente"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <XMarkIcon width={24} height={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.7)" }}>
              Nome Lista
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Task Urgenti"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>

          {/* Color & Icon */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Color */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.7)" }}>
                Colore
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      background: c.value,
                      border: color === c.value ? "3px solid #fff" : "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.7)" }}>
                Icona
              </label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 15,
                  outline: "none",
                }}
              >
                {ICON_OPTIONS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.7)" }}>
              Criteri di Filtro
            </label>

            {/* Match mode */}
            <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Includi task che soddisfano</span>
              <select
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as "all" | "any")}
                style={{
                  padding: "4px 8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13,
                  outline: "none",
                }}
              >
                <option value="all">TUTTI i criteri</option>
                <option value="any">ALMENO UNO dei criteri</option>
              </select>
            </div>

            {/* Filter list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filters.map((filter, index) => (
                <div
                  key={index}
                  style={{
                    padding: 12,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                    {/* Field */}
                    <select
                      value={filter.field}
                      onChange={(e) => updateFilter(index, { field: e.target.value, operator: "equals" })}
                      style={{
                        padding: "8px 10px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    >
                      {FIELD_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(index, { operator: e.target.value })}
                      style={{
                        padding: "8px 10px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    >
                      {OPERATOR_OPTIONS[filter.field]?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>

                    {/* Value */}
                    {VALUE_OPTIONS[filter.field]?.[filter.operator] ? (
                      <select
                        value={filter.value}
                        onChange={(e) => {
                          const val = e.target.value === "true" ? true : e.target.value === "false" ? false : e.target.value;
                          updateFilter(index, { value: val });
                        }}
                        style={{
                          padding: "8px 10px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          color: "#fff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      >
                        {VALUE_OPTIONS[filter.field][filter.operator].map((v: any) => (
                          <option key={String(v.value)} value={String(v.value)}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    ) : filter.operator === "exists" ? (
                      <select
                        value={String(filter.value)}
                        onChange={(e) => updateFilter(index, { value: e.target.value === "true" })}
                        style={{
                          padding: "8px 10px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          color: "#fff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      >
                        <option value="true">Sì</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) => updateFilter(index, { value: e.target.value })}
                        placeholder="valore"
                        style={{
                          padding: "8px 10px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          color: "#fff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    )}

                    {/* Delete */}
                    {filters.length > 1 && (
                      <button
                        onClick={() => removeFilter(index)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgba(255,59,48,0.8)",
                          cursor: "pointer",
                          display: "flex",
                        }}
                      >
                        <TrashIcon width={18} height={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Filter */}
              <button
                onClick={addFilter}
                style={{
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px dashed rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                }}
              >
                <PlusIcon width={16} height={16} />
                Aggiungi Criterio
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 8,
              color: "rgba(255,255,255,0.7)",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              padding: "10px 20px",
              background: title.trim() ? "#007aff" : "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: title.trim() ? "pointer" : "not-allowed",
              opacity: title.trim() ? 1 : 0.5,
            }}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
