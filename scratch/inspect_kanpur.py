import json
import os

scratch_dir = "/Users/abhinavsahu/.gemini/antigravity/brain/1ac154a3-f3a0-415b-9f5b-3135cda46e11/scratch"
up_path = os.path.join(scratch_dir, "up.geojson")

if os.path.exists(up_path):
    with open(up_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    kanpur_feature = None
    for f in data.get("features", []):
        props = f.get("properties", {})
        if props.get("district") == "Kanpur Nagar":
            kanpur_feature = f
            break
    if kanpur_feature:
        print("Found Kanpur Nagar district!")
        print("Properties:", kanpur_feature.get("properties"))
        geom = kanpur_feature.get("geometry", {})
        print("Geometry type:", geom.get("type"))
        coordinates = geom.get("coordinates", [])
        if geom.get("type") == "Polygon":
            print("Number of points:", len(coordinates[0]))
            print("First 5 points:", coordinates[0][:5])
        elif geom.get("type") == "MultiPolygon":
            print("Number of polygons:", len(coordinates))
            print("First 5 points of first polygon:", coordinates[0][0][:5])
    else:
        print("Kanpur Nagar district NOT found in UP features.")
        # Print list of district names
        districts = [f.get("properties", {}).get("district") for f in data.get("features", [])]
        print("Available districts in UP:", districts[:15])
else:
    print("up.geojson not found.")
