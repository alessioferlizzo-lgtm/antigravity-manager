import json
import os
import asyncio
import json_repair
from typing import Dict, Any

ANTI_HALLUCINATION_DIRECTIVE = """
⚠️ REGOLA CRITICA — INTEGRITÀ DELLE FONTI:
Analizza, ragiona, deduci, cerca competitor, usa conoscenze di settore — fai tutto quello
che serve per un'analisi strategica di alto livello.

L'unica regola: OGNI FATTO SPECIFICO CHE SCRIVI SUL BRAND DEVE AVERE UNA FONTE REALE.
Se scrivi un dato, devi sapere DOVE l'hai letto — nel sito, nelle recensioni, nei documenti,
nei social. Se non sai indicare la fonte, quel dato non va scritto.

Esempi di violazione:
- "Portfolio clienti: Reebok, Diesel, Leroy Merlin" → dove l'hai letto? Se non c'è nei dati, è inventato.
- "10+ anni di esperienza e 1.200 aziende assistite" → dove l'hai letto? Se non c'è, non scriverlo.
- "Specializzato in lead generation" → il sito parla di e-commerce? Allora è sbagliato.
- "Check-up strategico gratuito dal valore di €1.500" → dove l'hai letto? Se non esiste, è inventato.

Cosa fare invece:
- Leggi i dati reali e riporta quello che c'è veramente.
- Se un dato non è disponibile, omettilo o scrivi in modo generico senza numeri inventati.
- Per competitor e trend di mercato puoi usare le tue conoscenze — quelli non sono fatti sul brand.
"""

async def run_workflow_task(service, task: Dict[str, Any], context: Dict[str, Any]) -> Any:
    """Executes a single step of the dynamic workflow."""
    step_id = task["step_id"]
    model_choice = task.get("recommended_model", "claude")
    system_prompt_template = task["system_prompt"]

    # 1. Gather Required Inputs
    input_text = ""
    for req in task.get("required_inputs", []):
        if req in context and context[req]:
            val = context[req]
            if isinstance(val, dict) or isinstance(val, list):
                val_str = json.dumps(val, indent=2, ensure_ascii=False)
            else:
                val_str = str(val)
            input_text += f"\n--- {req.upper()} ---\n{val_str}\n"

    # Anti-hallucination as SYSTEM message (stronger enforcement than user message)
    final_prompt = f"{system_prompt_template}\n\n{input_text}"
    messages = [
        {"role": "system", "content": ANTI_HALLUCINATION_DIRECTIVE},
        {"role": "user", "content": final_prompt}
    ]
    
    # 2. Select AI Model Map
    model_map = {
        "claude": "anthropic/claude-3.7-sonnet",
        "gemini": "google/gemini-1.5-pro",
        "perplexity": "perplexity/sonar"
    }
    target_model = model_map.get(model_choice, model_map["claude"])
    
    print(f"[Workflow Engine] Executing Task: {step_id} using {target_model}")
    
    # 3. Execute with Retries
    max_retries = 3
    attempt = 0
    response_json = {}
    
    while attempt < max_retries:
        attempt += 1
        try:
            print(f"[Workflow Engine] Executing Task: {step_id} using {target_model} (Attempt {attempt}/{max_retries})")
            
            response_str = await service._call_ai(
                model=target_model,
                messages=messages,
                max_tokens=8000
            )
            
            response_json = json_repair.loads(response_str)
            
            # Check for error objects returned instead of valid data
            if isinstance(response_json, dict) and "error" in response_json:
                raise Exception(f"AI returned error object: {response_json['error']}")
            if isinstance(response_json, list) and len(response_json) > 0 and isinstance(response_json[0], dict) and "error" in response_json[0]:
                raise Exception(f"AI returned error array: {response_json[0]['error']}")
                
            # Content validation: if reviews_voc is completely empty, force retry
            if step_id == "reviews_voc" and isinstance(response_json, dict):
                gh = response_json.get("golden_hooks", response_json.get("hooks", []))
                kv = response_json.get("key_vocabulary", response_json.get("vocabulary", []))
                if not gh and not kv:
                    raise Exception("Voice of Customer returned empty data arrays. Retrying.")
                    
            # If we get here, success!
            return response_json
            
        except Exception as e:
            print(f"[Workflow Engine] Error in {step_id} (Attempt {attempt}): {e}")
            if attempt < max_retries:
                print(f"[Workflow Engine] Switching model and retrying {step_id}...")
                # Switch model for retry
                if target_model == "anthropic/claude-3.7-sonnet":
                    target_model = "google/gemini-1.5-pro"
                elif target_model == "google/gemini-1.5-pro":
                    target_model = "anthropic/claude-3.7-sonnet"
            else:
                print(f"[Workflow Engine] Failed {step_id} after {max_retries} attempts.")
                response_json = {"error": str(e)}
        
    return response_json


async def generate_complete_strategic_analysis(
    service,
    client_info: Dict[str, Any],
    site_url: str,
    site_content: str = "",
    social_data: str = "",
    ads_data: str = "",
    raw_docs: str = "",
    google_reviews: str = "",
    instagram_comments: str = "",
    products_csv: str = "",
    services_txt: str = "",
    competitor_data: str = "",
    progress_callback=None
) -> Dict[str, Any]:

    def _report(msg: str):
        if progress_callback:
            progress_callback(msg)
        print(f"[Workflow Engine] {msg}")

    # 1. Load the Master Workflow JSON
    workflow_path = os.path.join(os.path.dirname(__file__), "master_workflows", "agostinis_meta_ads.json")
    with open(workflow_path, "r", encoding="utf-8") as f:
        workflow = json.loads(f.read())

    _report(f"Workflow caricato: {workflow.get('workflow_name')}")

    # 2. Initialize the Global Context
    context = {
        "client_info": client_info,
        "site_url": site_url,
        "site_content": site_content[:80000] if site_content else "",
        "social_data": social_data,
        "ads_data": ads_data,
        "raw_docs": raw_docs,
        "google_reviews": google_reviews,
        "instagram_comments": instagram_comments,
        "products_csv": products_csv,
        "services_txt": services_txt,
        "competitor_data": competitor_data
    }

    # 3. Sequential Execution loop (guarantees context inheritance)
    results = {}
    total_tasks = len(workflow["tasks"])

    for i, task in enumerate(workflow["tasks"], 1):
        step_id = task["step_id"]
        task_name = task.get("title", step_id)
        _report(f"[{i}/{total_tasks}] {task_name}…")
        try:
            task_result = await run_workflow_task(service, task, context)
            results[step_id] = task_result
            context[step_id] = task_result

        except Exception as e:
            print(f"[Workflow Engine] Error executing task {step_id}: {e}")
            results[step_id] = {"error": str(e)}
            context[step_id] = {}

    _report(f"Tutte le {total_tasks} sezioni generate. Salvataggio…")

    # 4. Passthrough — I prompt chiedono già lo schema JSON esatto che i renderer React si aspettano.
    #    L'unica mappatura necessaria è step_id → frontend key dove differiscono.
    STEP_TO_FRONTEND_KEY = {
        "objections_management": "objections",
    }

    final_output = {}
    for step_id, data in results.items():
        frontend_key = STEP_TO_FRONTEND_KEY.get(step_id, step_id)
        final_output[frontend_key] = data

    return final_output
