import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_meta_connection():
    token = os.getenv("META_ACCESS_TOKEN")
    app_id = os.getenv("META_APP_ID")
    
    if not token or not app_id:
        print("Errore: META_ACCESS_TOKEN o META_APP_ID mancanti nel file .env")
        return

    # 1. Test Me (Verifica Utente e Token)
    url = f"https://graph.facebook.com/v19.0/me?access_token={token}&fields=id,name"
    response = requests.get(url)
    
    if response.status_code == 200:
        user_data = response.json()
        print(f"✅ Connessione riuscita! Utente: {user_data.get('name')} (ID: {user_data.get('id')})")
    else:
        print(f"❌ Errore connessione: {response.text}")
        return

    # 2. Verifica Permessi
    url_permissions = f"https://graph.facebook.com/v19.0/me/permissions?access_token={token}"
    perm_response = requests.get(url_permissions)
    if perm_response.status_code == 200:
        perms = [p['permission'] for p in perm_response.json().get('data', []) if p['status'] == 'granted']
        print(f"🔑 Permessi ottenuti: {', '.join(perms)}")
    
    # 3. Verifica Business Accounts
    url_businesses = f"https://graph.facebook.com/v19.0/me/businesses?access_token={token}"
    biz_response = requests.get(url_businesses)
    if biz_response.status_code == 200:
        businesses = biz_response.json().get('data', [])
        print(f"🏢 Business Manager rilevati: {len(businesses)}")
        for biz in businesses:
            print(f"   - {biz.get('name')} (ID: {biz.get('id')})")
    else:
        print("⚠️ Impossibile recuperare i Business Manager.")

if __name__ == "__main__":
    test_meta_connection()
