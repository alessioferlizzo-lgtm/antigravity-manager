"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, XMarkIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

const API = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? "https://antigravity-backend-production-41ee.up.railway.app" : "http://127.0.0.1:8001");

type Periodo = { spesa: number; risultati: number; costo: number | null };
type Riga = {
  id: string; nome: string; om_id?: string; obiettivo?: number;
  stato: "rosso" | "giallo" | "verde" | "ferma" | "errore"; frase: string;
  risultato?: string; risultato_uno?: string;
  settimana?: Periodo; prima?: Periodo; tre?: Periodo; variazione?: number | null;
};
type Panoramica = { aggiornato: string; periodi: Record<string, [string, string]>; clienti: Riga[] };
type Inserzione = { id: string; nome: string; gruppo: string; campagna: string; spesa: number; risultati: number; risultato: string; risultato_uno: string; costo: number | null; ctr: number | null; anteprima: string | null };

const COLORI: Record<string, string> = { rosso: "#f87171", errore: "#f87171", giallo: "#fbbf24", verde: "#a3d906", ferma: "rgba(255,255,255,0.25)" };
const ETICHETTE: Record<string, string> = { rosso: "Da guardare", errore: "Da guardare", giallo: "Da tenere d'occhio", verde: "Va bene", ferma: "Ferma" };

const euro = (v: number | null | undefined, decimali = 2) =>
  v == null ? "—" : `${v.toLocaleString("it-IT", { minimumFractionDigits: decimali, maximumFractionDigits: decimali })} €`;
const giorno = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });

function Numero({ etichetta, valore, sotto, colore, grande }: { etichetta: string; valore: string; sotto?: string; colore?: string; grande?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-xmuted)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{etichetta}</div>
      <div style={{ fontSize: grande ? 22 : 16, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{valore}</div>
      {sotto && <div style={{ fontSize: 11, color: colore || "var(--text-xmuted)", marginTop: 2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sotto}</div>}
    </div>
  );
}

export default function DashboardSection() {
  const [dati, setDati] = useState<Panoramica | null>(null);
  const [carico, setCarico] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [aperto, setAperto] = useState<string | null>(null);
  const [ads, setAds] = useState<Record<string, Inserzione[] | "carico" | string>>({});

  async function carica(forza = false) {
    setCarico(true); setErrore(null);
    try {
      const r = await fetch(`${API}/dashboard${forza ? "?forza=true" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Errore del server");
      setDati(j);
      if (forza) setAds({});
    } catch (e: any) {
      setErrore(e.message);
    } finally { setCarico(false); }
  }

  async function apri(id: string) {
    setAperto(id);
    if (Array.isArray(ads[id]) || ads[id] === "carico") return;
    setAds(p => ({ ...p, [id]: "carico" }));
    try {
      const r = await fetch(`${API}/dashboard/${id}/inserzioni`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Errore del server");
      setAds(p => ({ ...p, [id]: j.inserzioni }));
    } catch (e: any) {
      setAds(p => ({ ...p, [id]: `Errore: ${e.message}` }));
    }
  }

  useEffect(() => { carica(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAperto(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const attivi = dati?.clienti.filter(c => c.stato !== "ferma") || [];
  const fermi = dati?.clienti.filter(c => c.stato === "ferma") || [];
  const conta = (s: string[]) => attivi.filter(c => s.includes(c.stato)).length;
  const per = dati?.periodi;
  const scelto = dati?.clienti.find(c => c.id === aperto);
  const elenco = aperto ? ads[aperto] : undefined;

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Testata */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>Come stanno i clienti</h1>
          <p style={{ color: "var(--text-xmuted)", fontSize: 13, marginTop: 5 }}>
            {per ? <>Ultimi 7 giorni ({giorno(per.settimana[0])} → {giorno(per.settimana[1])}) contro i 7 prima · aggiornato {dati?.aggiornato}</> : "Letto da Meta, colonna Risultati"}
          </p>
        </div>
        <button onClick={() => carica(true)} disabled={carico}
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: carico ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", opacity: carico ? 0.6 : 1 }}>
          <ArrowPathIcon style={{ width: 15, height: 15, animation: carico ? "spin 1s linear infinite" : undefined }} />{carico ? "Leggo Meta..." : "Aggiorna"}
        </button>
      </div>

      {errore && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 13, marginBottom: 18 }}>
          Non riesco a leggere i numeri: {errore}
        </div>
      )}

      {!dati && carico && (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-xmuted)", fontSize: 14 }}>Leggo i numeri di tutti i clienti da Meta...</div>
      )}

      {dati && (
        <>
          {/* Il riassunto in una riga */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {[
              { n: conta(["rosso", "errore"]), testo: "da guardare", colore: COLORI.rosso },
              { n: conta(["giallo"]), testo: "da tenere d'occhio", colore: COLORI.giallo },
              { n: conta(["verde"]), testo: "vanno bene", colore: COLORI.verde },
              { n: fermi.length, testo: "fermi", colore: COLORI.ferma },
            ].filter(x => x.n > 0).map(x => (
              <div key={x.testo} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "5px 12px", fontSize: 12, color: "var(--text-body)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: x.colore }} />
                <strong style={{ color: "#fff" }}>{x.n}</strong> {x.testo}
              </div>
            ))}
          </div>

          {/* Le card, prima quelle da guardare */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
            {attivi.map(c => {
              const s = c.settimana, t = c.tre, v = c.variazione;
              const coloreVar = v == null ? undefined : v <= -10 ? COLORI.verde : v >= 20 ? COLORI.rosso : "var(--text-xmuted)";
              const cliccabile = c.stato !== "errore";
              return (
                <div key={c.id} onClick={() => cliccabile && apri(c.id)}
                  style={{ position: "relative", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: "18px 18px 16px", cursor: cliccabile ? "pointer" : "default", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden", transition: "background 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { if (cliccabile) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: COLORI[c.stato] }} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</span>
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORI[c.stato], background: "rgba(255,255,255,0.05)", borderRadius: 999, padding: "3px 8px" }}>{ETICHETTE[c.stato]}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.45, minHeight: 36 }}>{c.frase}</div>
                  </div>
                  {s && (
                    <>
                      <Numero grande etichetta={`Costo per ${c.risultato_uno || "risultato"}`} valore={euro(s.costo)}
                        sotto={v == null ? (c.prima?.costo != null ? `prima ${euro(c.prima.costo)}` : undefined) : `${v > 0 ? "+" : ""}${v}% · prima ${euro(c.prima?.costo)}`} colore={coloreVar} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                        <Numero etichetta="Spesa 7 gg" valore={euro(s.spesa, 0)} sotto={c.prima ? `prima ${euro(c.prima.spesa, 0)}` : undefined} />
                        <Numero etichetta={c.risultato || "Risultati"} valore={String(s.risultati)} sotto={c.prima ? `prima ${c.prima.risultati}` : undefined} />
                        <Numero etichetta="Ultimi 3 gg" valore={euro(t?.costo)} sotto={t ? `${t.risultati} ${t.risultati === 1 ? c.risultato_uno : c.risultato}` : undefined} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* I fermi, in fondo e più piccoli */}
          {fermi.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-xmuted)", marginBottom: 10 }}>Senza spesa negli ultimi 7 giorni</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {fermi.map(c => (
                  <div key={c.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-body)" }}>{c.nome}</div>
                    <div style={{ fontSize: 12, marginTop: 3, color: c.prima && c.prima.spesa > 0 ? COLORI.giallo : "var(--text-xmuted)" }}>
                      {c.prima && c.prima.spesa > 0 ? `La settimana prima ${euro(c.prima.spesa, 0)}` : "Ferma da più di due settimane"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Il pannello del cliente, con le inserzioni attive */}
      {scelto && (
        <div onClick={() => setAperto(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,10,30,0.6)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "min(720px, 100%)", height: "100%", overflowY: "auto", background: "var(--navy)", borderLeft: "1px solid rgba(255,255,255,0.1)", padding: "22px 22px 40px", boxShadow: "-20px 0 50px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{scelto.nome}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORI[scelto.stato] }}>{ETICHETTE[scelto.stato]}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 5, lineHeight: 1.45 }}>{scelto.frase}</div>
              </div>
              <button onClick={() => setAperto(null)} aria-label="Chiudi"
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <XMarkIcon style={{ width: 18, height: 18, color: "#fff" }} />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Inserzioni attive, ultimi 7 giorni, dalla più spesa</span>
              {scelto.om_id && (
                <a href={`/client/${scelto.om_id}`} style={{ fontSize: 12, color: "var(--orange)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  Scheda cliente <ArrowTopRightOnSquareIcon style={{ width: 13, height: 13 }} />
                </a>
              )}
            </div>

            {elenco === "carico" && <div style={{ fontSize: 13, color: "var(--text-xmuted)", padding: "8px 0" }}>Leggo le inserzioni...</div>}
            {typeof elenco === "string" && elenco !== "carico" && <div style={{ fontSize: 13, color: "#f87171" }}>{elenco}</div>}
            {Array.isArray(elenco) && elenco.length === 0 && <div style={{ fontSize: 13, color: "var(--text-xmuted)" }}>Nessuna inserzione attiva con spesa negli ultimi 7 giorni.</div>}
            {Array.isArray(elenco) && elenco.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {elenco.map(a => (
                  <div key={a.id} style={{ display: "flex", gap: 12, padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {a.anteprima
                      ? <img src={a.anteprima} alt="" style={{ width: 64, height: 64, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
                      : <div style={{ width: 64, height: 64, borderRadius: 9, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: "var(--text-xmuted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{a.gruppo} · {a.campagna}</div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--text-body)", fontVariantNumeric: "tabular-nums" }}>
                        <span>{euro(a.spesa, 0)}</span>
                        <span>{a.risultati} {a.risultati === 1 ? a.risultato_uno : a.risultato}</span>
                        <span style={{ color: a.costo == null ? "var(--text-xmuted)" : "#fff", fontWeight: 700 }}>{a.costo == null ? "nessun risultato" : `${euro(a.costo)} l'uno`}</span>
                        <span style={{ color: "var(--text-xmuted)" }}>CTR {a.ctr == null ? "—" : `${a.ctr.toLocaleString("it-IT")}%`}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
