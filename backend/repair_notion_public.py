import os
import json
import httpx
import asyncio
from dotenv import load_dotenv
from pathlib import Path

load_dotenv("/Users/alessioferlizzo/Databse-Clienti-Antigravity/backend/.env")
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_GRAPHICS_VAULT_DB_ID = os.getenv("NOTION_GRAPHICS_VAULT_DB_ID")
IMG_DIR = Path("/Users/alessioferlizzo/Databse-Clienti-Antigravity/backend/storage/knowledge/winning_creatives")

HEADERS = {
    "Authorization": f"Bearer {NOTION_API_KEY}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

async def upload_to_catbox(file_path: Path) -> str:
    """Uploads a file to Catbox.moe and returns the URL."""
    try:
        url = "https://catbox.moe/user/api.php"
        with open(file_path, "rb") as f:
            files = {"fileToUpload": (file_path.name, f)}
            data = {"reqtype": "fileupload"}
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, data=data, files=files)
                if response.status_code == 200:
                    return response.text.strip()
    except Exception as e:
        print(f"Error uploading {file_path.name} to Catbox: {e}")
    return None

async def remove_link_column():
    """Rimuove la colonna 'Link Materiale Grafico' dal database, se esiste."""
    print("🔄 Rimozione colonna 'Link Materiale Grafico'...")
    url = f"https://api.notion.com/v1/databases/{NOTION_GRAPHICS_VAULT_DB_ID}"
    payload = {"properties": {"Link Materiale Grafico": None}}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.patch(url, headers=HEADERS, json=payload)
        if r.status_code == 200:
            print("✅ Colonna rimossa con successo (o già inesistente).")
        else:
            print(f"⚠️ Impossibile rimuovere la colonna: {r.text}")

async def repair_graphics():
    print("🚀 Inizio caricamento immagini su host pubblico e aggiornamento Notion...")
    
    # 1. Carica la mappatura locale (se usiamo creatives.json, oppure listiamo i file)
    creatives_path = IMG_DIR / "creatives.json"
    local_data = {}
    if creatives_path.exists():
        with open(creatives_path, "r") as f:
            items = json.load(f)
            for item in items:
                local_data[item["headline"]] = item.get("local_image")

    # 2. Ottieni i record dal Vault di Notion
    url = f"https://api.notion.com/v1/databases/{NOTION_GRAPHICS_VAULT_DB_ID}/query"
    async with httpx.AsyncClient(timeout=120.0) as client:
        has_more = True
        next_cursor = None
        all_pages = []
        
        while has_more:
            payload = {"page_size": 100}
            if next_cursor: payload["start_cursor"] = next_cursor
            response = await client.post(url, headers=HEADERS, json=payload)
            if response.status_code != 200:
                print(f"Error querying Notion: {response.text}")
                return
            data = response.json()
            all_pages.extend(data.get("results", []))
            has_more = data.get("has_more", False)
            next_cursor = data.get("next_cursor")
            
        print(f"🔎 Trovati {len(all_pages)} record in Graphics Vault.")
        
        updated_count = 0
        for page in all_pages:
            page_id = page["id"]
            props = page["properties"]
            title_list = props.get("Nome o Titolo Grafica", {}).get("title", [])
            title = title_list[0].get("plain_text") if title_list else None
            
            if not title: continue
            
            # Controlla se l'immagine c'è già ed è esterna
            files = props.get("Anteprima Immagine", {}).get("files", [])
            needs_repair = True
            if files:
                furl = files[0].get(files[0]["type"], {}).get("url", "")
                if "catbox.moe" in furl or ("127.0.0.1" not in furl and "localhost" not in furl and "notion" not in furl):
                    # Sembra già avere un link esterno valido
                    needs_repair = False
                    
            if needs_repair:
                local_filename = local_data.get(title)
                if local_filename:
                    # Abbiamo il file!
                    local_path = IMG_DIR / local_filename
                    if local_path.exists():
                        print(f"⏳ Caricamento online: '{local_filename}'...")
                        public_url = await upload_to_catbox(local_path)
                        if public_url:
                            print(f"✅ Ottenuto URL pubblico: {public_url}")
                            update_payload = {
                                "properties": {
                                    "Anteprima Immagine": {
                                        "files": [{
                                            "name": local_filename,
                                            "type": "external",
                                            "external": {"url": public_url}
                                        }]
                                    }
                                }
                            }
                            patch_resp = await client.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=HEADERS, json=update_payload)
                            if patch_resp.status_code == 200:
                                updated_count += 1
                                print(f"🔗 Notion aggiornato per '{title[:30]}'")
                            else:
                                print(f"❌ Errore aggiornamento Notion per '{title[:30]}': {patch_resp.text}")
                        else:
                            print(f"❌ Fallito caricamento Catbox per '{local_filename}'")
                    else:
                        print(f"⚠️ File locale non trovato: {local_path}")
                        
        print(f"🎉 Finito! Pagine aggiornate con immagini funzionanti: {updated_count}")

async def main():
    await remove_link_column()
    await repair_graphics()

if __name__ == "__main__":
    asyncio.run(main())
