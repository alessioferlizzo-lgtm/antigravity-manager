import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv(".env")
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_GRAPHICS_VAULT_DB_ID = os.getenv("NOTION_GRAPHICS_VAULT_DB_ID")

async def inspect_graphics():
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
    }
    url = f"https://api.notion.com/v1/databases/{NOTION_GRAPHICS_VAULT_DB_ID}/query"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json={"page_size": 3})
        if response.status_code == 200:
            data = response.json()
            for page in data.get("results", []):
                props = page.get("properties", {})
                title_list = props.get("Nome o Titolo Grafica", {}).get("title", [])
                title = title_list[0].get("plain_text", "No Title") if title_list else "Untitled"
                files = props.get("Anteprima Immagine", {}).get("files", [])
                print(f"Page: {title}")
                for f in files:
                    ftype = f.get("type")
                    furl = f.get(ftype, {}).get("url", "No URL")
                    print(f"  - Type: {ftype}")
                    print(f"  - URL: {furl[:100]}...")
        else:
            print("Error", response.text)

if __name__ == "__main__":
    asyncio.run(inspect_graphics())
