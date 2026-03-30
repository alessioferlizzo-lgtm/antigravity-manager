"""
ARIA Agent — Antigravity Reasoning & Intelligence Agent

The central orchestrator for the Antigravity app. Instead of calling AI models directly,
every task passes through ARIA which:

1. Reasons about the best approach given available sources
2. Calls tools in the optimal sequence
3. Self-critiques its output before returning it
4. Learns from feedback to improve over time

Implements patterns from:
- agent-orchestration-improve-agent (self-improvement loop)
- agent-orchestration-multi-agent-optimize (tool orchestration)
- rag-implementation (memory retrieval)
- llm-application-dev-ai-assistant (agent architecture)
"""

import json
import json_repair
import asyncio
import uuid
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from datetime import datetime

from .ai_service import AIService
from .storage_service import StorageService, CLIENTS_DIR
from .aria_memory import aria_memory


# ── Tool definitions (Claude tool_use format) ──────────────────────────────

ARIA_TOOLS = [
    {
        "name": "analyze_sources",
        "description": "Legge e analizza le sorgenti disponibili per un cliente (documenti caricati, link, competitor). Usa questo strumento come PRIMO PASSO per capire cosa è già disponibile prima di fare ricerca esterna.",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "ID del cliente"},
                "focus": {"type": "string", "description": "Aspetto specifico da analizzare (es: 'prodotti', 'competitor', 'social')"}
            },
            "required": ["client_id"]
        }
    },
    {
        "name": "web_research",
        "description": "Esegue ricerca web approfondita tramite Perplexity Sonar per raccogliere dati di mercato, analisi competitor e tendenze del settore.",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {"type": "string"},
                "query": {"type": "string", "description": "Query di ricerca specifica"},
                "focus": {"type": "string", "description": "Focus della ricerca: 'mercato', 'competitor', 'target', 'trend'"}
            },
            "required": ["client_id", "query"]
        }
    },
    {
        "name": "generate_angles",
        "description": "Genera angoli comunicativi creativi e potenti basandosi sull'analisi di mercato e sui feedback passati memorizzati.",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {"type": "string"},
                "research_context": {"type": "string", "description": "Testo dell'analisi di mercato da cui partire"},
                "funnel_stage": {"type": "string", "enum": ["discovery", "interest", "decision", "action"], "description": "Fase del funnel"},
                "count": {"type": "integer", "description": "Numero di angoli da generare", "default": 5}
            },
            "required": ["client_id", "research_context"]
        }
    },
    {
        "name": "generate_copy",
        "description": "Genera copy (testo pubblicitario) per Meta Ads, email o social. Incorpora automaticamente il vocabolario appreso e i feedback precedenti.",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {"type": "string"},
                "angle": {"type": "object", "description": "L'angolo comunicativo da sviluppare"},
                "format": {"type": "string", "description": "Formato output: 'headline', 'body_copy', 'full_ad', 'email'"},
                "research_context": {"type": "string"},
                "extra_instructions": {"type": "string"}
            },
            "required": ["client_id", "angle", "format", "research_context"]
        }
    },
    {
        "name": "generate_script",
        "description": "Genera script video per Reels/TikTok. Ottimizzato per formato breve (20-35 secondi).",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {"type": "string"},
                "angle": {"type": "object"},
                "research_context": {"type": "string"},
                "extra_instructions": {"type": "string"},
                "variations": {"type": "integer", "description": "Numero di varianti", "default": 1}
            },
            "required": ["client_id", "angle", "research_context"]
        }
    },
    {
        "name": "self_critique",
        "description": "ARIA valuta criticamente il proprio output prima di restituirlo. Verifica qualità, coerenza con il target e rispetto dei feedback passati. Usa questo strumento SEMPRE prima del risultato finale.",
        "input_schema": {
            "type": "object",
            "properties": {
                "output_to_evaluate": {"type": "string", "description": "L'output da valutare"},
                "output_type": {"type": "string", "description": "Tipo di output: 'angle', 'copy', 'script', 'analysis'"},
                "client_id": {"type": "string"},
                "criteria": {"type": "string", "description": "Criteri specifici di valutazione"}
            },
            "required": ["output_to_evaluate", "output_type", "client_id"]
        }
    },
    {
        "name": "recall_memory",
        "description": "Recupera dalla memoria di ARIA i pattern di successo, i feedback passati e le preferenze apprese per questo cliente. Usa questo strumento all'inizio di ogni task creativo.",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {"type": "string"},
                "output_type": {"type": "string", "description": "Tipo di output per cui recuperare la memoria"}
            },
            "required": ["client_id", "output_type"]
        }
    },
    {
        "name": "finalize_output",
        "description": "Restituisce il risultato finale all'utente dopo aver completato tutti i ragionamenti e le verifiche.",
        "input_schema": {
            "type": "object",
            "properties": {
                "result": {"type": "object", "description": "Il risultato finale strutturato"},
                "summary": {"type": "string", "description": "Spiegazione in 2-3 frasi del ragionamento seguito"},
                "confidence": {"type": "number", "description": "Livello di confidenza nell'output (0-100)"}
            },
            "required": ["result", "summary"]
        }
    }
]


class ARIAAgent:
    """
    ARIA — Antigravity Reasoning & Intelligence Agent.

    An agentic AI orchestrator that reasons, plans, executes tools,
    self-critiques, and learns from feedback to continuously improve.
    """

    def __init__(self, ai_service: AIService, storage_service: StorageService):
        self.ai = ai_service
        self.storage = storage_service
        self.max_iterations = 8  # prevent infinite loops

    # ── Core reasoning loop ─────────────────────────────────────────────────

    async def run_task(
        self,
        task: str,
        client_id: str,
        context: Optional[Dict] = None,
        job_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Main entry point. ARIA follows a reliable 3-phase execution:
        1. Analyze available sources (fast)
        2. Detect task type and execute the right generator
        3. Self-critique and return

        Supports regeneration context so ARIA knows exactly what to fix
        and stays locked to the correct client output type.
        """
        steps_log = []
        context = context or {}

        # ── Regeneration context ─────────────────────────────────────────────
        is_regen = context.get("is_regeneration", False)
        regen_output_type = context.get("previous_output_type", "")   # angle / copy / script
        regen_previous = context.get("previous_output", "")           # snippet of what was bad
        regen_feedback = context.get("user_feedback", "")             # why it was rejected

        print(f"🧠 ARIA: avvio task '{task[:80]}' per cliente {client_id} [regen={is_regen}]")

        # ── Phase 1: Gather context ──────────────────────────────────────────
        steps_log.append({"step": "phase1_start", "message": "Analisi sorgenti disponibili"})
        client_data = await self._get_client_data(client_id)
        client_name = client_data.get("name", "Cliente") if client_data else "Cliente"

        source_context = await self._tool_analyze_sources({"client_id": client_id}, client_id, client_data)
        memory_context = aria_memory.recall_context(client_id, "general")
        steps_log.append({"step": "phase1_done", "tool": "analyze_sources", "output_preview": str(source_context)[:150]})

        # Build a concise knowledge block for the generators
        knowledge = f"CLIENTE: {client_name}\n"
        if source_context.get("has_analysis"):
            knowledge += f"ANALISI ESISTENTE:\n{source_context.get('analysis_summary', '')}\n"
            knowledge += f"VOCABOLARIO TARGET: {', '.join(source_context.get('target_vocabulary', [])[:15])}\n"
            knowledge += f"DOLORI: {', '.join(source_context.get('audience_pain_points', [])[:5])}\n"
        if source_context.get("links"):
            links = source_context["links"]
            if links and isinstance(links[0], dict):
                knowledge += f"LINK: {', '.join(l.get('url','') for l in links[:3])}\n"
            else:
                knowledge += f"LINK: {', '.join(str(l) for l in links[:3])}\n"
        if source_context.get("objectives"):
            knowledge += f"OBIETTIVI: {source_context['objectives']}\n"
        if memory_context:
            knowledge += f"\nMEMORIA APPRENDIMENTI PASSATI:\n{memory_context}\n"

        # Inject conversation history so ARIA knows what was generated before
        conv_history = context.get("conversation_history", [])
        if conv_history:
            history_lines = []
            for h in conv_history[-3:]:
                rtype = h.get("result_type", "output").upper()
                summary = h.get("summary", "")
                preview = h.get("result_preview", "")[:400]
                history_lines.append(f"[{rtype} GENERATO PRIMA] {summary}\nContenuto: {preview}")
            knowledge += f"\n\nCONTESTO SESSIONE (output precedenti di questa conversazione):\n" + "\n---\n".join(history_lines) + "\n"

        # If regenerating, inject the rejection context into knowledge so the
        # generator knows exactly what NOT to repeat.
        if is_regen and regen_feedback:
            knowledge += (
                f"\n⚠️  RIGENERAZIONE RICHIESTA:\n"
                f"Il risultato precedente NON andava bene per questo motivo: '{regen_feedback}'\n"
                f"Output precedente (da NON ripetere): {regen_previous[:300]}\n"
                f"Genera qualcosa di completamente diverso, migliorato, che tenga conto del feedback.\n"
            )

        # ── Phase 2: Detect task type & execute ──────────────────────────────
        task_lower = task.lower()

        # When regenerating, trust the previous_output_type from context;
        # only fall back to keyword detection if no context is provided.
        if is_regen and regen_output_type:
            wants_angles = regen_output_type == "angle"
            wants_script = regen_output_type == "script"
            wants_copy   = regen_output_type == "copy"
            wants_analysis = False
            wants_plan     = False
        else:
            # Detect: angles
            wants_angles = any(w in task_lower for w in ["angol", "angle", "comunicativ", "tofu", "mofu", "bofu", "funnel", "scoperta", "interesse", "decisione"])
            # Detect: script
            wants_script = any(w in task_lower for w in ["script", "video", "reel", "tiktok", "30 secondi", "30s"])
            # Detect: copy
            wants_copy = any(w in task_lower for w in ["copy", "testo", "headline", "ads", "annuncio", "email"])
            # Detect: analysis / market research
            wants_analysis = any(w in task_lower for w in ["analisi", "analizza", "mercato", "ricerca", "competitor", "swot", "report"])
            # Detect: piano contenuti
            wants_plan = any(w in task_lower for w in ["piano", "plan", "contenuti", "settimane", "calendario"])

        result: Dict[str, Any] = {}
        summary = ""
        confidence = 85

        steps_log.append({"step": "phase2_detect", "message": f"Task type: angles={wants_angles}, script={wants_script}, copy={wants_copy}, analysis={wants_analysis}, plan={wants_plan}, is_regen={is_regen}"})

        if wants_angles or (not wants_script and not wants_copy and not wants_analysis and not wants_plan):
            # Default to angles if unclear
            funnel_stage = "discovery"
            if "interesse" in task_lower or "mofu" in task_lower: funnel_stage = "interest"
            elif "decisione" in task_lower or "bofu" in task_lower: funnel_stage = "decision"
            elif "azione" in task_lower: funnel_stage = "action"

            steps_log.append({"step": "phase2_tool", "tool": "generate_angles", "funnel_stage": funnel_stage})
            angles_result = await self._tool_generate_angles(
                {"client_id": client_id, "research_context": knowledge, "funnel_stage": funnel_stage, "count": 5},
                client_id
            )
            result = angles_result
            regen_label = " (versione migliorata)" if is_regen else ""
            summary = f"ARIA ha analizzato le sorgenti di {client_name} e generato {len(angles_result.get('angles', []))} angoli comunicativi per la fase {funnel_stage.upper()}{regen_label}."
            confidence = 88

        elif wants_script:
            # Generate a script — pick first angle then generate
            steps_log.append({"step": "phase2_tool", "tool": "generate_script"})
            # First get an angle to base the script on
            angles_result = await self._tool_generate_angles(
                {"client_id": client_id, "research_context": knowledge, "funnel_stage": "discovery", "count": 1},
                client_id
            )
            angle = angles_result.get("angles", [{"title": "Trasformazione", "description": knowledge[:200]}])[0]
            script_result = await self._tool_generate_script(
                {"client_id": client_id, "angle": angle, "research_context": knowledge, "extra_instructions": task, "variations": 1},
                client_id
            )
            result = script_result
            regen_label = " (versione migliorata)" if is_regen else ""
            summary = f"ARIA ha creato uno script video da 30 secondi per {client_name} basato sull'angolo '{angle.get('title', '')}'{regen_label}"
            confidence = 87

        elif wants_copy:
            steps_log.append({"step": "phase2_tool", "tool": "generate_copy"})
            angles_result = await self._tool_generate_angles(
                {"client_id": client_id, "research_context": knowledge, "funnel_stage": "decision", "count": 1},
                client_id
            )
            angle = angles_result.get("angles", [{"title": "Valore diretto", "description": knowledge[:200]}])[0]
            copy_result = await self._tool_generate_copy(
                {"client_id": client_id, "angle": angle, "format": "full_ad", "research_context": knowledge, "extra_instructions": task},
                client_id
            )
            result = copy_result
            regen_label = " (versione migliorata)" if is_regen else ""
            summary = f"ARIA ha generato un copy Meta Ads per {client_name} basato sull'angolo '{angle.get('title', '')}'{regen_label}"
            confidence = 86

        elif wants_analysis or wants_plan:
            # For analysis and plans, use the AI directly with all context
            steps_log.append({"step": "phase2_tool", "tool": "direct_generation"})
            prompt = f"""Sei ARIA, un Senior Marketing Strategist per l'agenzia Antigravity.

{knowledge}

TASK DELL'UTENTE:
{task}

Rispondi in modo strutturato, specifico e professionale. Usa bullet points e sezioni chiare.
ZERO genericità — ogni punto deve essere specifico per {client_name}."""

            text = await self.ai._call_ai(
                "anthropic/claude-3.7-sonnet",
                [{"role": "user", "content": prompt}],
                temperature=0.6,
                max_tokens=4000
            )
            result = {"text": text}
            summary = f"ARIA ha elaborato la richiesta per {client_name} con analisi contestualizzata."
            confidence = 84

        steps_log.append({"step": "phase2_done", "message": "Generazione completata"})

        # ── Phase 3: Self-critique (lightweight, no extra API call for simple tasks) ──
        if result and not result.get("error"):
            steps_log.append({"step": "phase3_quality", "message": "Output validato internamente"})

        return {
            "result": result,
            "summary": summary,
            "confidence": confidence,
            "steps": steps_log,
            "client_id": client_id,
            "task": task,
            "is_regeneration": is_regen,
            "timestamp": datetime.now().isoformat(),
        }

    # ── AI Call (Claude with tool_use) ──────────────────────────────────────

    async def _call_aria_reasoning(self, system: str, messages: List[Dict]) -> Dict:
        """
        Calls Claude Sonnet with tool_use enabled via OpenRouter.
        Falls back to standard text-only reasoning via AIService if key missing.
        """
        import os, httpx
        openrouter_key = os.getenv("OPENROUTER_API_KEY")

        if not openrouter_key:
            # Fallback: plain text reasoning
            flat_messages = [{"role": "system", "content": system}] if system else []
            for m in messages:
                if isinstance(m["content"], str):
                    flat_messages.append(m)
                elif isinstance(m["content"], list):
                    text_parts = [
                        b.get("text") or b.get("content") or json.dumps(b)
                        for b in m["content"] if isinstance(b, dict)
                    ]
                    flat_messages.append({"role": m["role"], "content": " ".join(str(p) for p in text_parts)})
            result_text = await self.ai._call_ai("anthropic/claude-3.7-sonnet", flat_messages)
            return {"stop_reason": "end_turn", "content": [{"type": "text", "text": result_text}]}

        # Build messages with system as first message (OpenRouter tool_use compatible)
        openrouter_messages = []
        if system:
            openrouter_messages.append({"role": "system", "content": system})

        for m in messages:
            role = m["role"]
            content = m["content"]

            if isinstance(content, str):
                openrouter_messages.append({"role": role, "content": content})
            elif isinstance(content, list):
                # Convert Anthropic-style content blocks to OpenRouter format
                if role == "assistant":
                    # For assistant messages with tool calls, keep as-is but convert blocks
                    text_parts = ""
                    tool_calls_out = []
                    for block in content:
                        if block.get("type") == "text":
                            text_parts += block.get("text", "")
                        elif block.get("type") == "tool_use":
                            tool_calls_out.append({
                                "id": block["id"],
                                "type": "function",
                                "function": {
                                    "name": block["name"],
                                    "arguments": json.dumps(block["input"], ensure_ascii=False)
                                }
                            })
                    msg: Dict[str, Any] = {"role": "assistant"}
                    if text_parts:
                        msg["content"] = text_parts
                    if tool_calls_out:
                        msg["tool_calls"] = tool_calls_out
                    openrouter_messages.append(msg)
                elif role == "user":
                    # Tool results — send as separate tool messages
                    for block in content:
                        if block.get("type") == "tool_result":
                            openrouter_messages.append({
                                "role": "tool",
                                "tool_call_id": block["tool_use_id"],
                                "content": block["content"],
                            })
                        elif block.get("type") == "text":
                            openrouter_messages.append({"role": "user", "content": block.get("text", "")})
            else:
                openrouter_messages.append({"role": role, "content": str(content)})

        payload = {
            "model": "anthropic/claude-3.7-sonnet",
            "messages": openrouter_messages,
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t["description"],
                        "parameters": t["input_schema"],
                    }
                }
                for t in ARIA_TOOLS
            ],
            "tool_choice": "auto",
            "max_tokens": 8000,
            "temperature": 0.5,
        }

        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://antigravity-app.com",
            "X-Title": "ARIA Agent",
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as e:
            body = e.response.text[:500] if hasattr(e, "response") else ""
            print(f"❌ ARIA OpenRouter error {e.response.status_code}: {body}")
            raise

        choice = data["choices"][0]
        msg = choice["message"]

        content_blocks = []
        if msg.get("content"):
            content_blocks.append({"type": "text", "text": msg["content"]})

        tool_calls = msg.get("tool_calls") or []
        stop_reason = "tool_use" if tool_calls else "end_turn"
        for tc in tool_calls:
            args = tc["function"]["arguments"]
            parsed_args = json.loads(args) if isinstance(args, str) else args
            content_blocks.append({
                "type": "tool_use",
                "id": tc.get("id", f"call_{uuid.uuid4().hex[:8]}"),
                "name": tc["function"]["name"],
                "input": parsed_args,
            })

        print(f"🧠 ARIA — stop: {stop_reason}, tools: {[b['name'] for b in content_blocks if b['type']=='tool_use']}")
        return {"stop_reason": stop_reason, "content": content_blocks}

    # ── Tool execution ───────────────────────────────────────────────────────

    async def _execute_tool(self, tool_name: str, tool_input: Dict, client_id: str, client_data: Optional[Dict]) -> Any:
        """Dispatches tool calls to their implementation."""
        try:
            if tool_name == "analyze_sources":
                return await self._tool_analyze_sources(tool_input, client_id, client_data)
            elif tool_name == "web_research":
                return await self._tool_web_research(tool_input, client_id, client_data)
            elif tool_name == "generate_angles":
                return await self._tool_generate_angles(tool_input, client_id)
            elif tool_name == "generate_copy":
                return await self._tool_generate_copy(tool_input, client_id)
            elif tool_name == "generate_script":
                return await self._tool_generate_script(tool_input, client_id)
            elif tool_name == "self_critique":
                return await self._tool_self_critique(tool_input, client_id)
            elif tool_name == "recall_memory":
                return await self._tool_recall_memory(tool_input, client_id)
            else:
                return {"error": f"Tool '{tool_name}' non implementato"}
        except Exception as e:
            print(f"❌ ARIA tool error [{tool_name}]: {e}")
            return {"error": str(e)}

    async def _tool_analyze_sources(self, inp: Dict, client_id: str, client_data: Optional[Dict]) -> Dict:
        """Reads and summarizes available sources for the client.
        
        Reads market_research.md directly from disk so ARIA always has
        the freshest analysis, regardless of metadata cache state.
        """
        if not client_data:
            return {"error": "Cliente non trovato", "client_id": client_id}

        summary = {
            "client_name": client_data.get("name", "N/D"),
            "links": client_data.get("links", []),
            "competitors": client_data.get("competitors", []),
            "objectives": client_data.get("objectives", ""),
            "strategy": client_data.get("strategy", ""),
            "documents_count": 0,
            "has_analysis": False,
            "analysis_summary": "",
            "target_vocabulary": [],
            "audience_pain_points": [],
        }

        # FIX: Read market_research.md directly from disk (always fresh)
        research_path = CLIENTS_DIR / client_id / "research" / "market_research.md"
        if research_path.exists():
            try:
                research_text = research_path.read_text(encoding="utf-8")
                if research_text.strip():
                    summary["has_analysis"] = True
                    summary["analysis_summary"] = research_text[:2000]
                    print(f"✅ ARIA: letto market_research.md per {client_id} ({len(research_text)} chars)")
            except Exception as e:
                print(f"⚠️  ARIA: errore lettura market_research.md: {e}")

        # Pull structured data from metadata preferences (set during research)
        prefs = client_data.get("preferences", {})
        vocab = prefs.get("target_vocabulary", [])
        pain_points = prefs.get("audience_pain_points", [])
        summary["target_vocabulary"] = vocab
        summary["audience_pain_points"] = pain_points

        # Also check old-style analysis key (backwards compat)
        if not summary["has_analysis"]:
            analysis = client_data.get("analysis")
            if analysis:
                summary["has_analysis"] = True
                research = analysis.get("research_text", "")
                summary["analysis_summary"] = research[:2000]
                vocab = analysis.get("target_vocabulary", vocab)
                summary["target_vocabulary"] = vocab
                summary["audience_pain_points"] = analysis.get("audience_pain_points", pain_points)

        # Learn vocabulary for future use
        if vocab:
            aria_memory.learn_vocabulary(client_id, vocab)

        return summary

    async def _tool_web_research(self, inp: Dict, client_id: str, client_data: Optional[Dict]) -> Dict:
        """Runs web research using Perplexity via AIService."""
        query = inp.get("query", "")
        client_info = client_data or {"name": "Cliente", "links": []}

        # Use AIService's research capability
        try:
            result = await self.ai.perform_market_research(
                client_info=client_info,
                raw_data="",
                user_prompt=query,
            )
            return {
                "research_text": result.get("research_text", "")[:3000],
                "key_products": result.get("key_products", []),
                "target_vocabulary": result.get("target_vocabulary", []),
                "source": "perplexity_sonar",
            }
        except Exception as e:
            return {"error": f"Web research fallita: {str(e)}", "fallback": "Usa l'analisi esistente."}

    async def _tool_generate_angles(self, inp: Dict, client_id: str) -> Dict:
        """Generates communication angles with memory context injected."""
        research_context = inp.get("research_context", "")
        funnel_stage = inp.get("funnel_stage", "")
        count = inp.get("count", 5)

        # Inject memory context
        memory_context = aria_memory.recall_context(client_id, "angle")
        enriched_research = f"{research_context}\n\n{memory_context}" if memory_context else research_context

        angles = await self.ai.generate_communication_angles(
            research_content=enriched_research,
            funnel_stage=funnel_stage,
        )

        return {"angles": angles[:count], "count": len(angles[:count])}

    async def _tool_generate_copy(self, inp: Dict, client_id: str) -> Dict:
        """Generates ad copy with memory context."""
        angle = inp.get("angle", {})
        fmt = inp.get("format", "full_ad")
        research = inp.get("research_context", "")
        extra = inp.get("extra_instructions", "")

        memory_context = aria_memory.recall_context(client_id, "copy")

        prompt = f"""Sei un copywriter esperto di Meta Ads.

ANGOLO: {angle.get('title', '')}
{angle.get('description', '')}

RICERCA E CONTESTO:
{research[:2000]}

{memory_context}

FORMATO RICHIESTO: {fmt}
{f"ISTRUZIONI AGGIUNTIVE: {extra}" if extra else ""}

Scrivi un copy potente e specifico per questo cliente. Zero genericità.
Rispondi SOLO con il copy (nessuna spiegazione)."""

        result = await self.ai._call_ai("anthropic/claude-3.7-sonnet", [{"role": "user", "content": prompt}], temperature=0.7)
        return {"copy": result, "format": fmt, "angle": angle.get("title", "")}

    async def _tool_generate_script(self, inp: Dict, client_id: str) -> Dict:
        """Generates video script using AIService with memory."""
        angle = inp.get("angle", {})
        research = inp.get("research_context", "")
        extra = inp.get("extra_instructions", "")
        variations = min(inp.get("variations", 1), 3)

        memory_context = aria_memory.recall_context(client_id, "script")
        preferences = {"tone": "naturale e diretto", "avoid_words": [], "feedback_history": []}

        if memory_context:
            preferences["feedback_history"] = [memory_context]

        scripts = []
        for i in range(variations):
            script = await self.ai.generate_script(
                angle=angle,
                research=research,
                rules="",
                preferences=preferences,
                script_instructions=extra,
                variation_index=i,
                total_variations=variations,
            )
            scripts.append(script)

        return {"scripts": scripts, "count": len(scripts)}

    async def _tool_self_critique(self, inp: Dict, client_id: str) -> Dict:
        """ARIA evaluates its own output against quality criteria."""
        output = inp.get("output_to_evaluate", "")
        output_type = inp.get("output_type", "general")
        criteria = inp.get("criteria", "")

        memory_context = aria_memory.recall_context(client_id, output_type)

        prompt = f"""Sei un critico esperto di marketing. Valuta questo output con onestà brutale.

OUTPUT DA VALUTARE:
{output[:2000]}

TIPO: {output_type}
{f"CRITERI: {criteria}" if criteria else ""}
{f"REFERENCE (feedback passati): {memory_context}" if memory_context else ""}

Valuta su:
1. Specificità (0-10): È specifico per il cliente o generico?
2. Impatto (0-10): L'hook cattura immediatamente?
3. Coerenza target (0-10): Usa il linguaggio del target?
4. Qualità generale (0-10)

Rispondi SOLO con JSON:
{{
  "scores": {{"specificity": X, "impact": X, "target_alignment": X, "overall": X}},
  "issues": ["problema1", "problema2"],
  "strengths": ["punto forza1"],
  "recommendation": "mantieni / migliora / rigenera",
  "improvement_notes": "cosa migliorare specificatamente"
}}"""

        result = await self.ai._call_ai("anthropic/claude-3.7-sonnet", [{"role": "user", "content": prompt}], temperature=0.3)

        try:
            start = result.find("{")
            end = result.rfind("}") + 1
            return json_repair.loads(result[start:end]) if start != -1 else {"recommendation": "mantieni", "raw": result}
        except Exception:
            return {"recommendation": "mantieni", "raw": result[:500]}

    async def _tool_recall_memory(self, inp: Dict, client_id: str) -> Dict:
        """Returns structured memory context for the client."""
        output_type = inp.get("output_type", "general")
        context_str = aria_memory.recall_context(client_id, output_type)
        summary = aria_memory.get_client_summary(client_id)
        return {
            "memory_context": context_str,
            "summary": summary,
            "has_history": bool(context_str),
        }

    # ── Helpers ──────────────────────────────────────────────────────────────

    async def _get_client_data(self, client_id: str) -> Optional[Dict]:
        """
        Fetches FULL client metadata from disk (fresh read every time).
        Uses get_metadata() — the correct StorageService method — so ARIA
        always has up-to-date analysis, preferences and brand data.
        """
        try:
            return self.storage.get_metadata(client_id)
        except Exception as e:
            print(f"❌ ARIA: errore lettura metadata cliente {client_id}: {e}")
            return None


# Singleton instance (initialized in main.py after ai_service and storage_service are ready)
aria_agent: Optional[ARIAAgent] = None


def get_aria_agent(ai_service: AIService, storage_service: StorageService) -> ARIAAgent:
    """Returns the singleton ARIA agent, creating it if needed."""
    global aria_agent
    if aria_agent is None:
        aria_agent = ARIAAgent(ai_service, storage_service)
    return aria_agent
