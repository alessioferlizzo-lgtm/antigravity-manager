import os
import json
import asyncio
from typing import List, Dict, Any
from httpx import AsyncClient

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "") # Will be provided by env
model = "anthropic/claude-3.7-sonnet"

SYSTEM_PROMPT = """
Sei un AI Workflow Architect. Il tuo obiettivo è leggere un'intera guida o manuale strategico di Marketing e trasformarlo in un piano di esecuzione step-by-step per un'altra IA (un Autonomous Agent).

Devi restituire SOLO UN JSON strutturato così:
{
  "workflow_name": "Nome della Guida",
  "tasks": [
    {
      "step_id": "identificativo_univoco_snake_case",
      "title": "Titolo del task (es. Brand Identity)",
      "description": "Cosa fa questo task",
      "recommended_model": "Scegli tra: 'perplexity' (se serve cercare su google/web/competitor reali), 'gemini' (se serve analisi psicologica profonda), 'claude' (per copy, logica formale e creatività)",
      "required_inputs": ["products_csv", "site_content"], # Ipotizza quali input servono
      "system_prompt": "Il PROMPT COMPLETO ED ESTREMAMENTE DETTAGLIATO estratto o dedotto dalla guida per eseguire questa specifica fase. Non riassumere: includi tutte le regole, le metriche, lo schema JSON che l'IA dovrà restituire (se specificato nella guida). Questo prompt deve intimare all'IA di produrre paragrafi lunghissimi di altissima qualità."
    }
  ]
}

Assicurati che la lista di task sia completa e copra esattamente tutti i passaggi richiesti dalla guida fornita. Output rigorosamente e solo in JSON.
"""

async def parse_guide(file_path: str, output_path: str):
    print(f"Reading {file_path}...")
    with open(file_path, "r", encoding="utf-8") as f:
        guide_text = f.read()

    print(f"Sending to OpenRouter ({len(guide_text)} chars)...")
    async with AsyncClient(timeout=300.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Ecco la guida da trasformare in workflow:\n\n{guide_text}"}
                ],
                "response_format": {"type": "json_object"},
                "max_tokens": 8000,
                "temperature": 0.2
            }
        )
        
        response.raise_for_status()
        data = response.json()
        
        content = data["choices"][0]["message"]["content"]
        
        print("Parsing JSON...")
        try:
            workflow = json.loads(content)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(workflow, f, indent=2, ensure_ascii=False)
            print(f"Workflow saved to {output_path} with {len(workflow['tasks'])} tasks.")
        except Exception as e:
            print("Failed to parse JSON!")
            print(content[:500])
            with open(output_path + "_raw.txt", "w", encoding="utf-8") as f:
                f.write(content)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python guide_parser_agent.py <input.txt> <output.json>")
        sys.exit(1)
    
    asyncio.run(parse_guide(sys.argv[1], sys.argv[2]))
