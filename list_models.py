import httpx
import json

def list_models():
    url = "https://openrouter.ai/api/v1/models"
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url)
            response.raise_for_status()
            models = response.json()["data"]
            perplexity_models = [m["id"] for m in models if "perplexity" in m["id"].lower() or "sonar" in m["id"].lower()]
            print("--- Perplexity/Sonar Models ---")
            for m in perplexity_models:
                print(m)
            
            # Also list some mainstream models to verify connectivity
            print("\n--- Some Other Models ---")
            for m in models[:10]:
                print(m["id"])
                
    except Exception as e:
        print(f"Failed to list models: {e}")

if __name__ == "__main__":
    list_models()
