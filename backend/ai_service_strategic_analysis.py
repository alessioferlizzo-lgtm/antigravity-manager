import json
import os
import asyncio
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
    
    # 2. Select AI Model Map
    model_map = {
        "claude": "anthropic/claude-3.7-sonnet",
        "gemini": "google/gemini-1.5-pro",
        "perplexity": "perplexity/sonar"
    }
    target_model = model_map.get(model_choice, model_map["claude"])
    
    print(f"[Workflow Engine] Executing Task: {step_id} using {target_model}")
    
    # 3. Execute
    response_json = await service._call_ai(
        prompt=final_prompt,
        model=target_model,
        max_tokens=8000
    )
    
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
    services_txt: str = ""
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
        "services_txt": services_txt
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
    brand_identity = results.get("brand_identity", {})
    brand_values = results.get("brand_values", {})
    product_portfolio = results.get("product_portfolio", {})
    reasons_to_buy = results.get("reasons_to_buy", {})
    customer_personas = results.get("customer_personas", {})
    brand_voice = results.get("brand_voice", {})
    content_matrix = results.get("content_matrix", {})
    objections = results.get("objections_management", {})
    reviews_voc = results.get("reviews_voc", {})
    battlecards = results.get("battlecards", {})
    seasonal_roadmap = results.get("seasonal_roadmap", {})
    
    # Clean UI shapes
    final_output = {
        "identita_brand": {
            "mission": brand_identity.get("mission", ""),
            "posizionamento": brand_identity.get("positioning", ""),
            "statement": brand_identity.get("statement", ""),
            "inclusivity": brand_values.get("inclusivity", ""),
            "sustainability": brand_values.get("sustainability", ""),
            "premium_materials": brand_values.get("formulas_materials", "")
        },
        "prodotti_e_usp": {
            "core_products": product_portfolio.get("core_products", []),
            "pre_products": product_portfolio.get("pre_during_products", []),
            "post_products": product_portfolio.get("post_treatment_products", []),
            "marketing_hooks": [] 
        },
        "reasons_to_buy": {
            "rational": reasons_to_buy.get("rational_motives", []),
            "emotional": reasons_to_buy.get("emotional_motives", [])
        },
        "personas": customer_personas.get("personas", []),
        "brand_voice": {
            "persona": brand_voice.get("brand_persona", ""),
            "rules": brand_voice.get("communication_pillars", ""),
            "glossary": brand_voice.get("glossary", []),
            "examples": brand_voice.get("dos_and_donts", [])
        },
        "content_matrix": content_matrix.get("matrix", []),
        "objections": {
            "price": objections.get("price_value", []),
            "subscription": objections.get("mechanics_subscription", []),
            "performance": objections.get("product_performance", []),
            "ethics": objections.get("ethics_sustainability", [])
        },
        "voice_of_customer": {
            "golden_hooks": reviews_voc.get("golden_hooks", []),
            "pain_points": reviews_voc.get("pain_points_leverage", []),
            "keywords": reviews_voc.get("recurring_keywords", []),
            "conclusion": reviews_voc.get("practical_conclusion", "")
        },
        "battlecards": [
            battlecards.get("direct_competitor", {}),
            battlecards.get("retail_giant", {}),
            battlecards.get("secret_habit", {}),
            battlecards.get("ultimate_solution", {})
        ],
        "seasonal_roadmap": [
            seasonal_roadmap.get("q1_recovery", {}),
            seasonal_roadmap.get("q2_pre_summer", {}),
            seasonal_roadmap.get("q3_lifestyle", {}),
            seasonal_roadmap.get("q4_monetization", {})
        ]
    }
    
    return final_output
