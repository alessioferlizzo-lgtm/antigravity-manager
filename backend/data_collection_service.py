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
        competitor_links = [] # Link a competitor specifici
        instagram_handle = ""
        google_maps_url = ""

        # ─── LINK ROUTING ────────────────────────────────────────────────────────
        # Priority 1: use the declared label type (from dropdown in Sorgenti)
        # Priority 2: fallback to URL pattern matching (backward compat)
        SOCIAL_LABELS = {"instagram", "facebook", "tiktok", "youtube", "ads_library"}

        for link in links:
            if not isinstance(link, dict):
                url = str(link)
                label = ""
                desc = ""
            else:
                url = link.get("url", "")
                label = link.get("label", "")   # e.g. "instagram", "reviews", "google_business"
                desc = link.get("description", "")

            if not url or "http" not in url.lower():
                continue

            url_lc = url.lower()
            label_lc = label.lower().strip()

            # ── DECLARED TYPE ROUTING (new dropdown labels) ──────────────────
            if label_lc == "instagram":
                instagram_handle = url.strip("/").split("/")[-1].replace("@", "")
                continue

            if label_lc in ("google_business",):
                google_maps_url = url
                continue

            if label_lc == "reviews":
                review_urls.append({"url": url, "context": f"{desc or 'Recensioni'}".strip()})
                continue

            if label_lc == "service":
                service_urls.append({"url": url, "context": f"{desc or 'Servizio'}".strip()})
                continue

            if label_lc == "website":
                site_urls.append({"url": url, "context": f"{desc or 'Sito Web'}".strip()})
                continue

            if label_lc in SOCIAL_LABELS:
                # Facebook, TikTok, YouTube, ADS Library — trattiamo come sito da analizzare
                site_urls.append({"url": url, "context": f"{label} {desc}".strip()})
                continue

            if label_lc == "other":
                site_urls.append({"url": url, "context": f"{desc}".strip()})
                continue

            # ── FALLBACK: URL PATTERN MATCHING (vecchi link senza tipo) ──────
            # Estendi riconoscimento Google Maps a share.google/
            if any(x in url_lc for x in ["instagram.com"]):
                instagram_handle = url.strip("/").split("/")[-1].replace("@", "")
            elif any(x in url_lc for x in ["google.com/maps", "business.google.com", "g.page", "share.google", "google.com/search"]):
                google_maps_url = url
            elif any(x in label_lc or x in url_lc for x in ["recensioni", "review", "trustpilot", "recenzion", "opinioni"]):
                review_urls.append({"url": url, "context": f"{label} {desc}".strip()})
            elif any(x in label_lc for x in ["servizi", "service", "trattamenti", "trattamento", "landing"]):
                service_urls.append({"url": url, "context": f"{label} {desc}".strip()})
            else:
                site_urls.append({"url": url, "context": f"{label} {desc}".strip()})

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

        # Raccogli dati in parallelo - TIMEOUT GLOBALE 9 MINUTI per evitare freeze infiniti
        try:
            # 1. Scraping Siti Web (Generali)
            site_tasks = [self._scrape_single_website_page(s["url"], s["context"]) for s in site_urls]
            
            # 2. Scraping Landing Page Servizi (Specifici)
            service_tasks = [self._scrape_single_website_page(s["url"], s["context"]) for s in service_urls]
            
            # 3. Task in parallelo principali
            print(f"   📊 Lancio {len(site_tasks)} task sito, {len(service_tasks)} task servizi, {len(review_urls)} task recensioni extra")
            
            main_results = await asyncio.wait_for(
                asyncio.gather(
                    asyncio.gather(*site_tasks, return_exceptions=True),
                    asyncio.gather(*service_tasks, return_exceptions=True),
                    self._collect_google_reviews(client_name, metadata.get("location", ""), google_maps_url),
                    self._mine_reviews_from_urls(review_urls), # 🔥 NUOVO: Miner multi-fonte
                    self._collect_instagram_data_complete(instagram_handle, metadata),
                    self._collect_meta_ads_data(metadata),
                    self._find_and_analyze_competitors(client_name, metadata.get("industry", ""), metadata.get("location", ""), metadata.get("competitors", []), competitor_links), # 🔥 PASSATI LINK EXTRA
                    return_exceptions=True
                ),
                timeout=540.0 # 9 minuti
            )
        except asyncio.TimeoutError:
            print("⚠️ TIMEOUT GLOBALE RACCOLTA DATI (9 min) - Procedo con i dati parziali")
            main_results = [[], [], {}, {}, {}, {}, {}] 

        site_res, service_res, g_reviews, extra_reviews, instagram_data, ads_data, competitor_data = main_results

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
        
        # 🔥 UNISCI SERVIZI (Vengono messi in services_txt per l'AI)
        combined_services_text = ""
        for i, res in enumerate(service_res or []):
            url = service_urls[i]["url"]
            if not isinstance(res, Exception):
                combined_services_text += f"\n\n--- DETTAGLI SERVIZIO DA: {url} ---\n{res.get('raw_text', str(res))}"
        
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
            "site_urls": site_urls + service_urls,
            "site_content": site_content_combined,
            "google_reviews": merged_reviews,
            "instagram_data": instagram_full,
            "meta_ads": meta_ads,
            "competitor_data": competitors,
            "services_txt": combined_services_text # Ritorniamo questo per il main.py
        }

    async def _scrape_single_website_page(self, url: str, context: str = "") -> Dict[str, Any]:
        """
        Scraping profondo di un URL specifico usando contesto se fornito
        """
        print(f"   🌐 Scraping {url} {'(' + context + ')' if context else ''}...")
        
        prompt = f"""Analizza approfonditamente questa pagina web: {url}
{"Contesto fornito dall'utente: " + context if context else ""}

Estrai TUTTE le informazioni rilevanti per un media buyer:
1. Prodotti/Servizi principali con relativi prezzi o offerte
2. Angoli di attacco (Pain points risolti, promesse, trasformazione)
3. Elementi di trust (Anni di esperienza, certificazioni, premi)
4. Linguaggio e terminologia specifica usata dal brand
5. Obiezioni prevenute o gestite nel testo

Rispondi con un JSON strutturato con queste chiavi."""

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
                print(f"   ✅ Scraping pagina completato: {len(str(data))} caratteri")
                return data
            else:
                print(f"   ✅ Scraping pagina completato (testo): {len(response)} caratteri")
                return {"raw_text": response}

        except Exception as e:
            print(f"   ❌ Errore scraping pagina {url}: {e}")
            raise # Re-raise to be caught by asyncio.gather's return_exceptions

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

                for l in links:
                    u = l.get("url", "") if isinstance(l, dict) else str(l)
                    lbl = l.get("label", "").lower().strip() if isinstance(l, dict) else ""
                    if not u:
                        continue

                    # Usa il tipo dichiarato prima
                    if lbl == "google_business":
                        gmaps = u
                    elif lbl == "reviews":
                        if not gmaps:
                            gmaps = u  # tratta link recensioni come GMB per Perplexity
                        if not gmaps:
                            gmaps = u
                    elif lbl == "website":
                        if not website:
                            website = u
                    elif lbl == "instagram":
                        instagram = u
                    elif lbl == "facebook":
                        facebook = u
                    elif lbl in ("service",):
                        if not website:
                            website = u
                    else:
                        # Fallback: pattern matching per vecchi dati
                        u_lc = u.lower()
                        if any(x in u_lc for x in ["maps", "g.page", "share.google", "google.com/search"]):
                            if not gmaps:
                                gmaps = u
                        elif "instagram.com" in u_lc:
                            instagram = u
                        elif "facebook.com" in u_lc and "ads/library" not in u_lc:
                            facebook = u
                        elif not website and not any(x in u_lc for x in ["facebook.com/ads", "instagram.com", "tiktok.com"]):
                            website = u

                all_competitors.append({
                    "name": comp.get("name", ""),
                    "address": "",
                    "website": website,
                    "google_maps": gmaps,
                    "instagram": instagram,
                    "facebook": facebook,
                    "all_links": links,  # Passa tutti i link originali a fetch_comp_reviews
                })
        else:
            print("⚠️ Nessun competitor fornito nelle Sorgenti. Ricerca online...")
            # STEP 1b: Fallback to finding competitors
            search_prompt = f"""Trova i COMPETITOR DIRETTI di {client_name} ({industry}) in {location} e in tutta Italia.

CERCA:

### 1. COMPETITOR LOCALI (zona {location})
Trova 3-5 competitor diretti nella stessa zona.
Per ognuno:
- Nome
- Indirizzo
- Telefono
- Sito web
- Instagram
- Google Maps link

### 2. COMPETITOR TOP ITALIA
Trova i 5-10 competitor PIÙ GRANDI in Italia nello stesso settore.
Quelli con:
- Più recensioni Google
- Più follower Instagram
- Più presenza online

Per ognuno fornisci stesse info.

Formato JSON:
{{
  "local_competitors": [
    {{
      "name": "...",
      "address": "...",
      "phone": "...",
      "website": "...",
      "instagram": "...",
      "google_maps": "..."
    }}
  ],
  "top_italy_competitors": [...]
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
                    all_competitors = competitors.get("local_competitors", []) + competitors.get("top_italy_competitors", [])
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
            # Aggiungi eventuali link extra non già inclusi
            for lnk in all_links:
                lnk_url = lnk.get("url", "") if isinstance(lnk, dict) else str(lnk)
                lnk_lbl = lnk.get("label", "") if isinstance(lnk, dict) else ""
                if lnk_url and lnk_url not in (comp_maps, comp_url, comp_instagram, comp_facebook):
                    url_lines.append(f"- {lnk_lbl or 'Link'}: {lnk_url}")

            if url_lines:
                url_context = f"Link disponibili per {comp_name}:\n" + "\n".join(url_lines)
            elif comp_url:
                url_context = f"Il sito web del competitor è: {comp_url}"
            else:
                url_context = f"Cerca informazioni su '{comp_name}' online."
            
            reviews_prompt = f"""Raccogli TUTTE le recensioni Google disponibili per "{comp_name}".
{url_context}

Fornisci:
- Numero totale recensioni
- Media stelle
- Tutte le recensioni 5 stelle (testo completo)
- Tutte le recensioni 1-3 stelle (testo completo)

JSON:
{{
  "total": 0,
  "avg_rating": 0,
  "reviews_5star": [{{"text": "..."}}],
  "reviews_low": [{{"text": "...", "stars": 2}}]
}}"""
            try:
                comp_reviews = await self.ai_service._call_ai(
                    model="perplexity/sonar-pro",
                    messages=[{"role": "user", "content": reviews_prompt}],
                    temperature=0.1,
                    max_tokens=8000
                )
                import re
                import json
                json_match = re.search(r'\{.*\}', comp_reviews, re.DOTALL)
                reviews_data = json.loads(json_match.group()) if json_match else {}
                return {
                    "name": comp_name,
                    "info": comp,
                    "reviews": reviews_data
                }
            except Exception as e:
                print(f"      ⚠️ Errore recensioni competitor {comp_name}: {e}")
                return {
                    "name": comp_name,
                    "info": comp,
                    "reviews": {"error": str(e), "total": 0}
                }

        # Esegui i comp tasks in parallelo
        limited_competitors = all_competitors[0:10]
        comp_tasks = [fetch_comp_reviews(c) for c in limited_competitors]
        competitor_data = await asyncio.gather(*comp_tasks)

        total_comp_reviews = sum(c.get("reviews", {}).get("total", 0) for c in competitor_data if c.get("reviews"))
        print(f"✅ Competitor: {len(competitor_data)} analizzati, {total_comp_reviews} recensioni")

        return {
                "competitors": competitor_data,
                "total_competitors": len(competitor_data),
                "total_reviews_analyzed": total_comp_reviews
        }
