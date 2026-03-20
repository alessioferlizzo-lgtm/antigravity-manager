import os
import httpx
import asyncio
import json
from dotenv import load_dotenv
from pathlib import Path

# Load environment
load_dotenv("backend/.env")
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_GRAPHICS_VAULT_DB_ID = os.getenv("NOTION_GRAPHICS_VAULT_DB_ID")

# Config
# SUGGESTION: If you have a public URL for your creatives folder, put it here.
# Example: "https://your-site.com/creatives/"
PUBLIC_BASE_URL = os.getenv("CREATIVES_PUBLIC_URL", "http://REPLACE_WITH_PUBLIC_URL/")

async def repair_graphics():
    if not NOTION_API_KEY or not NOTION_GRAPHICS_VAULT_DB_ID:
        print("Missing Notion credentials in .env")
        return

    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    # 1. Load local mapping if exists
    creatives_path = Path("backend/storage/knowledge/winning_creatives/creatives.json")
    local_data = {}
    if creatives_path.exists():
        with open(creatives_path, "r") as f:
            items = json.load(f)
            for item in items:
                local_data[item["headline"]] = item.get("local_image")

    # 2. Query Notion Vault
    url = f"https://api.notion.com/v1/databases/{NOTION_GRAPHICS_VAULT_DB_ID}/query"
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers)
        if response.status_code != 200:
            print(f"Error querying Notion: {response.text}")
            return
            
        results = response.json().get("results", [])
        print(f"Found {len(results)} pages in Graphics Vault.")
        
        for page in results:
            page_id = page["id"]
            props = page["properties"]
            title_list = props.get("Nome o Titolo Grafica", {}).get("title", [])
            title = title_list[0].get("plain_text") if title_list else None
            
            if not title: continue
            
            # Check if it needs repair (has localhost link or is empty)
            files = props.get("Anteprima Immagine", {}).get("files", [])
            needs_repair = False
            if not files:
                needs_repair = True
            else:
                for f in files:
                    furl = f.get(f["type"], {}).get("url", "")
                    if "127.0.0.1" in furl or "localhost" in furl:
                        needs_repair = True
                        break
            
            if needs_repair:
                local_img = local_data.get(title)
                if local_img:
                    new_url = f"{PUBLIC_BASE_URL}{local_img}"
                    print(f"Repairing '{title}' with {new_url}")
                    
                    update_payload = {
                        "properties": {
                            "Anteprima Immagine": {
                                "files": [{
                                    "name": local_img,
                                    "type": "external",
                                    "external": {"url": new_url}
                                }]
                            }
                        }
                    }
                    await client.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=headers, json=update_payload)
                else:
                    print(f"No local backup found for '{title}'")

if __name__ == "__main__":
    asyncio.run(repair_graphics())
