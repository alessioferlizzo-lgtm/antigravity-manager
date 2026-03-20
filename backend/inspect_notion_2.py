import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_CLIENTS_PERSONAS_DB_ID = os.getenv("NOTION_CLIENTS_PERSONAS_DB_ID")

async def inspect():
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
    }
    async with httpx.AsyncClient() as client:
        print("--- CLIENTS PERSONAS ---")
        r1 = await client.get(f"https://api.notion.com/v1/databases/{NOTION_CLIENTS_PERSONAS_DB_ID}", headers=headers)
        if r1.status_code == 200:
            for k, v in r1.json().get('properties', {}).items():
                print(f"Prop: {k} (Type: {v['type']})")
            
            # Fetch some content
            r1_q = await client.post(f"https://api.notion.com/v1/databases/{NOTION_CLIENTS_PERSONAS_DB_ID}/query", headers=headers, json={"page_size": 2})
            for row in r1_q.json().get('results', []):
                print(row['properties'])
        else:
            print("Error", r1.text)
asyncio.run(inspect())
