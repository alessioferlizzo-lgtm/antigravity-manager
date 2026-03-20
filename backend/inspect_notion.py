import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_CREATIVES_DB_ID = os.getenv("NOTION_CREATIVES_DB_ID")
NOTION_GRAPHICS_VAULT_DB_ID = os.getenv("NOTION_GRAPHICS_VAULT_DB_ID")

async def inspect():
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
    }
    async with httpx.AsyncClient() as client:
        print("--- CREATIVE.LAB (CREATIVES_DB) ---")
        r1 = await client.get(f"https://api.notion.com/v1/databases/{NOTION_CREATIVES_DB_ID}", headers=headers)
        if r1.status_code == 200:
            props = r1.json().get('properties', {})
            for k, v in props.items():
                print(f"Prop: {k} (Type: {v['type']})")
        else:
            print("Error", r1.text)
            
        print("\n--- GRAPHICS VAULT ---")
        r2 = await client.get(f"https://api.notion.com/v1/databases/{NOTION_GRAPHICS_VAULT_DB_ID}", headers=headers)
        if r2.status_code == 200:
            props = r2.json().get('properties', {})
            for k, v in props.items():
                print(f"Prop: {k} (Type: {v['type']})")
        else:
            print("Error", r2.text)

asyncio.run(inspect())
