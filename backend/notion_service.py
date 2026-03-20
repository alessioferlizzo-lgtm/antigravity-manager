import os
import json
import base64
import httpx
from typing import List, Dict, Any, Optional
from pathlib import Path
import hashlib
from dotenv import load_dotenv

# Caricamento prioritario del file .env in backend/
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)
# Fallback se caricato dalla root
if not os.getenv("NOTION_API_KEY"):
    load_dotenv()

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_CLIENTS_PERSONAS_DB_ID = os.getenv("NOTION_CLIENTS_PERSONAS_DB_ID")
NOTION_COPY_ENGINEERING_DB_ID = os.getenv("NOTION_COPY_ENGINEERING_DB_ID")
NOTION_COPY_VAULT_DB_ID = os.getenv("NOTION_COPY_VAULT_DB_ID")
NOTION_ANGLES_VAULT_DB_ID = os.getenv("NOTION_ANGLES_VAULT_DB_ID")
NOTION_GRAPHICS_VAULT_DB_ID = os.getenv("NOTION_GRAPHICS_VAULT_DB_ID")
NOTION_API_VERSION = "2022-06-28"

def get_notion_headers():
    token = os.getenv("NOTION_API_KEY")
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json"
    }

class NotionService:
    def __init__(self):
        # Persistent headers helper
        self.project_root = Path(__file__).parent.parent
        self.thumbnails_dir = self.project_root / "clients" / "common" / "thumbnails"
        self.thumbnails_dir.mkdir(parents=True, exist_ok=True)

    @property
    def headers(self):
        return get_notion_headers()

    async def get_winning_creatives(self, business_model: str = None, limit: int = 2) -> List[Dict[str, Any]]:
        """
        Fetches top winning creatives from the Notion database, optionally filtering by business model.
        Returns a list of dictionaries with 'headline', 'notes', and 'thumbnail_b64' (and mime type).
        """
        token = os.getenv("NOTION_API_KEY")
        db_id = os.getenv("NOTION_CREATIVES_DB_ID")
        if not token or not db_id:
            print("Notion credentials not found.")
            return []

        url = f"https://api.notion.com/v1/databases/{db_id}/query"
        
        payload = {"page_size": limit}
        
        if business_model:
            payload["filter"] = {
                "property": "Modello di Business",
                "multi_select": {
                    "contains": business_model
                }
            }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                data = response.json()
                
                results = []
                for page in data.get("results", []):
                    props = page.get("properties", {})
                    
                    # 1. Headline
                    headline = ""
                    headline_prop = props.get("Titolo", {}).get("title", [])
                    if headline_prop:
                        headline = "".join([t.get("plain_text", "") for t in headline_prop])
                        
                    # 2. Notes
                    notes = ""
                    notes_prop = props.get("Note", {}).get("rich_text", [])
                    if notes_prop:
                        notes = "".join([t.get("plain_text", "") for t in notes_prop])
                        
                    # 3. Thumbnail (download and encode to base64)
                    thumbnail_b64 = None
                    thumbnail_mime = "image/jpeg"
                    files_prop = props.get("Anteprima Immagine", {}).get("files", [])
                    if files_prop and len(files_prop) > 0:
                        file_obj = files_prop[0]
                        file_url = None
                        if file_obj.get("type") == "file":
                            file_url = file_obj.get("file", {}).get("url")
                        elif file_obj.get("type") == "external":
                            file_url = file_obj.get("external", {}).get("url")
                            
                        if file_url:
                            try:
                                img_resp = await client.get(file_url)
                                img_resp.raise_for_status()
                                thumbnail_b64 = base64.b64encode(img_resp.content).decode("utf-8")
                                thumbnail_mime = img_resp.headers.get("content-type", "image/jpeg")
                            except Exception as e:
                                print(f"Failed to download Notion thumbnail: {e}")
                                
                    if headline or thumbnail_b64:
                        # Generate a persistent local filename if we have an image
                        local_thumb_url = None
                        if thumbnail_b64:
                            # Use hash of headline or a unique ID to avoid duplicates
                            img_hash = hashlib.md5(headline.encode() if headline else str(page.get("id")).encode()).hexdigest()
                            file_ext = thumbnail_mime.split("/")[-1] if "/" in thumbnail_mime else "jpg"
                            filename = f"{img_hash}.{file_ext}"
                            local_path = self.thumbnails_dir / filename
                            
                            # Save locally if doesn't exist
                            if not local_path.exists():
                                try:
                                    async with httpx.AsyncClient() as img_client:
                                        img_resp = await img_client.get(file_url)
                                        img_resp.raise_for_status()
                                        with open(local_path, "wb") as f:
                                            f.write(img_resp.content)
                                except Exception as e:
                                    print(f"Failed to save local thumbnail: {e}")
                            
                            local_thumb_url = f"/api/vault/thumbnails/{filename}"

                        results.append({
                            "id": page.get("id"),
                            "headline": headline,
                            "notes": notes,
                            "thumbnail_b64": thumbnail_b64,
                            "thumbnail_mime": thumbnail_mime,
                            "local_thumb_url": local_thumb_url
                        })
                        
                return results
                
        except Exception as e:
            print(f"Error querying Notion DB: {e}")
            return []

    async def get_copy_frameworks(self, funnel_stage: str = None) -> str:
        """
        Legge il database 'Copy Engineering' e ritorna una stringa formattata con tutte le regole
        e i framework attivi, possibilmente filtrati per funnel_stage.
        """
        token = os.getenv("NOTION_API_KEY")
        db_id = os.getenv("NOTION_COPY_ENGINEERING_DB_ID")
        if not token or not db_id:
            return ""
            
        url = f"https://api.notion.com/v1/databases/{db_id}/query"
        payload = {"page_size": 50}
        
        # Filtro: cerco quelli che hanno il funnel stage richiesto oppure che non hanno funnel specificato (universali)
        if funnel_stage:
            # Per ora importiamo tutto e filtriamo in Python per semplicità essendo DB piccoli,
            # in modo da includere anche quelli con Funnel Stage vuoto (valido per tutti)
            pass

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                data = response.json()
                
                frameworks_text: str = ""
                for page in data.get("results", []):
                    props = page.get("properties", {})
                    
                    # Estrai campi
                    title = "".join([t.get("plain_text", "") for t in props.get("Nome Regola o Framework", {}).get("title", [])])
                    desc = "".join([t.get("plain_text", "") for t in props.get("Istruzioni e Contenuti", {}).get("rich_text", [])])
                    fw_type = props.get("Tipologia", {}).get("select", {})
                    fw_type_name = fw_type.get("name", "Regola") if fw_type else "Regola"
                    
                    # Filtra per funnel se specificato (salta se non match)
                    if funnel_stage:
                        stages = [s.get("name", "") for s in props.get("Fase del Funnel", {}).get("multi_select", [])]
                        # Se ha degli stage definiti e nessuno matcha quello richiesto, skippa (a meno che non contenga "ACTION" o simili)
                        # Nota: la logica esatta dipende da come l'utente popola i tag su Notion. 
                        # Per sicurezza, includiamo i record senza tag o che contengono la parola chiave.
                        if stages and not any(funnel_stage.lower() in s.lower() for s in stages):
                            continue
                    
                    if title and desc:
                        frameworks_text += f"\n- [{fw_type_name}] {title}\nISTRUZIONI: {desc}\n"
                        
                return frameworks_text
        except Exception as e:
            print(f"Error reading Copy Engineering DB: {e}")
            return ""
            
    async def get_vault_examples(self, db_id: str, sector: str = None) -> str:
        """
        Legge i copy o angles vault con Rank a 5 stelle per dare ad AI esempi da imitare.
        """
        token = os.getenv("NOTION_API_KEY")
        if not token or not db_id:
            return ""
            
        url = f"https://api.notion.com/v1/databases/{db_id}/query"
        payload = {
            "page_size": 5,
            "filter": {
                "property": "Valutazione",
                "select": {
                    "equals": "⭐️⭐️⭐️⭐️⭐️"
                }
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                data = response.json()
                
                examples: str = ""
                for i, page in enumerate(data.get("results", [])):
                    props = page.get("properties", {})
                    
                    # Vault Angles ha "Angle Title" e "Description"
                    # Vault Copy ha "Name / Headline" e "Full Copy"
                    title_prop_name = "Titolo Angolo" if "Titolo Angolo" in props else "Titolo o Headline"
                    desc_prop_name = "Descrizione" if "Descrizione" in props else "Testo Completo"
                    
                    title = "".join([t.get("plain_text", "") for t in props.get(title_prop_name, {}).get("title", [])])
                    desc = "".join([t.get("plain_text", "") for t in props.get(desc_prop_name, {}).get("rich_text", [])])
                    
                    # Filtro settore (se specificato e mismatch, passa)
                    if sector:
                        sector_prop = props.get("Settore o Industria", {}).get("select", {})
                        if sector_prop and sector_prop.get("name") and sector.lower() not in sector_prop.get("name").lower():
                            continue
                            
                    if title or desc:
                        examples += f"\nESEMPIO VIRALE {i+1}:\n[Headline/Angle]: {title}\n[Copy/Descrizione]: {desc}\n"
                        
                return examples
        except Exception as e:
            print(f"Error reading Vault DB: {e}")
            return ""

    async def _cache_external_image(self, url: str) -> Optional[str]:
        """Scarica un'immagine esterna e la salva nella cache locale per renderla permanente."""
        try:
            img_hash = hashlib.md5(url.encode()).hexdigest()
            # Proviamo a indovinare l'estensione o usiamo jpg
            ext = "jpg"
            if ".png" in url.lower(): ext = "png"
            elif ".webp" in url.lower(): ext = "webp"
            
            filename = f"vault_{img_hash}.{ext}"
            local_path = self.thumbnails_dir / filename
            
            if not local_path.exists():
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        with open(local_path, "wb") as f:
                            f.write(resp.content)
            
            # Ritorna l'URL relativo gestito dal backend
            # Nota: Usiamo localhost per default, in produzione andrebbe configurato l'host reale
            return f"http://localhost:8001/api/vault/thumbnails/{filename}"
        except Exception as e:
            print(f"Error caching image: {e}")
            return None

    async def upload_to_catbox(self, file_path: Path) -> Optional[str]:
        """Uploads a file to Catbox.moe and returns the permanent URL for Notion."""
        try:
            print(f"⏳ Caricamento immagine su Catbox.moe: '{file_path.name}'...")
            url = "https://catbox.moe/user/api.php"
            with open(file_path, "rb") as f:
                files = {"fileToUpload": (file_path.name, f)}
                data = {"reqtype": "fileupload"}
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, data=data, files=files)
                    if response.status_code == 200:
                        public_url = response.text.strip()
                        print(f"✅ Ottenuto URL pubblico Catbox: {public_url}")
                        return public_url
        except Exception as e:
            print(f"Error uploading {file_path.name} to Catbox: {e}")
        return None

    async def save_to_vault(self, vault_type: str, item_data: Dict[str, Any]) -> bool:
        """
        Salva un copy, angle o grafica nel Notion Vault appropriato.
        vault_type: "copy", "angle", "graphic"
        item_data: contiene title, text, sector, funnel_stage, client_name, format (solo copy), img_link (solo grafica).
        """
        token = os.getenv("NOTION_API_KEY")
        if not token:
            return False
            
        db_id = None
        if vault_type == "copy":
            db_id = os.getenv("NOTION_COPY_VAULT_DB_ID")
        elif vault_type == "angle":
            db_id = os.getenv("NOTION_ANGLES_VAULT_DB_ID")
        elif vault_type == "graphic":
            # RE-DIREZIONE TOTALE SU CREATIVE.LAB (ID: 32296b3c...)
            db_id = os.getenv("NOTION_CREATIVES_DB_ID")
            
        print(f"📡 NotionService: Salvataggio in corso su Database ID {db_id} (Tipo: {vault_type})")
            
        if not db_id:
            return False
            
        url = "https://api.notion.com/v1/pages"
        
        # Costruisce le properties di base
        title_prop_name = "Titolo" if vault_type == "graphic" else ("Titolo Angolo" if vault_type == "angle" else "Titolo o Headline")
        content_prop_name = "Note" if vault_type == "graphic" else ("Descrizione" if vault_type == "angle" else "Testo Completo")
        
        print(f"📝 NotionService: Utilizzo proprietà Titolo='{title_prop_name}' e Contenuto='{content_prop_name}'")
        # Crea le proprietà base
        properties: Dict[str, Any] = {
            "Name": {
                "title": [{"text": {"content": item_data.get("title", "Senza Titolo")[:100]}}]
            },
            "Nome Cliente": {
                "rich_text": [{"text": {"content": item_data.get("client_name", "")[:2000]}}]
            }
        }
        
        if content_prop_name and item_data.get("text"):
            properties[content_prop_name] = {
                "rich_text": [{"text": {"content": item_data.get("text", "")[:2000]}}]
            }
            
        # Auto-popolamento campi Brand/Cliente e Categoria/Settore
        if item_data.get("sector"):
            if vault_type == "graphic":
                # 'Categoria' is multi_select in Graphic Vault
                properties["Categoria"] = {
                    "multi_select": [{"name": item_data.get("sector")[:100]}]
                }
            elif vault_type == "copy" or vault_type == "angle":
                # Both use 'Settore o Industria' as select
                properties["Settore o Industria"] = {
                    "select": {"name": item_data.get("sector")[:100]}
                }
                
        if item_data.get("client_name"):
            if vault_type == "graphic":
                # 'Brand' is multi_select in Graphic Vault
                properties["Brand"] = {
                    "multi_select": [{"name": item_data.get("client_name")[:100]}]
                }
            elif vault_type == "copy" or vault_type == "angle":
                # Both use 'Nome Cliente' as rich_text (verified via inspection)
                properties["Nome Cliente"] = {
                    "rich_text": [{"text": {"content": item_data.get("client_name")[:2000]}}]
                }
            
        if item_data.get("funnel_stage"):
            properties["Fase del Funnel"] = {
                "select": {"name": item_data.get("funnel_stage")[:100]}
            }
            
        if item_data.get("format"):
            fmt = str(item_data.get("format", ""))
            if vault_type == "copy":
                properties["Formato"] = {
                    "select": {"name": fmt[:100]}
                }
            elif vault_type == "graphic":
                # E.g. "Feed IG (1:1)" -> "1:1"
                extracted_format = "Image" # default
                fmt_low = fmt.lower()
                if "4:5" in fmt_low or "4/5" in fmt_low:
                    extracted_format = "4/5" 
                elif "9:16" in fmt_low or "9/16" in fmt_low or "stories" in fmt_low:
                    extracted_format = "9/16" 
                elif "1:1" in fmt_low or "1/1" in fmt_low:
                    extracted_format = "1/1"
                elif "16:9" in fmt_low or "16/9" in fmt_low:
                    extracted_format = "16/9"
                elif "carousel" in fmt_low or "carosello" in fmt_low:
                    extracted_format = "Carousel"
                elif "video" in fmt_low:
                    extracted_format = "Video"
                    
                properties["Formato Pubblicità"] = {
                    "multi_select": [{"name": extracted_format}]
                }
            
        # Per le grafiche salviamo l'immagine tramite la proprietà 'files'
        img_link = item_data.get("img_link")
        if vault_type == "graphic" and img_link:
            # Se è un link Notion (S3), scarichiamo e cacheiamo localmente
            if "amazonaws.com" in img_link or "prod-files-secure" in img_link:
                local_url = await self._cache_external_image(img_link)
                if local_url:
                    img_link = local_url
            
            # Se il link è locale (relativo o referenzia localhost), dobbiamo caricarlo su host pubblico
            # Notion non può caricare immagini da 'localhost' o percorsi locali.
            if img_link.startswith("/") or "127.0.0.1" in img_link or "localhost" in img_link:
                try:
                    # Determiniamo il percorso fisico reale
                    file_path = None
                    if "/clients/" in img_link:
                        # Estrai il percorso relativo es: /clients/client_id/graphics/file.png
                        rel_path = img_link.split("/clients/")[-1]
                        file_path = self.project_root / "clients" / rel_path
                    elif "/api/vault/thumbnails/" in img_link:
                        filename = img_link.split("/")[-1]
                        file_path = self.thumbnails_dir / filename
                    elif img_link.startswith(str(self.project_root)):
                        file_path = Path(img_link)
                        
                    if file_path and file_path.exists():
                        public_url = await self.upload_to_catbox(file_path)
                        if public_url:
                            img_link = public_url
                            print(f"🔗 Usa URL permanente per Notion: {img_link}")
                        else:
                            print(f"⚠️ Fallito caricamento su Catbox, Notion mostrerà immagine rotta.")
                except Exception as e:
                    print(f"Error during Catbox upload flow: {e}")
            
            # NOTA: Usiamo solo 'Anteprima Immagine' che visualizza l'immagine direttamente.
            if img_link.startswith("http"):
                properties["Anteprima Immagine"] = {
                    "files": [{
                        "name": "Generazione AI",
                        "type": "external",
                        "external": {"url": img_link}
                    }]
                }
            
        # Di default salviamoli con un ranking intermedio così l'utente li vede e può decidere se farli diventare 5 stelle
        properties["Valutazione"] = {
            "select": {"name": item_data.get("ranking", "⭐️⭐️⭐️")}
        }

        payload = {
            "parent": {"database_id": db_id},
            "properties": properties
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                return True
        except Exception as e:
            print(f"Error saving to Vault {vault_type}: {e}")
            if hasattr(e, 'response') and e.response:
                print(e.response.text)
            return False

    async def save_to_knowledge_base(self, kb_type: str, name: str, instructions: str, funnel_stage: str = None) -> bool:
        """
        Salva una regola o un framework nel database della conoscenza.
        kb_type: "Regola", "Framework", "Setup"
        """
        token = os.getenv("NOTION_API_KEY")
        db_id = os.getenv("NOTION_COPY_ENGINEERING_DB_ID")
        if not token or not db_id:
            return False
            
        url = "https://api.notion.com/v1/pages"
        
        properties = {
            "Nome Regola o Framework": {
                "title": [{"text": {"content": name[:2000]}}]
            },
            "Istruzioni e Contenuti": {
                "rich_text": [{"text": {"content": instructions[:2000]}}]
            },
            "Tipologia": {
                "select": {"name": kb_type}
            }
        }
        
        if funnel_stage:
            properties["Fase del Funnel"] = {
                "multi_select": [{"name": funnel_stage}]
            }
            
        payload = {
            "parent": {"database_id": db_id},
            "properties": properties
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                return True
        except Exception as e:
            print(f"Error saving to Knowledge Base: {e}")
            if hasattr(e, 'response') and e.response:
                print(e.response.text)
            return False

    async def sync_client_metadata(self, client_id: str, metadata: Dict[str, Any]) -> bool:
        """
        Sincronizza i metadati del cliente con il database Notion 'Anagrafica Clienti'.
        Mappatura raffinata: Focus Analisi (Chi è, Obiettivi, Tono) e Paure dal Target.
        """
        token = os.getenv("NOTION_API_KEY")
        db_id = os.getenv("NOTION_CLIENTS_PERSONAS_DB_ID")
        if not token or not db_id:
            print("Missing Notion credentials.")
            return False

        def split_text_to_rich_objects(sections: List[Dict[str, Any]], limit: int = 2000) -> List[Dict[str, Any]]:
            """
            Prende una lista di sezioni: [{"text": str, "bold": bool}]
            e ritorna la lista di rich_text objects per Notion.
            """
            rich_objects = []
            for section in sections:
                text = section.get("text", "")
                is_bold = section.get("bold", False)
                if not text: continue
                
                # Split text if it exceeds limit (rare for a single section but safe)
                chunks = [text[i:i+limit] for i in range(0, len(text), limit)]
                for chunk in chunks:
                    obj = {"text": {"content": chunk}}
                    if is_bold:
                        obj["annotations"] = {"bold": True}
                    rich_objects.append(obj)
            return rich_objects

        # 1. Cerca se il cliente esiste già
        search_url = f"https://api.notion.com/v1/databases/{db_id}/query"
        search_payload = {
            "filter": {
                "property": "Nome Cliente",
                "rich_text": {"equals": metadata["name"]}
            }
        }
        
        page_id = None
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(search_url, headers=self.headers, json=search_payload)
                if resp.status_code == 200:
                    search_data = resp.json()
                    if search_data.get("results"):
                        page_id = search_data["results"][0]["id"]
        except Exception as e:
            print(f"Error searching client in Notion: {e}")

        # 2. Prepara le properties
        brand = metadata.get("brand_identity", {})
        
        # FOCUS ANALISI: Native Bold Formatting
        focus_sections = [
            {"text": "IDENTITÀ\n", "bold": True},
            {"text": f"{metadata['name']} opera nel settore: {metadata.get('industry', 'N/A')}\n\n", "bold": False},
            {"text": "OBIETTIVI BRAND\n", "bold": True},
            {"text": f"{metadata.get('objectives', 'Non definiti')}\n\n", "bold": False},
            {"text": "TONO DI VOCE\n", "bold": True},
            {"text": f"{brand.get('tone', 'Non definito')}\n\n", "bold": False}
        ]
        
        # PAURE E LEVE PROFONDE: Native Bold
        paure_sections = [{"text": "Analisi delle paure e leve profonde del target:\n", "bold": False}]
        personas = brand.get("buyer_personas", [])
        if personas:
            for p in personas:
                paure_sections.append({"text": f"- {p.get('name', 'N/A')}: ", "bold": True})
                paure_sections.append({"text": f"{p.get('fears', 'N/A')}\n", "bold": False})

        # SERVIZIO SPECIFICO: Settore/Categoria (Ma più dettagliato se possibile)
        servizio_specifico = metadata.get("industry", "Non specificato")

        properties = {
            "Nome Cliente": {"title": [{"text": {"content": metadata["name"]}}]},
            "Servizio Specifico": {"rich_text": split_text_to_rich_objects([{"text": servizio_specifico, "bold": False}])},
            "Focus Analisi": {"rich_text": split_text_to_rich_objects(focus_sections)},
            "Paure e Leve Profonde": {"rich_text": split_text_to_rich_objects(paure_sections)},
            "Strategia": {"rich_text": split_text_to_rich_objects([{"text": metadata.get("strategy", ""), "bold": False}])},
            "Piano d'Azione": {"rich_text": split_text_to_rich_objects([{"text": metadata.get("strategy", ""), "bold": False}])}
        }
        
        if brand.get("colors"):
            properties["Colori Brand"] = {"rich_text": [{"text": {"content": ", ".join(brand["colors"])[:2000]}}]}
        
        # SWOT Separata - Semplice per ora (senza bold specifico per riga per non complicare troppo)
        swot = metadata.get("swot", {})
        properties["SWOT: Forze"] = {"rich_text": split_text_to_rich_objects([{"text": swot.get("strengths", ""), "bold": False}])}
        properties["SWOT: Debolezze"] = {"rich_text": split_text_to_rich_objects([{"text": swot.get("weaknesses", ""), "bold": False}])}
        properties["SWOT: Opportunità"] = {"rich_text": split_text_to_rich_objects([{"text": swot.get("opportunities", ""), "bold": False}])}
        properties["SWOT: Minacce"] = {"rich_text": split_text_to_rich_objects([{"text": swot.get("threats", ""), "bold": False}])}

        # Buyer Personas Summary
        if personas:
            p_sections = []
            for p in personas:
                p_sections.append({"text": f"- {p.get('name', 'N/A')} ", "bold": True})
                p_sections.append({"text": f"({p.get('type', 'N/A')}): {p.get('target', 'N/A')}\n", "bold": False})
            properties["Buyer Personas Summary"] = {"rich_text": split_text_to_rich_objects(p_sections)}

        # Sorgenti & Link
        links = metadata.get("links", [])
        if links:
            l_sections = []
            for l in links:
                l_sections.append({"text": f"- {l.get('url')}", "bold": False})
                if l.get('description'):
                    l_sections.append({"text": f" ({l.get('description')})", "bold": False})
                l_sections.append({"text": "\n", "bold": False})
            properties["Sorgenti & Link"] = {"rich_text": split_text_to_rich_objects(l_sections)}

        # 3. Crea o Aggiorna
        if page_id:
            url = f"https://api.notion.com/v1/pages/{page_id}"
            method = "PATCH"
        else:
            url = "https://api.notion.com/v1/pages"
            method = "POST"

        payload = {"properties": properties}
        if not page_id:
            payload["parent"] = {"database_id": db_id}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if method == "POST":
                    response = await client.post(url, headers=self.headers, json=payload)
                else:
                    response = await client.patch(url, headers=self.headers, json=payload)
                
                if response.status_code != 200:
                    print(f"Notion Sync Response Error: {response.text}")
                
                response.raise_for_status()
                return True
        except Exception as e:
            print(f"Error syncing client to Notion: {e}")
            if hasattr(e, 'response') and e.response:
                print(e.response.text)
            return False

# Singleton instance
notion_service = NotionService()
