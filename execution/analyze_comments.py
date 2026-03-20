import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

def extract_comments_and_analyze(target_ig_user_id, media_id):
    """
    Questo script scarica tutti i commenti di un post specifico (media_id)
    per permettere una successiva analisi del linguaggio del target.
    """
    token = os.getenv("META_ACCESS_TOKEN")
    
    print(f"💬 Estrazione commenti per il post ID: {media_id}...")
    
    # Endpoint per i commenti del post
    url = f"https://graph.facebook.com/v19.0/{media_id}/comments?access_token={token}&fields=text,timestamp,like_count"
    
    comments_list = []
    response = requests.get(url).json()
    
    if 'data' in response:
        for comment in response['data']:
            comments_list.append({
                "text": comment.get('text'),
                "likes": comment.get('like_count', 0),
                "date": comment.get('timestamp')
            })
            
    # Gestione paginazione (se ci sono molti commenti)
    while 'paging' in response and 'next' in response['paging']:
        response = requests.get(response['paging']['next']).json()
        if 'data' in response:
            for comment in response['data']:
                comments_list.append({
                    "text": comment.get('text'),
                    "likes": comment.get('like_count', 0),
                    "date": comment.get('timestamp')
                })
        else:
            break

    print(f"✅ Estratti {len(comments_list)} commenti.")
    
    # Salvataggio per analisi successiva
    output_path = f"/Users/alessioferlizzo/Databse-Clienti-Antigravity/.tmp/comments_analysis_{media_id}.json"
    with open(output_path, "w") as f:
        json.dump(comments_list, f, indent=4)
        
    return comments_list

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("❌ Utilizzo: python3 analyze_comments.py <media_id>")
    else:
        media_id = sys.argv[1]
        extract_comments_and_analyze(None, media_id)
