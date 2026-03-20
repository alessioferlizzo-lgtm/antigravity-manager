import os
import requests
import json
from dotenv import load_dotenv

load_dotenv("backend/.env")
notion_api_key = os.getenv("NOTION_API_KEY")

headers = {
    "Authorization": f"Bearer {notion_api_key}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

parent_page_id = "32296b3c-38cc-8046-a622-f2dec7d1b38c"

def create_database(title, properties):
    payload = {
        "parent": {
            "type": "page_id",
            "page_id": parent_page_id
        },
        "title": [
            {
                "type": "text",
                "text": {
                    "content": title
                }
            }
        ],
        "properties": properties
    }
    
    response = requests.post("https://api.notion.com/v1/databases", headers=headers, json=payload)
    if response.status_code == 200:
        db_id = response.json()["id"]
        print(f"Created '{title}' with ID: {db_id}")
        return db_id
    else:
        print(f"Failed to create '{title}': {response.status_code}")
        print(response.text)
        return None

def main():
    print("Creating Notion Architecture...")
    
    # 1. Copy Engineering (Conoscenza)
    copy_engineering_props = {
        "Name": {"title": {}},
        "Type": {"select": {"options": [{"name": "🧠 Framework", "color": "blue"}, {"name": "🪝 Hook", "color": "red"}, {"name": "🎯 Awareness Level", "color": "green"}, {"name": "📖 Psychological Rule", "color": "yellow"}]}},
        "Funnel Stage": {"multi_select": {"options": [{"name": "TOFU (Discovery)", "color": "blue"}, {"name": "MOFU (Interest)", "color": "yellow"}, {"name": "BOFU (Decision)", "color": "red"}, {"name": "ACTION", "color": "green"}]}},
        "Awareness Target": {"select": {"options": [{"name": "1. Unaware", "color": "gray"}, {"name": "2. Problem Aware", "color": "red"}, {"name": "3. Solution Aware", "color": "yellow"}, {"name": "4. Product Aware", "color": "blue"}, {"name": "5. Most Aware", "color": "green"}]}},
        "Instructions / Content": {"rich_text": {}}
    }
    db1 = create_database("Copy Engineering & Frameworks", copy_engineering_props)


    # 2. Copy Vault (Swipe File)
    copy_vault_props = {
        "Name / Headline": {"title": {}},
        "Full Copy": {"rich_text": {}},
        "Framework Used": {"select": {"options": []}},
        "Awareness Target": {"select": {"options": [{"name": "1. Unaware"}, {"name": "2. Problem Aware"}, {"name": "3. Solution Aware"}, {"name": "4. Product Aware"}, {"name": "5. Most Aware"}]}},
        "Sector / Industry": {"select": {"options": [{"name": "Estetica Medicinale", "color": "pink"}]}},
        "Funnel Stage": {"select": {"options": [{"name": "TOFU (Discovery)"}, {"name": "MOFU (Interest)"}, {"name": "BOFU (Decision)"}, {"name": "ACTION"}]}},
        "Format": {"select": {"options": [{"name": "Script Video", "color": "red"}, {"name": "Caption IG/FB", "color": "blue"}, {"name": "Ad Copy", "color": "green"}]}},
        "Client Name": {"rich_text": {}},
        "Ranking": {"select": {"options": [{"name": "⭐️"}, {"name": "⭐️⭐️"}, {"name": "⭐️⭐️⭐️"}, {"name": "⭐️⭐️⭐️⭐️"}, {"name": "⭐️⭐️⭐️⭐️⭐️", "color": "yellow"}]}}
    }
    db2 = create_database("Vault dei Copy (Swipe File)", copy_vault_props)

    
    # 3. Angles Vault
    angles_vault_props = {
        "Angle Title": {"title": {}},
        "Description": {"rich_text": {}},
        "Sector / Industry": {"select": {"options": [{"name": "Estetica Medicinale", "color": "pink"}]}},
        "Funnel Stage": {"select": {"options": [{"name": "TOFU (Discovery)"}, {"name": "MOFU (Interest)"}, {"name": "BOFU (Decision)"}, {"name": "ACTION"}]}},
        "Client Name": {"rich_text": {}},
        "Ranking": {"select": {"options": [{"name": "⭐️"}, {"name": "⭐️⭐️"}, {"name": "⭐️⭐️⭐️"}, {"name": "⭐️⭐️⭐️⭐️"}, {"name": "⭐️⭐️⭐️⭐️⭐️", "color": "yellow"}]}}
    }
    db3 = create_database("Vault degli Angles", angles_vault_props)
    
    
    # 4. Graphics Vault
    graphics_vault_props = {
        "Name / Headline Grafica": {"title": {}},
        "Graphic Assets Link": {"url": {}},
        "Sector / Industry": {"select": {"options": [{"name": "Estetica Medicinale", "color": "pink"}]}},
        "Funnel Stage": {"select": {"options": [{"name": "TOFU (Discovery)"}, {"name": "MOFU (Interest)"}, {"name": "BOFU (Decision)"}, {"name": "ACTION"}]}},
        "Copy Associated": {"rich_text": {}},
        "Client Name": {"rich_text": {}},
        "Ranking": {"select": {"options": [{"name": "⭐️"}, {"name": "⭐️⭐️"}, {"name": "⭐️⭐️⭐️"}, {"name": "⭐️⭐️⭐️⭐️"}, {"name": "⭐️⭐️⭐️⭐️⭐️", "color": "yellow"}]}}
    }
    db4 = create_database("Vault delle Grafiche", graphics_vault_props)
    
    # Check if a clients db is needed, for now we let the app handle the manual files as before?
    # The user says: 
    # "Se mi piacciono ho la possibilità di dirgli "Ok aggiungili al report" e cioè "Scusami aggiungili al database". E quindi magari tramite un tastino me li aggiunge nella scheda del cliente di riferimento come buyer personas che cercano questo servizio oppure che hanno questo problema o qualcosa del genere."
    # We can create a "Clienti & Servizi" DB on Notion to make it editable from Notion if they want.
    
    clients_props = {
        "Client Name": {"title": {}},
        "Specific Service": {"rich_text": {}},
        "Buyer Personas Focus": {"rich_text": {}},
        "Deep Fears & Levers": {"rich_text": {}}
    }
    db5 = create_database("Anagrafica Clienti & Personas", clients_props)

    print("\n\n=== UPDATE BACKEND/.ENV WITH THESE IDs ===")
    print(f"NOTION_COPY_ENGINEERING_DB_ID={db1}")
    print(f"NOTION_COPY_VAULT_DB_ID={db2}")
    print(f"NOTION_ANGLES_VAULT_DB_ID={db3}")
    print(f"NOTION_GRAPHICS_VAULT_DB_ID={db4}")
    print(f"NOTION_CLIENTS_PERSONAS_DB_ID={db5}")

if __name__ == "__main__":
    main()
