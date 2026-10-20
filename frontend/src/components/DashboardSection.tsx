"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, ChevronDownIcon, ChevronRightIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

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

function Numero({ etichetta, valore, sotto, colore }: { etichetta: string; valore: string; sotto?: string; colore?: string }) {
  return (
    <div style={{ width: 128 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-xmuted)", marginBottom: 3, whiteSpace: "nowrap" }}>{etichetta}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{valore}</div>
      {sotto && <div style={{ fontSize: 11, color: colore || "var(--text-xmuted)", marginTop: 2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{sotto}</div>}
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
    if (aperto === id) { setAperto(null); return; }
    setAperto(id);
    if (ads[id] && ads[id] !== "carico" && typeof ads[id] !== "string") return;
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

  const attivi = dati?.clienti.filter(c => c.stato !== "ferma") || [];
  const fermi = dati?.clienti.filter(c => c.stato === "ferma") || [];
  const conta = (s: string[]) => attivi.filter(c => s.includes(c.stato)).length;
  const per = dati?.periodi;

  return (
    <div style={{ maxWidth: 1100 }}>
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
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

          {/* Una riga per cliente, prima quelli da guardare */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {attivi.map(c => {
              const s = c.settimana, t = c.tre, v = c.variazione;
              const coloreVar = v == null ? undefined : v <= -10 ? COLORI.verde : v >= 20 ? COLORI.rosso : "var(--text-xmuted)";
              const elenco = ads[c.id];
              return (
                <div key={c.id} style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `3px solid ${COLORI[c.stato]}`, borderRadius: 12, overflow: "hidden" }}>
                  <div onClick={() => c.stato !== "errore" && apri(c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 18px", cursor: c.stato === "errore" ? "default" : "pointer", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{c.nome}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORI[c.stato] }}>{ETICHETTE[c.stato]}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45 }}>{c.frase}</div>
                    </div>
                    {s && (
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <Numero etichetta="Spesa 7 giorni" valore={euro(s.spesa, 0)} sotto={c.prima ? `prima ${euro(c.prima.spesa, 0)}` : undefined} />
                        <Numero etichetta={c.risultato || "Risultati"} valore={String(s.risultati)} sotto={c.prima ? `prima ${c.prima.risultati}` : undefined} />
                        <Numero etichetta={`Costo per ${c.risultato_uno || "risultato"}`} valore={euro(s.costo)}
                          sotto={v == null ? (c.prima?.costo != null ? `prima ${euro(c.prima.costo)}` : undefined) : `${v > 0 ? "+" : ""}${v}% · prima ${euro(c.prima?.costo)}`} colore={coloreVar} />
                        <Numero etichetta="Ultimi 3 giorni" valore={euro(t?.costo)} sotto={t ? `${t.risultati} ${t.risultati === 1 ? c.risultato_uno : c.risultato}` : undefined} />
                      </div>
                    )}
                    {c.stato !== "errore" && (aperto === c.id
                      ? <ChevronDownIcon style={{ width: 16, height: 16, color: "var(--text-xmuted)", flexShrink: 0 }} />
                      : <ChevronRightIcon style={{ width: 16, height: 16, color: "var(--text-xmuted)", flexShrink: 0 }} />)}
                  </div>

                  {/* Le inserzioni attive */}
                  {aperto === c.id && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px 18px 16px", background: "rgba(0,0,0,0.12)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Inserzioni attive, ultimi 7 giorni, dalla più spesa</span>
                        {c.om_id && (
                          <a href={`/client/${c.om_id}`} style={{ fontSize: 12, color: "var(--orange)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                            Scheda cliente <ArrowTopRightOnSquareIcon style={{ width: 13, height: 13 }} />
                          </a>
                        )}
                      </div>
                      {elenco === "carico" && <div style={{ fontSize: 13, color: "var(--text-xmuted)", padding: "8px 0" }}>Leggo le inserzioni...</div>}
                      {typeof elenco === "string" && elenco !== "carico" && <div style={{ fontSize: 13, color: "#f87171" }}>{elenco}</div>}
                      {Array.isArray(elenco) && elenco.length === 0 && <div style={{ fontSize: 13, color: "var(--text-xmuted)" }}>Nessuna inserzione attiva con spesa negli ultimi 7 giorni.</div>}
                      {Array.isArray(elenco) && elenco.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {elenco.map(a => (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.035)", flexWrap: "wrap" }}>
                              {a.anteprima
                                ? <img src={a.anteprima} alt="" style={{ width: 44, height: 44, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
                                : <div style={{ width: 44, height: 44, borderRadius: 7, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />}
                              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</div>
                                <div style={{ fontSize: 11, color: "var(--text-xmuted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.gruppo} · {a.campagna}</div>
                              </div>
                              <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--text-body)", fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ minWidth: 70 }}>{euro(a.spesa, 0)}</span>
                                <span style={{ minWidth: 86 }}>{a.risultati} {a.risultati === 1 ? a.risultato_uno : a.risultato}</span>
                                <span style={{ minWidth: 90, color: a.costo == null ? "var(--text-xmuted)" : "#fff", fontWeight: 600 }}>{a.costo == null ? "nessun risultato" : `${euro(a.costo)} l'uno`}</span>
                                <span style={{ minWidth: 70, color: "var(--text-xmuted)" }}>CTR {a.ctr == null ? "—" : `${a.ctr.toLocaleString("it-IT")}%`}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* I fermi, in fondo e in piccolo */}
          {fermi.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-xmuted)", marginBottom: 8 }}>Senza spesa negli ultimi 7 giorni</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {fermi.map(c => (
                  <div key={c.id} style={{ fontSize: 13, color: "var(--text-body)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, padding: "7px 12px" }}>
                    {c.nome}
                    {c.prima && c.prima.spesa > 0 && <span style={{ color: COLORI.giallo }}> · la settimana prima {euro(c.prima.spesa, 0)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
