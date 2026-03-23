import json

with open("backend/master_workflows/agostinis_meta_ads.json", "r") as f:
    wf = json.load(f)

# The new tasks to add
tasks_to_add = [
    {
      "step_id": "product_vertical",
      "title": "Analisi Verticale Prodotti",
      "recommended_model": "claude",
      "required_inputs": ["product_portfolio"],
      "system_prompt": "Agisci come un Product Marketing Manager. Analizza tecnicamente ogni prodotto/servizio estratto. Usa il JSON schema: {\"products\": [{\"name\": \"...\", \"technical_analysis\": {\"description\": \"...\", \"technology\": \"...\", \"key_elements\": [\"...\"]}, \"marketing_strategy\": {\"customer_problem\": \"...\", \"reasons_to_buy\": [\"...\"], \"usp\": \"...\"}, \"marketing_hooks\": [\"...\"]}]}"
    },
    {
      "step_id": "psychographic_analysis",
      "title": "Analisi Psicografica",
      "recommended_model": "gemini",
      "required_inputs": ["customer_personas"],
      "system_prompt": "Crea un'analisi psicografica a 3 livelli del pubblico. JSON schema rigoroso: {\"level_1_primary\": [{\"trait\": \"...\", \"description\": \"...\"}], \"level_2_secondary\": [{\"trait\": \"...\", \"description\": \"...\"}], \"level_3_tertiary\": [{\"trait\": \"...\", \"description\": \"...\"}]}"
    },
    {
      "step_id": "visual_brief",
      "title": "Visual Brief",
      "recommended_model": "claude",
      "required_inputs": ["brand_identity", "customer_personas"],
      "system_prompt": "Agisci come Art Director. Sulla base dell'identità del brand, decodifica lo stile visivo. JSON: {\"color_palette\": [{\"hex\": \"#...\", \"label\": \"...\"}], \"visual_style\": \"...\", \"mood_board\": \"...\", \"ad_formats\": \"...\"}"
    }
]

existing_ids = [t["step_id"] for t in wf["tasks"]]
for t in tasks_to_add:
    if t["step_id"] not in existing_ids:
        wf["tasks"].append(t)

with open("backend/master_workflows/agostinis_meta_ads.json", "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Workflow updated with the 3 missing steps.")
