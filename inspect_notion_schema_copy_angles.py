import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv("/Users/alessioferlizzo/Databse-Clienti-Antigravity/backend/.env")
copy_db_id = os.getenv("NOTION_COPY_VAULT_DB_ID")
angles_db_id = os.getenv("NOTION_ANGLES_VAULT_DB_ID")
api_key = os.getenv("NOTION_API_KEY")

async def inspect(db_id, name):
    print(f"\n--- {name} ---")
    url = f"https://api.notion.com/v1/databases/{db_id}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Notion-Version": "2022-06-28"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        data = resp.json()
        props = data.get("properties", {})
        for prop_name, info in props.items():
            print(f"- {prop_name}: {info['type']}")

if __name__ == "__main__":
    asyncio.run(inspect(copy_db_id, "COPY VAULT"))
    asyncio.run(inspect(angles_db_id, "ANGLES VAULT"))
