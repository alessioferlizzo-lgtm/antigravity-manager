import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path("backend/.env"))
os.environ["NOTION_API_KEY"] = os.getenv("NOTION_API_KEY", "")
os.environ["NOTION_CREATIVES_DB_ID"] = os.getenv("NOTION_CREATIVES_DB_ID", "")
import sys
sys.path.append("backend")
from notion_service import notion_service

async def main():
    print(f"API Key loaded: {bool(os.environ.get('NOTION_API_KEY'))}")
    creatives = await notion_service.get_winning_creatives(business_model=None, limit=1)
    if creatives:
        cr = creatives[0]
        print(f"Headline: {cr.get('headline')}")
        print(f"Notes length: {len(cr.get('notes', ''))}")
        print(f"Has Thumbnail B64: {bool(cr.get('thumbnail_b64'))}")
    else:
        print("No creatives found or error occurred.")

asyncio.run(main())
