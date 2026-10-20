"""La dashboard dei clienti: come sta andando ognuno, letto da Meta.

Il numero che conta è la colonna «Risultati» di Gestione inserzioni, chiesta a Meta col
campo `results`: è la stessa che Alessio vede nel pannello, quindi i conti tornano.
Si legge a livello di gruppo di inserzioni, perché a livello di campagna Meta risponde
«mixed» quando i gruppi hanno obiettivi diversi, e il dato si perde.

Tre periodi, tutti di giorni interi e nel fuso di Roma, come «Ultimi 7 giorni» del pannello:
  - settimana: gli ultimi 7 giorni completi, oggi escluso;
  - settimana prima: i 7 giorni prima di quella;
  - ultimi 3 giorni: gli ultimi 3 giorni completi.

Il costo per risultato è la spesa di tutto l'account, tolte le campagne escluse,
diviso i risultati del tipo principale: un gruppo che spende e non porta niente pesa.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx

API = "https://graph.facebook.com/v23.0"
CLIENTI_FILE = Path(__file__).parent / "dashboard_clienti.json"
CACHE_SECONDI = 15 * 60
_cache: dict = {}

# Come si chiama un risultato, dal suo indicatore di Meta: (plurale, singolare)
NOMI = {
    "offsite_conversion.fb_pixel_purchase": ("acquisti", "acquisto"),
    "omni_purchase": ("acquisti", "acquisto"),
    "purchase": ("acquisti", "acquisto"),
    "lead": ("contatti", "contatto"),
    "offsite_conversion.fb_pixel_lead": ("contatti", "contatto"),
    "onsite_conversion.lead_grouped": ("contatti", "contatto"),
    "leadgen_grouped": ("contatti", "contatto"),
    "total_profile_visits": ("visite al profilo", "visita"),
    "profile_visit_view": ("visite al profilo", "visita"),
    "link_click": ("click", "click"),
    "onsite_conversion.messaging_conversation_started_7d": ("conversazioni", "conversazione"),
    "post_engagement": ("interazioni", "interazione"),
    "reach": ("persone raggiunte", "persona raggiunta"),
    "video_thruplay_watched_actions": ("visualizzazioni", "visualizzazione"),
}


def _nome_risultato(indicatore: str) -> tuple:
    chiave = indicatore.split(":", 1)[1] if indicatore.startswith("actions:") else indicatore
    return NOMI.get(chiave, (chiave.replace("_", " "), chiave.replace("_", " ")))


def _nessun(singolare: str) -> str:
    """«nessun acquisto», «nessuna visita»: i nomi di questo elenco in -a o -e sono femminili."""
    return f"nessuna {singolare}" if singolare.split()[0][-1] in "ae" else f"nessun {singolare}"


def clienti() -> list:
    return json.loads(CLIENTI_FILE.read_text(encoding="utf-8"))


def periodi(oggi: date | None = None) -> dict:
    oggi = oggi or datetime.now(ZoneInfo("Europe/Rome")).date()
    ieri = oggi - timedelta(days=1)
    return {
        "settimana": (ieri - timedelta(days=6), ieri),
        "prima": (ieri - timedelta(days=13), ieri - timedelta(days=7)),
        "tre": (ieri - timedelta(days=2), ieri),
    }


async def _get(hc: httpx.AsyncClient, percorso: str, parametri: dict, token: str) -> dict:
    parametri = dict(parametri, access_token=token)
    resp = await hc.get(f"{API}{percorso}", params=parametri)
    dati = resp.json()
    if "error" in dati:
        raise RuntimeError(dati["error"].get("message", "errore di Meta"))
    return dati


def _filtro(escludi: list) -> dict:
    if not escludi:
        return {}
    return {"filtering": json.dumps([{"field": "campaign.id", "operator": "NOT_IN", "value": escludi}])}


async def _gruppi(hc, conto: str, dal: date, al: date, escludi: list, token: str) -> list:
    """Spesa e risultati di ogni gruppo di inserzioni del periodo, con tutte le pagine."""
    parametri = {
        "level": "adset",
        "time_range": json.dumps({"since": dal.isoformat(), "until": al.isoformat()}),
        "fields": "campaign_id,adset_id,spend,results",
        "limit": 500,
        **_filtro(escludi),
    }
    righe, dati = [], await _get(hc, f"/{conto}/insights", parametri, token)
    while True:
        righe += dati.get("data", [])
        dopo = dati.get("paging", {}).get("next")
        if not dopo:
            return righe
        resp = await hc.get(dopo)
        dati = resp.json()


def _somma(righe: list) -> dict:
    """Spesa totale e risultati per indicatore. Un gruppo senza risultati pesa solo in spesa."""
    spesa, per_indicatore, spesa_indicatore = 0.0, {}, {}
    for r in righe:
        s = float(r.get("spend") or 0)
        spesa += s
        for res in r.get("results") or []:
            ind = res.get("indicator")
            valori = res.get("values") or []
            if not ind or not valori:
                continue
            per_indicatore[ind] = per_indicatore.get(ind, 0.0) + float(valori[0].get("value") or 0)
            spesa_indicatore[ind] = spesa_indicatore.get(ind, 0.0) + s
    return {"spesa": spesa, "risultati": per_indicatore, "spesa_indicatore": spesa_indicatore}


def _periodo(somma: dict, indicatore: str | None) -> dict:
    n = somma["risultati"].get(indicatore, 0.0) if indicatore else 0.0
    spesa = round(somma["spesa"], 2)
    return {
        "spesa": spesa,
        "risultati": int(round(n)),
        "costo": round(spesa / n, 2) if n else None,
    }


def _variazione(ora, prima):
    if ora is None or prima is None or prima == 0:
        return None
    return round((ora - prima) / prima * 100)


def _giudizio(cli: dict, settimana: dict, prima: dict, tre: dict, singolare: str) -> dict:
    """Il colore e la frase della riga. Prima l'obiettivo del cliente, se c'è; se no la settimana prima."""
    if settimana["spesa"] == 0:
        return {"stato": "ferma", "frase": "Nessuna spesa negli ultimi 7 giorni"}
    costo = settimana["costo"]
    var = _variazione(costo, prima["costo"])
    if costo is None:
        return {"stato": "rosso", "frase": f"{settimana['spesa']:.0f} € spesi e {_nessun(singolare)} in 7 giorni"}

    obiettivo, accettabile = cli.get("obiettivo"), cli.get("accettabile")
    if obiettivo:
        if costo <= obiettivo:
            stato, frase = "verde", f"Sotto l'obiettivo di {obiettivo:.0f} € per {singolare}"
        elif accettabile and costo <= accettabile:
            stato, frase = "giallo", f"Sopra l'obiettivo di {obiettivo:.0f} €, entro i {accettabile:.0f} accettabili"
        else:
            stato, frase = "rosso", f"Sopra l'obiettivo di {obiettivo:.0f} € per {singolare}"
    elif var is None:
        stato, frase = "giallo", "Niente da confrontare con la settimana prima"
    elif var <= -10:
        stato, frase = "verde", f"Il costo per {singolare} scende del {abs(var)}% sulla settimana prima"
    elif var >= 20:
        stato, frase = "rosso", f"Il costo per {singolare} sale del {var}% sulla settimana prima"
    else:
        segno = "+" if var > 0 else ""
        stato, frase = "giallo", f"Stabile sulla settimana prima ({segno}{var}%)"

    if settimana["risultati"] < 3 and stato == "verde":
        stato = "giallo"
    if settimana["risultati"] < 3:
        frase += f". Pochi dati: {settimana['risultati']} in 7 giorni"
    var3 = _variazione(tre["costo"], costo)
    if tre["spesa"] > 0 and tre["costo"] is None:
        frase += f". Negli ultimi 3 giorni {_nessun(singolare)}"
    elif var3 is not None and var3 >= 30:
        frase += f". Ultimi 3 giorni in salita (+{var3}%)"
    return {"stato": stato, "frase": frase}


async def _cliente(hc, cli: dict, per: dict, token: str) -> dict:
    base = {"id": cli["id"], "nome": cli["nome"], "om_id": cli.get("om_id"),
            "obiettivo": cli.get("obiettivo")}
    escludi = cli.get("escludi", [])
    try:
        letture = {}
        for nome, (dal, al) in per.items():
            righe = []
            for conto in cli["conti"]:
                righe += await _gruppi(hc, conto, dal, al, escludi, token)
            letture[nome] = _somma(righe)
    except Exception as e:  # un cliente che non si legge non ferma gli altri
        return {**base, "stato": "errore", "frase": f"Meta non risponde: {e}"}

    # Il risultato principale: quello su cui la settimana ha speso di più, se no la settimana prima
    indicatore = None
    for nome in ("settimana", "prima"):
        pesi = letture[nome]["spesa_indicatore"]
        if pesi:
            indicatore = max(pesi, key=pesi.get)
            break
    plurale, singolare = _nome_risultato(indicatore) if indicatore else ("risultati", "risultato")
    settimana = _periodo(letture["settimana"], indicatore)
    prima = _periodo(letture["prima"], indicatore)
    tre = _periodo(letture["tre"], indicatore)
    altri = sorted(i for i in letture["settimana"]["risultati"] if i != indicatore)
    return {
        **base,
        "risultato": plurale,
        "risultato_uno": singolare,
        "indicatore": indicatore,
        "altri_indicatori": altri,
        "settimana": settimana,
        "prima": prima,
        "tre": tre,
        "variazione": _variazione(settimana["costo"], prima["costo"]),
        **_giudizio(cli, settimana, prima, tre, singolare),
    }


ORDINE = {"rosso": 0, "errore": 1, "giallo": 2, "verde": 3, "ferma": 4}


async def panoramica(forza: bool = False) -> dict:
    token = os.getenv("META_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("META_ACCESS_TOKEN non configurato")
    per = periodi()
    chiave = ("panoramica", per["settimana"][1].isoformat())
    if not forza and chiave in _cache and time.time() - _cache[chiave]["quando"] < CACHE_SECONDI:
        return _cache[chiave]["dati"]
    async with httpx.AsyncClient(timeout=60.0) as hc:
        righe = await asyncio.gather(*[_cliente(hc, c, per, token) for c in clienti()])
    righe = sorted(righe, key=lambda r: (ORDINE.get(r["stato"], 9), -(r.get("settimana", {}).get("spesa") or 0)))
    dati = {
        "aggiornato": datetime.now(ZoneInfo("Europe/Rome")).strftime("%d/%m %H:%M"),
        "periodi": {k: [v[0].isoformat(), v[1].isoformat()] for k, v in per.items()},
        "clienti": righe,
    }
    _cache[chiave] = {"quando": time.time(), "dati": dati}
    return dati


async def inserzioni(cliente_id: str) -> dict:
    """Le inserzioni attive del cliente negli ultimi 7 giorni, dalla più spesa in giù."""
    token = os.getenv("META_ACCESS_TOKEN")
    cli = next((c for c in clienti() if c["id"] == cliente_id), None)
    if not cli:
        raise KeyError(cliente_id)
    dal, al = periodi()["settimana"]
    filtro = [{"field": "ad.effective_status", "operator": "IN", "value": ["ACTIVE"]}]
    if cli.get("escludi"):
        filtro.append({"field": "campaign.id", "operator": "NOT_IN", "value": cli["escludi"]})
    elenco = []
    async with httpx.AsyncClient(timeout=60.0) as hc:
        for conto in cli["conti"]:
            dati = await _get(hc, f"/{conto}/insights", {
                "level": "ad",
                "time_range": json.dumps({"since": dal.isoformat(), "until": al.isoformat()}),
                "fields": "ad_id,ad_name,adset_name,campaign_name,spend,results,inline_link_click_ctr",
                "filtering": json.dumps(filtro),
                "limit": 200,
            }, token)
            righe = dati.get("data", [])
            ids = [r["ad_id"] for r in righe]
            anteprime = {}
            if ids:
                ann = await _get(hc, "/", {"ids": ",".join(ids[:50]), "fields": "creative{thumbnail_url}"}, token)
                anteprime = {k: (v.get("creative") or {}).get("thumbnail_url") for k, v in ann.items()}
            for r in righe:
                res = (r.get("results") or [{}])[0]
                valori = res.get("values") or []
                n = float(valori[0]["value"]) if valori else 0.0
                spesa = float(r.get("spend") or 0)
                plurale, singolare = _nome_risultato(res["indicator"]) if res.get("indicator") else ("risultati", "risultato")
                elenco.append({
                    "id": r["ad_id"],
                    "nome": r.get("ad_name"),
                    "gruppo": r.get("adset_name"),
                    "campagna": r.get("campaign_name"),
                    "spesa": round(spesa, 2),
                    "risultati": int(round(n)),
                    "risultato": plurale,
                    "risultato_uno": singolare,
                    "costo": round(spesa / n, 2) if n else None,
                    "ctr": round(float(r["inline_link_click_ctr"]), 2) if r.get("inline_link_click_ctr") else None,
                    "anteprima": anteprime.get(r["ad_id"]),
                })
    elenco.sort(key=lambda a: -a["spesa"])
    return {"cliente": cli["nome"], "periodo": [dal.isoformat(), al.isoformat()], "inserzioni": elenco}
