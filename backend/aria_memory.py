"""
ARIA Memory — Persistent learning and feedback system for the ARIA agent.

Stores:
- Feedback history per client and output type
- Vocabulary learned from target audiences
- Success patterns (what outputs were kept without modification)
- Failure patterns (what was regenerated multiple times)
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

ARIA_MEMORY_FILE = Path(__file__).parent / "storage" / "aria_memory.json"


def _load_memory() -> Dict[str, Any]:
    """Load the full memory store from disk."""
    if not ARIA_MEMORY_FILE.exists():
        ARIA_MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        return {
            "feedback_history": [],
            "success_patterns": {},
            "failure_patterns": {},
            "learned_vocabulary": {},
            "client_preferences": {},
            "regeneration_counts": {},
        }
    with open(ARIA_MEMORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_memory(memory: Dict[str, Any]) -> None:
    """Save the full memory store to disk."""
    ARIA_MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ARIA_MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(memory, f, indent=2, ensure_ascii=False)


class ARIAMemory:
    """
    Manages ARIA's persistent memory across sessions.
    Implements the self-improvement loop described in agent-orchestration-improve-agent skill.
    """

    def save_feedback(
        self,
        client_id: str,
        output_type: str,  # "angle", "copy", "script", "analysis"
        output_content: str,
        feedback: str,
        kept: bool = False,  # True = user liked it, False = regenerated
        task_context: Optional[Dict] = None,
    ) -> None:
        """Record explicit or implicit feedback on a generated output."""
        memory = _load_memory()

        entry = {
            "id": f"{client_id}_{output_type}_{datetime.now().isoformat()}",
            "client_id": client_id,
            "output_type": output_type,
            "output_content": output_content[:500],  # store snippet
            "feedback": feedback,
            "kept": kept,
            "timestamp": datetime.now().isoformat(),
            "task_context": task_context or {},
        }

        memory["feedback_history"].append(entry)

        # Update success/failure patterns
        key = f"{client_id}:{output_type}"
        if kept:
            if key not in memory["success_patterns"]:
                memory["success_patterns"][key] = []
            memory["success_patterns"][key].append({
                "snippet": output_content[:200],
                "feedback": feedback,
                "timestamp": entry["timestamp"],
            })
            # Keep only last 20 successes per key
            memory["success_patterns"][key] = memory["success_patterns"][key][-20:]
        else:
            if key not in memory["failure_patterns"]:
                memory["failure_patterns"][key] = []
            memory["failure_patterns"][key].append({
                "feedback": feedback,
                "timestamp": entry["timestamp"],
            })
            memory["failure_patterns"][key] = memory["failure_patterns"][key][-20:]

        _save_memory(memory)

    def record_regeneration(self, client_id: str, output_type: str, task_id: str) -> int:
        """
        Record that the user triggered a regeneration (implicit negative feedback).
        Returns the new count of regenerations for this task.
        """
        memory = _load_memory()
        key = f"{task_id}:{output_type}"
        count = memory["regeneration_counts"].get(key, 0) + 1
        memory["regeneration_counts"][key] = count
        _save_memory(memory)
        return count

    def learn_vocabulary(self, client_id: str, vocab_words: List[str]) -> None:
        """Store target vocabulary words learned from analysis for a client."""
        memory = _load_memory()
        existing = set(memory["learned_vocabulary"].get(client_id, []))
        existing.update(vocab_words)
        memory["learned_vocabulary"][client_id] = list(existing)[-100:]  # cap at 100
        _save_memory(memory)

    def set_client_preference(self, client_id: str, key: str, value: Any) -> None:
        """Store a general preference for a client (tone, avoid_words, etc.)."""
        memory = _load_memory()
        if client_id not in memory["client_preferences"]:
            memory["client_preferences"][client_id] = {}
        memory["client_preferences"][client_id][key] = value
        _save_memory(memory)

    def recall_context(self, client_id: str, output_type: str) -> str:
        """
        Builds a context string that ARIA injects into prompts to utilise past learnings.
        Follows the few-shot example optimization from agent-orchestration-improve-agent skill.
        """
        memory = _load_memory()
        sections = []

        # Success examples
        key = f"{client_id}:{output_type}"
        successes = memory["success_patterns"].get(key, [])
        if successes:
            examples = "\n".join(
                f"- [ESEMPIO VINCENTE] \"{s['snippet'][:150]}...\" → Feedback: {s['feedback']}"
                for s in successes[-5:]
            )
            sections.append(f"=== OUTPUT PRECEDENTI APPROVATI (usa come riferimento stilistico) ===\n{examples}")

        # Failure patterns
        failures = memory["failure_patterns"].get(key, [])
        if failures:
            bad = "\n".join(f"- {f['feedback']}" for f in failures[-5:])
            sections.append(f"=== ERRORI DA EVITARE (feedback negativi passati) ===\n{bad}")

        # Learned vocabulary
        vocab = memory["learned_vocabulary"].get(client_id, [])
        if vocab:
            sections.append(f"=== VOCABOLARIO TARGET APPRESO ===\n{', '.join(vocab[:30])}")

        # Client preferences
        prefs = memory["client_preferences"].get(client_id, {})
        if prefs:
            pref_lines = "\n".join(f"- {k}: {v}" for k, v in prefs.items())
            sections.append(f"=== PREFERENZE CLIENTE ===\n{pref_lines}")

        if not sections:
            return ""

        return "\n\n".join(sections)

    def get_client_summary(self, client_id: str) -> Dict[str, Any]:
        """Returns a structured summary of what ARIA has learned about a client."""
        memory = _load_memory()
        total_feedback = [e for e in memory["feedback_history"] if e["client_id"] == client_id]
        kept = [e for e in total_feedback if e.get("kept")]
        discarded = [e for e in total_feedback if not e.get("kept")]

        return {
            "client_id": client_id,
            "total_outputs_generated": len(total_feedback),
            "outputs_kept": len(kept),
            "outputs_discarded": len(discarded),
            "approval_rate": round(len(kept) / len(total_feedback) * 100) if total_feedback else 0,
            "learned_vocabulary_count": len(memory["learned_vocabulary"].get(client_id, [])),
            "preferences": memory["client_preferences"].get(client_id, {}),
            "recent_feedback": [
                {"type": e["output_type"], "feedback": e["feedback"], "kept": e["kept"]}
                for e in total_feedback[-10:]
            ],
        }

    def get_all_feedback(self) -> List[Dict]:
        """Returns all feedback history (for admin/debug)."""
        memory = _load_memory()
        return memory["feedback_history"]


# Singleton
aria_memory = ARIAMemory()
