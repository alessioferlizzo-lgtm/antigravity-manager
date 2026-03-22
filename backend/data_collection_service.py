"""
Servizio di Raccolta Dati Massiva
Raccoglie TUTTI i dati necessari per analisi professionale
"""

import asyncio
import httpx
from typing import Dict, Any, List
import os
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

        # Trova sito web, Instagram e Google Maps
        site_urls = [] # Will now store dicts: {"url": "...", "context": "..."}
        instagram_handle = ""
        google_maps_url = ""

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
                
            if "instagram.com" in url:
                instagram_handle = url.strip("/").split("/")[-1].replace("@", "")
            elif any(x in url for x in ["google.com/maps", "business.google.com", "g.page", "google.com/search"]):
                google_maps_url = url
            else:
                # Salva sia URL che contesto
                site_urls.append({"url": url, "context": f"{label} {desc}".strip()})

        if not site_urls:
            raise Exception("Nessun sito web fornito nelle sorgenti")

        # Raccogli dati in parallelo - TIMEOUT GLOBALE 9 MINUTI per evitare freeze infiniti
        try:
            # 1. Scraping Siti Web (In parallelo per ogni URL con il suo contesto)
            site_tasks = [self._scrape_single_website_page(s["url"], s["context"]) for s in site_urls]
            site_results = await asyncio.gather(*site_tasks, return_exceptions=True)
            
            # Unisci i contenuti
            combined_site_content = ""
            processed_site_results = []
            for i, res in enumerate(site_results):
                url = site_urls[i]["url"]
                if isinstance(res, Exception):
                    print(f"❌ Errore scraping pagina {url}: {res}")
                    processed_site_results.append({"url": url, "error": str(res)})
                    combined_site_content += f"\n\n--- ERRORE DA: {url} ---\n{str(res)}"
                else:
                    processed_site_results.append({"url": url, "data": res})
                    combined_site_content += f"\n\n--- CONTENUTO DA: {url} ---\n{res.get('raw_text', str(res))}"
            
            site_content_combined = {"combined_raw_text": combined_site_content, "pages": processed_site_results}

            results = await asyncio.wait_for(
                asyncio.gather(
                    self._collect_google_reviews(client_name, metadata.get("location", ""), google_maps_url),
                    self._collect_instagram_data_complete(instagram_handle, metadata),
                    self._collect_meta_ads_data(metadata),
                    self._find_and_analyze_competitors(client_name, metadata.get("industry", ""), metadata.get("location", ""), metadata.get("competitors", [])),
                    return_exceptions=True
                ),
                timeout=540.0 # 9 minuti
            )
        except asyncio.TimeoutError:
            print("⚠️ TIMEOUT GLOBALE RACCOLTA DATI (9 min) - Procedo con i dati parziali")
            site_content_combined = {"error": "Timeout globale durante lo scraping dei siti"}
            results = [{}, {}, {}, {}] 

        reviews_data, instagram_data, ads_data, competitor_data = results

        # Gestisci errori
        google_reviews = reviews_data if not isinstance(reviews_data, Exception) else {"error": str(reviews_data)}
        instagram_full = instagram_data if not isinstance(instagram_data, Exception) else {"error": str(instagram_data)}
        meta_ads = ads_data if not isinstance(ads_data, Exception) else {"error": str(ads_data)}
        competitors = competitor_data if not isinstance(competitor_data, Exception) else {"error": str(competitor_data)}

        print("=" * 80)
        print("✅ RACCOLTA DATI COMPLETATA")

        return {
            "site_url": site_urls[0]["url"] if site_urls else "",
            "site_urls": site_urls,
            "site_content": site_content_combined,
            "google_reviews": google_reviews,
            "instagram_data": instagram_full,
            "meta_ads": meta_ads,
            "competitor_data": competitors
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
            if "google.com/search" in gmb_url:
                url_instruction = f"1. Analizza questo link fornito: {gmb_url}\n2. Esegui anche una ricerca per 'Recensioni Google {client_name} {location}'\n3. Cerca i feedback dei clienti su Facebook o altri aggregatori se Google Maps è bloccato."
            else:
                url_instruction = f"1. Utilizza questo link esatto: {gmb_url}\n2. Cerca anche 'Recensioni {client_name} {location}' in generale."
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

        try:
            response = await self.ai_service._call_ai(
                model="perplexity/sonar-pro",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=16000
            )

            import re
            import json
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                num_reviews = data.get("total_reviews", 0)
                print(f"✅ Raccolte {num_reviews} recensioni Google")
                return data
            else:
                print(f"✅ Recensioni raccolte (testo): {len(response)} caratteri")
                return {"raw_text": response}

        except Exception as e:
            print(f"❌ Errore recensioni Google: {e}")
            return {"error": str(e), "reviews": []}

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
        user_competitors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Trova e analizza COMPETITOR:
        - Usa PRIMA quelli forniti dall'utente nella sezione Sorgenti
        - Altrimenti cercali online
        - Raccoglie loro recensioni
        """

        print(f"\n🎯 Ricerca e analisi competitor: {industry} in {location}")

        all_competitors = []
        
        # STEP 1: Use user-provided competitors if available
        if user_competitors and len(user_competitors) > 0:
            print(f"✅ Utilizzando {len(user_competitors)} competitor forniti dall'utente (Sorgenti)")
            for comp in user_competitors:
                links = comp.get("links", [])
                website = ""
                gmaps = ""
                for l in links:
                    u = l.get("url", "") if isinstance(l, dict) else str(l)
                    if not u: continue
                    if "maps" in u or "g.page" in u: gmaps = u
                    elif not website: website = u
                
                all_competitors.append({
                    "name": comp.get("name", ""),
                    "address": "",
                    "website": website,
                    "google_maps": gmaps
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
            
            url_context = ""
            if comp_maps: url_context = f"Utilizza questo link esatto di Google Maps per le recensioni: {comp_maps}"
            elif comp_url: url_context = f"Il sito web del competitor è: {comp_url}"
            
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
