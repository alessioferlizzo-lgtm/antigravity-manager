import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

def get_instagram_research(target_username):
    token = os.getenv("META_ACCESS_TOKEN")
    
    # 1. Trovo un account Instagram Business collegato
    print(f"🔍 Scansione pagine per trovare un account Instagram Business...")
    
    url_accounts = f"https://graph.facebook.com/v19.0/me/accounts?access_token={token}"
    resp = requests.get(url_accounts).json()
    
    if 'data' not in resp or not resp['data']:
        print("❌ Nessuna pagina Facebook trovata.")
        return

    ig_user_id = None
    for page in resp['data']:
        page_id = page['id']
        url_ig = f"https://graph.facebook.com/v19.0/{page_id}?fields=instagram_business_account&access_token={token}"
        ig_resp = requests.get(url_ig).json()
        
        if 'instagram_business_account' in ig_resp:
            ig_user_id = ig_resp['instagram_business_account']['id']
            print(f"✅ Trovato IG Business Account ID: {ig_user_id} (collegato alla pagina: {page.get('name')})")
            break
            
    if not ig_user_id:
        print("❌ Nessun account Instagram Business trovato tra le tue pagine. Assicurati che l'account IG sia 'Business' e collegato a una pagina FB.")
        return

    # 2. Business Discovery
    print(f"🚀 Avvio Business Discovery per @{target_username}...")
    discovery_url = f"https://graph.facebook.com/v19.0/{ig_user_id}"
    params = {
        "fields": f"business_discovery.username({target_username}){{followers_count,media_count,media{{caption,like_count,comments_count,timestamp,media_type,media_url}}}}",
        "access_token": token
    }
    
    discovery_resp = requests.get(discovery_url, params=params).json()
    
    if 'error' in discovery_resp:
        print(f"❌ Errore Business Discovery: {discovery_resp['error'].get('message')}")
        return

    data = discovery_resp['business_discovery']
    print(f"📈 Risultati per @{target_username}:")
    print(f"   - Follower: {data['followers_count']}")
    print(f"   - Post totali: {data['media_count']}")
    
    # Salviamo i risultati completi
    output_path = f"/Users/alessioferlizzo/Databse-Clienti-Antigravity/.tmp/ig_research_{target_username}.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=4)
    
    print(f"💾 Dati salvati in: {output_path}")
    
    print("\n📝 Ultime attività (Top 3):")
    for post in data.get('media', {}).get('data', [])[:3]:
        caption = (post.get('caption', '')[:100] + '...') if post.get('caption') else 'Senza caption'
        print(f"   - [{post['timestamp'][:10]}] Likes: {post.get('like_count', 0)} | Commenti: {post.get('comments_count', 0)}")
        print(f"     Caption: {caption}\n")

if __name__ == "__main__":
    import sys
    
    # Prendo l'username dall'argomento riga di comando o uso quello di default
    target = sys.argv[1] if len(sys.argv) > 1 else "arianofestadellapizza"
    get_instagram_research(target)
