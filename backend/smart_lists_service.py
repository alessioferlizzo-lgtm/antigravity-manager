"""
Smart Lists Service - Apple Reminders style
Gestisce liste intelligenti con criteri di filtro dinamici
"""
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

PROJECT_ROOT = Path(__file__).parent.parent
SMART_LISTS_FILE = PROJECT_ROOT / "smart_lists.json"


class SmartListsService:
    """Gestisce le Smart Lists personalizzate dall'utente"""

    def __init__(self):
        if not SMART_LISTS_FILE.exists():
            self._init_default_smart_lists()

    def _init_default_smart_lists(self):
        """Inizializza le Smart Lists di sistema (non modificabili)"""
        default_lists = [
            {
                "id": "oggi",
                "title": "Oggi",
                "icon": "calendar",
                "color": "#007aff",
                "is_system": True,
                "is_smart": True,
                "criteria": {
                    "match": "all",  # 'all' (AND) o 'any' (OR)
                    "filters": [
                        {"field": "status", "operator": "not_equals", "value": "done"},
                        {"field": "due_date", "operator": "equals", "value": "today"}
                    ]
                }
            },
            {
                "id": "scheduled",
                "title": "Programmate",
                "icon": "calendar",
                "color": "#ff3b30",
                "is_system": True,
                "is_smart": True,
                "criteria": {
                    "match": "all",
                    "filters": [
                        {"field": "status", "operator": "not_equals", "value": "done"},
                        {"field": "due_date", "operator": "exists", "value": True}
                    ]
                }
            },
            {
                "id": "all",
                "title": "Tutte",
                "icon": "inbox",
                "color": "#636366",
                "is_system": True,
                "is_smart": True,
                "criteria": {
                    "match": "all",
                    "filters": [
                        {"field": "status", "operator": "not_equals", "value": "done"}
                    ]
                }
            },
            {
                "id": "flagged",
                "title": "Contrassegnate",
                "icon": "flag",
                "color": "#ff9500",
                "is_system": True,
                "is_smart": True,
                "criteria": {
                    "match": "all",
                    "filters": [
                        {"field": "status", "operator": "not_equals", "value": "done"},
                        {"field": "flagged", "operator": "equals", "value": True}
                    ]
                }
            },
            {
                "id": "completed",
                "title": "Completate",
                "icon": "check-circle",
                "color": "#8e8e93",
                "is_system": True,
                "is_smart": True,
                "criteria": {
                    "match": "all",
                    "filters": [
                        {"field": "status", "operator": "equals", "value": "done"}
                    ]
                }
            }
        ]

        with open(SMART_LISTS_FILE, "w") as f:
            json.dump(default_lists, f, indent=2)

    def get_all_smart_lists(self) -> List[Dict]:
        """Ottiene tutte le Smart Lists (sistema + custom)"""
        try:
            with open(SMART_LISTS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            self._init_default_smart_lists()
            return self.get_all_smart_lists()

    def get_custom_smart_lists(self) -> List[Dict]:
        """Ottiene solo le Smart Lists custom (create dall'utente)"""
        all_lists = self.get_all_smart_lists()
        return [l for l in all_lists if not l.get("is_system", False)]

    def create_smart_list(self, title: str, color: str, icon: str, criteria: Dict) -> Dict:
        """Crea una nuova Smart List custom"""
        import uuid

        new_list = {
            "id": str(uuid.uuid4()),
            "title": title,
            "icon": icon,
            "color": color,
            "is_system": False,
            "is_smart": True,
            "criteria": criteria,
            "created_at": datetime.now().isoformat()
        }

        all_lists = self.get_all_smart_lists()
        all_lists.append(new_list)

        with open(SMART_LISTS_FILE, "w") as f:
            json.dump(all_lists, f, indent=2)

        return new_list

    def update_smart_list(self, list_id: str, updates: Dict) -> Optional[Dict]:
        """Aggiorna una Smart List (solo se custom, non sistema)"""
        all_lists = self.get_all_smart_lists()

        for i, lst in enumerate(all_lists):
            if lst["id"] == list_id:
                if lst.get("is_system", False):
                    raise ValueError("Cannot modify system Smart Lists")

                # Update fields
                for key, value in updates.items():
                    if key != "id" and key != "is_system":
                        lst[key] = value

                lst["updated_at"] = datetime.now().isoformat()
                all_lists[i] = lst

                with open(SMART_LISTS_FILE, "w") as f:
                    json.dump(all_lists, f, indent=2)

                return lst

        return None

    def delete_smart_list(self, list_id: str) -> bool:
        """Elimina una Smart List (solo se custom)"""
        all_lists = self.get_all_smart_lists()

        for i, lst in enumerate(all_lists):
            if lst["id"] == list_id:
                if lst.get("is_system", False):
                    raise ValueError("Cannot delete system Smart Lists")

                all_lists.pop(i)

                with open(SMART_LISTS_FILE, "w") as f:
                    json.dump(all_lists, f, indent=2)

                return True

        return False

    def filter_tasks(self, tasks: List[Dict], criteria: Dict) -> List[Dict]:
        """
        Filtra le task secondo i criteri della Smart List

        Criteria structure:
        {
            "match": "all" | "any",  # AND o OR
            "filters": [
                {
                    "field": "due_date" | "priority" | "status" | "flagged" | "tags" | "client_id" | "estimated_time",
                    "operator": "equals" | "not_equals" | "contains" | "not_contains" | "exists" | "greater_than" | "less_than" | "before" | "after",
                    "value": any
                }
            ]
        }
        """
        match_mode = criteria.get("match", "all")
        filters = criteria.get("filters", [])

        if not filters:
            return tasks

        def task_matches_filter(task: Dict, filter_config: Dict) -> bool:
            field = filter_config["field"]
            operator = filter_config["operator"]
            value = filter_config["value"]

            # Get field value from task
            task_value = task.get(field)

            # Handle special date values
            if value == "today":
                value = datetime.now().strftime("%Y-%m-%d")
            elif value == "tomorrow":
                value = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            elif value == "this_week":
                # For range queries, we'll handle separately
                pass

            # Apply operator
            if operator == "equals":
                return task_value == value
            elif operator == "not_equals":
                return task_value != value
            elif operator == "contains":
                if isinstance(task_value, list):
                    return value in task_value
                elif isinstance(task_value, str):
                    return value.lower() in task_value.lower()
                return False
            elif operator == "not_contains":
                if isinstance(task_value, list):
                    return value not in task_value
                elif isinstance(task_value, str):
                    return value.lower() not in task_value.lower()
                return True
            elif operator == "exists":
                if value is True:
                    return task_value is not None and task_value != ""
                else:
                    return task_value is None or task_value == ""
            elif operator == "greater_than":
                try:
                    return float(task_value or 0) > float(value)
                except:
                    return False
            elif operator == "less_than":
                try:
                    return float(task_value or 0) < float(value)
                except:
                    return False
            elif operator == "before":
                if not task_value:
                    return False
                try:
                    task_date = datetime.fromisoformat(task_value.replace("Z", "+00:00"))
                    compare_date = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    return task_date < compare_date
                except:
                    return False
            elif operator == "after":
                if not task_value:
                    return False
                try:
                    task_date = datetime.fromisoformat(task_value.replace("Z", "+00:00"))
                    compare_date = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    return task_date > compare_date
                except:
                    return False

            return False

        # Filter tasks based on match mode
        filtered = []
        for task in tasks:
            if match_mode == "all":
                # ALL filters must match (AND)
                if all(task_matches_filter(task, f) for f in filters):
                    filtered.append(task)
            else:
                # ANY filter must match (OR)
                if any(task_matches_filter(task, f) for f in filters):
                    filtered.append(task)

        return filtered


# Singleton instance
smart_lists_service = SmartListsService()
