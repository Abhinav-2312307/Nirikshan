import json
import os

project_dir = "/Users/abhinavsahu/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Project/civic-map-project"
file_path = os.path.join(project_dir, "UttarPradesh.geojson")

if os.path.exists(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print("GeoJSON Type:", data.get("type"))
    features = data.get("features", [])
    print("Number of features:", len(features))
    if features:
        print("First feature properties:", features[0].get("properties"))
        geom = features[0].get("geometry", {})
        print("First feature geometry type:", geom.get("type"))
        if geom.get("type") == "Polygon":
            print("First feature coordinate points count:", len(geom.get("coordinates", [[]])[0]))
        elif geom.get("type") == "MultiPolygon":
            print("First feature coordinate points count:", len(geom.get("coordinates", [[[]]])[0][0]))
        
        # Check some names
        names = []
        for feat in features[:15]:
            props = feat.get("properties", {})
            name = props.get("name") or props.get("district") or props.get("NAME_2") or props.get("District")
            names.append(name)
        print("Sample feature names:", names)
else:
    print("UttarPradesh.geojson not found.")
