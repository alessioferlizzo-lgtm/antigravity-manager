"""
Quick verification script to check Supabase migration
"""
import os
from pathlib import Path

# Load environment
env_path = Path(__file__).parent / "backend" / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print("📊 Verifying Supabase Migration:\n")

# Check clients
clients = sb.table("clients").select("id, name").execute()
print(f"✅ Clients: {len(clients.data)} records")
print(f"   Sample: {clients.data[:3]}\n")

# Check research
research = sb.table("client_research").select("client_id").execute()
print(f"✅ Research: {len(research.data)} records")
print(f"   Clients with research: {[r['client_id'] for r in research.data]}\n")

# Check angles
angles = sb.table("client_angles").select("client_id").execute()
print(f"✅ Angles: {len(angles.data)} records")
print(f"   Clients with angles: {[a['client_id'] for a in angles.data]}\n")

# Check tasks
tasks = sb.table("tasks").select("id").execute()
print(f"✅ Tasks: {len(tasks.data)} records\n")

# Check creative intelligence
ci = sb.table("creative_intelligence").select("client_id").execute()
print(f"✅ Creative Intelligence: {len(ci.data)} records\n")

print("=" * 50)
print("🎉 Migration verification complete!")
