import os
import json
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv("backend/.env")

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_CREATIVES_DB_ID = os.getenv("NOTION_CREATIVES_DB_ID")

LOCAL_DIR = "backend/storage/knowledge/winning_creatives"
os.makedirs(LOCAL_DIR, exist_ok=True)

async def migrate_creatives():
    if not NOTION_API_KEY or not NOTION_CREATIVES_DB_ID:
        print("Missing Notion API Key or Creatives DB ID")
        return

    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    url = f"https://api.notion.com/v1/databases/{NOTION_CREATIVES_DB_ID}/query"
    
    creatives = []
    has_more = True
    next_cursor = None
    
    print("Fetching from Creative.Lab...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while has_more:
            payload = {"page_size": 100}
            if next_cursor:
                payload["start_cursor"] = next_cursor
                
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                print(f"Error fetching: {response.text}")
                break
                
            data = response.json()
            
            for page in data.get("results", []):
                props = page.get("properties", {})
                
                # Extract fields based on new Italian names
                def get_text(prop_name):
                    rt = props.get(prop_name, {}).get("rich_text", [])
                    return "".join([t.get("plain_text", "") for t in rt])
                    
                def get_title(prop_name):
                    rt = props.get(prop_name, {}).get("title", [])
                    return "".join([t.get("plain_text", "") for t in rt])
                    
                def get_multi_select(prop_name):
                    ms = props.get(prop_name, {}).get("multi_select", [])
                    return [s.get("name") for s in ms]
                    
                headline = get_title("Titolo")
                notes = get_text("Note")
                watermark = get_text("Watermark")
                category = get_multi_select("Categoria")
                ad_format = get_multi_select("Formato Pubblicità")
                brand = get_multi_select("Brand")
                channel = get_multi_select("Canale")
                business_model = get_multi_select("Modello di Business")
                recommended_by = get_multi_select("Consigliato Da")
                ads_link = props.get("Link alla ads library", {}).get("url", "")
                
                # Immagine
                local_image_path = None
                files_prop = props.get("Anteprima Immagine", {}).get("files", [])
                if files_prop:
                    file_obj = files_prop[0]
                    file_url = file_obj.get("file", {}).get("url") if file_obj.get("type") == "file" else file_obj.get("external", {}).get("url")
                    
                    if file_url:
                        # Extract extension
                        ext = "jpg"
                        if ".png" in file_url.lower(): ext = "png"
                        if ".mp4" in file_url.lower(): ext = "mp4"
                        
                        safe_title = "".join(c if c.isalnum() else "_" for c in headline)[:50]
                        filename = f"{page['id']}_{safe_title}.{ext}"
                        local_path = os.path.join(LOCAL_DIR, filename)
                        
                        try:
                            img_resp = await client.get(file_url)
                            if img_resp.status_code == 200:
                                with open(local_path, "wb") as f:
                                    f.write(img_resp.content)
                                local_image_path = filename
                                print(f"Saved image for: {headline}")
                        except Exception as e:
                            print(f"Failed to download image for {headline}: {e}")

                creatives.append({
                    "id": page["id"],
                    "headline": headline,
                    "notes": notes,
                    "watermark": watermark,
                    "category": category,
                    "ad_format": ad_format,
                    "brand": brand,
                    "channel": channel,
                    "business_model": business_model,
                    "recommended_by": recommended_by,
                    "ads_link": ads_link,
                    "local_image": local_image_path
                })
                
            has_more = data.get("has_more", False)
            next_cursor = data.get("next_cursor")
            
    with open(os.path.join(LOCAL_DIR, "creatives.json"), "w") as f:
        json.dump(creatives, f, indent=2, ensure_ascii=False)
        
    print(f"Migration completed! Saved {len(creatives)} creatives to local brain.")

if __name__ == "__main__":
    asyncio.run(migrate_creatives())
