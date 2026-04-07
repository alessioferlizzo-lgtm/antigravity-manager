"""
Servizio di Raccolta Dati Massiva
Raccoglie TUTTI i dati necessari per analisi professionale
"""

import asyncio
import httpx
from typing import Dict, Any, List, Optional
import os
import re
import json
from html.parser import HTMLParser
from pathlib import Path


class DataCollectionService:
    """Raccoglie dati da TUTTE le fonti disponibili"""

    def __init__(self, ai_service):
        self.ai_service = ai_service

    async def collect_all_data(
        self,
        client_id: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Raccolta COMPLETA di TUTTI i dati disponibili
        """

        print("🔍 INIZIO RACCOLTA DATI MASSIVA")
        print("=" * 80)

        # Estrai info base
        client_name = metadata.get("name", "")
        links = metadata.get("links", [])

        # CATEGORIE LINK
        site_urls = []       # Siti web generali da analizzare
        review_urls = []     # Link a recensioni (Trustpilot, FB, etc.)
        service_urls = []    # Link a landing page servizi
        product_urls = []    # Link a landing page prodotti o menu digitali
        competitor_links = [] # Link a competitor specifici
        gmb_info_urls = []   # Link a Google My Business (info business: indirizzo, orari, etc.)
        instagram_handle = ""
        google_maps_url = ""

        # ─── LINK ROUTING ────────────────────────────────────────────────────────
        # Funzione robusta: gestisce dropdown standardizzato, varianti testuali
        # libere (legacy) e URL pattern matching come fallback finale.

        def classify_link(url: str, label: str, desc: str):
            """Classifica un link e lo aggiunge alla lista corretta."""
            nonlocal instagram_handle, google_maps_url

            url_lc = url.lower()
            label_lc = label.lower().strip()

            # 1. Instagram
            if label_lc == "instagram" or ("instagram" in label_lc and "ads" not in label_lc):
                if "instagram.com" in url_lc:
                    instagram_handle = url.strip("/").split("/")[-1].replace("@", "")
                    return

            # 2. Google My Business — distingui SCHEDA (info) da RECENSIONI
            is_gmb = label_lc == "google_business" or any(x in label_lc for x in [
                "google my business", "scheda google", "google maps", "gmb",
                "mappa google"
            ])
            is_gmb_reviews = any(x in label_lc for x in [
                "reviews google", "recensioni google", "google review", "google recensioni"
            ])
            # Anche URL pattern: se il link contiene #lrd o fid è un link diretto recensioni
            is_review_url_pattern = any(x in url.lower() for x in ["#lrd=", "fid=", "place_id"])

            if is_gmb_reviews or (is_gmb and is_review_url_pattern):
                # Link diretto alle recensioni Google → va nelle recensioni
                google_maps_url = url
                return
            elif is_gmb:
                # Link alla scheda GMB (info business) → scrappa come pagina + usa per recensioni
                google_maps_url = url
                gmb_info_urls.append({"url": url, "context": "Scheda Google My Business — estrai indirizzo, orari, categorie, descrizione, servizi elencati"})
                return

            # 3. Recensioni (non-Google)
            if label_lc == "reviews" or any(x in label_lc for x in [
                "recensioni", "review", "trustpilot", "opinioni", "recenzion"
            ]):
                # Se è un link Google, usalo anche per le recensioni Google
                if any(x in url.lower() for x in ["google.com/maps", "business.google.com", "g.page", "goo.gl"]):
                    google_maps_url = url
                review_urls.append({"url": url, "context": f"{desc or label}".strip()})
                return

            # 4. Servizi / Landing Page
            if label_lc == "service" or any(x in label_lc for x in [
                "servizi", "servizio", "trattamenti", "trattamento", "landing"
            ]):
                service_urls.append({"url": url, "context": f"{desc or label}".strip()})
                return

            # 4.5 Prodotti / Menu
            if label_lc == "product" or any(x in label_lc for x in [
                "menu", "carta", "listino", "bevande", "food", "prodotti", "catalogo", "shop"
            ]):
                product_urls.append({"url": url, "context": f"{desc or label}".strip()})
                return

            # 5. Sito Web
            if label_lc == "website" or any(x in label_lc for x in [
                "sito web", "sito", "website", "web site", "pagina web", "home"
            ]):
                site_urls.append({"url": url, "context": f"{desc or label}".strip()})
                return

            # 6. Facebook / ADS / Social
            if any(x in label_lc for x in [
                "facebook", "tiktok", "youtube", "ads library", "libreria ads",
                "libreria inserzioni", "libreria meta", "meta ads", "ads_library", "inserzioni"
            ]):
                site_urls.append({"url": url, "context": f"{label} {desc}".strip()})
                return

            # 7. FALLBACK: URL pattern matching
            if "instagram.com" in url_lc:
                instagram_handle = url.strip("/").split("/")[-1].replace("@", "")
            elif any(x in url_lc for x in [
                "google.com/maps", "business.google.com", "g.page",
                "share.google", "google.com/search"
            ]):
                google_maps_url = url
            elif any(x in url_lc for x in ["trustpilot.com", "tripadvisor.com"]):
                review_urls.append({"url": url, "context": f"{label} {desc}".strip()})
            elif "facebook.com/ads/library" in url_lc:
                site_urls.append({"url": url, "context": f"Libreria ADS {desc}".strip()})
            elif "facebook.com" in url_lc:
                site_urls.append({"url": url, "context": f"Facebook {desc}".strip()})
            else:
                site_urls.append({"url": url, "context": f"{label} {desc}".strip()})

        for link in links:
            if not isinstance(link, dict):
                url = str(link)
                label = ""
                desc = ""
            else:
                url = link.get("url", "")
                label = link.get("label", "")
                desc = link.get("description", "")

            if not url or "http" not in url.lower():
                continue

            classify_link(url, label, desc)


        if not site_urls:
            if service_urls:
                print("ℹ️ Nessun sito web generico, uso il primo link Servizio come base.")
                site_urls = [service_urls[0]]
            elif review_urls:
                print("ℹ️ Nessun sito web generico, uso il primo link Recensioni come base.")
                site_urls = [review_urls[0]]
            else:
                print("❌ Nessun link utile fornito nelle sorgenti")
                return {"error": "Nessun link utile fornito nelle sorgenti"}

        # ─── FASE 0: AUTO-DISCOVERY LINK INTERNI ────────────────────────────
        # Fetch rapido dell'HTML delle pagine sito per scoprire link interni
        # (landing servizi, prodotti, about, etc.) che l'utente non ha inserito manualmente.
        already_known_urls = set()
        for lst in [site_urls, service_urls, product_urls]:
            for item in lst:
                already_known_urls.add(item["url"].rstrip("/").lower())

        discovered_pages = []
        try:
            print("   🔍 Auto-discovery: scarico HTML delle pagine sito per trovare link interni...")
            html_fetch_tasks = []
            for s in site_urls:
                html_fetch_tasks.append(self._fetch_page_html(s["url"]))

            html_results = await asyncio.wait_for(
                asyncio.gather(*html_fetch_tasks, return_exceptions=True),
                timeout=30.0
            )

            for i, html in enumerate(html_results):
                if isinstance(html, Exception):
                    continue
                base_url = site_urls[i]["url"]
                internal_links = self._extract_internal_links(html, base_url)

                for link_url in internal_links:
                    if link_url.rstrip("/").lower() not in already_known_urls:
                        already_known_urls.add(link_url.rstrip("/").lower())
                        discovered_pages.append({"url": link_url, "context": "Pagina interna scoperta automaticamente"})

            if discovered_pages:
                print(f"   ✅ Auto-discovery: trovate {len(discovered_pages)} pagine interne aggiuntive:")
                for dp in discovered_pages[:10]:  # Log max 10
                    print(f"      → {dp['url']}")
                if len(discovered_pages) > 10:
                    print(f"      ... e altre {len(discovered_pages) - 10}")
            else:
                print("   ℹ️ Auto-discovery: nessuna pagina interna aggiuntiva trovata")
        except Exception as e:
            print(f"   ⚠️ Auto-discovery fallita: {e} — procedo senza")

        # ─── FASE 1: RACCOLTA DATI PARALLELA ─────────────────────────────────
        # TIMEOUT GLOBALE 9 MINUTI per evitare freeze infiniti
        try:
            # 1. Scraping Siti Web (Generali)
            site_tasks = [self._scrape_single_website_page(s["url"], s["context"]) for s in site_urls]

            # 1.5 Scraping pagine interne auto-scoperte
            discovered_tasks = [self._scrape_single_website_page(s["url"], s["context"]) for s in discovered_pages]

            # 2. Scraping Landing Page Servizi (Specifici)
            service_tasks = [self._scrape_single_website_page(s["url"], s["context"]) for s in service_urls]

            # 2.5 Scraping Landing Page Prodotti / Menu
            product_tasks = [self._scrape_single_website_page(s["url"], s["context"]) for s in product_urls]

            # 2.6 Scraping Google My Business info (indirizzo, orari, servizi, etc.)
            gmb_info_tasks = [self._scrape_gmb_info(s["url"], s["context"]) for s in gmb_info_urls]

            # 3. Task in parallelo principali
            print(f"   📊 Lancio {len(site_tasks)} task sito, {len(discovered_tasks)} pagine scoperte, {len(service_tasks)} task servizi, {len(product_tasks)} task prodotti/menu, {len(gmb_info_tasks)} task GMB info, {len(review_urls)} task recensioni")

            main_results = await asyncio.wait_for(
                asyncio.gather(
                    asyncio.gather(*site_tasks, return_exceptions=True),
                    asyncio.gather(*discovered_tasks, return_exceptions=True),
                    asyncio.gather(*service_tasks, return_exceptions=True),
                    asyncio.gather(*product_tasks, return_exceptions=True),
                    asyncio.gather(*gmb_info_tasks, return_exceptions=True),
                    self._collect_google_reviews(client_name, metadata.get("location", ""), google_maps_url),
                    self._mine_reviews_from_urls(review_urls),
                    self._collect_instagram_data_complete(instagram_handle, metadata),
                    self._collect_meta_ads_data(metadata),
                    self._find_and_analyze_competitors(client_name, metadata.get("industry", ""), metadata.get("location", ""), metadata.get("competitors", []), competitor_links),
                    return_exceptions=True
                ),
                timeout=540.0 # 9 minuti
            )
        except asyncio.TimeoutError:
            print("⚠️ TIMEOUT GLOBALE RACCOLTA DATI (9 min) - Procedo con i dati parziali")
            main_results = [[], [], [], [], [], {}, {}, {}, {}, {}]

        site_res, discovered_res, service_res, product_res, gmb_info_res, g_reviews, extra_reviews, instagram_data, ads_data, competitor_data = main_results

        # 🔥 UNISCI CONTENUTI SITO
        combined_site_content = ""
        processed_site_results = []
        for i, res in enumerate(site_res or []):
            url = site_urls[i]["url"]
            if isinstance(res, Exception):
                processed_site_results.append({"url": url, "error": str(res)})
                combined_site_content += f"\n\n--- ERRORE DA: {url} ---\n{str(res)}"
            else:
                processed_site_results.append({"url": url, "data": res})
                combined_site_content += f"\n\n--- CONTENUTO DA: {url} ---\n{res.get('raw_text', str(res))}"

        # 🔥 UNISCI PAGINE AUTO-SCOPERTE (link interni trovati nella homepage)
        for i, res in enumerate(discovered_res or []):
            if isinstance(res, Exception):
                continue
            url = discovered_pages[i]["url"] if i < len(discovered_pages) else "discovered"
            processed_site_results.append({"url": url, "data": res})
            combined_site_content += f"\n\n--- CONTENUTO DA: {url} (auto-scoperta) ---\n{res.get('raw_text', str(res))}"
            print(f"   ✅ Pagina auto-scoperta aggiunta: {url} ({len(res.get('raw_text', ''))} chars)")

        # 🔥 UNISCI INFO GOOGLE MY BUSINESS (indirizzo, orari, categorie, servizi)
        gmb_info_text = ""
        for i, res in enumerate(gmb_info_res or []):
            if not isinstance(res, Exception) and res:
                gmb_info_text += f"\n\n--- GOOGLE MY BUSINESS ---\n{res.get('raw_text', str(res))}"
                # Aggiungi anche al contenuto del sito per arricchire il contesto
                processed_site_results.append({"url": gmb_info_urls[i]["url"] if i < len(gmb_info_urls) else "gmb", "data": res})
                combined_site_content += f"\n\n--- GOOGLE MY BUSINESS ---\n{res.get('raw_text', str(res))}"
                print(f"   ✅ Info GMB estratte: {len(res.get('raw_text', ''))} caratteri")
        
        # 🔥 UNISCI SERVIZI (Vengono messi in services_txt per l'AI)
        combined_services_text = ""
        for i, res in enumerate(service_res or []):
            url = service_urls[i]["url"]
            if not isinstance(res, Exception):
                combined_services_text += f"\n\n--- DETTAGLI SERVIZIO DA: {url} ---\n{res.get('raw_text', str(res))}"
        
        # 🔥 UNISCI PRODOTTI E MENU (Vengono messi in products_txt)
        combined_products_text = ""
        for i, res in enumerate(product_res or []):
            url = product_urls[i]["url"]
            if not isinstance(res, Exception):
                combined_products_text += f"\n\n--- PRODOTTI/MENU DA: {url} ---\n{res.get('raw_text', str(res))}"
        
        site_content_combined = {"combined_raw_text": combined_site_content, "pages": processed_site_results}

        # 🔥 UNISCI RECENSIONI (Google + Extra)
        merged_reviews = {"all_reviews": []}
        if isinstance(g_reviews, dict):
            merged_reviews["all_reviews"].extend(g_reviews.get("reviews", []))
            for k, v in g_reviews.items():
                if k != "reviews": merged_reviews[k] = v
        
        if isinstance(extra_reviews, dict) and "reviews" in extra_reviews:
            print(f"✅ Aggiunte {len(extra_reviews['reviews'])} recensioni da fonti extra (Trustpilot/FB/etc)")
            merged_reviews["all_reviews"].extend(extra_reviews["reviews"])

        instagram_full = instagram_data if not isinstance(instagram_data, Exception) else {"error": str(instagram_data)}
        meta_ads = ads_data if not isinstance(ads_data, Exception) else {"error": str(ads_data)}
        competitors = competitor_data if not isinstance(competitor_data, Exception) else {"error": str(competitor_data)}

        print("=" * 80)
        print("✅ RACCOLTA DATI COMPLETATA")

        return {
            "site_url": site_urls[0]["url"] if site_urls else (service_urls[0]["url"] if service_urls else ""),
            "site_urls": site_urls + service_urls + product_urls,
            "site_content": site_content_combined,
            "google_reviews": merged_reviews,
            "instagram_data": instagram_full,
            "meta_ads": meta_ads,
            "competitor_data": competitors,
            "services_txt": combined_services_text,
            "products_txt": combined_products_text
        }

    def _html_to_text(self, html: str) -> str:
        """Converte HTML in testo pulito senza dipendenze esterne."""
        # Rimuovi script, style, svg, noscript
        html = re.sub(r'<(script|style|svg|noscript)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
        # Rimuovi commenti HTML
        html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
        # Converti br e p/div/h*/li in newline
        html = re.sub(r'<br\s*/?\s*>', '\n', html, flags=re.IGNORECASE)
        html = re.sub(r'</(p|div|h[1-6]|li|tr|section|article|header|footer|blockquote)>', '\n', html, flags=re.IGNORECASE)
        html = re.sub(r'<(p|div|h[1-6]|li|tr|section|article|header|footer|blockquote)[^>]*>', '\n', html, flags=re.IGNORECASE)
        # Rimuovi tutti i tag rimanenti
        html = re.sub(r'<[^>]+>', ' ', html)
        # Decodifica entità HTML comuni
        html = html.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        html = html.replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
        html = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), html)
        html = re.sub(r'&\w+;', ' ', html)
        # Pulisci whitespace
        lines = []
        for line in html.split('\n'):
            cleaned = ' '.join(line.split())
            if cleaned:
                lines.append(cleaned)
        return '\n'.join(lines)

    def _extract_internal_links(self, html: str, base_url: str) -> List[str]:
        """Estrae tutti i link interni da una pagina HTML."""
        from urllib.parse import urljoin, urlparse
        base_domain = urlparse(base_url).netloc

        # Trova tutti gli href
        hrefs = re.findall(r'<a[^>]+href=["\']([^"\']+)["\']', html, re.IGNORECASE)

        internal_links = set()
        # Pagine tecniche da ignorare
        SKIP = ["privacy", "cookie", "legal", "terms", "login", "cart", "checkout",
                "wp-admin", "wp-json", "xmlrpc", "feed", "sitemap", "robots",
                "#", "mailto:", "tel:", "javascript:", "whatsapp", ".pdf", ".jpg",
                ".png", ".gif", ".svg", ".css", ".js", "facebook.com", "instagram.com",
                "linkedin.com", "twitter.com", "youtube.com", "wa.me"]

        for href in hrefs:
            # Risolvi URL relativi
            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)

            # Solo link interni (stesso dominio)
            if parsed.netloc != base_domain:
                continue

            # Rimuovi fragment e query
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")

            # Salta pagine tecniche
            if any(skip in clean_url.lower() for skip in SKIP):
                continue

            # Salta la homepage stessa
            if parsed.path in ("", "/"):
                continue

            internal_links.add(clean_url)

        return list(internal_links)

    async def _fetch_page_html(self, url: str) -> str:
        """Scarica l'HTML grezzo di una pagina con httpx."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        }
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.text

    async def _scrape_single_website_page(self, url: str, context: str = "") -> Dict[str, Any]:
        """
        Scraping DIRETTO: fetch HTML → estrai testo → Claude per strutturazione.
        Non usa più Perplexity — prende il testo reale dalla pagina.
        """
        print(f"   🌐 Scraping diretto {url} {'(' + context + ')' if context else ''}...")

        try:
            # STEP 1: Fetch HTML diretto
            html = await self._fetch_page_html(url)
            raw_text = self._html_to_text(html)

            if len(raw_text.strip()) < 50:
                print(f"   ⚠️ Pagina {url} ha poco testo ({len(raw_text)} chars), provo con Perplexity come fallback")
                return await self._scrape_single_website_page_perplexity(url, context)

            # Tronca a 15K chars per non esplodere il context
            raw_text = raw_text[:15000]
            print(f"   ✅ HTML scaricato e convertito: {len(raw_text)} caratteri di testo")

            # STEP 2: Claude analizza il testo REALE estratto
            prompt = f"""Hai davanti il TESTO REALE estratto dalla pagina web: {url}
{"CONTESTO: " + context if context else ""}

TESTO DELLA PAGINA (estratto direttamente dall'HTML):
---
{raw_text}
---

ISTRUZIONI:
1. Analizza il testo sopra COSÌ COM'È. Non inventare, non aggiungere, non interpretare.
2. Il testo sopra È la pagina. Non hai bisogno di navigare altrove.
3. FEDELTÀ ASSOLUTA: usa le parole esatte del testo. Se dice "gestione completa" scrivi "gestione completa", non "consulenza".

⚠️ REGOLA CRITICA — CTA ≠ SERVIZIO:
- Bottoni come "Richiedi una Consulenza Gratuita" sono il PROCESSO DI VENDITA (call conoscitiva), NON il servizio.
- Il servizio è descritto nel corpo: "Come Funziona", fasi operative, "Fa per te se".
- Se dice "mi occupo di tutto", "gestione e ottimizzazione", "delegare completamente" → GESTIONE DONE-FOR-YOU.

COMPONENTI RICHIESTI NEL JSON:
1. "raw_text": COPIA il testo integrale della pagina così come lo vedi sopra — non riassumere.
2. "product_service_details": Cosa viene offerto, come funziona, fasi del servizio. Specifica se è gestione done-for-you o consulenza BASANDOTI sulle parole reali.
3. "marketing_hooks": Promesse, angoli, trasformazione promessa al cliente.
4. "trust_signals": Testimonianze, garanzie, numeri citati.
5. "brand_voice": Termini specifici e stile comunicativo.

Rispondi esclusivamente con un JSON strutturato con queste chiavi."""

            response = await self.ai_service._call_ai(
                model="anthropic/claude-3.7-sonnet",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=16000
            )

            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                # Assicurati che il raw_text contenga il testo reale, non un riassunto di Claude
                if len(data.get("raw_text", "")) < len(raw_text) * 0.3:
                    data["raw_text"] = raw_text
                print(f"   ✅ Analisi pagina completata: {len(str(data))} caratteri")
                return data
            else:
                print(f"   ✅ Analisi pagina completata (testo): {len(response)} caratteri")
                return {"raw_text": raw_text}

        except Exception as e:
            print(f"   ⚠️ Scraping diretto fallito per {url}: {e} — fallback a Perplexity")
            return await self._scrape_single_website_page_perplexity(url, context)

    async def _scrape_single_website_page_perplexity(self, url: str, context: str = "") -> Dict[str, Any]:
        """Fallback: usa Perplexity solo se il fetch diretto fallisce (es. JS-rendered pages)."""
        print(f"   🔄 Fallback Perplexity per {url}...")

        prompt = f"""Estrai TUTTO il testo visibile dalla pagina web: {url}
{"CONTESTO: " + context if context else ""}

ISTRUZIONI MANDATORIE:
1. Estrai ogni singola informazione presente, dalla prima all'ultima riga.
2. ZERO RIASSUNTI: copia il testo come appare sulla pagina.
3. FEDELTÀ ASSOLUTA: usa le parole esatte. Se dicono "gestione completa" NON scrivere "consulenza".

COMPONENTI RICHIESTI NEL JSON:
1. "raw_text": Il testo COMPLETO e LETTERALE della pagina, dall'alto in basso.
2. "product_service_details": Cosa viene offerto, come funziona.
3. "marketing_hooks": Promesse e angoli di marketing.
4. "trust_signals": Certificazioni, garanzie, testimonianze.
5. "brand_voice": Termini specifici del brand.

Rispondi esclusivamente con un JSON strutturato con queste chiavi."""

        try:
            response = await self.ai_service._call_ai(
                model="perplexity/sonar-pro",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=16000
            )

            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                print(f"   ✅ Fallback Perplexity completato: {len(str(data))} caratteri")
                return data
            else:
                return {"raw_text": response}

        except Exception as e:
            print(f"   ❌ Anche Perplexity fallito per {url}: {e}")
            raise

    async def _scrape_gmb_info(self, url: str, context: str = "") -> Dict[str, Any]:
        """
        Estrai info business dalla scheda Google My Business.
        Google Maps è JS-rendered → usiamo Perplexity per navigarla.
        """
        print(f"   📍 Scraping info Google My Business: {url}")

        prompt = f"""Visita questa scheda Google My Business / Google Maps: {url}

ESTRAI TUTTE le seguenti informazioni (se presenti):
1. Nome attività ESATTO come appare sulla scheda
2. Indirizzo completo
3. Numero di telefono
4. Orari di apertura (tutti i giorni)
5. Categorie/tipo di attività
6. Descrizione dell'attività (se presente)
7. Servizi elencati sulla scheda
8. Sito web collegato
9. Rating medio e numero totale recensioni
10. Foto: descrivi brevemente le prime 5-10 foto (cosa mostrano)
11. Domande e risposte (se presenti)
12. Attributi speciali (accessibilità, pagamenti accettati, etc.)

NON estrarre le singole recensioni qui — solo le INFO della scheda.

Rispondi in JSON:
{{
  "business_name": "Nome",
  "address": "Indirizzo completo",
  "phone": "Numero",
  "hours": "Orari dettagliati per giorno",
  "categories": ["Categoria 1", "Categoria 2"],
  "description": "Descrizione dalla scheda",
  "listed_services": ["Servizio 1", "Servizio 2"],
  "website": "URL sito",
  "rating": 4.9,
  "total_reviews": 150,
  "photo_descriptions": ["Descrizione foto 1", "..."],
  "attributes": ["Attributo 1", "..."],
  "raw_text": "Tutto il testo visibile sulla scheda, completo"
}}"""

        try:
            response = await self.ai_service._call_ai(
                model="perplexity/sonar-pro",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=8000
            )

            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                # Costruisci un raw_text leggibile dalle info strutturate
                parts = []
                if data.get("business_name"): parts.append(f"Nome attività: {data['business_name']}")
                if data.get("address"): parts.append(f"Indirizzo: {data['address']}")
                if data.get("phone"): parts.append(f"Telefono: {data['phone']}")
                if data.get("hours"): parts.append(f"Orari: {data['hours']}")
                if data.get("categories"): parts.append(f"Categorie: {', '.join(data['categories'])}")
                if data.get("description"): parts.append(f"Descrizione: {data['description']}")
                if data.get("listed_services"): parts.append(f"Servizi: {', '.join(data['listed_services'])}")
                if data.get("rating"): parts.append(f"Rating: {data['rating']} ({data.get('total_reviews', '?')} recensioni)")
                if data.get("attributes"): parts.append(f"Attributi: {', '.join(data['attributes'])}")
                if not data.get("raw_text") or len(data["raw_text"]) < 50:
                    data["raw_text"] = "\n".join(parts)
                print(f"   ✅ Info GMB estratte: {data.get('business_name', 'N/A')}")
                return data
            else:
                return {"raw_text": response}

        except Exception as e:
            print(f"   ❌ Errore scraping GMB info: {e}")
            return {"raw_text": "", "error": str(e)}

    async def _scrape_website_complete(self, site_urls: List[str], client_name: str) -> Dict[str, Any]:
        """
        Scraping COMPLETO di più pagine del sito web
        - Homepage, About, Prodotti, Servizi, FAQ, Blog, Prezzi
        """

        primary_url = site_urls[0] if site_urls else ""
        all_links_str = "\n".join([f"- {u}" for u in site_urls])
        
        print(f"\n🌐 Scraping COMPLETO sito: {primary_url} ({len(site_urls)} pagine)")

        prompt = f"""Analizza in modo ESTREMAMENTE DETTAGLIATO il sito web di {client_name}.
Hai a disposizione questi link specifici da scansionare:
{all_links_str}

RACCOGLI TUTTO:

### 1. HOMEPAGE
- Value Proposition completa
- Headline principali
- Testo completo (tutto)
- Call to Action

### 2. CHI SIAMO / ABOUT
- Storia completa
- Mission e Valori
- Team (nomi, ruoli, bio)
- Certificazioni, riconoscimenti

### 3. PRODOTTI (LISTA COMPLETA)
Per OGNI prodotto:
- Nome esatto
- Categoria
- Descrizione COMPLETA
- Ingredienti attivi (tutti)
- Benefici
- Prezzo
- Formato/Quantità
- Modalità d'uso

### 4. SERVIZI (LISTA COMPLETA)
Per OGNI servizio:
- Nome esatto
- Descrizione COMPLETA
- Durata
- Prezzo
- Per chi è indicato
- Risultati attesi
- Controindicazioni

### 5. FAQ
- Tutte le domande e risposte

### 6. BLOG/ARTICOLI
- Titoli principali
- Temi trattati

### 7. FOOTER
- Informazioni aziendali
- Indirizzo
- Contatti
- Certificazioni

### 8. ALTRO
- Testimonianze presenti sul sito
- Garanzie/Politiche
- Informazioni spedizione

FORNISCI UN REPORT DETTAGLIATISSIMO CON **TUTTO IL TESTO TROVATO**.
NON RIASSUMERE - SCRIVI TUTTO.

Formato JSON:
{{
  "homepage": {{"value_prop": "...", "headlines": [...], "full_text": "..."}},
  "about": {{"storia": "...", "mission": "...", "valori": [...], "team": [...]}},
  "products": [
    {{
      "name": "...",
      "category": "...",
      "description": "DESCRIZIONE COMPLETA",
      "ingredients": [...],
      "benefits": [...],
      "price": "...",
      "format": "..."
    }}
  ],
  "services": [
    {{
      "name": "...",
      "description": "DESCRIZIONE COMPLETA",
      "duration": "...",
      "price": "...",
      "for_who": "...",
      "results": "...",
      "contraindications": "..."
    }}
  ],
  "faq": [{{"question": "...", "answer": "..."}}],
  "testimonials": [...],
  "footer": {{...}}
}}"""

        try:
            response = await self.ai_service._call_ai(
                model="perplexity/sonar-pro",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=16000  # Massimo per avere TUTTO
            )

            # Prova a parsare JSON
            import re
            import json
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                print(f"✅ Scraping completato: {len(str(data))} caratteri")
                return data
            else:
                print(f"✅ Scraping completato (testo): {len(response)} caratteri")
                return {"raw_text": response}

        except Exception as e:
            print(f"❌ Errore scraping sito: {e}")
            return {"error": str(e)}

    async def _collect_google_reviews(self, client_name: str, location: str, gmb_url: str = "") -> Dict[str, Any]:
        """
        Raccolta TUTTE le recensioni Google (150+)
        Usa URL fornito se disponibile
        """

        print(f"\n⭐ Raccolta recensioni Google: {client_name}")
        
        url_instruction = ""
        if gmb_url:
            # Riconoscimento pattern URL specifici (lrd, fid, ecc.)
            is_direct_review = "#lrd=" in gmb_url or "fid=" in gmb_url or "place_id" in gmb_url.lower()
            
            if is_direct_review:
                url_instruction = f"⚠️ LINK DIRETTO RECENSIONI RILEVATO: {gmb_url}\n1. Apri questo link ed estrai TUTTE le recensioni associate a questo ID specifico.\n2. Non fermarti alla prima pagina."
            elif "google.com/search" in gmb_url:
                url_instruction = f"1. Analizza questo link fornito: {gmb_url}\n2. Cerca il pulsante 'Recensioni' nel pannello laterale (Knowledge Panel).\n3. Esegui anche una ricerca per 'Recensioni Google {client_name} {location}'."
            else:
                url_instruction = f"1. Utilizza questo link di Google Maps: {gmb_url}\n2. Cerca la sezione 'Recensioni' (spesso è un tab o in fondo alla colonna sinistra).\n3. Se il link è bloccato, cerca '{client_name} {location}' su Google e clicca sulle recensioni."
        else:
            url_instruction = f"Cerca il Profilo Google My Business di {client_name} a {location} ed estrai le recensioni. Usa query come 'Recensioni {client_name}' e '{client_name} {location} reviews'."

        prompt = f"""Esegui una ricerca e un'analisi MASSIVA delle recensioni Google per "{client_name}" ({location}).
        
{url_instruction}

ISTRUZIONI CRITICHE:
1. Devi TROVARE le recensioni. Non accettare un 'nessun risultato'. 
2. Cerca il 'Knowledge Panel' di Google per questa attività.
3. Estrai almeno 20-30 recensioni reali (Testo, Stelle, Autore).
4. Se non trovi recensioni dirette, cerca su siti come Treatwell, Fresha, o Facebook per trovare opinioni di clienti REALI di "{client_name}".

Rispondi in JSON:
{{
  "total_reviews": 150,
  "average_rating": 4.9,
  "reviews": [
    {{"stars": 5, "text": "TESTO REALE RECENSIONE", "author": "Nome", "date": "..."}}
  ]
}}"""

        async def _call_reviews_ai(current_prompt):
            return await self.ai_service._call_ai(
                model="perplexity/sonar-pro",
                messages=[{"role": "user", "content": current_prompt}],
                temperature=0.1,
                max_tokens=16000
            )

        def parse_json(resp):
            import re
            import json
            json_match = re.search(r'\{.*\}', resp, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    return None
            return None

        try:
            # 🚀 PRIMO TENTATIVO (Diretto o con Link)
            print(f"⭐ [Passo 1] Tentativo di recupero recensioni per {client_name}...")
            response = await _call_reviews_ai(prompt)
            data = parse_json(response)
            
            # Se abbiamo dati e recensioni, bene così
            if data and (data.get("reviews") and len(data.get("reviews")) > 2):
                num_r = len(data.get("reviews"))
                print(f"✅ [Passo 1] Successo: {num_r} recensioni trovate.")
                return data
            
            # 🚨 FALLBACK: Se vuoto, cerca in modo ultra-aggressivo
            print(f"⚠️ [Passo 1] Risultati scarsi. Lancio ricerca FALLBACK AGGRESSIVA...")
            fallback_prompt = f"""ERRORE: La ricerca precedente per "{client_name}" ({location}) non ha prodotto risultati.
IL CLIENTE GARANTISCE CHE LE RECENSIONI ESISTONO.

AZIONI OBBLIGATORIE:
1. Ignora il link precedente se non funziona.
2. Cerca "{client_name} {location} recensioni" su Google Search.
3. Cerca su Treatwell, Facebook, Miodottore, o altri aggregatori per "{client_name}".
4. Estrai i feedback TESTUALI dei clienti. Non dire 'Nessun risultato'.

Rispondi in JSON (schema identico a prima)."""
            
            response_f = await _call_reviews_ai(fallback_prompt)
            data_f = parse_json(response_f)
            
            if data_f:
                print(f"✅ [Passo 2] Fallback completato: {len(data_f.get('reviews', []))} recensioni recuperate.")
                return data_f
            
            return {"raw_text": response_f if response_f else response}

        except Exception as e:
            print(f"❌ Errore critico recensioni Google: {e}")
            return {"error": str(e), "reviews": []}

    async def _mine_reviews_from_urls(self, review_urls: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        🔥 MULTI-SOURCE REVIEW MINER
        Estrae recensioni da Trustpilot, FB, o qualsiasi link etichettato 'Recensioni'
        """
        if not review_urls:
            return {"reviews": []}

        print(f"   ⛏️ Estrazione recensioni da {len(review_urls)} fonti extra...")
        
        all_extra_reviews = []
        
        for item in review_urls:
            url = item["url"]
            context = item["context"]
            
            prompt = f"""Estrai TUTTE le recensioni dei clienti e i feedback testuali da questo URL: {url}
Contesto: {context}

REGOLE:
1. Devi estrarre Verbatim REALI (frasi esatte dei clienti).
2. Estrai: Testo della recensione, Stelle/Rating (se presente), Autore.
3. Se la pagina è un aggregatore (Trustpilot/FB), prendi almeno le ultime 10-15 recensioni.
4. Ignora il contenuto marketing del sito.

Rispondi in JSON:
{{
  "reviews": [
    {{"stars": 5, "text": "...", "author": "..."}}
  ]
}}"""
            try:
                response = await self.ai_service._call_ai(
                    model="perplexity/sonar-pro",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1
                )
                
                # Parse JSON
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                    reviews = data.get("reviews", [])
                    if reviews:
                        print(f"      ✅ Recuperate {len(reviews)} recensioni da {url}")
                        all_extra_reviews.extend(reviews)
            except Exception as e:
                print(f"      ⚠️ Errore mining recensioni da {url}: {e}")

        return {"reviews": all_extra_reviews}

    async def _collect_instagram_data_complete(
        self,
        instagram_handle: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Raccolta COMPLETA Instagram:
        - TUTTI i post (non solo 6)
        - TUTTI i commenti (non solo 15)
        """

        if not instagram_handle:
            return {"error": "Nessun Instagram fornito"}

        print(f"\n📸 Raccolta COMPLETA Instagram: @{instagram_handle}")

        ig_token = metadata.get("meta_access_token") or os.getenv("META_ACCESS_TOKEN")
        if not ig_token:
            return {"error": "Nessun token Meta fornito"}

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Get IG Business Account
                me_resp = await client.get(
                    "https://graph.facebook.com/v19.0/me",
                    params={"fields": "id,instagram_business_account", "access_token": ig_token}
                )
                me_data = me_resp.json()
                ig_user_id = me_data.get("instagram_business_account", {}).get("id")

                if not ig_user_id:
                    return {"error": "Instagram Business Account non trovato"}

                # Business Discovery API per il cliente
                disc_resp = await client.get(
                    f"https://graph.facebook.com/v19.0/{ig_user_id}",
                    params={
                        "fields": f"business_discovery.username({instagram_handle}){{followers_count,media_count,biography,media.limit(100){{id,caption,like_count,comments_count,timestamp,media_type,media_url}}}}",
                        "access_token": ig_token
                    }
                )

                disc_data = disc_resp.json()

                if "business_discovery" not in disc_data:
                    return {"error": "Dati Instagram non disponibili"}

                ig_data = disc_data["business_discovery"]
                posts = ig_data.get("media", {}).get("data", [])

                # Ordina per engagement
                posts_sorted = sorted(
                    posts,
                    key=lambda p: p.get("like_count", 0) + p.get("comments_count", 0) * 2,
                    reverse=True
                )

                # Raccogli TUTTI i commenti dai top 20 post
                print(f"   Raccolta commenti da {min(20, len(posts_sorted))} post...")

                async def fetch_all_comments(post_id: str) -> List[Dict]:
                    try:
                        comments = []
                        url = f"https://graph.facebook.com/v19.0/{post_id}/comments"
                        params = {
                            "fields": "text,like_count,timestamp,username",
                            "access_token": ig_token,
                            "limit": 100
                        }

                        while url:
                            resp = await client.get(url, params=params if not comments else {})
                            data = resp.json()
                            comments.extend(data.get("data", []))
                            url = data.get("paging", {}).get("next")
                            if len(comments) >= 200:  # Max 200 commenti per post
                                break

                        return comments
                    except:
                        return []

                # Raccogli commenti in parallelo
                comment_tasks = [fetch_all_comments(p["id"]) for p in posts_sorted[:20]]
                all_comments = await asyncio.gather(*comment_tasks)

                # Associa commenti ai post
                for post, comments in zip(posts_sorted[:20], all_comments):
                    post["all_comments"] = comments

                total_comments = sum(len(c) for c in all_comments)

                print(f"✅ Instagram: {len(posts)} post, {total_comments} commenti")

                return {
                    "account": {
                        "username": instagram_handle,
                        "followers": ig_data.get("followers_count", 0),
                        "posts_count": ig_data.get("media_count", 0),
                        "bio": ig_data.get("biography", "")
                    },
                    "posts": posts_sorted,
                    "total_posts": len(posts),
                    "total_comments": total_comments
                }

        except Exception as e:
            print(f"❌ Errore Instagram: {e}")
            return {"error": str(e)}

    async def _collect_meta_ads_data(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Raccolta dati Meta Ads (già implementato nel main.py)
        """

        ad_account_id = metadata.get("ad_account_id", "").strip()
        ig_token = metadata.get("meta_access_token") or os.getenv("META_ACCESS_TOKEN")

        if not ad_account_id or not ig_token:
            return {"error": "Meta Ads non configurato"}

        print(f"\n📊 Raccolta dati Meta Ads")

        try:
            if not ad_account_id.startswith("act_"):
                ad_account_id = f"act_{ad_account_id}"

            async with httpx.AsyncClient(timeout=60.0) as client:
                insights_resp = await client.get(
                    f"https://graph.facebook.com/v19.0/{ad_account_id}/insights",
                    params={
                        "fields": "ad_id,ad_name,adset_name,campaign_name,spend,ctr,cpc,impressions,clicks,actions",
                        "level": "ad",
                        "date_preset": "last_90d",
                        "limit": 100,  # Top 100 ads
                        "access_token": ig_token
                    }
                )

                insights_data = insights_resp.json()
                ads = insights_data.get("data", [])

                # Ordina per CTR
                ads_sorted = sorted(ads, key=lambda x: float(x.get("ctr", 0) or 0), reverse=True)

                # Raccogli copy delle top 30 ads
                print(f"   Raccolta copy da {min(30, len(ads_sorted))} ads...")

                for ad in ads_sorted[:30]:
                    try:
                        creative_resp = await client.get(
                            f"https://graph.facebook.com/v19.0/{ad.get('ad_id')}",
                            params={
                                "fields": "creative{body,title,image_url,video_id}",
                                "access_token": ig_token
                            }
                        )
                        creative_data = creative_resp.json()
                        ad["creative"] = creative_data.get("creative", {})
                    except:
                        pass

                print(f"✅ Meta Ads: {len(ads)} ads analizzate")

                return {
                    "total_ads": len(ads),
                    "top_ads": ads_sorted[:30],
                    "summary": {
                        "total_spend": sum(float(a.get("spend", 0) or 0) for a in ads),
                        "avg_ctr": sum(float(a.get("ctr", 0) or 0) for a in ads) / len(ads) if ads else 0
                    }
                }

        except Exception as e:
            print(f"❌ Errore Meta Ads: {e}")
            return {"error": str(e)}

    async def _find_and_analyze_competitors(
        self,
        client_name: str,
        industry: str,
        location: str,
        user_competitors: List[Dict[str, Any]],
        extra_links: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Trova e analizza COMPETITOR:
        - Usa PRIMA quelli forniti dall'utente nella sezione Sorgenti
        - Altrimenti cercali online
        - Raccoglie loro recensioni
        """

        print(f"\n🎯 Ricerca e analisi competitor: {industry} in {location}")

        all_competitors = []
        
        # STEP 0: Aggiungi competitor dai link extra (Sorgenti)
        if extra_links:
            for link_item in extra_links:
                url = link_item["url"]
                label = link_item["label"]
                # Estrai nome se possibile dalla label "Competitor: Nome"
                comp_name = label.replace("Competitor", "").replace(":", "").strip()
                if not comp_name: comp_name = url.split("//")[-1].split("/")[0]
                
                all_competitors.append({
                    "name": comp_name,
                    "website": url,
                    "google_maps": ""
                })
                print(f"   ➕ Aggiunto competitor da link: {comp_name} ({url})")

        # STEP 1: Use user-provided competitors (Legacy/JSON field)
        if user_competitors and len(user_competitors) > 0:
            print(f"✅ Utilizzando {len(user_competitors)} competitor forniti dall'utente (Sorgenti)")
            for comp in user_competitors:
                links = comp.get("links", [])
                website = ""
                gmaps = ""
                instagram = ""
                facebook = ""
                ads_library_url = ""

                for l in links:
                    u = l.get("url", "") if isinstance(l, dict) else str(l)
                    lbl = l.get("label", "").lower().strip() if isinstance(l, dict) else ""
                    if not u:
                        continue

                    u_lc = u.lower()

                    # Google My Business (tutte le varianti)
                    if lbl == "google_business" or any(x in lbl for x in [
                        "google my business", "scheda google", "google maps", "gmb",
                        "mappa google", "recensioni google"
                    ]) or any(x in u_lc for x in [
                        "maps", "g.page", "share.google", "google.com/search", "business.google.com"
                    ]):
                        if not gmaps:
                            gmaps = u

                    # Instagram
                    elif lbl == "instagram" or ("instagram" in lbl and "ads" not in lbl) or "instagram.com" in u_lc:
                        instagram = u

                    # Sito Web
                    elif lbl == "website" or any(x in lbl for x in ["sito web", "sito", "website"]):
                        if not website:
                            website = u

                    # Servizi (trattati come sito web)
                    elif lbl == "service" or any(x in lbl for x in ["servizio", "servizi", "trattamenti"]):
                        if not website:
                            website = u

                    # Facebook (non ADS)
                    elif (lbl == "facebook" or "facebook" in lbl) and "ads" not in lbl and "libreria" not in lbl:
                        if "facebook.com" in u_lc and "ads/library" not in u_lc:
                            facebook = u

                    # ADS Library / Libreria inserzioni — salva per analisi ads competitor
                    elif any(x in lbl for x in ["libreria", "ads library", "inserzioni", "ads_library"]) or "ads/library" in u_lc:
                        if not ads_library_url:
                            ads_library_url = u

                    # Fallback generico: se non è social/ads prendi come sito
                    elif not website and not any(x in u_lc for x in [
                        "facebook.com/ads", "instagram.com", "tiktok.com"
                    ]):
                        website = u

                all_competitors.append({
                    "name": comp.get("name", ""),
                    "address": "",
                    "website": website,
                    "google_maps": gmaps,
                    "instagram": instagram,
                    "facebook": facebook,
                    "ads_library_url": ads_library_url,  # Per analisi inserzioni competitor
                    "all_links": links,
                })
        else:
            print("⚠️ Nessun competitor fornito nelle Sorgenti. Ricerca online...")
            # STEP 1b: Fallback to finding competitors
            search_prompt = f"""Trova i 3 COMPETITOR DIRETTI PIÙ RILEVANTI di {client_name} ({industry}) in {location}.

Cerca i 3 competitor più importanti — quelli che un cliente confronterebbe direttamente con {client_name}.
Preferisci competitor locali nella zona {location}, ma se non ce ne sono abbastanza includi quelli nazionali più noti.

Per ognuno fornisci:
- Nome
- Sito web
- Google Maps link (se disponibile)

Formato JSON:
{{
  "local_competitors": [
    {{
      "name": "...",
      "website": "...",
      "google_maps": "..."
    }}
  ]
}}"""

            try:
                competitors_search = await self.ai_service._call_ai(
                    model="perplexity/sonar-pro",
                    messages=[{"role": "user", "content": search_prompt}],
                    temperature=0.2,
                    max_tokens=8000
                )

                import re
                import json
                json_match = re.search(r'\{.*\}', competitors_search, re.DOTALL)
                if not json_match:
                    print("❌ Competitor non trovati tramite ricerca")
                else:
                    competitors = json.loads(json_match.group())
                    all_competitors = competitors.get("local_competitors", [])[:3]
            except Exception as e:
                print(f"⚠️ Errore ricerca competitor: {e}")

        if not all_competitors:
            return {"error": "Nessun competitor disponibile"}

        print(f"   Analizzando {len(all_competitors)} competitor")

        # STEP 2: Per ogni competitor, raccogli recensioni (IN PARALLELO)
        print(f"   Analisi parallela di {len(all_competitors[:10])} competitor...")
        
        async def fetch_comp_reviews(comp):
            comp_name = comp.get("name", "")
            comp_url = comp.get("website", "")
            comp_maps = comp.get("google_maps", "")
            comp_instagram = comp.get("instagram", "")
            comp_facebook = comp.get("facebook", "")
            ads_library_url = comp.get("ads_library_url", "")
            all_links = comp.get("all_links", [])

            # Costruisci contesto URL il più ricco possibile
            url_lines = []
            if comp_maps:
                url_lines.append(f"- Google My Business / Recensioni: {comp_maps}")
            if comp_url:
                url_lines.append(f"- Sito Web: {comp_url}")
            if comp_instagram:
                url_lines.append(f"- Instagram: {comp_instagram}")
            if comp_facebook:
                url_lines.append(f"- Facebook: {comp_facebook}")
            if ads_library_url:
                url_lines.append(f"- Libreria ADS Meta: {ads_library_url}")
            # Link extra non già inclusi
            for lnk in all_links:
                lnk_url = lnk.get("url", "") if isinstance(lnk, dict) else str(lnk)
                lnk_lbl = lnk.get("label", "") if isinstance(lnk, dict) else ""
                if lnk_url and lnk_url not in (comp_maps, comp_url, comp_instagram, comp_facebook, ads_library_url):
                    url_lines.append(f"- {lnk_lbl or 'Link'}: {lnk_url}")

            url_context = (f"Link disponibili per {comp_name}:\n" + "\n".join(url_lines)) if url_lines else f"Cerca informazioni su '{comp_name}' online."

            # Prompt unificato: recensioni + ads in una sola chiamata
            ads_section = ""
            if ads_library_url:
                ads_section = f"""

INOLTRE analizza le inserzioni pubblicitarie ATTIVE usando la Libreria ADS Meta: {ads_library_url}
Per le ADS fornisci: temi principali, offerte in corso, formato prevalente, tono, pain point target.
Includi nel JSON un campo "ads_analysis" con queste info."""

            unified_prompt = f"""Analizza il competitor "{comp_name}" per un'analisi competitiva.
{url_context}

COMPITI:
1. Raccogli le recensioni Google: numero totale, media stelle, le migliori (5 stelle) e le peggiori (1-3 stelle)
{ads_section}

JSON richiesto:
{{
  "total": 0,
  "avg_rating": 0,
  "reviews_5star": [{{"text": "..."}}],
  "reviews_low": [{{"text": "...", "stars": 2}}],
  "ads_analysis": {{}}
}}"""

            try:
                comp_result = await self.ai_service._call_ai(
                    model="perplexity/sonar-pro",
                    messages=[{"role": "user", "content": unified_prompt}],
                    temperature=0.1,
                    max_tokens=8000
                )
                import re
                import json
                json_match = re.search(r'\{.*\}', comp_result, re.DOTALL)
                result_data = json.loads(json_match.group()) if json_match else {}
                ads_analysis = result_data.pop("ads_analysis", {})
                return {
                    "name": comp_name,
                    "info": comp,
                    "reviews": result_data,
                    "ads_analysis": ads_analysis
                }
            except Exception as e:
                print(f"      ⚠️ Errore analisi competitor {comp_name}: {e}")
                return {
                    "name": comp_name,
                    "info": comp,
                    "reviews": {"error": str(e), "total": 0},
                    "ads_analysis": {}
                }

        # Esegui i comp tasks in parallelo — tutti quelli delle Sorgenti, max 3 auto-trovati
        comp_tasks = [fetch_comp_reviews(c) for c in all_competitors]
        competitor_data = await asyncio.gather(*comp_tasks)

        total_comp_reviews = sum(c.get("reviews", {}).get("total", 0) for c in competitor_data if c.get("reviews"))
        print(f"✅ Competitor: {len(competitor_data)} analizzati, {total_comp_reviews} recensioni")

        return {
                "competitors": competitor_data,
                "total_competitors": len(competitor_data),
                "total_reviews_analyzed": total_comp_reviews
        }
