import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

def test_openrouter():
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://antigravity-app.com",
        "X-Title": "Antigravity App"
    }
    
    payload = {
        "model": "perplexity/sonar-reasoning", # Specific model
        "messages": [{"role": "user", "content": "Hello"}],
        "temperature": 0.7
    }
    
    print(f"Testing connectivity to {OPENROUTER_URL}")
    print(f"API Key present: {bool(OPENROUTER_API_KEY)}")
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(OPENROUTER_URL, headers=headers, json=payload)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            response.raise_for_status()
            print("Connectivity test successful!")
    except Exception as e:
        print(f"Connectivity test failed: {e}")

if __name__ == "__main__":
    test_openrouter()
