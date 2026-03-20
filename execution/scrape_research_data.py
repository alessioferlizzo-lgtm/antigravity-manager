import json
import os

def generate_report():
    data = {
        "event_name": "Festa della Pizza Ariano Irpino",
        "social_metrics": {
            "instagram": {
                "handle": "@arianofestadellapizza",
                "followers": 3401,
                "posts": 618,
                "engagement_notes": "Active with good reach on Reels (250+ views). Focused on entertainment and artist announcements."
            }
        },
        "customer_sentiment": {
            "google_maps": {
                "rating": 4.6,
                "total_reviews": 217,
                "strengths": [
                    "Excellent organization and cleanliness",
                    "High-quality entertainment and music",
                    "Pizza quality consistently high"
                ],
                "weaknesses": [
                    "Long wait times during peak hours",
                    "Accessibility (located in Contrada Frolice)",
                    "High noise and crowding at peak"
                ]
            }
        },
        "market_analysis": {
            "competitors": [
                {
                    "name": "Napoli Pizza Village",
                    "scale": "International",
                    "focus": "Authentic Neapolitan tradition, massive tourist draw"
                },
                {
                    "name": "Pizza Festival (Touring)",
                    "scale": "National",
                    "focus": "Street food format, itinerant across Italian cities"
                },
                {
                    "name": "Campionato Mondiale della Pizza (Parma)",
                    "scale": "Professional",
                    "focus": "Industry competition and networking"
                }
            ],
            "strategic_positioning": "Festa della Pizza Ariano functions as a strong regional hub (Irpinia), leveraging entertainment and local loyalty rather than just pure gastronomic tourism."
        }
    }
    
    output_dir = "/Users/alessioferlizzo/Databse-Clienti-Antigravity/.tmp"
    os.makedirs(output_dir, exist_ok=True)
    
    report_path = os.path.join(output_dir, "festa_della_pizza_report.json")
    with open(report_path, "w") as f:
        json.dump(data, f, indent=4)
        
    print(f"Report generated at: {report_path}")

if __name__ == "__main__":
    generate_report()
