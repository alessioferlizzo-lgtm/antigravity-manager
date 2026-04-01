"""
Strategic Context Loader
Carica TUTTA l'Analisi Strategica (14 sezioni) + Brand Identity per i generatori AI
"""

import json
from typing import Dict, Any, Optional
from supabase import create_client
import os


class StrategicContextLoader:
    """
    Classe helper per caricare il contesto strategico completo di un cliente.
    Usata da tutti i generatori (Copy, Script, Angoli, Graphics).
    """

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def load_full_context(self, client_id: str, metadata: dict) -> str:
        """
        Carica TUTTA l'intelligenza del cliente in formato testo strutturato per AI.

        Include:
        - Tutte le 14 sezioni dell'Analisi Strategica
        - Brand Identity (logo, colori, font)
        - Metadata cliente

        Returns:
            str: Contesto completo formattato per prompt AI
        """

        # 1. Fetch Analisi Strategica completa da Supabase
        analysis = await self._fetch_strategic_analysis(client_id)

        # 2. Estrai Brand Identity da metadata
        brand_identity_meta = metadata.get("brand_identity", {})
        client_name = metadata.get("name", client_id)
        industry = metadata.get("industry", "")
        website = metadata.get("website", "")

        # 3. Costruisci contesto strutturato
        context_parts = []

        # HEADER: Info cliente base
        context_parts.append(f"""
═══════════════════════════════════════════════════════════
CLIENTE: {client_name}
SETTORE: {industry}
SITO WEB: {website}
═══════════════════════════════════════════════════════════
""")

        # BRAND IDENTITY VISIVA (da metadata - logo, colori, font)
        if brand_identity_meta:
            logo = brand_identity_meta.get("logo_url", "")
            colors = brand_identity_meta.get("colors", [])
            fonts = brand_identity_meta.get("fonts", "")

            context_parts.append(f"""
┌─────────────────────────────────────────────────────────┐
│ BRAND IDENTITY VISIVA (logo, colori, font)              │
└─────────────────────────────────────────────────────────┘
Logo URL: {logo}
Colori Brand: {', '.join(colors) if colors else 'Non definiti'}
Font Principali: {fonts if fonts else 'Non definiti'}
""")

        # ANALISI STRATEGICA COMPLETA (14 sezioni da Supabase)
        if analysis:
            context_parts.append("""
╔═══════════════════════════════════════════════════════════╗
║ ANALISI STRATEGICA COMPLETA (14 SEZIONI)                 ║
╚═══════════════════════════════════════════════════════════╝
""")

            # Sezione 1: Brand Identity & Posizionamento
            if analysis.get("brand_identity"):
                context_parts.append(f"""
【1】 BRAND IDENTITY & POSIZIONAMENTO
{self._format_json_section(analysis["brand_identity"], max_chars=2000)}
""")

            # Sezione 2: Valori del Brand
            if analysis.get("brand_values"):
                context_parts.append(f"""
【2】 VALORI DEL BRAND
{self._format_json_section(analysis["brand_values"], max_chars=1500)}
""")

            # Sezione 3: Portafoglio Prodotti
            if analysis.get("product_portfolio"):
                context_parts.append(f"""
【3】 PORTAFOGLIO PRODOTTI
{self._format_json_section(analysis["product_portfolio"], max_chars=2500)}
""")

            # Sezione 4: Reasons to Buy (RTB)
            if analysis.get("reasons_to_buy"):
                context_parts.append(f"""
【4】 REASONS TO BUY (RTB)
{self._format_json_section(analysis["reasons_to_buy"], max_chars=1500)}
""")

            # Sezione 5: Customer Personas (10 ICP)
            if analysis.get("customer_personas"):
                context_parts.append(f"""
【5】 CUSTOMER PERSONAS (10 ICP)
{self._format_json_section(analysis["customer_personas"], max_chars=3000)}
""")

            # Sezione 6: Matrice Strategia Contenuti
            if analysis.get("content_matrix"):
                context_parts.append(f"""
【6】 MATRICE STRATEGIA CONTENUTI
{self._format_json_section(analysis["content_matrix"], max_chars=2000)}
""")

            # Sezione 7: Analisi Verticale Prodotti
            if analysis.get("product_vertical"):
                context_parts.append(f"""
【7】 ANALISI VERTICALE PRODOTTI
{self._format_json_section(analysis["product_vertical"], max_chars=2000)}
""")

            # Sezione 7b: Analisi Verticale Servizi
            if analysis.get("service_vertical"):
                context_parts.append(f"""
【7b】 ANALISI VERTICALE SERVIZI (hook, problemi cliente, USP per ogni servizio)
{self._format_json_section(analysis["service_vertical"], max_chars=2500)}
""")

            # Sezione 8: Brand Voice & Guidelines
            if analysis.get("brand_voice"):
                context_parts.append(f"""
【8】 BRAND VOICE & GUIDELINES
{self._format_json_section(analysis["brand_voice"], max_chars=1500)}
""")

            # Sezione 9: Gestione Obiezioni
            if analysis.get("objections"):
                context_parts.append(f"""
【9】 GESTIONE OBIEZIONI
{self._format_json_section(analysis["objections"], max_chars=1500)}
""")

            # Sezione 10: Voice of Customer (Recensioni)
            if analysis.get("reviews_voc"):
                context_parts.append(f"""
【10】 VOICE OF CUSTOMER (Golden Hooks, Pain Points, Desires)
{self._format_json_section(analysis["reviews_voc"], max_chars=2000)}
""")

            # Sezione 11: Competitor Battlecards
            if analysis.get("battlecards"):
                context_parts.append(f"""
【11】 COMPETITOR BATTLECARDS
{self._format_json_section(analysis["battlecards"], max_chars=2000)}
""")

            # Sezione 12: Roadmap Stagionale
            if analysis.get("seasonal_roadmap"):
                context_parts.append(f"""
【12】 ROADMAP STAGIONALE
{self._format_json_section(analysis["seasonal_roadmap"], max_chars=1500)}
""")

            # Sezione 13: Analisi Psicografica (3 livelli)
            if analysis.get("psychographic_analysis"):
                context_parts.append(f"""
【13】 ANALISI PSICOGRAFICA (3 LIVELLI - Trigger Emotivi Profondi)
{self._format_json_section(analysis["psychographic_analysis"], max_chars=2000)}
""")

            # Sezione 14: Visual Brief
            if analysis.get("visual_brief"):
                context_parts.append(f"""
【14】 VISUAL BRIEF (Mood, Colori, Struttura Video)
{self._format_json_section(analysis["visual_brief"], max_chars=1500)}
""")

            # Sezione 15: Ad Copy Creation
            if analysis.get("ad_copy_creation"):
                context_parts.append(f"""
【15】 COPY ADS (Angles, Hook, Primary Text per segmento)
{self._format_json_section(analysis["ad_copy_creation"], max_chars=3000)}
""")

            # Sezione 16: Video Scripts
            if analysis.get("video_scripts"):
                context_parts.append(f"""
【16】 SCRIPT VIDEO (TikTok/Reels — 6 script con timing e visual)
{self._format_json_section(analysis["video_scripts"], max_chars=2000)}
""")

            # Sezione 17: FranzCopy Scaling
            if analysis.get("franzcopy_scaling"):
                context_parts.append(f"""
【17】 FRANZCOPY — VARIANTI COPY (6 formule × Best Bet ads)
{self._format_json_section(analysis["franzcopy_scaling"], max_chars=2500)}
""")

        else:
            context_parts.append("""
⚠️ ATTENZIONE: Analisi Strategica non ancora generata per questo cliente.
Le informazioni disponibili sono limitate. Consiglia all'utente di generare prima l'Analisi Strategica completa.
""")

        return "\n".join(context_parts)


    async def _fetch_strategic_analysis(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Fetch Analisi Strategica da Supabase."""
        try:
            result = await self.supabase.table("client_complete_analysis").select("*").eq("client_id", client_id).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
        except Exception as e:
            print(f"Errore fetch analisi strategica: {e}")
            return None


    def _format_json_section(self, data: Any, max_chars: int = 2000) -> str:
        """
        Formatta una sezione JSON in modo leggibile, troncando se troppo lunga.
        """
        if not data:
            return "(Dati non disponibili)"

        try:
            json_str = json.dumps(data, ensure_ascii=False, indent=2)
            if len(json_str) > max_chars:
                json_str = json_str[:max_chars] + "\n... (troncato per lunghezza)"
            return json_str
        except:
            return str(data)[:max_chars]


# ═══════════════════════════════════════════════════════════
# HELPER FUNCTIONS per integrare nei generatori esistenti
# ═══════════════════════════════════════════════════════════

async def get_strategic_context_for_generator(
    client_id: str,
    metadata: dict,
    supabase_client,
    focus_areas: list[str] = None
) -> str:
    """
    Funzione helper rapida per ottenere contesto strategico.

    Args:
        client_id: ID cliente
        metadata: Metadata cliente
        supabase_client: Client Supabase
        focus_areas: Lista opzionale di aree su cui focalizzarsi
                    (es. ["brand_voice", "personas", "visual_brief"])

    Returns:
        str: Contesto completo o focalizzato
    """
    loader = StrategicContextLoader(supabase_client)
    full_context = await loader.load_full_context(client_id, metadata)

    # Se richiesto focus specifico, aggiungi nota
    if focus_areas:
        focus_note = f"""
╔═══════════════════════════════════════════════════════════╗
║ FOCUS AREAS PER QUESTA GENERAZIONE:                      ║
╚═══════════════════════════════════════════════════════════╝
{', '.join(focus_areas)}

Usa principalmente queste sezioni, ma consulta tutto il contesto se necessario.

"""
        return focus_note + full_context

    return full_context
