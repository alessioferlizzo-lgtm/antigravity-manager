import os
import json
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv("backend/.env")

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_CLIENTS_PERSONAS_DB_ID = os.getenv("NOTION_CLIENTS_PERSONAS_DB_ID")
CLIENTS_DIR = "clients"

os.makedirs(CLIENTS_DIR, exist_ok=True)

async def sync_clients():
    if not NOTION_API_KEY or not NOTION_CLIENTS_PERSONAS_DB_ID:
        print("Missing API Keys.")
        return

    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    url = f"https://api.notion.com/v1/databases/{NOTION_CLIENTS_PERSONAS_DB_ID}/query"
    
    print("Fetching Clients from Notion...")
    has_more = True
    next_cursor = None
    
    clients_map = {}
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while has_more:
            payload = {"page_size": 100}
            if next_cursor:
                payload["start_cursor"] = next_cursor
                
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                print(f"Error: {response.text}")
                break
                
            data = response.json()
            for page in data.get("results", []):
                props = page.get("properties", {})
                
                name_rt = props.get("Nome Cliente", {}).get("title", [])
                client_name = "".join([t.get("plain_text", "") for t in name_rt]).strip()
                if not client_name:
                    continue
                    
                service_rt = props.get("Servizio Specifico", {}).get("rich_text", [])
                service = "".join([t.get("plain_text", "") for t in service_rt]).strip()
                
                fears_rt = props.get("Paure e Leve Profonde", {}).get("rich_text", [])
                fears = "".join([t.get("plain_text", "") for t in fears_rt]).strip()
                
                focus_rt = props.get("Focus Analisi", {}).get("rich_text", [])
                focus = "".join([t.get("plain_text", "") for t in focus_rt]).strip()
                
                if client_name not in clients_map:
                    clients_map[client_name] = []
                    
                clients_map[client_name].append({
                    "name": service or "Persona Generale",
                    "profile": focus,
                    "desires": "Desiderio legato a: " + service if service else "",
                    "fears": fears
                })
                
            has_more = data.get("has_more", False)
            next_cursor = data.get("next_cursor")
            
    print(f"Found {len(clients_map)} unique clients. Generating local files...")
    import uuid
    
    for client_name, personas in clients_map.items():
        # Clean folder name
        safe_name = "".join(c if c.isalnum() else "_" for c in client_name).lower()
        if not safe_name:
            safe_name = "unknown"
        
        # Check if already exists in storage directly
        exists = False
        for client_id in os.listdir(CLIENTS_DIR):
            p = os.path.join(CLIENTS_DIR, client_id, "metadata.json")
            if os.path.exists(p):
                with open(p, "r") as f:
                    meta = json.load(f)
                    if meta.get("name") == client_name:
                        exists = True
                        # Potentially update personas here, but let's keep it simple
                        print(f"Client {client_name} already exists. Skipping.")
                        break
        
        if not exists:
            client_id = str(uuid.uuid4())
            client_path = os.path.join(CLIENTS_DIR, client_id)
            os.makedirs(client_path, exist_ok=True)
            
            metadata = {
                "id": client_id,
                "name": client_name,
                "links": [],
                "competitors": [],
                "created_at": "importato da Notion",
                "brand_identity": {
                    "buyer_personas": personas
                }
            }
            
            with open(os.path.join(client_path, "metadata.json"), "w") as f:
                json.dump(metadata, f, indent=4)
                
            print(f"Created local profile for {client_name} with {len(personas)} personas.")

if __name__ == "__main__":
    asyncio.run(sync_clients())
