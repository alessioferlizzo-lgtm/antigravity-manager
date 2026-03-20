import sys
import json
from PIL import Image

def get_dominant_colors(image_path, num_colors=5):
    try:
        img = Image.open(image_path)
        img = img.convert('RGB')
        img.thumbnail((200, 200))  # Resize for faster processing
        
        # Get pixels
        pixels = img.getdata()
        
        # Group similar colors (optional, but let's keep it simple first)
        # Use a dictionary to count occurrences of each color
        color_counts = {}
        for r, g, b in pixels:
            # Quantize colors slightly to group similar ones
            # (e.g., divide by 8 and multiply by 8)
            quantized = (r // 8 * 8, g // 8 * 8, b // 8 * 8)
            color_counts[quantized] = color_counts.get(quantized, 0) + 1
            
        # Sort by frequency
        sorted_colors = sorted(color_counts.items(), key=lambda x: x[1], reverse=True)
        
        # Filter out near-white or near-black if they are too dominant?
        # Actually, let's just take the top ones but avoid pure white/black if others exist
        
        hex_colors = []
        for (r, g, b), count in sorted_colors:
            # Skip if color is too close to white or black (simple filter)
            # if (r > 240 and g > 240 and b > 240) or (r < 15 and g < 15 and b < 15):
            #     continue
            
            hex_color = '#{:02x}{:02x}{:02x}'.format(r, g, b)
            if hex_color not in hex_colors:
                hex_colors.append(hex_color)
            if len(hex_colors) >= num_colors:
                break
                
        return hex_colors
    except Exception as e:
        print(f"Error: {e}")
        return []

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(1)
        
    path = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    colors = get_dominant_colors(path, limit)
    print(json.dumps(colors))
