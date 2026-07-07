import json
import os

project_dir = "/Users/abhinavsahu/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Project/civic-map-project"

def round_coords(obj):
    if isinstance(obj, list):
        return [round_coords(x) for x in obj]
    elif isinstance(obj, float):
        return round(obj, 5)
    return obj

def optimize_file(filename):
    file_path = os.path.join(project_dir, filename)
    if not os.path.exists(file_path):
        return
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for feat in data.get("features", []):
        geom = feat.get("geometry")
        if geom and "coordinates" in geom:
            geom["coordinates"] = round_coords(geom["coordinates"])
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    print(f"Optimized {filename}, new size: {os.path.getsize(file_path) / 1024:.1f} KB")

optimize_file("src/server/data/india.states.geojson")
optimize_file("src/server/data/up.districts.geojson")
optimize_file("src/server/data/areas.macro.geojson")
optimize_file("src/server/data/areas.micro.geojson")
optimize_file("src/server/data/areas.submicro.geojson")
