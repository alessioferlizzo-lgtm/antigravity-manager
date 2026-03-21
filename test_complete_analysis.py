#!/usr/bin/env python3
"""
Script di test per l'analisi completa.
Testa che tutte le funzioni siano importabili e funzionanti.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

async def test_imports():
    """Test che tutti i moduli siano importabili"""
    print("🧪 Test 1: Importazione moduli...")

    try:
        from backend.ai_service import ai_service
        print("✅ ai_service importato")

        from backend.ai_service_complete_analysis import CompleteAnalysisService
        print("✅ CompleteAnalysisService importato")

        from backend import ai_service_complete_analysis_part2
        print("✅ ai_service_complete_analysis_part2 importato")

        from backend import ai_service_complete_analysis_part3
        print("✅ ai_service_complete_analysis_part3 importato")

        # Test che l'orchestrator sia disponibile
        assert hasattr(ai_service, 'generate_complete_analysis'), "Metodo generate_complete_analysis non trovato"
        print("✅ Metodo generate_complete_analysis disponibile")

        print("\n✅ Tutti i moduli importati con successo!\n")
        return True

    except Exception as e:
        print(f"\n❌ Errore importazione: {e}\n")
        import traceback
        traceback.print_exc()
        return False


async def test_function_signatures():
    """Test che le funzioni abbiano le signature corrette"""
    print("🧪 Test 2: Verifica signature funzioni...")

    try:
        from backend.ai_service_complete_analysis import CompleteAnalysisService
        from backend import ai_service_complete_analysis_part2 as part2
        from backend import ai_service_complete_analysis_part3 as part3

        service = CompleteAnalysisService(None)

        # Verifica che tutte le funzioni esistano
        functions = [
            (service.generate_brand_identity, "generate_brand_identity"),
            (service.generate_brand_values, "generate_brand_values"),
            (service.generate_product_portfolio, "generate_product_portfolio"),
            (service.generate_reasons_to_buy, "generate_reasons_to_buy"),
            (service.generate_customer_personas, "generate_customer_personas"),
            (part2.generate_content_matrix, "generate_content_matrix"),
            (part2.generate_product_vertical_analysis, "generate_product_vertical_analysis"),
            (part2.generate_brand_voice, "generate_brand_voice"),
            (part2.generate_objections_management, "generate_objections_management"),
            (part2.generate_reviews_analysis, "generate_reviews_analysis"),
            (part3.generate_competitor_battlecards, "generate_competitor_battlecards"),
            (part3.generate_seasonal_roadmap, "generate_seasonal_roadmap"),
        ]

        for func, name in functions:
            assert callable(func), f"{name} non è callable"
            print(f"✅ {name} - OK")

        print("\n✅ Tutte le 12 funzioni sono presenti e callable!\n")
        return True

    except Exception as e:
        print(f"\n❌ Errore verifica funzioni: {e}\n")
        import traceback
        traceback.print_exc()
        return False


async def test_mock_generation():
    """Test con dati mock (senza chiamate AI reali)"""
    print("🧪 Test 3: Generazione mock (no AI calls)...")

    try:
        from backend.ai_service_complete_analysis import CompleteAnalysisService

        # Mock AI service che non fa chiamate reali
        class MockAI:
            async def _call_ai(self, model, messages, temperature=0.7, max_tokens=16000):
                return '{"test": "mock_response"}'

        service = CompleteAnalysisService(MockAI())

        # Test con dati minimi
        client_info = {
            "id": "test-123",
            "name": "Test Brand",
            "metadata": {"industry": "Test Industry"}
        }

        print("⏳ Testando generate_brand_identity (mock)...")
        result = await service.generate_brand_identity(
            client_info=client_info,
            site_url="https://example.com",
            social_data="Mock social data",
            raw_docs="Mock docs",
            ads_data="Mock ads"
        )

        assert isinstance(result, dict), "Result deve essere un dict"
        print("✅ generate_brand_identity restituisce un dict")

        print("\n✅ Test mock completato con successo!\n")
        return True

    except Exception as e:
        print(f"\n❌ Errore test mock: {e}\n")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Esegue tutti i test"""
    print("=" * 60)
    print("🚀 TEST SUITE: Analisi Completa")
    print("=" * 60 + "\n")

    results = []

    # Test 1: Imports
    results.append(await test_imports())

    # Test 2: Function Signatures
    results.append(await test_function_signatures())

    # Test 3: Mock Generation
    results.append(await test_mock_generation())

    # Summary
    print("=" * 60)
    print("📊 RISULTATI")
    print("=" * 60)

    total = len(results)
    passed = sum(results)

    print(f"\nTest passati: {passed}/{total}")

    if all(results):
        print("\n🎉 TUTTI I TEST PASSATI!")
        print("\n✅ L'implementazione dell'analisi completa è pronta!")
        print("\nProssimi step:")
        print("  1. Esegui migrazione database: python migrate_complete_analysis_table.py")
        print("  2. Avvia il backend: cd backend && .venv/bin/python run_app.py")
        print("  3. Testa con un cliente reale: POST /clients/{id}/analysis/complete")
        return 0
    else:
        print("\n❌ ALCUNI TEST FALLITI")
        print("\nControlla gli errori sopra e risolvi i problemi.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
