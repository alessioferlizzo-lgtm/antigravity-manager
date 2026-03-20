"""
Script di migrazione: carica tutti i dati locali su Supabase.
Esegui con: python migrate_to_supabase.py
"""
import os, json, sys
from pathlib import Path

# ── carica le env vars dal file .env ──────────────────────────────────────────
env_path = Path(__file__).parent / "backend" / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL o SUPABASE_KEY non trovati nel file backend/.env")
    sys.exit(1)

try:
    from supabase import create_client
except ImportError:
    print("❌ Installa supabase: pip install supabase")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

PROJECT_ROOT = Path(__file__).parent
CLIENTS_DIR  = PROJECT_ROOT / "clients"
TASKS_FILE   = PROJECT_ROOT / "tasks.json"

ok = 0
errors = 0

# ── CLIENTI ──────────────────────────────────────────────────────────────────
print("\n📦 Migrazione clienti...")
for client_dir in sorted(CLIENTS_DIR.iterdir()):
    if not client_dir.is_dir():
        continue
    meta_file = client_dir / "metadata.json"
    if not meta_file.exists():
        continue
    try:
        meta = json.loads(meta_file.read_text())
        client_id = client_dir.name
        name = meta.get("name", client_id)
        sb.table("clients").upsert({"id": client_id, "name": name, "metadata": meta}).execute()
        print(f"  ✅ {client_id}")
        ok += 1
    except Exception as e:
        print(f"  ❌ {client_dir.name}: {e}")
        errors += 1

# ── RESEARCH ─────────────────────────────────────────────────────────────────
print("\n📚 Migrazione research...")
for client_dir in sorted(CLIENTS_DIR.iterdir()):
    if not client_dir.is_dir():
        continue
    research_dir = client_dir / "research"
    if not research_dir.exists():
        continue
    research_files = list(research_dir.glob("*.txt")) + list(research_dir.glob("*.md"))
    if not research_files:
        continue
    try:
        content = "\n\n---\n\n".join(f.read_text() for f in sorted(research_files))
        sb.table("client_research").upsert({"client_id": client_dir.name, "content": content}).execute()
        print(f"  ✅ {client_dir.name}")
        ok += 1
    except Exception as e:
        print(f"  ❌ {client_dir.name}: {e}")
        errors += 1

# ── CREATIVE INTELLIGENCE ────────────────────────────────────────────────────
print("\n🧠 Migrazione creative intelligence...")
for client_dir in sorted(CLIENTS_DIR.iterdir()):
    if not client_dir.is_dir():
        continue
    ci_file = client_dir / "creative_intelligence.json"
    if not ci_file.exists():
        continue
    try:
        data = json.loads(ci_file.read_text())
        sb.table("creative_intelligence").upsert({"client_id": client_dir.name, "data": data}).execute()
        print(f"  ✅ {client_dir.name}")
        ok += 1
    except Exception as e:
        print(f"  ❌ {client_dir.name}: {e}")
        errors += 1

# ── ANGLES ───────────────────────────────────────────────────────────────────
print("\n🎯 Migrazione angles...")
for client_dir in sorted(CLIENTS_DIR.iterdir()):
    if not client_dir.is_dir():
        continue
    angles_file = client_dir / "angles.json"
    if not angles_file.exists():
        continue
    try:
        data = json.loads(angles_file.read_text())
        sb.table("client_angles").upsert({"client_id": client_dir.name, "data": data}).execute()
        print(f"  ✅ {client_dir.name}")
        ok += 1
    except Exception as e:
        print(f"  ❌ {client_dir.name}: {e}")
        errors += 1

# ── TASKS ────────────────────────────────────────────────────────────────────
print("\n✅ Migrazione tasks...")
if TASKS_FILE.exists():
    try:
        tasks = json.loads(TASKS_FILE.read_text())
        if isinstance(tasks, list):
            for task in tasks:
                tid = task.get("id")
                if tid:
                    sb.table("tasks").upsert({"id": tid, "data": task}).execute()
            print(f"  ✅ {len(tasks)} tasks migrati")
            ok += len(tasks)
        else:
            print("  ⚠️  tasks.json non è una lista, saltato")
    except Exception as e:
        print(f"  ❌ tasks: {e}")
        errors += 1
else:
    print("  ⚠️  tasks.json non trovato, saltato")

print(f"\n{'='*50}")
print(f"✅ Successo: {ok}  |  ❌ Errori: {errors}")
print("="*50)
