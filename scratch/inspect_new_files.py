import json
import os

project_dir = "/Users/abhinavsahu/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Project/civic-map-project"

def inspect_file(filename):
    file_path = os.path.join(project_dir, filename)
    print(f"\n=== Inspecting {filename} ===")
    if not os.path.exists(file_path):
        print("File does not exist")
        return
        
    with open(file_path, "r", encoding="utf-8") as f:
        # Load only the first few bytes to avoid memory overhead or load fully if needed
        # We can read the first feature or parse it
        try:
            data = json.load(f)
            print("Type:", data.get("type"))
            features = data.get("features", [])
            print("Features count:", len(features))
            if features:
                print("First feature properties:", features[0].get("properties"))
                print("First feature geometry type:", features[0].get("geometry", {}).get("type"))
                
                # Sample some names
                names = []
                for feat in features[:10]:
                    props = feat.get("properties", {})
                    # Find a name property
                    name = None
                    for key in ["state_name", "state", "ST_NM", "district", "Name", "NAME_1", "NAME_2", "name", "ward_name", "ward", "WARD_NAME"]:
                        if key in props:
                            name = props[key]
                            break
                    names.append(name)
                print("Sample names:", names)
        except Exception as e:
            print("Error parsing JSON:", e)

inspect_file("india_state.geojson")
inspect_file("india_district.geojson")
inspect_file("wards_kanpur.geojson")
