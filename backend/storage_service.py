import os
import io
import json
import shutil
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent
CLIENTS_DIR = PROJECT_ROOT / "clients"
TASKS_FILE = PROJECT_ROOT / "tasks.json"

# ─────────────────────────────────────────────────────────────────
# Supabase — lazy init, fail-silent
# ─────────────────────────────────────────────────────────────────
_sb = None

def _get_sb():
    global _sb
    if _sb is not None:
        return _sb
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        _sb = create_client(url, key)
        print("[Supabase] Connected")
        return _sb
    except Exception as e:
        print(f"[Supabase] Init failed: {e}")
        return None


def _sb_run(fn):
    """Execute a Supabase operation. Returns result or None on error."""
    try:
        sb = _get_sb()
        if sb is None:
            return None
        return fn(sb)
    except Exception as e:
        print(f"[Supabase] Write error: {e}")
        return None


class StorageService:
    def __init__(self):
        CLIENTS_DIR.mkdir(exist_ok=True)

    # ─── normalize helpers (unchanged) ────────────────────────────
    def normalize_links(self, links: List[Any]) -> List[Dict[str, Any]]:
        normalized = []
        for l in links:
            if isinstance(l, dict):
                normalized.append(l)
            elif isinstance(l, str):
                normalized.append({"url": l, "description": "", "label": ""})
        return normalized

    def normalize_competitors(self, competitors: List[Any]) -> List[Dict[str, Any]]:
        normalized = []
        for c in competitors:
            if isinstance(c, dict):
                if "name" in c:
                    c["links"] = self.normalize_links(c.get("links", []))
                    normalized.append(c)
                else:
                    name = c.get("description") or c.get("url") or "Senza Nome"
                    links = []
                    if c.get("url"):
                        links.append({"url": c["url"], "description": c.get("description", ""), "label": c.get("label", "")})
                    normalized.append({"name": name, "links": links})
            elif isinstance(c, str):
                normalized.append({"name": c, "links": []})
        return normalized

    # ─── CLIENT CRUD ──────────────────────────────────────────────
    def create_client(self, client_name: str, industry: str = "", links: List[Dict] = None, competitors: List[Dict] = None) -> str:
        client_id = client_name.lower().replace(" ", "_")
        client_path = CLIENTS_DIR / client_id
        if client_path.exists():
            count = 1
            while (CLIENTS_DIR / f"{client_id}_{count}").exists():
                count += 1
            client_id = f"{client_id}_{count}"
            client_path = CLIENTS_DIR / client_id

        client_path.mkdir(parents=True)
        for subdir in ["raw_data", "research", "scripts", "brand"]:
            (client_path / subdir).mkdir()

        metadata = {
            "name": client_name, "id": client_id, "industry": industry,
            "links": links or [], "competitors": competitors or [],
            "objectives": "",
            "swot": {"strengths": "", "weaknesses": "", "opportunities": "", "threats": ""},
            "strategy": "",
            "brand_identity": {"tone": "natural", "colors": [], "logo": "", "visuals": "", "buyer_personas": []},
            "preferences": {"tone": "natural", "length": "medium", "avoid_words": [], "feedback_history": []}
        }
        self.save_metadata(client_id, metadata)
        return client_id

    def get_metadata(self, client_id: str) -> Dict[str, Any]:
        with open(CLIENTS_DIR / client_id / "metadata.json", "r") as f:
            data = json.load(f)
            data["links"] = self.normalize_links(data.get("links", []))
            data["competitors"] = self.normalize_competitors(data.get("competitors", []))
            return data

    def save_metadata(self, client_id: str, metadata: Dict[str, Any]):
        with open(CLIENTS_DIR / client_id / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=4)
        _sb_run(lambda sb: sb.table("clients").upsert({
            "id": client_id,
            "name": metadata.get("name", client_id),
            "metadata": metadata
        }).execute())

    def list_clients(self) -> List[Dict[str, str]]:
        clients = []
        if not CLIENTS_DIR.exists():
            return []
        for d in CLIENTS_DIR.iterdir():
            if d.is_dir() and (d / "metadata.json").exists():
                meta = self.get_metadata(d.name)
                clients.append({"id": d.name, "name": meta["name"]})
        return clients

    def delete_client(self, client_id: str):
        client_path = CLIENTS_DIR / client_id
        if client_path.exists() and client_path.is_dir():
            shutil.rmtree(client_path)
        else:
            raise FileNotFoundError(f"Client {client_id} not found")
        _sb_run(lambda sb: sb.table("clients").delete().eq("id", client_id).execute())
        for bucket in ["logos", "raw-data", "graphics"]:
            def _del_bucket(sb, b=bucket):
                try:
                    files = sb.storage.from_(b).list(client_id)
                    if files:
                        paths = [f"{client_id}/{f['name']}" for f in files if f.get("name")]
                        if paths:
                            sb.storage.from_(b).remove(paths)
                except Exception:
                    pass
            _sb_run(_del_bucket)

    # ─── RAW DATA FILES ────────────────────────────────────────────
    def save_file(self, client_id: str, filename: str, content: bytes):
        file_path = CLIENTS_DIR / client_id / "raw_data" / filename
        with open(file_path, "wb") as f:
            f.write(content)
        path = f"{client_id}/{filename}"
        def _upload(sb):
            try:
                sb.storage.from_("raw-data").remove([path])
            except Exception:
                pass
            sb.storage.from_("raw-data").upload(path, content)
        _sb_run(_upload)

    def list_files(self, client_id: str) -> List[str]:
        raw_data_dir = CLIENTS_DIR / client_id / "raw_data"
        if not raw_data_dir.exists():
            return []
        return [f.name for f in raw_data_dir.iterdir() if f.is_file()]

    def delete_file(self, client_id: str, filename: str):
        file_path = CLIENTS_DIR / client_id / "raw_data" / filename
        if not file_path.exists():
            raise FileNotFoundError(f"File {filename} not found")
        file_path.unlink()
        _sb_run(lambda sb: sb.storage.from_("raw-data").remove([f"{client_id}/{filename}"]))

    def get_raw_data_content(self, client_id: str) -> str:
        content = ""
        raw_data_dir = CLIENTS_DIR / client_id / "raw_data"
        if not raw_data_dir.exists():
            return ""
        for file in raw_data_dir.iterdir():
            if not file.is_file():
                continue
            if not file.exists():
                self._ensure_local_file("raw-data", client_id, file.name, file)
            filename = file.name
            extension = file.suffix.lower()
            content += f"\n--- START FILE: {filename} ---\n"
            if extension == ".pdf":
                try:
                    reader = PdfReader(file)
                    text = ""
                    for page in reader.pages:
                        extracted = page.extract_text()
                        if extracted:
                            text += extracted + "\n"
                    content += text if text.strip() else "[PDF senza testo leggibile]\n"
                except Exception as e:
                    content += f"[Errore PDF {filename}: {str(e)}]\n"
            elif extension in [".txt", ".md", ".json", ".csv"]:
                try:
                    with open(file, "r", encoding="utf-8") as f:
                        content += f.read()
                except Exception as e:
                    content += f"[Errore lettura {filename}: {str(e)}]\n"
            else:
                content += f"[File binario: {filename}]\n"
            content += f"\n--- END FILE: {filename} ---\n"
        return content

    # ─── TASKS ────────────────────────────────────────────────────
    def get_tasks(self) -> List[Dict[str, Any]]:
        if not TASKS_FILE.exists():
            return []
        with open(TASKS_FILE, "r") as f:
            return json.load(f)

    def save_tasks(self, tasks: List[Dict[str, Any]]):
        with open(TASKS_FILE, "w") as f:
            json.dump(tasks, f, indent=4)
        def _sync(sb):
            sb.table("tasks").delete().neq("id", "____never____").execute()
            if tasks:
                rows = [{"id": t["id"], "data": t, "created_at": t.get("created_at", datetime.now().isoformat())} for t in tasks]
                sb.table("tasks").insert(rows).execute()
        _sb_run(_sync)

    def create_task(self, title: str, client_id: Optional[str], client_name: Optional[str],
                    priority: str, due_date: Optional[str], notes: str,
                    estimated_time: Optional[str] = "") -> Dict[str, Any]:
        tasks = self.get_tasks()
        task = {
            "id": str(uuid.uuid4()), "title": title,
            "client_id": client_id or "", "client_name": client_name or "",
            "priority": priority, "status": "todo",
            "due_date": due_date or "", "notes": notes or "",
            "estimated_time": estimated_time or "",
            "created_at": datetime.now().isoformat()
        }
        tasks.append(task)
        self.save_tasks(tasks)
        return task

    def update_task(self, task_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        tasks = self.get_tasks()
        for task in tasks:
            if task["id"] == task_id:
                task.update(updates)
                self.save_tasks(tasks)
                return task
        raise FileNotFoundError(f"Task {task_id} not found")

    def delete_task(self, task_id: str):
        tasks = self.get_tasks()
        new_tasks = [t for t in tasks if t["id"] != task_id]
        if len(new_tasks) == len(tasks):
            raise FileNotFoundError(f"Task {task_id} not found")
        self.save_tasks(new_tasks)

    # ─── REPORTS ──────────────────────────────────────────────────
    def get_reports(self, client_id: str) -> List[Dict[str, Any]]:
        reports_dir = CLIENTS_DIR / client_id / "reports"
        if not reports_dir.exists():
            return []
        reports = []
        for f in sorted(reports_dir.glob("*.json")):
            with open(f, "r") as fp:
                reports.append(json.load(fp))
        return sorted(reports, key=lambda r: r.get("created_at", ""), reverse=True)

    def save_report(self, client_id: str, report_data: Dict[str, Any]) -> Dict[str, Any]:
        reports_dir = CLIENTS_DIR / client_id / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        report_id = str(uuid.uuid4())
        report_data["id"] = report_id
        report_data["created_at"] = datetime.now().isoformat()
        with open(reports_dir / f"{report_id}.json", "w") as f:
            json.dump(report_data, f, indent=4)
        _sb_run(lambda sb: sb.table("client_reports").insert({
            "id": report_id, "client_id": client_id,
            "data": report_data, "created_at": report_data["created_at"]
        }).execute())
        return report_data

    def update_report(self, client_id: str, report_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        report_path = CLIENTS_DIR / client_id / "reports" / f"{report_id}.json"
        if not report_path.exists():
            raise FileNotFoundError(f"Report {report_id} not found")
        with open(report_path, "r") as f:
            report = json.load(f)
        report.update(updates)
        with open(report_path, "w") as f:
            json.dump(report, f, indent=4)
        _sb_run(lambda sb: sb.table("client_reports").update({"data": report}).eq("id", report_id).execute())
        return report

    def delete_report(self, client_id: str, report_id: str):
        report_path = CLIENTS_DIR / client_id / "reports" / f"{report_id}.json"
        if not report_path.exists():
            raise FileNotFoundError(f"Report {report_id} not found")
        report_path.unlink()
        _sb_run(lambda sb: sb.table("client_reports").delete().eq("id", report_id).execute())

    # ─── SYNC HELPERS (called from main.py after direct file writes) ─
    def sync_research(self, client_id: str, content: str):
        _sb_run(lambda sb: sb.table("client_research").upsert({
            "client_id": client_id, "content": content,
            "updated_at": datetime.now().isoformat()
        }).execute())

    def sync_creative_intelligence(self, client_id: str, data: dict):
        _sb_run(lambda sb: sb.table("creative_intelligence").upsert({
            "client_id": client_id, "data": data,
            "updated_at": datetime.now().isoformat()
        }).execute())

    def sync_angles(self, client_id: str, data: list):
        _sb_run(lambda sb: sb.table("client_angles").upsert({
            "client_id": client_id, "data": data,
            "updated_at": datetime.now().isoformat()
        }).execute())

    def sync_graphics_meta(self, client_id: str, meta_list: list):
        _sb_run(lambda sb: sb.table("client_graphics_meta").upsert({
            "client_id": client_id, "data": meta_list,
            "updated_at": datetime.now().isoformat()
        }).execute())

    # ─── LOGO SUPABASE HELPERS ────────────────────────────────────
    def save_logo_to_supabase(self, client_id: str, logo_filename: str, content: bytes, ext: str):
        mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml"}
        mime = mime_map.get(ext.lower(), "application/octet-stream")
        path = f"{client_id}/{logo_filename}"
        def _upload(sb):
            try:
                sb.storage.from_("logos").remove([path])
            except Exception:
                pass
            sb.storage.from_("logos").upload(path, content, {"content-type": mime})
        _sb_run(_upload)

    def delete_logo_from_supabase(self, client_id: str, logo_filename: str):
        _sb_run(lambda sb: sb.storage.from_("logos").remove([f"{client_id}/{logo_filename}"]))

    # ─── GRAPHICS SUPABASE HELPERS ────────────────────────────────
    def save_graphic_to_supabase(self, client_id: str, filename: str, content: bytes):
        path = f"{client_id}/{filename}"
        def _upload(sb):
            try:
                sb.storage.from_("graphics").remove([path])
            except Exception:
                pass
            sb.storage.from_("graphics").upload(path, content, {"content-type": "image/png"})
        _sb_run(_upload)

    def delete_graphic_from_supabase(self, client_id: str, filename: str):
        _sb_run(lambda sb: sb.storage.from_("graphics").remove([f"{client_id}/{filename}"]))

    # ─── ON-DEMAND LOCAL CACHE (download from Supabase if missing) ─
    def _ensure_local_file(self, bucket: str, client_id: str, filename: str, local_path: Path) -> bool:
        if local_path.exists():
            return True
        sb = _get_sb()
        if not sb:
            return False
        try:
            data = sb.storage.from_(bucket).download(f"{client_id}/{filename}")
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(data)
            return True
        except Exception as e:
            print(f"[Supabase] Download {bucket}/{client_id}/{filename} failed: {e}")
            return False

    def ensure_local_logo(self, client_id: str):
        try:
            metadata = self.get_metadata(client_id)
            logo_filename = metadata.get("brand_identity", {}).get("logo", "")
            if logo_filename:
                logo_path = CLIENTS_DIR / client_id / "brand" / logo_filename
                self._ensure_local_file("logos", client_id, logo_filename, logo_path)
        except Exception:
            pass

    def ensure_local_graphic(self, client_id: str, filename: str):
        graphic_path = CLIENTS_DIR / client_id / "graphics" / filename
        self._ensure_local_file("graphics", client_id, filename, graphic_path)

    # ─── STARTUP SYNC (Supabase → local filesystem) ───────────────
    def sync_from_supabase(self):
        """Download all persistent data from Supabase to local filesystem. Called on app startup."""
        sb = _get_sb()
        if not sb:
            print("[Supabase] Sync skipped: SUPABASE_URL/SUPABASE_KEY not configured")
            return
        print("[Supabase] Starting startup sync...")

        # 1. Clients metadata
        try:
            result = sb.table("clients").select("id, name, metadata").execute()
            for row in result.data:
                client_id = row["id"]
                metadata = row["metadata"]
                client_path = CLIENTS_DIR / client_id
                client_path.mkdir(parents=True, exist_ok=True)
                for subdir in ["raw_data", "research", "scripts", "brand", "reports", "graphics"]:
                    (client_path / subdir).mkdir(exist_ok=True)
                with open(client_path / "metadata.json", "w") as f:
                    json.dump(metadata, f, indent=4)
            print(f"[Supabase] Synced {len(result.data)} clients")
        except Exception as e:
            print(f"[Supabase] Clients sync failed: {e}")

        # 2. Research
        try:
            result = sb.table("client_research").select("client_id, content").execute()
            for row in result.data:
                research_path = CLIENTS_DIR / row["client_id"] / "research" / "market_research.md"
                research_path.parent.mkdir(parents=True, exist_ok=True)
                with open(research_path, "w") as f:
                    f.write(row["content"])
            print(f"[Supabase] Synced {len(result.data)} research docs")
        except Exception as e:
            print(f"[Supabase] Research sync failed: {e}")

        # 3. Tasks
        try:
            result = sb.table("tasks").select("data").execute()
            tasks = [row["data"] for row in result.data]
            with open(TASKS_FILE, "w") as f:
                json.dump(tasks, f, indent=4)
            print(f"[Supabase] Synced {len(tasks)} tasks")
        except Exception as e:
            print(f"[Supabase] Tasks sync failed: {e}")

        # 4. Reports
        try:
            result = sb.table("client_reports").select("client_id, id, data").execute()
            for row in result.data:
                client_id = row["client_id"]
                reports_dir = CLIENTS_DIR / client_id / "reports"
                reports_dir.mkdir(parents=True, exist_ok=True)
                with open(reports_dir / f"{row['id']}.json", "w") as f:
                    json.dump(row["data"], f, indent=4)
            print(f"[Supabase] Synced {len(result.data)} reports")
        except Exception as e:
            print(f"[Supabase] Reports sync failed: {e}")

        # 5. Creative intelligence
        try:
            result = sb.table("creative_intelligence").select("client_id, data").execute()
            for row in result.data:
                intel_path = CLIENTS_DIR / row["client_id"] / "creative_intelligence.json"
                with open(intel_path, "w") as f:
                    json.dump(row["data"], f, indent=2, ensure_ascii=False)
            print(f"[Supabase] Synced {len(result.data)} creative intelligence")
        except Exception as e:
            print(f"[Supabase] Creative intelligence sync failed: {e}")

        # 6. Angles
        try:
            result = sb.table("client_angles").select("client_id, data").execute()
            for row in result.data:
                angles_path = CLIENTS_DIR / row["client_id"] / "angles.json"
                with open(angles_path, "w") as f:
                    json.dump(row["data"], f, indent=2, ensure_ascii=False)
            print(f"[Supabase] Synced {len(result.data)} angles")
        except Exception as e:
            print(f"[Supabase] Angles sync failed: {e}")

        # 7. Graphics metadata
        try:
            result = sb.table("client_graphics_meta").select("client_id, data").execute()
            for row in result.data:
                graphics_dir = CLIENTS_DIR / row["client_id"] / "graphics"
                graphics_dir.mkdir(parents=True, exist_ok=True)
                with open(graphics_dir / "graphics_meta.json", "w") as f:
                    json.dump(row["data"], f, indent=2, ensure_ascii=False)
            print(f"[Supabase] Synced {len(result.data)} graphics meta")
        except Exception as e:
            print(f"[Supabase] Graphics meta sync failed: {e}")

        print("[Supabase] Startup sync complete ✓")
