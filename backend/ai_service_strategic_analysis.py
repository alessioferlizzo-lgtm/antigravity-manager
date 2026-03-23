import json
import os
import asyncio
import json_repair
from typing import Dict, Any

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

    final_prompt = f"{system_prompt_template}\n\n{input_text}"
    messages = [{"role": "user", "content": final_prompt}]
    
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
    competitor_data: str = ""
) -> Dict[str, Any]:
    
    # 1. Load the Master Workflow JSON
    workflow_path = os.path.join(os.path.dirname(__file__), "master_workflows", "agostinis_meta_ads.json")
    with open(workflow_path, "r", encoding="utf-8") as f:
        workflow = json.loads(f.read())
        
    print(f"[Workflow Engine] Loaded Master Workflow: {workflow.get('workflow_name')}")
    
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
        "products_csv": products_csv, # Pass the entire CSV
        "services_txt": services_txt,
        "competitor_data": competitor_data  # Real competitor names/links from Sorgenti
    }
    
    # 3. Sequential Execution loop (guarantees context inheritance)
    results = {}
    
    for task in workflow["tasks"]:
        step_id = task["step_id"]
        try:
            # Run the task
            task_result = await run_workflow_task(service, task, context)
            
            # Save to results
            results[step_id] = task_result
            
            # INJECT into context so downstream tasks can use it
            context[step_id] = task_result
            
        except Exception as e:
            print(f"[Workflow Engine] Error executing task {step_id}: {e}")
            results[step_id] = {"error": str(e)}
            context[step_id] = {}

    print(f"[Workflow Engine] All {len(workflow['tasks'])} tasks executed successfully.")

    # 4. Final Adapter - Map to exactly what React expects

    def safe_dict(val, fallback=None):
        """Garantisce che val sia sempre un dict, evitando AttributeError su str/list/None."""
        if isinstance(val, dict):
            return val
        if isinstance(val, list):
            # Se è già una lista di dict, restituisci un wrapper
            return {"_list": val}
        return fallback or {}

    def safe_list(val):
        """Garantisce che val sia sempre una lista."""
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            # Prova i campi comuni
            for key in ["items", "data", "results", "_list"]:
                if key in val and isinstance(val[key], list):
                    return val[key]
            return [val] if val else []
        return []

    # Extract keys safely — tutto passa sempre per safe_dict
    brand_identity_data    = safe_dict(results.get("brand_identity"))
    brand_values_data      = safe_dict(results.get("brand_values"))
    product_portfolio_data = safe_dict(results.get("product_portfolio"))
    product_vertical_data  = safe_dict(results.get("product_vertical"))
    reasons_to_buy_data    = safe_dict(results.get("reasons_to_buy"))
    customer_personas_data = results.get("customer_personas", {})  # gestito separatamente
    psychographic_data     = safe_dict(results.get("psychographic_analysis"))
    brand_voice_data       = safe_dict(results.get("brand_voice"))
    content_matrix_data    = safe_dict(results.get("content_matrix"))
    objections_data        = safe_dict(results.get("objections_management"))
    reviews_voc_data       = safe_dict(results.get("reviews_voc"))
    battlecards_data       = safe_dict(results.get("battlecards"))
    seasonal_roadmap_data  = safe_dict(results.get("seasonal_roadmap"))
    visual_brief_data      = safe_dict(results.get("visual_brief"))
    
    # Customer personas - handle both list and dict formats from AI
    personas_raw = customer_personas_data
    if isinstance(personas_raw, list):
        personas_list = personas_raw
    elif isinstance(personas_raw, dict):
        personas_list = personas_raw.get("personas", [])
        if not personas_list and personas_raw:
            personas_list = [personas_raw]
    else:
        personas_list = []
        
    # Clean out any error objects that might have slipped through
    personas_list = [p for p in personas_list if isinstance(p, dict) and "error" not in p]

    # Clean UI shapes
    final_output = {
        "brand_identity": {
            "mission": brand_identity_data.get("mission", ""),
            "positioning": brand_identity_data.get("positioning", ""),
            "statement": brand_identity_data.get("statement", ""),
            "tone_of_voice": brand_identity_data.get("tone_of_voice", "")
        },
        "brand_values": {
            "brand_pillars": [
                {"name": "Inclusività", "content": brand_values_data.get("inclusivity", "")},
                {"name": "Sostenibilità", "content": brand_values_data.get("sustainability", "")},
                {"name": "Materiali/Premium", "content": brand_values_data.get("formulas_materials", "")}
            ]
        },
        "brand_voice": {
            "brand_persona": brand_voice_data.get("brand_persona", ""),
            "communication_pillars": brand_voice_data.get("communication_pillars", ""),
            "glossary": brand_voice_data.get("glossary", []),
            "dos_donts": brand_voice_data.get("dos_donts", [])
        },
        "product_portfolio": {
            "products": product_portfolio_data.get("core_products", []) + product_portfolio_data.get("pre_during_products", []) + product_portfolio_data.get("post_treatment_products", []) + product_portfolio_data.get("lifestyle_products", [])
        },
        "product_vertical": {
            "products": product_vertical_data.get("products", [])
        },
        "reasons_to_buy": {
            "rational": reasons_to_buy_data.get("rational_motives", []),
            "emotional": reasons_to_buy_data.get("emotional_motives", [])
        },
        "objections": {
            "price": objections_data.get("price_value", []),
            "subscription": objections_data.get("mechanics_subscription", []),
            "performance": objections_data.get("product_performance", []),
            "ethics": objections_data.get("ethics_sustainability", [])
        },
        "customer_personas": personas_list,
        "psychographic_analysis": {
            "level_1_primary": psychographic_data.get("level_1_primary", []),
            "level_2_secondary": psychographic_data.get("level_2_secondary", []),
            "level_3_tertiary": psychographic_data.get("level_3_tertiary", [])
        },
        "content_matrix": content_matrix_data.get("matrix", []),
        "reviews_voc": {
            "golden_hooks": reviews_voc_data.get("golden_hooks", reviews_voc_data.get("hooks", [])),
            "sentiment_analysis": reviews_voc_data.get("sentiment_analysis", reviews_voc_data.get("sentiment", "")),
            "key_vocabulary": reviews_voc_data.get("key_vocabulary", reviews_voc_data.get("recurring_keywords", reviews_voc_data.get("vocabulary", []))),
            "pain_points": reviews_voc_data.get("pain_points_leverage", reviews_voc_data.get("pain_points", [])),
            "conclusion": reviews_voc_data.get("practical_conclusion", reviews_voc_data.get("conclusion", ""))
        },
        "battlecards": (
            # Nuovo formato: array diretto
            battlecards_data.get("battlecards", None)
            or battlecards_data.get("_list", None)
            # Legacy: dict con chiavi fisse
            or [v for v in [
                battlecards_data.get("direct_competitor"),
                battlecards_data.get("retail_giant"),
                battlecards_data.get("secret_habit"),
                battlecards_data.get("ultimate_solution"),
            ] if v]
        ),
        "seasonal_roadmap": (
            # Nuovo formato potrebbe essere lista
            seasonal_roadmap_data.get("quarters", None)
            or seasonal_roadmap_data.get("_list", None)
            # Legacy: dict con chiavi Q1-Q4
            or {k: seasonal_roadmap_data[k] for k in [
                "q1_recovery", "q2_pre_summer", "q3_lifestyle", "q4_monetization",
                "execution_tips"
            ] if k in seasonal_roadmap_data}
            or seasonal_roadmap_data
        ),
        "visual_brief": {
            "color_palette": visual_brief_data.get("color_palette", []),
            "visual_style": visual_brief_data.get("visual_style", ""),
            "mood_board": visual_brief_data.get("mood_board", ""),
            "ad_formats": visual_brief_data.get("ad_formats", "")
        }
    }
    
    return final_output
