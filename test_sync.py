"""
Test sync functionality by downloading data from Supabase
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

import os
from dotenv import load_dotenv

# Load env
load_dotenv(Path(__file__).parent / "backend" / ".env")

from storage_service import StorageService

print("🔄 Testing Supabase → Local sync functionality...\n")

storage = StorageService()
storage.sync_from_supabase()

print("\n✅ Sync test complete!")
print("\n📁 Checking local files after sync:")

clients_dir = Path(__file__).parent / "clients"
for client_dir in sorted(clients_dir.iterdir()):
    if client_dir.is_dir() and client_dir.name != "common" and client_dir.name != "test_client":
        metadata = client_dir / "metadata.json"
        research = client_dir / "research" / "market_research.md"
        angles = client_dir / "angles.json"

        files = []
        if metadata.exists():
            files.append("metadata")
        if research.exists():
            files.append("research")
        if angles.exists():
            files.append("angles")

        if files:
            print(f"  {client_dir.name}: {', '.join(files)}")
