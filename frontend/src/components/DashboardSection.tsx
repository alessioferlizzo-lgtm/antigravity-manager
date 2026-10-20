"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, XMarkIcon, ArrowTopRightOnSquareIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";

const API = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? "https://antigravity-backend-production-41ee.up.railway.app" : "http://127.0.0.1:8001");

type Periodo = { spesa: number; risultati: number; costo: number | null };
type Stato = "rosso" | "giallo" | "verde" | "ferma" | "errore";
type Riga = {
  id: string; nome: string; om_id?: string; obiettivo?: number;
  stato: Stato; frase: string;
  risultato?: string; risultato_uno?: string;
  settimana?: Periodo; prima?: Periodo; tre?: Periodo; variazione?: number | null;
};
type Panoramica = { aggiornato: string; periodi: Record<string, [string, string]>; clienti: Riga[] };
type Inserzione = { id: string; nome: string; gruppo: string; campagna: string; spesa: number; risultati: number; risultato: string; risultato_uno: string; costo: number | null; ctr: number | null; anteprima: string | null };

const ROSSO = "#f87171", GIALLO = "#fbbf24", VERDE = "#a3d906";
const COLORI: Record<Stato, string> = { rosso: ROSSO, errore: ROSSO, giallo: GIALLO, verde: VERDE, ferma: "rgba(255,255,255,0.3)" };
const ETICHETTE: Record<Stato, string> = { rosso: "Da guardare", errore: "Da guardare", giallo: "Da tenere d'occhio", verde: "Va bene", ferma: "Ferma" };
const GRUPPI: { titolo: string; stati: Stato[]; colore: string }[] = [
  { titolo: "Da guardare", stati: ["rosso", "errore"], colore: ROSSO },
  { titolo: "Da tenere d'occhio", stati: ["giallo"], colore: GIALLO },
  { titolo: "Vanno bene", stati: ["verde"], colore: VERDE },
];
// Lo sfondo della card dice lo stato prima ancora di leggere
const SFONDO: Record<Stato, { bg: string; bordo: string }> = {
  rosso: { bg: "rgba(248,113,113,0.10)", bordo: "rgba(248,113,113,0.40)" },
  errore: { bg: "rgba(248,113,113,0.10)", bordo: "rgba(248,113,113,0.40)" },
  giallo: { bg: "rgba(251,191,36,0.06)", bordo: "rgba(251,191,36,0.28)" },
  verde: { bg: "rgba(255,255,255,0.04)", bordo: "rgba(255,255,255,0.09)" },
  ferma: { bg: "rgba(255,255,255,0.03)", bordo: "rgba(255,255,255,0.07)" },
};

const euro = (v: number | null | undefined, decimali = 2) =>
  v == null ? "—" : `${v.toLocaleString("it-IT", { minimumFractionDigits: decimali, maximumFractionDigits: decimali })} €`;
const giorno = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const quanti = (n: number, c: Riga | Inserzione) => `${n} ${n === 1 ? c.risultato_uno : c.risultato}`;

/** La freccia del costo: sale è male, scende è bene. */
function Freccia({ v }: { v: number | null | undefined }) {
  if (v == null) return null;
  const colore = v >= 20 ? ROSSO : v <= -10 ? VERDE : "rgba(255,255,255,0.55)";
  const Icona = v > 0 ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 700, color: colore, background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: "3px 9px", fontVariantNumeric: "tabular-nums" }}>
      {v !== 0 && <Icona style={{ width: 12, height: 12, strokeWidth: 3 }} />}{Math.abs(v)}%
    </span>
  );
}

/** La nota sotto la card: solo se c'è qualcosa che il numero grande non dice. */
function nota(c: Riga): { testo: string; colore: string } | null {
  const s = c.settimana, t = c.tre;
  if (!s) return null;
  if (s.risultati < 3) return { testo: `Pochi dati: ${quanti(s.risultati, c)} in 7 giorni`, colore: GIALLO };
  if (t && t.spesa > 0 && t.costo == null) return { testo: `Ultimi 3 giorni: nessun risultato`, colore: ROSSO };
  if (t?.costo != null && s.costo != null && t.costo >= s.costo * 1.3) return { testo: `Ultimi 3 giorni: ${euro(t.costo)}, in salita`, colore: ROSSO };
  if (c.obiettivo) return { testo: `Obiettivo ${euro(c.obiettivo, 0)}`, colore: "var(--text-xmuted)" };
  return null;
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

  const fermi = dati?.clienti.filter(c => c.stato === "ferma") || [];
  const per = dati?.periodi;
  const scelto = dati?.clienti.find(c => c.id === aperto);
  const elenco = aperto ? ads[aperto] : undefined;

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Testata */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>Come stanno i clienti</h1>
          <p style={{ color: "var(--text-xmuted)", fontSize: 13, marginTop: 5 }}>
            {per ? <>Costo per risultato degli ultimi 7 giorni ({giorno(per.settimana[0])} → {giorno(per.settimana[1])}), la freccia rispetto ai 7 prima</> : "Letto da Meta, colonna Risultati"}
          </p>
        </div>
        <button onClick={() => carica(true)} disabled={carico} title={dati ? `Aggiornato ${dati.aggiornato}` : undefined}
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: carico ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", opacity: carico ? 0.6 : 1 }}>
          <ArrowPathIcon style={{ width: 15, height: 15, animation: carico ? "spin 1s linear infinite" : undefined }} />{carico ? "Leggo Meta..." : "Aggiorna"}
        </button>
      </div>

      {errore && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 16px", color: ROSSO, fontSize: 13, marginBottom: 18 }}>
          Non riesco a leggere i numeri: {errore}
        </div>
      )}

      {!dati && carico && (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-xmuted)", fontSize: 14 }}>Leggo i numeri di tutti i clienti da Meta...</div>
      )}

      {/* Un gruppo per stato: si capisce dove guardare senza leggere */}
      {dati && GRUPPI.map(g => {
        const qui = dati.clienti.filter(c => g.stati.includes(c.stato));
        if (!qui.length) return null;
        return (
          <section key={g.titolo} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: g.colore }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{g.titolo}</span>
              <span style={{ fontSize: 13, color: "var(--text-xmuted)" }}>{qui.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
              {qui.map(c => {
                const s = c.settimana, n = nota(c), cliccabile = c.stato !== "errore";
                const sf = SFONDO[c.stato];
                return (
                  <div key={c.id} onClick={() => cliccabile && apri(c.id)}
                    style={{ background: sf.bg, border: `1px solid ${sf.bordo}`, borderRadius: 16, padding: "16px 18px", cursor: cliccabile ? "pointer" : "default", transition: "transform 0.12s, border-color 0.12s" }}
                    onMouseEnter={e => { if (cliccabile) e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</div>
                    {c.stato === "errore" || !s ? (
                      <div style={{ fontSize: 13, color: ROSSO, marginTop: 10 }}>{c.frase}</div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{euro(s.costo)}</span>
                          <Freccia v={c.variazione} />
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                          per {c.risultato_uno} · {quanti(s.risultati, c)}
                        </div>
                        {n && <div style={{ fontSize: 12, color: n.colore, marginTop: 8, fontWeight: 600 }}>{n.testo}</div>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* I fermi, in fondo e piccoli */}
      {fermi.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: COLORI.ferma }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)" }}>Fermi</span>
            <span style={{ fontSize: 13, color: "var(--text-xmuted)" }}>{fermi.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {fermi.map(c => {
              const appena = !!(c.prima && c.prima.spesa > 0);
              return (
                <div key={c.id} style={{ fontSize: 13, color: "var(--text-body)", background: appena ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${appena ? "rgba(251,191,36,0.28)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "8px 13px" }}>
                  {c.nome}
                  {appena && <span style={{ color: GIALLO }}> · fermo da questa settimana</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Il dettaglio, solo quando si tocca una card */}
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

            {/* I tre periodi uno accanto all'altro */}
            {scelto.settimana && per && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 18 }}>
                {[
                  { titolo: "Ultimi 7 giorni", p: scelto.settimana, date: per.settimana },
                  { titolo: "I 7 giorni prima", p: scelto.prima, date: per.prima },
                  { titolo: "Ultimi 3 giorni", p: scelto.tre, date: per.tre },
                ].map(x => (
                  <div key={x.titolo} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 12px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-xmuted)" }}>{x.titolo}</div>
                    <div style={{ fontSize: 10, color: "var(--text-xmuted)", marginBottom: 6 }}>{giorno(x.date[0])} → {giorno(x.date[1])}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{euro(x.p?.costo)}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{x.p ? quanti(x.p.risultati, scelto) : "—"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-xmuted)", fontVariantNumeric: "tabular-nums" }}>{euro(x.p?.spesa, 0)} spesi</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Inserzioni attive, ultimi 7 giorni, dalla più spesa</span>
              {scelto.om_id && (
                <a href={`/client/${scelto.om_id}`} style={{ fontSize: 12, color: "var(--orange)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  Scheda cliente <ArrowTopRightOnSquareIcon style={{ width: 13, height: 13 }} />
                </a>
              )}
            </div>

            {elenco === "carico" && <div style={{ fontSize: 13, color: "var(--text-xmuted)", padding: "8px 0" }}>Leggo le inserzioni...</div>}
            {typeof elenco === "string" && elenco !== "carico" && <div style={{ fontSize: 13, color: ROSSO }}>{elenco}</div>}
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
                        <span>{quanti(a.risultati, a)}</span>
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
