from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import io
import json
import json_repair
import base64
import uuid
import asyncio
import httpx
import random
import subprocess
import fal_client
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import re


def extract_ig_handle(url: str) -> str:
    """Extracts clean Instagram handle from a URL."""
    try:
        return url.split('instagram.com/')[1].strip('/').split('?')[0].split('/')[0]
    except Exception:
        return ""


# Load .env from backend directory
load_dotenv(Path(__file__).parent / ".env")

from .ai_service import AIService
from .storage_service import StorageService, CLIENTS_DIR, TASKS_FILE
from .notion_service import notion_service

app = FastAPI(title="Antigravity Script Manager")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_service = AIService()
storage_service = StorageService()

@app.on_event("startup")
async def on_startup():
    import asyncio
    await asyncio.to_thread(storage_service.sync_from_supabase)

class StructuredLink(BaseModel):
    url: str
    description: Optional[str] = ""
    label: Optional[str] = ""

class Competitor(BaseModel):
    name: str
    links: List[StructuredLink] = []

class ClientCreate(BaseModel):
    name: str
    industry: Optional[str] = ""
    links: List[StructuredLink] = []
    competitors: List[Competitor] = []

class FeedbackRequest(BaseModel):
    script_id: Optional[str] = "script_1"
    feedback: str
    angle_title: str

class AngleRequest(BaseModel):
    user_prompt: Optional[str] = ""
    funnel_stage: Optional[str] = ""

class BrandIdentityUpdate(BaseModel):
    tone: Optional[str] = None
    visuals: Optional[str] = None
    colors: Optional[List[str]] = None
    buyer_personas: Optional[List[Dict[str, Any]]] = None

class ResearchUpdate(BaseModel):
    content: str

class ResearchRequest(BaseModel):
    user_prompt: Optional[str] = ""

class KnowledgeRequest(BaseModel):
    name: str
    instructions: str
    kb_type: str
    funnel_stage: Optional[str] = None

@app.post("/clients")
async def create_client(client: ClientCreate):
    client_id = storage_service.create_client(client.name, client.industry, client.links, client.competitors)
    return {"client_id": client_id}

@app.get("/clients")
async def list_clients():
    return storage_service.list_clients()

@app.get("/clients/{client_id}")
async def get_client(client_id: str):
    try:
        return storage_service.get_metadata(client_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")

@app.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    try:
        storage_service.delete_client(client_id)
        return {"message": "Client deleted"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")

@app.get("/clients/{client_id}/notion-sync")
async def sync_client_notion(client_id: str):
    try:
        metadata = storage_service.get_metadata(client_id)
        success = await notion_service.sync_client_metadata(client_id, metadata)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to sync with Notion")
        return {"status": "success"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")

@app.get("/api/vault/thumbnails/{filename}")
async def get_vault_thumbnail(filename: str):
    thumb_path = notion_service.thumbnails_dir / filename
    if thumb_path.exists():
        return FileResponse(thumb_path)
    raise HTTPException(status_code=404, detail="Thumbnail not found")

@app.patch("/clients/{client_id}/brand")
async def update_brand_identity(client_id: str, identity: BrandIdentityUpdate):
    try:
        metadata = storage_service.get_metadata(client_id)
        if identity.tone is not None:
            metadata["brand_identity"]["tone"] = identity.tone
            metadata["preferences"]["tone"] = identity.tone # Sync legacy
        if identity.visuals is not None:
            metadata["brand_identity"]["visuals"] = identity.visuals
        if identity.colors is not None:
            metadata["brand_identity"]["colors"] = identity.colors
        if identity.buyer_personas is not None:
            old_personas = metadata.get("brand_identity", {}).get("buyer_personas", [])
            new_personas = identity.buyer_personas
            
            print(f"PATCH Brand: Updating buyer_personas for client {client_id}")
            print(f"  - Old count: {len(old_personas)}")
            print(f"  - New count: {len(new_personas)}")
            
            # Safeguard: if new count is 0 but old count was large, it might be a race condition/error
            if len(new_personas) == 0 and len(old_personas) > 1:
                print(f"  WARNING: Attempting to clear {len(old_personas)} personas. Skipping update to prevent data loss.")
            else:
                metadata["brand_identity"]["buyer_personas"] = new_personas
        
        storage_service.save_metadata(client_id, metadata)
        return metadata["brand_identity"]
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")

@app.post("/clients/{client_id}/logo")
async def upload_logo(client_id: str, file: UploadFile = File(...)):
    try:
        metadata = storage_service.get_metadata(client_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Save logo file
    logo_dir = CLIENTS_DIR / client_id / "brand"
    logo_dir.mkdir(parents=True, exist_ok=True)
    
    # Remove old logo
    for old_file in logo_dir.glob("logo.*"):
        old_file.unlink()
    
    ext = os.path.splitext(file.filename)[1] or ".png"
    logo_filename = f"logo{ext}"
    logo_path = logo_dir / logo_filename
    
    content = await file.read()
    with open(logo_path, "wb") as f:
        f.write(content)

    metadata["brand_identity"]["logo"] = logo_filename
    storage_service.save_metadata(client_id, metadata)
    storage_service.save_logo_to_supabase(client_id, logo_filename, content, ext)
    return {"logo": logo_filename}

@app.get("/clients/{client_id}/logo")
async def get_logo(client_id: str):
    try:
        metadata = storage_service.get_metadata(client_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")

    logo_filename = metadata.get("brand_identity", {}).get("logo", "")
    if not logo_filename:
        raise HTTPException(status_code=404, detail="No logo uploaded")

    logo_path = CLIENTS_DIR / client_id / "brand" / logo_filename
    if not logo_path.exists():
        storage_service.ensure_local_logo(client_id)
    if not logo_path.exists():
        raise HTTPException(status_code=404, detail="Logo file not found")

    return FileResponse(logo_path)

@app.post("/clients/{client_id}/extract-colors")
async def extract_colors(client_id: str):
    try:
        metadata = storage_service.get_metadata(client_id)
        logo_filename = metadata.get("brand_identity", {}).get("logo", "")
        if not logo_filename:
            raise HTTPException(status_code=400, detail="Nessun logo caricato per questo cliente")
        
        logo_path = CLIENTS_DIR / client_id / "brand" / logo_filename
        if not logo_path.exists():
            storage_service.ensure_local_logo(client_id)
        if not logo_path.exists():
            raise HTTPException(status_code=404, detail="File logo non trovato")

        script_path = os.path.join(os.getcwd(), "execution", "extract_dominant_colors.py")
        # Explicitly use python3 to ensure Pillow is found
        result = subprocess.run(["python3", script_path, str(logo_path), "5"], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Extraction script error: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"Errore script: {result.stderr}")
            
        colors = json.loads(result.stdout)
        return {"colors": colors}
    except Exception as e:
        print(f"Extraction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clients/{client_id}/extract-industry")
async def extract_industry(client_id: str):
    try:
        metadata = storage_service.get_metadata(client_id)
        # If already in metadata (e.g. from research), return it
        if metadata.get("industry"):
            return {"industry": metadata["industry"]}

        research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
        if not research_path.exists():
            raise HTTPException(status_code=404, detail="Analisi di mercato non trovata. Avvia prima la ricerca.")
            
        with open(research_path, "r") as f:
            content = f.read()
            
        # 1. Regex Match for explicit phrases
        match = re.search(r"specializzat[ao] in\s+([^\.]+)", content, re.IGNORECASE)
        if match:
            industry = match.group(1).strip()
            industry = industry[:60]
            industry = re.sub(r",| e | per | come | ad | in | con | \d+%", "", industry).strip().title()
        else:
            # 2. AI Fallback: Summarize the industry from the research text
            print(f"DEBUG: Industry regex failed. Using AI fallback.")
            prompt = f"Basandoti su questo testo di ricerca, estrai SOLO il settore/categoria del business (max 3-5 parole). Esempio: 'Centro Estetico Avanzato', 'Ristorante Gourmet Irpino'.\n\nTesto: {content[:1000]}"
            industry = await ai_service._call_ai("anthropic/claude-3-7-sonnet", [{"role": "user", "content": prompt}], temperature=0)
            industry = industry.strip().strip('"').strip("'")

        metadata["industry"] = industry
        storage_service.save_metadata(client_id, metadata)
        
        return {"industry": industry}
    except Exception as e:
        print(f"Industry extraction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/clients/{client_id}/logo")
async def delete_logo(client_id: str):
    try:
        metadata = storage_service.get_metadata(client_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")
    
    logo_filename = metadata.get("brand_identity", {}).get("logo", "")
    if logo_filename:
        logo_path = CLIENTS_DIR / client_id / "brand" / logo_filename
        if logo_path.exists():
            logo_path.unlink()
        storage_service.delete_logo_from_supabase(client_id, logo_filename)

    metadata["brand_identity"]["logo"] = ""
    storage_service.save_metadata(client_id, metadata)
    return {"message": "Logo deleted"}

@app.post("/clients/{client_id}/upload")
async def upload_file(client_id: str, file: UploadFile = File(...)):
    content = await file.read()
    storage_service.save_file(client_id, file.filename, content)
    return {"message": f"File {file.filename} uploaded successfully"}

@app.post("/clients/{client_id}/files")
async def upload_multiple_files(client_id: str, files: List[UploadFile] = File(...)):
    uploaded = []
    for file in files:
        content = await file.read()
        storage_service.save_file(client_id, file.filename, content)
        uploaded.append(file.filename)
    return {"message": f"Uploaded {len(uploaded)} files", "files": uploaded}

@app.get("/clients/{client_id}/files")
async def list_files(client_id: str):
    return storage_service.list_files(client_id)

@app.delete("/clients/{client_id}/files/{filename}")
async def delete_file(client_id: str, filename: str):
    try:
        storage_service.delete_file(client_id, filename)
        return {"message": f"File {filename} deleted"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

@app.get("/clients/{client_id}/research")
async def get_research(client_id: str):
    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    if not research_path.exists():
        return {"content": ""}
    with open(research_path, "r") as f:
        return {"content": f.read()}

@app.put("/clients/{client_id}/research")
async def update_research(client_id: str, update: ResearchUpdate):
    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    research_path.parent.mkdir(parents=True, exist_ok=True)
    with open(research_path, "w") as f:
        f.write(update.content)
    storage_service.sync_research(client_id, update.content)
    return {"message": "Research updated"}

class SWOTUpdate(BaseModel):
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    opportunities: Optional[str] = None
    threats: Optional[str] = None

class LinksUpdate(BaseModel):
    links: List[StructuredLink]

class CompetitorsUpdate(BaseModel):
    competitors: List[Competitor]

@app.post("/clients/{client_id}/research")
async def perform_research(client_id: str, request: ResearchRequest = ResearchRequest()):
    try:
        metadata = storage_service.get_metadata(client_id)
        
        print(f"DEBUG: Starting research for {client_id}")
        
        # --- AUTOMATED DEEP RESEARCH (META / INSTAGRAM INTEGRATION) ---
        ig_data_context = ""
        ig_token = os.getenv("META_ACCESS_TOKEN")

        # Collect Instagram handles from client links AND all competitor links
        client_ig_handles = [
            (extract_ig_handle(l.get('url', '')), "cliente")
            for l in metadata.get('links', [])
            if 'instagram.com' in l.get('url', '').lower()
        ]
        competitor_ig_handles = [
            (extract_ig_handle(cl.get('url', '')), f"competitor: {comp.get('name','')}")
            for comp in metadata.get('competitors', [])
            for cl in comp.get('links', [])
            if 'instagram.com' in cl.get('url', '').lower()
        ]
        all_handles = [(h, label) for h, label in client_ig_handles + competitor_ig_handles if h]

        if all_handles and ig_token:
            print(f"DEBUG: IG research for {len(all_handles)} accounts: {[h for h,_ in all_handles]}")

            # Find OUR IG Business Account ID once (reused for all Business Discovery calls)
            ig_user_id = None
            try:
                async with httpx.AsyncClient(timeout=20.0) as hc:
                    pages = (await hc.get(
                        "https://graph.facebook.com/v19.0/me/accounts",
                        params={"access_token": ig_token}
                    )).json().get("data", [])
                    for page in pages:
                        ig_resp = (await hc.get(
                            f"https://graph.facebook.com/v19.0/{page['id']}",
                            params={"fields": "instagram_business_account", "access_token": ig_token}
                        )).json()
                        if "instagram_business_account" in ig_resp:
                            ig_user_id = ig_resp["instagram_business_account"]["id"]
                            break
            except Exception as e:
                print(f"DEBUG: Failed to find IG user ID: {e}")

            async def fetch_ig_account(handle: str, label: str) -> dict:
                """Fetches IG account data via Business Discovery. Returns dict with all data."""
                result = {"handle": handle, "label": label, "followers": 0, "comments_collected": 0, "text": ""}
                if not ig_user_id:
                    return result
                try:
                    async with httpx.AsyncClient(timeout=30.0) as hc:
                        disc = (await hc.get(
                            f"https://graph.facebook.com/v19.0/{ig_user_id}",
                            params={
                                "fields": f"business_discovery.username({handle}){{followers_count,media_count,biography,media{{id,caption,like_count,comments_count,timestamp,media_type}}}}",
                                "access_token": ig_token,
                            }
                        )).json()

                    if "error" in disc:
                        print(f"DEBUG: Business Discovery error for @{handle}: {disc['error'].get('message')}")
                        return result

                    ig_data = disc.get("business_discovery", {})
                    followers = ig_data.get("followers_count", 0)
                    media_count = ig_data.get("media_count", 0)
                    bio = ig_data.get("biography", "")
                    posts = ig_data.get("media", {}).get("data", [])

                    total_eng = sum(p.get("like_count", 0) + p.get("comments_count", 0) for p in posts)
                    avg_eng_rate = round((total_eng / len(posts) / followers * 100), 2) if posts and followers else 0

                    block = (
                        f"\n{'='*60}\n"
                        f"📊 ACCOUNT: @{handle} [{label.upper()}]\n"
                        f"Follower: {followers:,} | Post totali: {media_count} | "
                        f"Engagement Rate medio: {avg_eng_rate}%\n"
                        f"Bio: {bio}\n\nTOP POST (engagement più alto):\n"
                    )

                    # Sort posts by engagement to show the best ones first
                    sorted_posts = sorted(posts, key=lambda p: p.get("like_count", 0) + p.get("comments_count", 0), reverse=True)
                    for p in sorted_posts[:6]:
                        caption_preview = (p.get("caption", "") or "")[:150]
                        block += (
                            f"  [{p.get('timestamp','')[:10]}] {p.get('media_type','?')} | "
                            f"❤️ {p.get('like_count',0):,} likes | 💬 {p.get('comments_count',0)} commenti\n"
                            f"  Caption: {caption_preview}\n"
                        )

                    # Fetch comment text from top 5 posts in parallel
                    async def fetch_comments(p: dict) -> tuple:
                        m_id = p.get("id")
                        if not m_id:
                            return p, []
                        try:
                            async with httpx.AsyncClient(timeout=15.0) as hc:
                                data = (await hc.get(
                                    f"https://graph.facebook.com/v19.0/{m_id}/comments",
                                    params={"fields": "text,like_count", "access_token": ig_token, "limit": 30}
                                )).json().get("data", [])
                            return p, data
                        except Exception:
                            return p, []

                    comments_results = await asyncio.gather(*[fetch_comments(p) for p in sorted_posts[:5]])
                    comments_collected = 0
                    for post, comm_data in comments_results:
                        if comm_data:
                            block += f"\n  💬 COMMENTI POST (❤️{post.get('like_count',0)} likes):\n"
                            for c in comm_data[:25]:
                                text = c.get("text", "").strip()
                                if text:
                                    block += f"    - \"{text}\"\n"
                                    comments_collected += 1

                    result["followers"] = followers
                    result["comments_collected"] = comments_collected
                    result["text"] = block
                    return result

                except Exception as e:
                    print(f"DEBUG: fetch_ig_account error for @{handle}: {e}")
                    return result

            # Fetch all known accounts in parallel — collect results to reuse for threshold check
            accounts_results = await asyncio.gather(*[fetch_ig_account(h, l) for h, l in all_handles])
            total_followers_check = 0
            total_comments_check = 0
            for account_data in accounts_results:
                ig_data_context += account_data["text"]
                total_followers_check += account_data["followers"]
                total_comments_check += account_data["comments_collected"]

            # --- FALLBACK: se i dati sono scarsi, cerca account leader nello stesso settore ---
            FOLLOWER_THRESHOLD = 8000
            COMMENT_THRESHOLD = 20
            if total_followers_check < FOLLOWER_THRESHOLD or total_comments_check < COMMENT_THRESHOLD:
                print(f"DEBUG: Insufficient data (followers={total_followers_check}, comments={total_comments_check}). Searching for niche leaders...")
                industry = metadata.get("industry", "") or metadata.get("name", "")
                try:
                    niche_prompt = (
                        f"Settore del cliente: {industry}. Cliente: {metadata.get('name','')}.\n"
                        f"Dammi esattamente 5 handle Instagram (@username) di account pubblici ITALIANI "
                        f"con molti follower (minimo 20k) in questo stesso settore/nicchia. "
                        f"Devono essere account reali, attivi, con molti commenti sui post. "
                        f"Rispondi SOLO con una lista JSON di handle senza @ es: [\"account1\",\"account2\",...]. "
                        f"Zero spiegazioni, solo il JSON."
                    )
                    handles_str = await ai_service._call_ai(
                        "perplexity/sonar",
                        [{"role": "user", "content": niche_prompt}]
                    )
                    niche_handles = json_repair.loads(handles_str)
                    if isinstance(niche_handles, list):
                        ig_data_context += f"\n\n{'='*60}\n⚡ ACCOUNT LEADER DI SETTORE (ricerca allargata — stessa nicchia, più follower):\n"
                        already_done = {h for h, _ in all_handles}
                        new_handles = [nh.strip().lstrip("@") for nh in niche_handles[:5] if nh.strip().lstrip("@") and nh.strip().lstrip("@") not in already_done]
                        print(f"DEBUG: Fetching {len(new_handles)} niche leaders in parallel: {new_handles}")
                        leader_results = await asyncio.gather(*[fetch_ig_account(nh, "leader di settore") for nh in new_handles])
                        for leader_data in leader_results:
                            ig_data_context += leader_data["text"]
                except Exception as e:
                    print(f"DEBUG: Niche leader search failed: {e}")

        raw_content = storage_service.get_raw_data_content(client_id)

        # AIService now returns a DICT directly — pass social data separately
        research_data = await ai_service.perform_market_research(
            metadata, raw_content, request.user_prompt, ig_data_context
        )
        
    except Exception as e:
        error_msg = str(e)
        if "402 Payment Required" in error_msg:
            return {"error": "Crediti API esauriti (402 Payment Required). Ricarica il tuo account OpenRouter per continuare."}
        return {"error": f"Errore di connessione API AI: {error_msg}"}
    
    try:
        # Distribute data into metadata
        metadata["strategy"] = research_data.get("strategy", metadata.get("strategy", ""))
        metadata["industry"] = research_data.get("industry", metadata.get("industry", ""))
        
        # Merge personas
        personas = research_data.get("buyer_personas", [])
        if isinstance(personas, list):
            metadata["brand_identity"]["buyer_personas"] = personas
        
        # Handle tone
        tone_label = research_data.get("suggested_tone", "naturale")
        tone_details = research_data.get("tone_description", "")
        metadata["brand_identity"]["tone"] = f"{tone_label}: {tone_details}" if tone_details else tone_label
        metadata["preferences"]["tone"] = metadata["brand_identity"]["tone"] # Sync
        
        if "target_vocabulary" in research_data:
            metadata["preferences"]["target_vocabulary"] = research_data["target_vocabulary"]

        if "audience_pain_points" in research_data:
            metadata["preferences"]["audience_pain_points"] = research_data["audience_pain_points"]

        if "top_content_patterns" in research_data:
            metadata["preferences"]["top_content_patterns"] = research_data["top_content_patterns"]

        storage_service.save_metadata(client_id, metadata)

        # Save the research text as markdown file — append extra fields for future AI use
        research_text = research_data.get("research_text", "Errore generazione testo")
        pain_points = research_data.get("audience_pain_points", [])
        content_patterns = research_data.get("top_content_patterns", [])
        vocab = research_data.get("target_vocabulary", [])

        extra_sections = ""
        if pain_points:
            extra_sections += "\n\n---\n## DOLORI REALI DEL TARGET (da commenti/dati reali)\n" + "\n".join(f"- {p}" for p in pain_points)
        if content_patterns:
            extra_sections += "\n\n---\n## PATTERN CONTENUTO AD ALTO ENGAGEMENT\n" + "\n".join(f"- {p}" for p in content_patterns)
        if vocab:
            extra_sections += "\n\n---\n## VOCABOLARIO REALE DEL TARGET\n" + "\n".join(f"- {v}" for v in vocab)

        full_research_text = research_text + extra_sections

        research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
        research_path.parent.mkdir(parents=True, exist_ok=True)
        with open(research_path, "w") as f:
            f.write(full_research_text)
        storage_service.sync_research(client_id, full_research_text)

        return {"research": full_research_text, "data": research_data}
        
    except Exception as e:
        print(f"RESEARCH HANDLER ERROR: {str(e)}")
        return {"error": f"Errore Elaborazione Dati: {str(e)}"}

@app.patch("/clients/{client_id}/swot")
async def update_swot(client_id: str, update: SWOTUpdate):
    metadata = storage_service.get_metadata(client_id)
    if "swot" not in metadata:
        metadata["swot"] = {}
    for key, value in update.dict(exclude_unset=True).items():
        metadata["swot"][key] = value
    storage_service.save_metadata(client_id, metadata)
    return metadata["swot"]

@app.put("/clients/{client_id}/strategy")
async def put_strategy(client_id: str, update: ResearchUpdate):
    metadata = storage_service.get_metadata(client_id)
    metadata["strategy"] = update.content
    storage_service.save_metadata(client_id, metadata)
    return {"strategy": metadata["strategy"]}

@app.put("/clients/{client_id}/objectives")
async def put_objectives(client_id: str, update: ResearchUpdate):
    metadata = storage_service.get_metadata(client_id)
    metadata["objectives"] = update.content
    storage_service.save_metadata(client_id, metadata)
    return {"objectives": metadata["objectives"]}

@app.post("/clients/{client_id}/deep-analysis")
async def run_deep_analysis(client_id: str):
    """Re-generates SWOT, buyer personas, tone, objectives and strategy from existing research."""
    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    if not research_path.exists():
        raise HTTPException(status_code=400, detail="Perform research first before running deep analysis")
    
    with open(research_path, "r") as f:
        research_text = f.read()
    
    metadata = storage_service.get_metadata(client_id)
    
    try:
        target_vocab = metadata.get("preferences", {}).get("target_vocabulary", [])
        analysis = await ai_service.generate_deep_analysis(research_text, metadata, target_vocabulary=target_vocab)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
    
    # Update metadata with analysis results
    if "swot" in analysis:
        metadata["swot"] = analysis["swot"]
    
    if "buyer_personas" in analysis and isinstance(analysis["buyer_personas"], list):
        # MERGE LOGIC: Don't overwrite. Append new ones if the name doesn't exist.
        if "brand_identity" not in metadata: metadata["brand_identity"] = {}
        existing = metadata["brand_identity"].get("buyer_personas", [])
        
        # Track names to avoid exact duplicates
        existing_names = {p.get("name", "").lower() for p in existing}
        
        new_count = 0
        for p in analysis["buyer_personas"]:
            name = p.get("name", "")
            if name.lower() not in existing_names:
                existing.append(p)
                new_count += 1
        
        metadata["brand_identity"]["buyer_personas"] = existing
        print(f"Deep Analysis: Added {new_count} new personas, preserved {len(existing) - new_count} existing.")

    if "tone" in analysis:
        metadata["brand_identity"]["tone"] = analysis["tone"]
        metadata["preferences"]["tone"] = analysis["tone"]
    if "objectives" in analysis:
        metadata["objectives"] = analysis["objectives"]
    if "strategy" in analysis:
        metadata["strategy"] = analysis["strategy"]
    
    storage_service.save_metadata(client_id, metadata)
    return {"analysis": analysis, "metadata": metadata}

class PersonaSpecificaRequest(BaseModel):
    target_service: str

@app.post("/clients/{client_id}/personas-specifiche")
async def create_specific_personas(client_id: str, req: PersonaSpecificaRequest):
    """Genera buyer personas specifiche per un servizio mirato usando Perplexity."""
    try:
        # Load fresh metadata
        metadata = storage_service.get_metadata(client_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    client_name = metadata.get("name", "")
    sector = metadata.get("brand_identity", {}).get("tone", "")
    
    prompt = f"""Sei un esperto di marketing strategico e buyer personas. Utilizza le tue capacità di ricerca web per analizzare il mercato attuale.
    
Il cliente è: {client_name}
Contesto/Settore: {sector}

COMPITO: Genera 2 buyer personas ESTREMAMENTE SPECIFICHE per il seguente servizio/problema:
"{req.target_service}"

Per OGNI persona, fornisci una struttura completa e approfondita:
- "name": Nome e Cognome fittizio realistico italiano
- "type": Etichetta del tipo di persona (es: "Il manager stressato", "La studentessa con acne tardiva")
- "profile": Descrizione dettagliata (situazione, stile di vita, perché cerca questo servizio ora)
- "buying_habits": Abitudini d'acquisto (come sceglie, cosa guarda prima, canali preferiti)
- "fears": Le paure più grandi, le obiezioni, i blocchi emotivi legati a "{req.target_service}"
- "desires": I desideri profondi e la trasformazione finale cercata
- "critical_info": Info indispensabile per la strategia (trigger, piattaforme, messaggi chiave)

IMPORTANTE: Sii CHIRURGICO. Sfrutta la tua capacità di ricerca web per trovare insight reali. Non dare profili generici.
Rispondi SOLO con un JSON array valido, senza markdown:
[
  {{
    "name": "...",
    "type": "...",
    "profile": "...",
    "buying_habits": "...",
    "fears": "...",
    "desires": "...",
    "critical_info": "..."
  }}
]"""

    try:
        response = await ai_service._call_ai(
            model="perplexity/sonar",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=4000
        )
        
        import json_repair
        # Clean response from potential markdown fences if perplexity adds them
        clean_response = response.strip()
        if "```" in clean_response:
             import re
             match = re.search(r'```(?:json)?\s*(.*?)\s*```', clean_response, re.DOTALL)
             if match:
                 clean_response = match.group(1)
        
        personas = json_repair.loads(clean_response)
        if not isinstance(personas, list):
            personas = [personas]
        
        # Tag each persona with the target service
        for p in personas:
            p["servizio_specifico"] = req.target_service
        
        # Robust Merging
        if "brand_identity" not in metadata or not isinstance(metadata["brand_identity"], dict):
            metadata["brand_identity"] = {}
        
        existing = metadata["brand_identity"].get("buyer_personas", [])
        if not isinstance(existing, list):
            existing = []
            
        # Add new personas
        existing.extend(personas)
        metadata["brand_identity"]["buyer_personas"] = existing
        
        storage_service.save_metadata(client_id, metadata)
        return metadata
        
    except Exception as e:
        print(f"Error generating specific personas: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
        
    except Exception as e:
        print(f"Error generating specific personas: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

@app.patch("/clients/{client_id}/links")
async def update_links(client_id: str, update: LinksUpdate):
    metadata = storage_service.get_metadata(client_id)
    metadata["links"] = [l.dict() for l in update.links]
    storage_service.save_metadata(client_id, metadata)
    return metadata["links"]

class IndustryUpdate(BaseModel):
    industry: str

@app.patch("/clients/{client_id}/industry")
async def update_industry(client_id: str, update: IndustryUpdate):
    metadata = storage_service.get_metadata(client_id)
    metadata["industry"] = update.industry
    storage_service.save_metadata(client_id, metadata)
    return {"industry": metadata["industry"]}

@app.patch("/clients/{client_id}/competitors")
async def update_competitors(client_id: str, update: CompetitorsUpdate):
    metadata = storage_service.get_metadata(client_id)
    metadata["competitors"] = [c.dict() for c in update.competitors]
    storage_service.save_metadata(client_id, metadata)
    return metadata["competitors"]

class AdAccountUpdate(BaseModel):
    ad_account_id: str

@app.patch("/clients/{client_id}/ad-account")
async def update_ad_account(client_id: str, update: AdAccountUpdate):
    metadata = storage_service.get_metadata(client_id)
    metadata["ad_account_id"] = update.ad_account_id.strip()
    storage_service.save_metadata(client_id, metadata)
    return {"ad_account_id": metadata["ad_account_id"]}

@app.get("/clients/{client_id}/meta-ads-insights")
async def fetch_meta_ads_insights(client_id: str, date_preset: str = "last_30d", since: str = "", until: str = ""):
    metadata = storage_service.get_metadata(client_id)
    ad_account_id = metadata.get("ad_account_id", "").strip()
    if not ad_account_id:
        raise HTTPException(status_code=400, detail="Ad Account ID non configurato per questo cliente. Aggiungilo nella sezione Sorgenti.")

    token = os.getenv("META_ACCESS_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="META_ACCESS_TOKEN non trovato nel file .env")

    # Ensure act_ prefix
    if not ad_account_id.startswith("act_"):
        ad_account_id = f"act_{ad_account_id}"

    fields = "spend,cpm,ctr,cpc,cpp,impressions,reach,actions,cost_per_action_type"
    url = f"https://graph.facebook.com/v19.0/{ad_account_id}/insights"

    async with httpx.AsyncClient(timeout=30.0) as client:
        params: dict = {
            "fields": fields,
            "level": "account",
            "access_token": token,
        }
        if since and until:
            import json as _json
            params["time_range"] = _json.dumps({"since": since, "until": until})
        else:
            params["date_preset"] = date_preset
        resp = await client.get(url, params=params)

    if resp.status_code != 200:
        error_msg = resp.json().get("error", {}).get("message", resp.text[:200])
        raise HTTPException(status_code=resp.status_code, detail=f"Meta Ads API error: {error_msg}")

    data = resp.json().get("data", [])
    if not data:
        raise HTTPException(status_code=404, detail="Nessun dato trovato per questo periodo. Verifica che l'Ad Account abbia campagne attive.")

    row = data[0]

    # Extract purchase conversions from actions list
    actions = row.get("actions", [])
    purchase_action = next((a for a in actions if a.get("action_type") in ("purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase")), None)
    conversioni = purchase_action["value"] if purchase_action else ""

    # Extract CPA from cost_per_action_type
    cpa_actions = row.get("cost_per_action_type", [])
    cpa_action = next((a for a in cpa_actions if a.get("action_type") in ("purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase")), None)
    cpa = round(float(cpa_action["value"]), 2) if cpa_action else ""

    return {
        "budget_speso": round(float(row.get("spend", 0)), 2) if row.get("spend") else "",
        "cpm": round(float(row.get("cpm", 0)), 2) if row.get("cpm") else "",
        "ctr": round(float(row.get("ctr", 0)), 2) if row.get("ctr") else "",
        "cpc": round(float(row.get("cpc", 0)), 2) if row.get("cpc") else "",
        "cpa": str(cpa) if cpa else "",
        "impressions": row.get("impressions", ""),
        "reach": row.get("reach", ""),
        "conversioni": conversioni,
        "date_preset": date_preset,
    }


# ══════════════════════════════════════════════════════════
#  LIVE ADS — BM overview + campaign breakdown + AI analysis
# ══════════════════════════════════════════════════════════

def _meta_extract_conversions(actions: list) -> int:
    purchase = next((a for a in (actions or []) if a.get("action_type") in ("purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase")), None)
    return int(float(purchase["value"])) if purchase else 0

def _meta_extract_cpa(cpa_list: list) -> Optional[float]:
    item = next((a for a in (cpa_list or []) if a.get("action_type") in ("purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase")), None)
    return round(float(item["value"]), 2) if item else None

ANDROMEDA_EXPERT_KNOWLEDGE = """
## COME FUNZIONA ANDROMEDA (fatti tecnici reali — deploy globale ottobre 2024)
- Sistema di retrieval basato su embedding: mappa utenti, contesti e ads in uno spazio vettoriale ad alta dimensione.
- 10.000x più complesso dei sistemi precedenti; usa chip NVIDIA Grace Hopper e MTIA di Meta.
- Processo a 3 stadi: (1) Retrieval via embedding similarity → shortlist di migliaia di ads; (2) Ranking: predizione di azione utente; (3) Asta finale.
- Se il tuo ad non supera il retrieval (embedding similarity bassa), non entra MAI nell'asta — indipendentemente dal bid o dal targeting.
- Segnali comportamentali: quanto l'utente si ferma su un post, quali video rivede, chi messaggia dopo aver visto qualcosa, pattern di acquisto, interazioni cross-platform (FB + IG + WhatsApp).
- IMPLICAZIONE CRITICA: La rilevanza della creatività (non il targeting demografico) determina la visibilità. La stessa audience vede ads completamente diversi in base al profilo comportamentale.

## STRUTTURA CAMPAGNA OTTIMALE PER ANDROMEDA (2025)
- 1 campagna per obiettivo (1 Sales, 1 Lead Gen — non di più).
- 1-3 ad set massimo per campagna (non 5-10).
- 10-40 creatività per ad set — la diversità creativa è il nuovo targeting.
- CBO (Advantage Campaign Budget): Meta distribuisce il budget in real-time tra gli ad set.
- Broad targeting: nessuna restrizione di interesse, età, genere — lascia che Andromeda trovi il pubblico via embedding.
- Evidenza: 1 ad set con 25 creatività outperforma 5 ad set con 5 creatività ciascuno di +17% conversioni e -16% costi.

## FASE DI APPRENDIMENTO (aggiornato 2025)
- Soglia ufficiale: 50 eventi di ottimizzazione per ad set in 7 giorni per uscire dalla learning phase.
- Budget minimo reale = (CPA obiettivo × 50) ÷ 7 giorni. Es: CPA €30 → serve €214/giorno minimo.
- NOVITÀ 2025: Aggiungere nuove creatività a campagne già in apprendimento NON riavvia più la learning phase completamente.
- Aumenti di budget fino a €179/giorno non riavviano il learning; oltre quella soglia rischi un reset parziale.
- Aspetta 3-4 giorni tra un aumento e il successivo; aumenta al massimo del 15-20% alla volta.
- ERRORE COMUNE: Uccidere campagne a 2-3 giorni durante la volatilità normale della learning phase.

## PERCHÉ LE CAMPAGNE SI "ROMPONO" DOPO 2-3 GIORNI
1. Volatilità learning phase (normale): CPA/ROAS oscillano molto nei primi 7 giorni — non toccare nulla.
2. Creative fatigue (causa più comune): Con Andromeda la fatigue arriva 35% prima rispetto ai sistemi precedenti. Fatigue reale: 10-21 giorni per campagne standard, 5-7 giorni per retargeting. NON si vede sempre dalla frequenza — molte ads fatigate hanno frequenza 2.0-2.5 apparentemente "ok".
3. Budget frammentato: Budget diviso su molti ad set → ogni ad set troppo debole per imparare.
4. Modifiche frequenti: Ogni cambio nei primi 7 giorni resetta l'apprendimento.
5. Saturazione audience: Con targeting stretto, esaurisci il pool disponibile in pochi giorni.
Soluzioni: Non pausare/duplicare (crea un nuovo ciclo di learning da zero). Se fatigue: aggiungi 2-3 creatività strutturalmente diverse. Se fragmentation: consolida ad set. Se learning volatility: aspetta 7 giorni. Se saturazione: passa a broad targeting.

## ADVANTAGE+ E ASC IN 2025
- Tutte le campagne di vendita sono essenzialmente Advantage+/ASC ora — è diventata la struttura default di Meta.
- Advantage+ Sales supporta fino a 50 ads per ad set, più ad set per campagna, basic audience preferences.
- Meta sta progressivamente eliminando le campagne manuali per la maggior parte degli obiettivi.
- Dati interni Meta aprile 2025: campagne con full Advantage+ automation → 12% costi per acquisto più bassi, 17% ROAS più alto.

## CREATIVITÀ: IL VERO DRIVER
- 4+ formati creativi unici in un ad set → +32% performance.
- Diversità strutturale necessaria: video (varie lunghezze), statico, carousel, UGC, demo prodotto, testimonial.
- Meta considera due ads "simili" se i primi 3 secondi sono identici — hook diversi sono obbligatori.
- Rotazione proattiva ogni 7-10 giorni (non aspettare i segnali di fatigue).
- UGC e product demo sono i format più efficaci nel 2025.

## TARGETING BROAD vs STRETTO
- Targeting broad = paese intero, nessun interesse, nessuna restrizione età/genere — è ora la best practice ufficiale Meta.
- Andromeda trova il pubblico giusto via embedding similarity alla creatività, non via targeting impostato.
- Targeting stretto: satura l'audience, rallenta il learning, va contro il funzionamento di Andromeda.

## CPM E ASTA (2025)
- CPM medio Q1 2025: €10.88 (+19.2% YoY).
- Alta embedding similarity → CPM più basso; bassa similarity → CPM più alto.
- Creatività migliore = costi inferiori oltre che performance migliori.

## CBO vs ABO
- CBO: consigliato per campagne con ads vincenti da scalare.
- ABO: utile solo nella fase di test/validazione di nuove creatività (7-14 giorni), poi migra i vincitori su CBO.
"""

@app.get("/live-ads/overview")
async def get_live_ads_overview(date_preset: str = "last_30d", since: str = "", until: str = ""):
    token = os.getenv("META_ACCESS_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="META_ACCESS_TOKEN non trovato nel file .env")

    all_clients = storage_service.list_clients()
    clients_with_ads = [(c, storage_service.get_metadata(c["id"])) for c in all_clients]
    clients_with_ads = [(c, m) for c, m in clients_with_ads if m.get("ad_account_id", "").strip()]

    if not clients_with_ads:
        return {"clients": [], "totals": {}, "period": date_preset}

    async def fetch_account_summary(client: dict, metadata: dict) -> dict:
        base = {"client_id": client["id"], "name": client["name"]}
        ad_id = metadata["ad_account_id"].strip()
        if not ad_id.startswith("act_"):
            ad_id = f"act_{ad_id}"
        try:
            overview_params: dict = {
                "fields": "spend,impressions,reach,clicks,ctr,cpc,cpm,actions,cost_per_action_type",
                "access_token": token,
            }
            if since and until:
                import json as _json
                overview_params["time_range"] = _json.dumps({"since": since, "until": until})
            else:
                overview_params["date_preset"] = date_preset
            async with httpx.AsyncClient(timeout=30.0) as hc:
                resp = await hc.get(
                    f"https://graph.facebook.com/v19.0/{ad_id}/insights",
                    params=overview_params
                )
            data = resp.json()
            if "error" in data:
                return {**base, "error": data["error"].get("message", "API error")}
            rows = data.get("data", [])
            if not rows:
                return {**base, "error": "Nessun dato per questo periodo"}
            row = rows[0]
            actions = row.get("actions", [])
            purchase = next((a for a in actions if a["action_type"] in ("purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase")), None)
            cpa_list = row.get("cost_per_action_type", [])
            cpa_item = next((a for a in cpa_list if a["action_type"] in ("purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase")), None)
            return {
                **base,
                "ad_account_id": ad_id,
                "spend": round(float(row.get("spend") or 0), 2),
                "impressions": int(row.get("impressions") or 0),
                "reach": int(row.get("reach") or 0),
                "clicks": int(row.get("clicks") or 0),
                "ctr": round(float(row.get("ctr") or 0), 2),
                "cpc": round(float(row.get("cpc") or 0), 2),
                "cpm": round(float(row.get("cpm") or 0), 2),
                "conversioni": int(float(purchase["value"])) if purchase else 0,
                "cpa": round(float(cpa_item["value"]), 2) if cpa_item else None,
            }
        except Exception as e:
            return {**base, "error": str(e)}

    results = await asyncio.gather(*[fetch_account_summary(c, m) for c, m in clients_with_ads])
    valid = [r for r in results if "error" not in r]
    totals = {
        "spend": round(sum(r["spend"] for r in valid), 2),
        "impressions": sum(r["impressions"] for r in valid),
        "reach": sum(r["reach"] for r in valid),
        "clicks": sum(r["clicks"] for r in valid),
        "conversioni": sum(r["conversioni"] for r in valid),
        "ctr": round(sum(r["ctr"] for r in valid) / len(valid), 2) if valid else 0,
        "cpm": round(sum(r["cpm"] for r in valid) / len(valid), 2) if valid else 0,
    }
    return {"clients": list(results), "totals": totals, "period": date_preset}


@app.get("/live-ads/campaigns/{client_id}")
async def get_client_campaigns(client_id: str, date_preset: str = "last_30d", since: str = "", until: str = ""):
    metadata = storage_service.get_metadata(client_id)
    ad_id = metadata.get("ad_account_id", "").strip()
    if not ad_id:
        raise HTTPException(status_code=400, detail="Ad Account ID non configurato per questo cliente")
    token = os.getenv("META_ACCESS_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="META_ACCESS_TOKEN non trovato nel file .env")
    if not ad_id.startswith("act_"):
        ad_id = f"act_{ad_id}"

    camp_params: dict = {
        "fields": "campaign_name,campaign_id,spend,impressions,reach,clicks,ctr,cpc,cpm,actions,cost_per_action_type",
        "level": "campaign",
        "filtering": json.dumps([{"field": "campaign.effective_status", "operator": "IN", "value": ["ACTIVE"]}]),
        "access_token": token,
    }
    if since and until:
        import json as _json
        camp_params["time_range"] = _json.dumps({"since": since, "until": until})
    else:
        camp_params["date_preset"] = date_preset

    async with httpx.AsyncClient(timeout=30.0) as hc:
        resp = await hc.get(
            f"https://graph.facebook.com/v19.0/{ad_id}/insights",
            params=camp_params
        )
    data = resp.json()
    if "error" in data:
        raise HTTPException(status_code=400, detail=data["error"].get("message", "Meta API error"))

    campaigns = []
    for row in data.get("data", []):
        actions = row.get("actions", [])
        purchase = next((a for a in actions if a["action_type"] in ("purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase")), None)
        cpa_list = row.get("cost_per_action_type", [])
        cpa_item = next((a for a in cpa_list if a["action_type"] in ("purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase")), None)
        campaigns.append({
            "campaign_id": row.get("campaign_id"),
            "campaign_name": row.get("campaign_name", "—"),
            "spend": round(float(row.get("spend") or 0), 2),
            "impressions": int(row.get("impressions") or 0),
            "reach": int(row.get("reach") or 0),
            "clicks": int(row.get("clicks") or 0),
            "ctr": round(float(row.get("ctr") or 0), 2),
            "cpc": round(float(row.get("cpc") or 0), 2),
            "cpm": round(float(row.get("cpm") or 0), 2),
            "conversioni": int(float(purchase["value"])) if purchase else 0,
            "cpa": round(float(cpa_item["value"]), 2) if cpa_item else None,
        })
    campaigns.sort(key=lambda x: x["spend"], reverse=True)
    return {"campaigns": campaigns, "period": date_preset, "client_id": client_id}


class LiveAdsAnalysisRequest(BaseModel):
    date_preset: str = "last_30d"
    campaigns: List[dict] = []

class LiveAdsChatRequest(BaseModel):
    messages: List[dict]
    campaigns: List[dict] = []
    date_preset: str = "last_30d"

@app.post("/live-ads/analyze/{client_id}")
async def analyze_live_ads(client_id: str, request: LiveAdsAnalysisRequest):
    metadata = storage_service.get_metadata(client_id)
    if not request.campaigns:
        raise HTTPException(status_code=400, detail="Nessuna campagna da analizzare")

    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    research_context = ""
    if research_path.exists():
        with open(research_path, "r") as f:
            research_context = f.read()[:2500]

    # Load creative intelligence if available
    intel_path = CLIENTS_DIR / client_id / "creative_intelligence.json"
    creative_intel_block = ""
    if intel_path.exists():
        with open(intel_path, "r") as f:
            intel_data = json.load(f)
        creative_intel = intel_data.get("analysis", "")[:3000]
        if creative_intel:
            creative_intel_block = f"\n\nINTELLIGENCE STORICA CREATIVITÀ (analisi di {intel_data.get('ads_count', '?')} ads — periodo {intel_data.get('period', '?')}):\n{creative_intel}"

    campaigns_text = json.dumps(request.campaigns, ensure_ascii=False, indent=2)
    research_block = f"RICERCA DI MERCATO (contesto audience):\n{research_context}" if research_context else ""
    prompt = f"""Sei un esperto senior di Meta Ads. Usa questa base di conoscenza aggiornata su Andromeda per l'analisi:
{ANDROMEDA_EXPERT_KNOWLEDGE}

CLIENTE: {metadata.get('name', '')} | Settore: {metadata.get('industry', '')}
PERIODO: {request.date_preset}

DATI CAMPAGNE ATTIVE:
{campaigns_text}

{research_block}{creative_intel_block}

Analizza e rispondi SOLO con questa struttura markdown:

## 🏆 Campagne Vincenti
Per ogni campagna che performa bene: nome, metriche chiave, perché funziona secondo Andromeda.

## ⚠️ Campagne da Ottimizzare
Per ogni campagna che brucia budget: nome, problema specifico (learning phase? fatigue? fragmentation?), azione correttiva immediata.

## 🤖 Raccomandazioni Andromeda
3-5 azioni concrete basate su come funziona l'algoritmo Meta oggi. Sii specifico per questi numeri — niente consigli generici.

## 🎯 Angoli e Hook che Funzionano
In base ai dati e alla storia delle creatività (se disponibile), che tipo di creatività/messaggio sta vincendo? Suggerisci 3 variazioni di angolo per scalare.

## ✅ Prossimi 7 Giorni — Piano d'Azione
Lista prioritizzata di 5 azioni concrete (con budget suggerito se pertinente).

Sii diretto, pratico, specifico per questi numeri."""

    analysis = await ai_service._call_ai(
        "anthropic/claude-sonnet-4-5",
        [{"role": "user", "content": prompt}]
    )
    return {"analysis": analysis, "client_id": client_id, "period": request.date_preset}


@app.post("/live-ads/chat/{client_id}")
async def chat_live_ads(client_id: str, request: LiveAdsChatRequest):
    metadata = storage_service.get_metadata(client_id)
    if not request.messages:
        raise HTTPException(status_code=400, detail="Nessun messaggio nella conversazione")

    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    research_context = ""
    if research_path.exists():
        with open(research_path, "r") as f:
            research_context = f.read()[:2500]

    # Load creative intelligence if available
    intel_path = CLIENTS_DIR / client_id / "creative_intelligence.json"
    creative_intel_block = ""
    if intel_path.exists():
        with open(intel_path, "r") as f:
            intel_data = json.load(f)
        creative_intel = intel_data.get("analysis", "")[:3000]
        if creative_intel:
            creative_intel_block = f"\n\nINTELLIGENCE STORICA CREATIVITÀ (analisi di {intel_data.get('ads_count', '?')} ads — periodo {intel_data.get('period', '?')}):\n{creative_intel}"

    campaigns_text = json.dumps(request.campaigns, ensure_ascii=False, indent=2) if request.campaigns else "Nessun dato campagna disponibile."
    research_block = f"\nRICERCA DI MERCATO (contesto audience):\n{research_context}" if research_context else ""

    system_prompt = f"""Sei un esperto senior di Meta Ads. Usa questa base di conoscenza aggiornata su Andromeda:
{ANDROMEDA_EXPERT_KNOWLEDGE}

CLIENTE: {metadata.get('name', '')} | Settore: {metadata.get('industry', '')}
PERIODO ANALIZZATO: {request.date_preset}

DATI CAMPAGNE ATTIVE:
{campaigns_text}
{research_block}{creative_intel_block}

Sei in una conversazione diretta con il marketer/imprenditore che gestisce questo cliente. Hai accesso alla storia completa delle creatività e delle campagne. Rispondi in modo conciso e pratico — applicando la conoscenza di Andromeda ai dati reali di questo account. Se ti forniscono aggiornamenti (campagna disattivata, cambio budget, nuove creatività, ecc.), adatta immediatamente i tuoi consigli. Usa emoji con parsimonia."""

    messages = [{"role": "system", "content": system_prompt}] + request.messages
    reply = await ai_service._call_ai("anthropic/claude-sonnet-4-5", messages)
    return {"message": reply, "client_id": client_id}


@app.post("/clients/{client_id}/angles")
async def get_angles(client_id: str, request: AngleRequest = AngleRequest()):
    metadata = storage_service.get_metadata(client_id)
    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    if not research_path.exists():
        raise HTTPException(status_code=400, detail="Perform research first")

    with open(research_path, "r") as f:
        research_content = f.read()

    buyer_personas = metadata.get("brand_identity", {}).get("buyer_personas", [])
    if buyer_personas:
        research_content += "\n\n### BUYER PERSONAS E PAURE PROFONDE (CRITICO DA STUDIARE):\n"
        research_content += json.dumps(buyer_personas, ensure_ascii=False, indent=2)

    # Enrich with creative intelligence from real ad performance if available
    intel_path = CLIENTS_DIR / client_id / "creative_intelligence.json"
    if intel_path.exists():
        with open(intel_path, "r") as f:
            intel_data = json.load(f)
        creative_intel = intel_data.get("analysis", "")[:2000]
        if creative_intel:
            research_content += f"\n\n### INTELLIGENCE DALLE ADS REALI ({intel_data.get('period', 'storico')}, {intel_data.get('ads_count', '?')} ads analizzate):\nQuesti dati provengono dall'analisi delle inserzioni realmente mandate in pubblicazione. Usali come FONTE PRIMARIA per capire cosa ha già funzionato e cosa no. Gli angoli vincitori reali devono guidare i nuovi angoli suggeriti:\n{creative_intel}"

    angles_data = await ai_service.generate_communication_angles(research_content, request.user_prompt, request.funnel_stage)
    
    # Save angles
    angles_path = CLIENTS_DIR / client_id / "angles.json"
    with open(angles_path, "w") as f:
        json.dump(angles_data, f, ensure_ascii=False, indent=2)
    storage_service.sync_angles(client_id, angles_data)

    return angles_data

@app.get("/clients/{client_id}/angles")
async def fetch_existing_angles(client_id: str):
    angles_path = CLIENTS_DIR / client_id / "angles.json"
    if not angles_path.exists():
        return []
    with open(angles_path, "r") as f:
        return json.load(f)


# ══════════════════════════════════════════════════════════
#  CREATIVE INTELLIGENCE — fetch ad creatives + AI analysis
# ══════════════════════════════════════════════════════════

@app.get("/live-ads/creative-intelligence/{client_id}")
async def get_creative_intelligence(client_id: str):
    intel_path = CLIENTS_DIR / client_id / "creative_intelligence.json"
    if not intel_path.exists():
        return {"analysis": None, "period": None, "generated_at": None, "ads_count": 0}
    with open(intel_path, "r") as f:
        return json.load(f)


@app.get("/live-ads/creatives/{client_id}")
async def get_ad_creatives(client_id: str, date_preset: str = "last_90d", since: str = "", until: str = ""):
    metadata = storage_service.get_metadata(client_id)
    ad_id = metadata.get("ad_account_id", "").strip()
    if not ad_id:
        raise HTTPException(status_code=400, detail="Ad Account ID non configurato per questo cliente")
    token = os.getenv("META_ACCESS_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="META_ACCESS_TOKEN non trovato nel file .env")
    if not ad_id.startswith("act_"):
        ad_id = f"act_{ad_id}"

    insights_params: dict = {
        "fields": "ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,actions,cost_per_action_type",
        "level": "ad",
        "access_token": token,
        "limit": 100,
    }
    if since and until:
        insights_params["time_range"] = json.dumps({"since": since, "until": until})
    else:
        insights_params["date_preset"] = date_preset

    async with httpx.AsyncClient(timeout=60.0) as hc:
        insights_resp = await hc.get(
            f"https://graph.facebook.com/v19.0/{ad_id}/insights",
            params=insights_params
        )
    insights_data = insights_resp.json()
    if "error" in insights_data:
        raise HTTPException(status_code=400, detail=insights_data["error"].get("message", "Meta API error"))

    ads_insights = insights_data.get("data", [])
    if not ads_insights:
        return {"ads": [], "period": date_preset, "client_id": client_id, "total_ads": 0}

    ads_insights.sort(key=lambda x: float(x.get("spend", 0) or 0), reverse=True)
    top_ads = ads_insights[:40]

    async def fetch_creative(ad_insight: dict) -> dict:
        ad_insight_id = ad_insight.get("ad_id")
        base = {
            "ad_id": ad_insight_id,
            "ad_name": ad_insight.get("ad_name", "—"),
            "adset_name": ad_insight.get("adset_name", "—"),
            "campaign_name": ad_insight.get("campaign_name", "—"),
            "spend": round(float(ad_insight.get("spend", 0) or 0), 2),
            "impressions": int(ad_insight.get("impressions", 0) or 0),
            "reach": int(ad_insight.get("reach", 0) or 0),
            "clicks": int(ad_insight.get("clicks", 0) or 0),
            "ctr": round(float(ad_insight.get("ctr", 0) or 0), 3),
            "cpc": round(float(ad_insight.get("cpc", 0) or 0), 2),
            "cpm": round(float(ad_insight.get("cpm", 0) or 0), 2),
            "conversioni": _meta_extract_conversions(ad_insight.get("actions", [])),
            "cpa": _meta_extract_cpa(ad_insight.get("cost_per_action_type", [])),
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as hc:
                creative_resp = await hc.get(
                    f"https://graph.facebook.com/v19.0/{ad_insight_id}",
                    params={
                        "fields": "creative{id,body,title,description,image_url,thumbnail_url,object_story_spec}",
                        "access_token": token,
                    }
                )
            creative_data = creative_resp.json()
            creative = creative_data.get("creative", {})
            story_spec = creative.get("object_story_spec", {})
            link_data = story_spec.get("link_data", {})
            video_data = story_spec.get("video_data", {})
            return {
                **base,
                "creative_id": creative.get("id", ""),
                "body": (creative.get("body") or link_data.get("message") or video_data.get("message", "")).strip(),
                "title": (creative.get("title") or link_data.get("name") or video_data.get("title", "")).strip(),
                "description": (creative.get("description") or link_data.get("description", "")).strip(),
                "image_url": creative.get("image_url") or link_data.get("picture", ""),
                "thumbnail_url": creative.get("thumbnail_url") or video_data.get("image_url", ""),
            }
        except Exception:
            return base

    ads_with_creatives = await asyncio.gather(*[fetch_creative(ad) for ad in top_ads])
    return {
        "ads": list(ads_with_creatives),
        "period": date_preset,
        "client_id": client_id,
        "total_ads": len(ads_insights),
    }


class CreativeAnalysisRequest(BaseModel):
    ads: List[dict] = []
    date_preset: str = "last_90d"


@app.post("/live-ads/analyze-creatives/{client_id}")
async def analyze_ad_creatives(client_id: str, request: CreativeAnalysisRequest):
    metadata = storage_service.get_metadata(client_id)
    if not request.ads:
        raise HTTPException(status_code=400, detail="Nessuna ad da analizzare")

    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    research_context = ""
    if research_path.exists():
        with open(research_path, "r") as f:
            research_context = f.read()[:2000]

    ads_sorted = sorted(request.ads, key=lambda x: float(x.get("ctr", 0) or 0), reverse=True)

    ads_text_parts = []
    for i, ad in enumerate(ads_sorted[:35], 1):
        body = (ad.get("body") or "").strip()
        title = (ad.get("title") or "").strip()
        desc = (ad.get("description") or "").strip()
        cpa_str = f"€{ad.get('cpa')}" if ad.get("cpa") else "N/D"
        lines = [
            f"AD #{i} | Campagna: {ad.get('campaign_name', '?')} | AdSet: {ad.get('adset_name', '?')}",
            f"Nome: {ad.get('ad_name', '?')}",
            f"Spend: €{ad.get('spend', 0)} | CTR: {ad.get('ctr', 0)}% | CPC: €{ad.get('cpc', 0)} | Conv: {ad.get('conversioni', 0)} | CPA: {cpa_str}",
        ]
        if title:
            lines.append(f"Headline: {title}")
        if body:
            lines.append(f"Copy: {body}")
        if desc:
            lines.append(f"Descrizione: {desc}")
        ads_text_parts.append("\n".join(lines))

    ads_text = "\n\n---\n\n".join(ads_text_parts)
    research_block = f"CONTESTO DI MERCATO:\n{research_context}\n\n" if research_context else ""

    prompt_text = f"""Sei un Senior Creative Strategist specializzato in Meta Ads, con expertise in copywriting, psicologia persuasiva e analisi delle performance creative.

CLIENTE: {metadata.get('name', '')} | Settore: {metadata.get('industry', '')}
PERIODO ANALIZZATO: {request.date_preset}

{research_block}━━━ INSERZIONI ANALIZZATE ({len(request.ads)} ads totali, ordinate per CTR) ━━━

{ads_text}

━━━ ANALISI STRATEGICA RICHIESTA ━━━
Produci un'analisi approfondita con questa struttura markdown:

## 🏆 Creatività Vincenti
Le ads con CTR/conversioni/CPA migliori. Per ognuna: angolo comunicativo usato, tipo di hook, tono, promessa principale, perché funziona psicologicamente.

## 📊 Pattern delle Ads che Funzionano
Caratteristiche comuni tra le ads top performer: stile copy (lungo/corto, formale/informale), tipo di apertura, struttura del messaggio, call-to-action usate.

## 🎯 Angoli Comunicativi Identificati
Lista degli angoli unici trovati nelle ads reali. Per ognuno: nome angolo, come viene usato, performance media (CTR/CPA). Distingui tra angoli provati e vincenti vs angoli provati ma deboli.

## ❌ Cosa Non Funziona
Pattern delle ads con CTR basso o CPA alto: perché non risuonano, quali errori comunicativi emergono.

## 💡 Raccomandazioni per Nuove Creatività
Basandoti SOLO sui dati reali:
- I 3 hook/aperture più efficaci da replicare e variare
- 3 angoli nuovi non ancora testati che potrebbero funzionare per questo cliente
- Formati da testare (video vs statico, lunghezza copy, struttura)

## 🔑 Vocabolario che Converte
Parole, frasi, strutture linguistiche trovate nelle ads vincenti che risuonano col target. Questo è il linguaggio da replicare.

## 📌 Intelligence per il Team
3-5 insight pratici e immediati che il team creativo deve conoscere per produrre nuove creatività efficaci per questo cliente.

Sii specifico. Cita le ads per nome/numero. Usa i dati reali forniti."""

    content: list = [{"type": "text", "text": prompt_text}]

    # Add thumbnails of top performing ads that have images
    ads_with_images = [ad for ad in ads_sorted[:10] if ad.get("thumbnail_url") or ad.get("image_url")][:5]
    for ad in ads_with_images:
        img_url = ad.get("thumbnail_url") or ad.get("image_url")
        if img_url:
            content.append({"type": "text", "text": f"\n[Creatività visiva — '{ad.get('ad_name', '?')}' CTR:{ad.get('ctr', 0)}%]"})
            content.append({"type": "image_url", "image_url": {"url": img_url}})

    messages = [{"role": "user", "content": content}]
    analysis = await ai_service._call_ai("anthropic/claude-3.7-sonnet", messages)

    intel_data = {
        "analysis": analysis,
        "period": request.date_preset,
        "ads_count": len(request.ads),
        "generated_at": datetime.now().isoformat(),
        "client_id": client_id,
    }
    intel_path = CLIENTS_DIR / client_id / "creative_intelligence.json"
    with open(intel_path, "w") as f:
        json.dump(intel_data, f, ensure_ascii=False, indent=2)
    storage_service.sync_creative_intelligence(client_id, intel_data)

    return intel_data


# ══════════════════════════════════════════════════════════
#  SHOPIFY — OAuth connection + data endpoints
# ══════════════════════════════════════════════════════════

SHOPIFY_CLIENT_ID = os.getenv("SHOPIFY_CLIENT_ID", "")
SHOPIFY_CLIENT_SECRET = os.getenv("SHOPIFY_CLIENT_SECRET", "")
SHOPIFY_SCOPES = "read_orders,read_all_orders,read_customers,read_analytics,read_checkouts,read_customer_events,read_reports"
SHOPIFY_REDIRECT_URI = os.getenv("SHOPIFY_REDIRECT_URI", "http://127.0.0.1:8001/shopify/callback")


@app.get("/shopify/install")
async def shopify_install(client_id: str, shop: str):
    """Avvia il flusso OAuth Shopify per un cliente specifico."""
    if not SHOPIFY_CLIENT_ID:
        raise HTTPException(status_code=500, detail="SHOPIFY_CLIENT_ID non configurato nel .env")
    # Normalize shop domain
    shop = shop.replace("https://", "").replace("http://", "").rstrip("/")
    if not shop.endswith(".myshopify.com"):
        shop = f"{shop}.myshopify.com"
    # Save shop domain to client metadata immediately
    metadata = storage_service.get_metadata(client_id)
    metadata["shopify_domain"] = shop
    storage_service.save_metadata(client_id, metadata)
    # Build OAuth URL
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": SHOPIFY_CLIENT_ID,
        "scope": SHOPIFY_SCOPES,
        "redirect_uri": SHOPIFY_REDIRECT_URI,
        "state": client_id,
    })
    auth_url = f"https://{shop}/admin/oauth/authorize?{params}"
    return RedirectResponse(url=auth_url)


@app.get("/shopify/callback")
async def shopify_callback(code: str, shop: str, state: str, hmac: str = ""):
    """Riceve il callback OAuth da Shopify e salva l'access token."""
    if not SHOPIFY_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="SHOPIFY_CLIENT_SECRET non configurato nel .env")
    client_id = state
    # Exchange code for access token
    async with httpx.AsyncClient(timeout=30.0) as hc:
        resp = await hc.post(
            f"https://{shop}/admin/oauth/access_token",
            json={
                "client_id": SHOPIFY_CLIENT_ID,
                "client_secret": SHOPIFY_CLIENT_SECRET,
                "code": code,
            }
        )
    data = resp.json()
    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail=f"Token non ricevuto: {data}")
    # Save token to client metadata
    metadata = storage_service.get_metadata(client_id)
    metadata["shopify_domain"] = shop
    metadata["shopify_token"] = access_token
    storage_service.save_metadata(client_id, metadata)
    # Redirect back to client page
    from fastapi.responses import RedirectResponse
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3001")
    return RedirectResponse(url=f"{frontend_url}/client/{client_id}?shopify=connected")


@app.get("/clients/{client_id}/shopify/orders")
async def get_shopify_orders(client_id: str, limit: int = 50, days: int = 90):
    """Recupera gli ordini recenti da Shopify per il cliente."""
    metadata = storage_service.get_metadata(client_id)
    shop = metadata.get("shopify_domain", "").strip()
    token = metadata.get("shopify_token", "").strip()
    if not shop or not token:
        raise HTTPException(status_code=400, detail="Shopify non collegato. Usa il bottone 'Connetti Shopify' nella sezione Sorgenti.")
    from datetime import timedelta
    since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")
    async with httpx.AsyncClient(timeout=30.0) as hc:
        resp = await hc.get(
            f"https://{shop}/admin/api/2024-01/orders.json",
            headers={"X-Shopify-Access-Token": token},
            params={
                "status": "any",
                "limit": limit,
                "created_at_min": since,
                "fields": "id,created_at,total_price,subtotal_price,currency,financial_status,customer,line_items,source_name,landing_site,referring_site,utm_parameters,note_attributes",
            }
        )
    data = resp.json()
    if "errors" in data:
        raise HTTPException(status_code=400, detail=str(data["errors"]))
    orders = data.get("orders", [])
    # Aggregate summary
    total_revenue = sum(float(o.get("total_price", 0)) for o in orders)
    new_customers = sum(1 for o in orders if o.get("customer", {}).get("orders_count", 1) == 1)
    returning = len(orders) - new_customers
    return {
        "orders": orders,
        "summary": {
            "total_orders": len(orders),
            "total_revenue": round(total_revenue, 2),
            "new_customers": new_customers,
            "returning_customers": returning,
            "avg_order_value": round(total_revenue / len(orders), 2) if orders else 0,
            "period_days": days,
        },
        "shop": shop,
        "client_id": client_id,
    }


@app.get("/clients/{client_id}/shopify/customers")
async def get_shopify_customers(client_id: str, limit: int = 50):
    """Recupera i clienti Shopify con dati per CAPI."""
    metadata = storage_service.get_metadata(client_id)
    shop = metadata.get("shopify_domain", "").strip()
    token = metadata.get("shopify_token", "").strip()
    if not shop or not token:
        raise HTTPException(status_code=400, detail="Shopify non collegato.")
    async with httpx.AsyncClient(timeout=30.0) as hc:
        resp = await hc.get(
            f"https://{shop}/admin/api/2024-01/customers.json",
            headers={"X-Shopify-Access-Token": token},
            params={
                "limit": limit,
                "fields": "id,email,phone,first_name,last_name,city,province,country,zip,orders_count,total_spent,created_at",
            }
        )
    data = resp.json()
    if "errors" in data:
        raise HTTPException(status_code=400, detail=str(data["errors"]))
    return {"customers": data.get("customers", []), "shop": shop}


@app.delete("/clients/{client_id}/shopify")
async def disconnect_shopify(client_id: str):
    """Rimuove la connessione Shopify dal cliente."""
    metadata = storage_service.get_metadata(client_id)
    metadata.pop("shopify_token", None)
    metadata.pop("shopify_domain", None)
    storage_service.save_metadata(client_id, metadata)
    return {"connected": False}


class ShopifyManualTokenRequest(BaseModel):
    shop: str
    access_token: str

@app.put("/clients/{client_id}/shopify/token")
async def save_shopify_token_manual(client_id: str, body: ShopifyManualTokenRequest):
    """Salva manualmente un access token Shopify (da custom app o collaborator access)."""
    shop = body.shop.replace("https://", "").replace("http://", "").rstrip("/")
    if not shop.endswith(".myshopify.com"):
        shop = shop + ".myshopify.com"
    token = body.access_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="access_token vuoto")
    # Verify the token works before saving
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            resp = await hc.get(
                f"https://{shop}/admin/api/2024-01/shop.json",
                headers={"X-Shopify-Access-Token": token},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Token non valido (HTTP {resp.status_code})")
        shop_data = resp.json().get("shop", {})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Impossibile connettersi allo store: {e}")
    metadata = storage_service.get_metadata(client_id)
    metadata["shopify_domain"] = shop
    metadata["shopify_token"] = token
    storage_service.save_metadata(client_id, metadata)
    return {
        "connected": True,
        "shop": shop,
        "shop_name": shop_data.get("name", shop),
        "currency": shop_data.get("currency", ""),
    }


@app.get("/clients/{client_id}/shopify/status")
async def get_shopify_status(client_id: str):
    """Controlla se Shopify è collegato e restituisce lo stato."""
    metadata = storage_service.get_metadata(client_id)
    shop = metadata.get("shopify_domain", "").strip()
    token = metadata.get("shopify_token", "").strip()
    if not shop or not token:
        return {"connected": False, "shop": None}
    # Quick check
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            resp = await hc.get(
                f"https://{shop}/admin/api/2024-01/shop.json",
                headers={"X-Shopify-Access-Token": token},
            )
        shop_data = resp.json().get("shop", {})
        return {
            "connected": True,
            "shop": shop,
            "shop_name": shop_data.get("name", shop),
            "currency": shop_data.get("currency", ""),
            "plan": shop_data.get("plan_name", ""),
        }
    except Exception:
        return {"connected": False, "shop": shop, "error": "Connessione fallita"}


# ── VAULT ENDPOINTS ──
class VaultSaveRequest(BaseModel):
    title: str
    text: str = ""
    funnel_stage: Optional[str] = ""
    format: Optional[str] = ""
    img_link: Optional[str] = ""

@app.post("/clients/{client_id}/vault/{vault_type}")
async def save_to_vault_endpoint(client_id: str, vault_type: str, request: VaultSaveRequest):
    if vault_type not in ["copy", "angle", "graphic"]:
        raise HTTPException(status_code=400, detail="Invalid vault type. Use 'copy', 'angle' or 'graphic'.")
        
    try:
        metadata = storage_service.get_metadata(client_id)
        from .notion_service import notion_service
        
        # Prepare basic item data
        item_data = {
            "title": request.title,
            "text": request.text,
            "client_name": metadata.get("name", ""),
            "sector": metadata.get("industry", ""),
            "funnel_stage": request.funnel_stage,
            "format": request.format,
            "img_link": request.img_link
        }
        
        if vault_type == "graphic" and request.img_link:
            # L'URL locale viene passato a notion_service.py che si occuperà
            # di caricarlo su host pubblico permanente (es. Catbox.moe)
            pass
        
        success = await notion_service.save_to_vault(vault_type, item_data)
        if success:
            return {"status": "success", "message": f"Saved to {vault_type} vault"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save to Notion Vault")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")

class ScriptRequest(BaseModel):
    title: str
    description: str = ""
    emotion: str = ""
    script_instructions: str = ""
    count: int = 1

@app.post("/clients/{client_id}/scripts")
async def generate_script_endpoint(client_id: str, request: ScriptRequest):
    metadata = storage_service.get_metadata(client_id)
    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    if not research_path.exists():
        raise HTTPException(status_code=400, detail="Perform research first")
    with open(research_path, "r") as f:
        research = f.read()
        
    buyer_personas = metadata.get("brand_identity", {}).get("buyer_personas", [])
    if buyer_personas:
        research += "\n\n### BUYER PERSONAS E PAURE PROFONDE (CRITICO DA STUDIARE):\n"
        research += json.dumps(buyer_personas, ensure_ascii=False, indent=2)
    
    # Read Output-script rules (optional, best-effort)
    rules = ""
    try:
        with open("Output-script", "r") as f:
            rules = f.read()
    except FileNotFoundError:
        pass
    
    angle = {"title": request.title, "description": request.description}
    count = min(max(request.count, 1), 5)
    
    scripts = []
    for i in range(count):
        script = await ai_service.generate_script(
            angle, research, rules, metadata["preferences"],
            script_instructions=request.script_instructions,
            variation_index=i,
            total_variations=count
        )
        
        scripts_dir = CLIENTS_DIR / client_id / "scripts"
        scripts_dir.mkdir(parents=True, exist_ok=True)
        script_id = f"script_{len(os.listdir(scripts_dir)) + 1}"
        script_path = scripts_dir / f"{script_id}.md"
        with open(script_path, "w") as f:
            f.write(script)
        
        scripts.append({"script_id": script_id, "content": script})
    
    return scripts

@app.post("/clients/{client_id}/feedback")
async def submit_feedback(client_id: str, request: FeedbackRequest):
    metadata = storage_service.get_metadata(client_id)
    
    # Record feedback to improve future scripts
    if "preferences" not in metadata:
        metadata["preferences"] = {"feedback_history": [], "avoid_words": []}
    
    metadata["preferences"].setdefault("feedback_history", []).append(request.feedback)
    
    # Extract keywords/rules from feedback (simple logic for now, could be AI-driven)
    if "evita" in request.feedback.lower():
        words = request.feedback.lower().split("evita")[1].replace("la parola", "").strip().split(",")
        metadata["preferences"].setdefault("avoid_words", []).extend([w.strip() for w in words])
    
    storage_service.save_metadata(client_id, metadata)
    
    # Regenerate script with new preferences
    research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
    research = ""
    if research_path.exists():
        with open(research_path, "r") as f:
            research = f.read()
    
    rules = ""
    try:
        if os.path.exists("Output-script"):
            with open("Output-script", "r") as f:
                rules = f.read()
    except Exception:
        pass
        
    # Load original script content for contextual refinement
    original_script_content = ""
    scripts_dir = CLIENTS_DIR / client_id / "scripts"
    if request.script_id:
        script_path = scripts_dir / f"{request.script_id}.md"
        if script_path.exists():
            with open(script_path, "r") as f:
                original_script_content = f.read()

    angle = {"title": request.angle_title or "Script", "description": "Regenerated based on feedback"}
    new_script = await ai_service.generate_script(
        angle, research, rules, metadata["preferences"], 
        script_instructions=request.feedback,
        original_script=original_script_content
    )
    
    # Save as new version
    base_id = request.script_id or "script_1"
    scripts_dir = CLIENTS_DIR / client_id / "scripts"
    scripts_dir.mkdir(parents=True, exist_ok=True)
    
    existing_versions = [f for f in os.listdir(scripts_dir) if f.startswith(base_id.split('_v')[0])]
    version = len(existing_versions) + 1
    script_id = f"{base_id.split('_v')[0]}_v{version}"
    
    script_path = scripts_dir / f"{script_id}.md"
    with open(script_path, "w") as f:
        f.write(new_script)
        
    return {"script_id": script_id, "content": new_script}


# ═══════════════════════════════════════════════
#  TASKS (global)
# ═══════════════════════════════════════════════

class TaskCreate(BaseModel):
    title: str
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    priority: Optional[str] = "media"
    due_date: Optional[str] = ""
    notes: Optional[str] = ""
    estimated_time: Optional[str] = ""   # es: "30min", "1h", "2h"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    estimated_time: Optional[str] = None

@app.get("/tasks")
async def list_tasks():
    return storage_service.get_tasks()

@app.post("/tasks")
async def create_task(task: TaskCreate):
    return storage_service.create_task(
        title=task.title,
        client_id=task.client_id,
        client_name=task.client_name,
        priority=task.priority,
        due_date=task.due_date,
        notes=task.notes,
        estimated_time=task.estimated_time
    )

@app.patch("/tasks/{task_id}")
async def update_task(task_id: str, update: TaskUpdate):
    try:
        updates = {k: v for k, v in update.dict(exclude_unset=True).items() if v is not None}
        return storage_service.update_task(task_id, updates)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    try:
        storage_service.delete_task(task_id)
        return {"message": "Task deleted"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")

@app.post("/tasks/sort")
async def ai_sort_tasks():
    """Use AI to suggest an optimized, prioritized order for open tasks."""
    tasks = storage_service.get_tasks()
    open_tasks = [t for t in tasks if t.get("status") != "done"]
    if not open_tasks:
        return {"order": [], "reasoning": "Nessuna task aperta da ordinare."}
    result = await ai_service.sort_tasks(open_tasks)
    return result


# ═══════════════════════════════════════════════
#  REPORTS (per-client)
# ═══════════════════════════════════════════════

class ReportCreate(BaseModel):
    period_label: Optional[str] = ""       # es: "Febbraio 2026"
    budget_speso: Optional[str] = ""
    roas: Optional[str] = ""
    ctr: Optional[str] = ""
    cpc: Optional[str] = ""
    cpm: Optional[str] = ""
    conversioni: Optional[str] = ""
    revenue: Optional[str] = ""
    reach: Optional[str] = ""
    impressions: Optional[str] = ""
    note: Optional[str] = ""
    best_angles: Optional[str] = ""
    best_creatives: Optional[str] = ""
    best_copy: Optional[str] = ""

@app.get("/clients/{client_id}/reports")
async def list_reports(client_id: str):
    try:
        storage_service.get_metadata(client_id)  # verify client exists
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")
    return storage_service.get_reports(client_id)

@app.post("/clients/{client_id}/reports")
async def create_report(client_id: str, report: ReportCreate):
    try:
        storage_service.get_metadata(client_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")
    data = report.dict(exclude_none=True)
    return storage_service.save_report(client_id, data)

@app.post("/clients/{client_id}/reports/{report_id}/generate")
async def generate_report_ai(client_id: str, report_id: str):
    try:
        metadata = storage_service.get_metadata(client_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Client not found")
    reports = storage_service.get_reports(client_id)
    report = next((r for r in reports if r["id"] == report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        ai_text = await ai_service.generate_performance_report(metadata, report)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
    updated = storage_service.update_report(client_id, report_id, {"ai_report": ai_text})
    return updated

@app.delete("/clients/{client_id}/reports/{report_id}")
async def delete_report(client_id: str, report_id: str):
    try:
        storage_service.delete_report(client_id, report_id)
        return {"message": "Report deleted"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Report not found")


# ═══════════════════════════════════════════════
# ═══════════════════════════════════════════════
#  IMAGE GENERATION (Fal.ai)
# ═══════════════════════════════════════════════

FAL_KEY = os.getenv("FAL_KEY", "")


class ImageReference(BaseModel):
    type: str  # logo, persona, prodotto, contesto
    data: str  # base64 string
    mime: str  # image/png, image/jpeg etc.

class ImageGenerateRequest(BaseModel):
    prompt: str
    client_id: str
    format: str = "Feed IG (1:1)"
    references: List[ImageReference] = []
    use_rag: bool = False
    model_id: str = "fal-ai/flux-pro/v1.1-ultra"
    reference_filename: Optional[str] = None # For "Modifica" or "Aggiungi Formato" from existing gallery


def save_graphic_metadata(client_id: str, filename: str, prompt: str, enhanced_prompt: str, format: str, original_url: str = ""):
    """Helper to save metadata to graphics_meta.json uniformly."""
    graphics_dir = CLIENTS_DIR / client_id / "graphics"
    graphics_dir.mkdir(parents=True, exist_ok=True)
    meta_file = graphics_dir / "graphics_meta.json"
    meta_list = []
    if meta_file.exists():
        try:
            meta_list = json.loads(meta_file.read_text())
        except:
            meta_list = []
            
    meta_list.insert(0, {
        "filename": filename,
        "prompt": prompt,
        "enhanced_prompt": enhanced_prompt,
        "format": format,
        "created_at": datetime.now().isoformat(),
        "original_url": original_url
    })
    meta_file.write_text(json.dumps(meta_list, indent=2, ensure_ascii=False))
    storage_service.sync_graphics_meta(client_id, meta_list)

@app.post("/generate-image")
async def generate_image(request: ImageGenerateRequest):
    """Universal image generation endpoint. Claude writes the prompt, the model executes with direct file access."""
    GOOGLE_AI_API_KEY = os.getenv("GOOGLE_AI_API_KEY", "")
    is_gemini = request.model_id in ("gemini-image", "gemini-image-pro")
    is_fal = not is_gemini

    if is_gemini and not GOOGLE_AI_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_AI_API_KEY not configured")
    if is_fal and not FAL_KEY:
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")

    # Load image from disk if reference_filename is provided
    if request.reference_filename:
        ref_path = CLIENTS_DIR / request.client_id / "graphics" / request.reference_filename
        if ref_path.exists():
            with open(ref_path, "rb") as f:
                ref_data = base64.b64encode(f.read()).decode("utf-8")
                # Append to references list so the rest of the logic sees it as an image ref
                request.references.insert(0, ImageReference(type="context", data=ref_data, mime="image/png"))

    # ── STEP 1: Load client context (shared for ALL models) ───────────────────
    client_context = ""
    metadata = {}
    try:
        metadata = storage_service.get_metadata(request.client_id)
        brand = metadata.get("brand_identity", {})
        client_context = f"""Cliente: {metadata.get('name', '')}
Settore: {metadata.get('industry', 'non specificato')}
Tono: {brand.get('tone', 'non specificato')}
Colori brand: {', '.join(brand.get('colors', []))}
Stile visivo: {brand.get('visuals', 'non specificato')}"""
    except Exception:
        pass

    # ── STEP 2: Fetch Notion RAG data if requested ────────────────────────────
    rag_context_text = ""
    if request.use_rag:
        try:
            bm = metadata.get("industry") or metadata.get("business_type")
            rag_creatives = await notion_service.get_winning_creatives(business_model=bm, limit=3)
            if rag_creatives:
                rag_context_text = "\n\n=== ADS AD ALTE PERFORMANCE NEL SETTORE ===\nPrendi ispirazione da questi layout e angoli testati:\n"
                for i, cr in enumerate(rag_creatives):
                    rag_context_text += f"\nEsempio {i+1}: {cr.get('headline', '')} — {cr.get('notes', '')}\n"
        except Exception as e:
            print(f"RAG fetch failed: {e}")

    # ── STEP 3: Claude writes the creative prompt ─────────────────────────────
    # Claude's ONLY job: turn the user's idea into the perfect prompt for the chosen model.
    # Claude NEVER describes the uploaded images — those go directly to the model as pixels.
    n_refs = len(request.references)
    ref_note = ""
    if n_refs == 1:
        ref_note = f"NOTA: L'utente ha caricato 1 immagine di riferimento (Immagine 1). Il modello la vedrà direttamente. Nel tuo prompt scrivi dove/come deve usarla (es. 'using the person in the reference as the model', 'place the product from the reference image on the bathroom counter')."
    elif n_refs >= 2:
        ref_note = f"NOTA: L'utente ha caricato {n_refs} immagini di riferimento (Immagine 1 = Persona, Immagine 2 = Prodotto). Il modello le vedrà direttamente come pixel. Nel tuo prompt scrivi cosa fare con loro (es. 'use Image 1 as the woman in the ad', 'place the exact product from Image 2 in her hand'). NON descrivere l'aspetto delle immagini — il modello le ha già."

    # Select model name for the prompt system message
    model_names = {
        "gemini-image": "Google Gemini 3.1 Flash Image",
        "gemini-image-pro": "Google Gemini 3 Pro Image",
        "fal-ai/flux-pro/v1.1-ultra": "Flux Pro 1.1 Ultra (Black Forest Labs)",
        "fal-ai/flux-realism": "Flux Realism (Black Forest Labs)",
    }
    model_label = model_names.get(request.model_id, request.model_id)

    enhanced_prompt = request.prompt
    try:
        system_msg = f"""Sei il Creative Director di un'agenzia pubblicitaria di lusso. Il tuo UNICO compito in questo momento è scrivere il prompt perfetto per il modello AI scelto ({model_label}) che genererà una creative pubblicitaria.

FLUSS DI LAVORO:
1. Leggi l'idea dell'utente e il contesto del cliente
2. Consulta gli esempi di ads vincenti nel settore (se presenti)
3. Scrivi un prompt INGLESE ottimizzato per {model_label}

REGOLE FONDAMENTALI:
- Il modello AI vedrà le immagini di riferimento direttamente come pixel. NON descrivere l'aspetto fisico delle persone o dei prodotti — usa frasi come "the woman in Image 1", "the product in Image 2".
- Specifica la scena, la composizione, l'illuminazione, il mood, il formato e il testo overlay.
- Il testo in italiano (Headline, bullet point, CTA) va incluso nel prompt tra virgolette come overlay tipografico.
- Formato richiesto: {request.format}. Specifica esplicitamente nel prompt: "in {request.format} vertical format, portrait orientation".
- Stile: commercial photography, 8k, photorealistic, NOT illustrated, NOT cartoon.

{ref_note}

Rispondi SOLO con il prompt inglese. Senza spiegazioni, senza prefissi."""

        user_msg_text = f"Contesto brand:\n{client_context}\n{rag_context_text}\n\nFormato richiesto: {request.format}\nModello: {model_label}\n\nIdea dell'utente:\n{request.prompt}"

        user_content = [
            {"type": "text", "text": user_msg_text}
        ]

        # Inject RAG Ad images so Claude can physically see the styles
        for cr in rag_creatives:
            if cr.get("thumbnail_b64"):
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{cr.get('thumbnail_mime', 'image/jpeg')};base64,{cr.get('thumbnail_b64')}"
                    }
                })

        # Inject direct reference images so Claude understands the composition request
        # NOTE: Claude does NOT describe these — it only writes how to position them in the scene
        for ref in request.references:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{ref.mime};base64,{ref.data}"}
            })

        enhanced_prompt = await ai_service._call_ai(
            model="anthropic/claude-sonnet-4-5",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_content}
            ],
            temperature=0.7,
            max_tokens=800
        )
    except Exception as e:
        print(f"Claude enhancement failed, using original prompt: {e}")

    # ── STEP 4a: Execute on Google Gemini (if gemini model selected) ────────────
    if is_gemini:
        gemini_model = (
            "gemini-3-pro-image-preview" if request.model_id == "gemini-image-pro"
            else "gemini-3.1-flash-image-preview"
        )
        # Format instruction injected into the prompt text
        fmt_low = request.format.lower()
        if "4:5" in fmt_low:
            ar_note = "IMPORTANT: Generate this in 4:5 portrait format (tall vertical image, like Instagram feed). "
        elif "9:16" in fmt_low or "stories" in fmt_low:
            ar_note = "IMPORTANT: Generate this in 9:16 portrait format (phone Stories ratio). "
        elif "16:9" in fmt_low or "banner" in fmt_low:
            ar_note = "IMPORTANT: Generate this in 16:9 wide landscape format. "
        else:
            ar_note = ""

        # Build Gemini parts: inline images first, then Claude-generated prompt
        gemini_parts = []
        for ref in request.references:
            gemini_parts.append({"inline_data": {"mime_type": ref.mime, "data": ref.data}})
        gemini_parts.append({"text": ar_note + enhanced_prompt})

        gemini_payload = {
            "contents": [{"role": "user", "parts": gemini_parts}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
        }
        gemini_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent"
            f"?key={GOOGLE_AI_API_KEY}"
        )
        print(f"Gemini {gemini_model}: Claude prompt ready, {len(request.references)} images as inline_data")
        async with httpx.AsyncClient(timeout=180.0) as gclient:
            try:
                resp = await gclient.post(gemini_url, headers={"Content-Type": "application/json"}, json=gemini_payload)
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=502, detail=f"Gemini error: {e.response.text[:500]}")

        image_b64 = None
        for candidate in resp.json().get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                if "inlineData" in part:
                    image_b64 = part["inlineData"]["data"]
                    break
        if not image_b64:
            raise HTTPException(status_code=502, detail="Gemini did not return an image")

        client_dir = CLIENTS_DIR / request.client_id / "graphics"
        client_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{uuid.uuid4().hex[:6]}.png"
        img_bytes = base64.b64decode(image_b64)
        with open(client_dir / filename, "wb") as f:
            f.write(img_bytes)
        storage_service.save_graphic_to_supabase(request.client_id, filename, img_bytes)

        # Save metadata (was missing for Gemini!)
        save_graphic_metadata(
            request.client_id, filename, request.prompt, enhanced_prompt, request.format
        )

        return {"url": f"/clients/{request.client_id}/graphics/{filename}", "filename": filename, "enhanced_prompt": enhanced_prompt, "model_used": gemini_model}

    # ── STEP 4b: Execute on Fal.ai (Flux models only) ────────────────────────
    # Flux models: use Redux for identity+scene, standard for text-to-image
    fmt_low = request.format.lower()
    actual_model = request.model_id
    if request.references and "flux" in request.model_id.lower():
        actual_model = "fal-ai/flux-pro/v1.1-ultra/redux"

    fal_url = f"https://fal.run/{actual_model}"
    payload = {"prompt": enhanced_prompt, "output_format": "png"}

    # Pixel-perfect image sizes for Flux
    if "9:16" in fmt_low or "stories" in fmt_low:
        payload["image_size"] = {"width": 720, "height": 1280}
    elif "16:9" in fmt_low or "banner" in fmt_low:
        payload["image_size"] = {"width": 1280, "height": 720}
    elif "4:5" in fmt_low:
        payload["image_size"] = {"width": 1024, "height": 1280}
    elif "2:3" in fmt_low or "pinterest" in fmt_low:
        payload["image_size"] = {"width": 854, "height": 1280}
    else:
        payload["image_size"] = {"width": 1024, "height": 1024}

    if request.references:
        import random
        payload["image_url"] = f"data:{request.references[0].mime};base64,{request.references[0].data}"
        payload["strength"] = 0.60
        payload["seed"] = random.randint(0, 2**32 - 1)

    # 4. Call Fal.ai REST API - always use JSON
    fal_headers = {"Authorization": f"Key {FAL_KEY}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            resp = await client.post(fal_url, headers=fal_headers, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text[:500] if e.response else str(e)
            raise HTTPException(status_code=502, detail=f"Fal.ai error: {error_detail}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Fal.ai network error: {str(e)}")

    result = resp.json()

    # 5. Extract generated image URL
    image_url = None
    if "images" in result and len(result["images"]) > 0:
        image_url = result["images"][0].get("url")
    elif "image" in result and isinstance(result["image"], dict):
        image_url = result["image"].get("url")
        
    if not image_url:
        raise HTTPException(status_code=500, detail=f"No image returned from Fal.ai. Response: {str(result)[:300]}")

    # 6. Download the image from Fal.ai url and save strictly to disk
    graphics_dir = CLIENTS_DIR / request.client_id / "graphics"
    graphics_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.png"
    filepath = graphics_dir / filename
    
    async with httpx.AsyncClient(timeout=60.0) as img_client:
        try:
            img_resp = await img_client.get(image_url)
            img_resp.raise_for_status()
            with open(filepath, "wb") as f:
                f.write(img_resp.content)
            storage_service.save_graphic_to_supabase(request.client_id, filename, img_resp.content)
        except Exception as e:
             raise HTTPException(status_code=500, detail=f"Failed to download generated image from Fal.ai: {str(e)}")

    save_graphic_metadata(
        request.client_id, filename, request.prompt, enhanced_prompt, request.format, image_url
    )

    return {
        "filename": filename,
        "prompt": request.prompt,
        "enhanced_prompt": enhanced_prompt,
        "response_text": "",
        "url": f"/clients/{request.client_id}/graphics/{filename}",
        "original_url": image_url
    }


@app.get("/clients/{client_id}/graphics")
def list_graphics(client_id: str):
    """List all generated graphics for a client."""
    graphics_dir = CLIENTS_DIR / client_id / "graphics"
    meta_file = graphics_dir / "graphics_meta.json"
    if meta_file.exists():
        return json.loads(meta_file.read_text())
    return []


@app.get("/clients/{client_id}/graphics/{filename}")
def get_graphic(client_id: str, filename: str):
    """Serve a generated graphic file."""
    filepath = CLIENTS_DIR / client_id / "graphics" / filename
    if not filepath.exists():
        storage_service.ensure_local_graphic(client_id, filename)
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Graphic not found")
    return FileResponse(filepath, media_type="image/png")

@app.delete("/clients/{client_id}/graphics/{filename}")
def delete_graphic(client_id: str, filename: str):
    """Delete a graphic file and its metadata."""
    graphics_dir = CLIENTS_DIR / client_id / "graphics"
    filepath = graphics_dir / filename
    meta_file = graphics_dir / "graphics_meta.json"
    
    # 1. Delete actual image
    if filepath.exists():
        filepath.unlink()
    storage_service.delete_graphic_from_supabase(client_id, filename)

    # 2. Update metadata
    meta_list = []
    if meta_file.exists():
        try:
            meta_list = json.loads(meta_file.read_text())
            meta_list = [m for m in meta_list if m.get("filename") != filename]
            meta_file.write_text(json.dumps(meta_list, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Error updating graphics meta: {e}")
    storage_service.sync_graphics_meta(client_id, meta_list)

    return {"message": "Graphic deleted"}

@app.post("/knowledge")
async def add_knowledge(req: KnowledgeRequest):
    """Save a rule or framework directly to Notion Knowledge Base DB."""
    success = await notion_service.save_to_knowledge_base(
        kb_type=req.kb_type,
        name=req.name,
        instructions=req.instructions,
        funnel_stage=req.funnel_stage
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save to Knowledge Base")
    return {"message": "Success"}

@app.get("/knowledge/creatives/{filename}")
def serve_creative_image(filename: str):
    """Serve a locally cached creative image from the knowledge base."""
    filepath = Path("backend/storage/knowledge/winning_creatives") / filename
    if not filepath.exists():
        # Try absolute path
        filepath = CLIENTS_DIR.parent / "knowledge" / "winning_creatives" / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine media type
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    media_types = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp", "mp4": "video/mp4"}
    return FileResponse(filepath, media_type=media_types.get(ext, "image/jpeg"))

