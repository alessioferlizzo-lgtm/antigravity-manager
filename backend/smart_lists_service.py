"""
Smart Lists Service - Apple Reminders style
Gestisce liste intelligenti con criteri di filtro dinamici
Usa Supabase per la persistenza
"""
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import uuid

# Default Smart Lists di sistema
DEFAULT_SYSTEM_LISTS = [
    {
        "id": "oggi",
        "title": "Oggi",
        "icon": "calendar",
        "color": "#007aff",
        "is_system": True,
        "is_smart": True,
        "criteria": {
            "match": "all",
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


class SmartListsService:
    """Gestisce le Smart Lists personalizzate dall'utente usando Supabase"""

    def __init__(self):
        # Import qui per evitare circular imports
        from .storage_service import _get_sb
        self.sb = _get_sb()

    def get_all_smart_lists(self) -> List[Dict]:
        """Ottiene tutte le Smart Lists (sistema + custom da Supabase)"""
        # Inizia con le liste di sistema (sempre presenti)
        all_lists = list(DEFAULT_SYSTEM_LISTS)

        # Aggiungi le liste custom da Supabase
        try:
            if self.sb:
                response = self.sb.table("smart_lists").select("*").execute()
                custom_lists = response.data if response.data else []
                all_lists.extend(custom_lists)
        except Exception as e:
            print(f"Error loading custom smart lists from Supabase: {e}")

        return all_lists

    def get_custom_smart_lists(self) -> List[Dict]:
        """Ottiene solo le Smart Lists custom (create dall'utente)"""
        all_lists = self.get_all_smart_lists()
        return [l for l in all_lists if not l.get("is_system", False)]

    def create_smart_list(self, title: str, color: str, icon: str, criteria: Dict) -> Dict:
        """Crea una nuova Smart List custom in Supabase"""
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

        if self.sb:
            try:
                response = self.sb.table("smart_lists").insert(new_list).execute()
                if response.data:
                    return response.data[0]
            except Exception as e:
                print(f"Error creating smart list in Supabase: {e}")

        return new_list

    def update_smart_list(self, list_id: str, updates: Dict) -> Optional[Dict]:
        """Aggiorna una Smart List (solo se custom, non sistema) in Supabase"""
        # Verifica che non sia una lista di sistema
        if list_id in [sl["id"] for sl in DEFAULT_SYSTEM_LISTS]:
            raise ValueError("Cannot modify system Smart Lists")

        if self.sb:
            try:
                # Prepara gli update
                update_data = {k: v for k, v in updates.items() if k not in ["id", "is_system"]}
                update_data["updated_at"] = datetime.now().isoformat()

                response = self.sb.table("smart_lists").update(update_data).eq("id", list_id).execute()
                if response.data:
                    return response.data[0]
            except Exception as e:
                print(f"Error updating smart list in Supabase: {e}")

        return None

    def delete_smart_list(self, list_id: str) -> bool:
        """Elimina una Smart List (solo se custom) da Supabase"""
        # Verifica che non sia una lista di sistema
        if list_id in [sl["id"] for sl in DEFAULT_SYSTEM_LISTS]:
            raise ValueError("Cannot delete system Smart Lists")

        if self.sb:
            try:
                self.sb.table("smart_lists").delete().eq("id", list_id).execute()
                return True
            except Exception as e:
                print(f"Error deleting smart list from Supabase: {e}")
                return False

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
