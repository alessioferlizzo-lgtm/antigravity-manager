import json

with open("backend/master_workflows/agostinis_meta_ads.json", "r") as f:
    wf = json.load(f)

for task in wf["tasks"]:
    if task["step_id"] == "brand_identity":
        task["system_prompt"] = task["system_prompt"].replace(
            '"tone_of_voice": "..."',
            '"tone_of_voice": {"style": "...", "target_audience": "...", "linguistic_approach": "...", "vocabulary": ["..."]}'
        )
    elif task["step_id"] == "brand_voice":
        task["system_prompt"] = task["system_prompt"].replace(
            '"use_this": "..."',
            '"use": "..."'
        )
        task["system_prompt"] = task["system_prompt"].replace(
            '"dos_and_donts": [{"scenario": "...", "dont": "...", "do": "..."}]',
            '"dos_donts": {"dos": ["..."], "donts": ["..."]}'
        )
    elif task["step_id"] == "customer_personas":
        task["system_prompt"] = task["system_prompt"].replace(
            'Genera 5-10 profili psicologici',
            'Genera ALMENO 5 profili psicologici'
        ).replace(
            '"fears": "Le paure..."',
            '"fears": "...", "desires": "...", "what_seeks": "...", "critical_info": "..."'
        )
    elif task["step_id"] == "content_matrix":
        task["system_prompt"] = task["system_prompt"].replace(
            '"main_hook": "..."',
            '"hook": "..."'
        ).replace(
            '"paid_ads": "..."',
            '"paid": "..."'
        ).replace(
            '"organic_social": "..."',
            '"organic": "..."'
        )
    elif task["step_id"] == "psychographic_analysis":
        task["system_prompt"] = task["system_prompt"].replace(
            '{"level_1_primary": [{"trait": "...", "description": "..."}]',
            '{"level_1_primary": [{"characteristic": "...", "description": "..."}]'
        ).replace(
            '{"trait": "...", "description": "..."}',
            '{"characteristic": "...", "description": "..."}'
        )
    elif task["step_id"] == "reviews_voc":
        task["system_prompt"] = task["system_prompt"].replace(
            '{"golden_hooks": [...]',
            '{"golden_hooks": [{"hook": "...", "source": "..."}]'
        ).replace(
            '"practical_conclusion": "..."',
            '"sentiment_analysis": "...", "key_vocabulary": ["..."], "practical_conclusion": "..."'
        )

with open("backend/master_workflows/agostinis_meta_ads.json", "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

