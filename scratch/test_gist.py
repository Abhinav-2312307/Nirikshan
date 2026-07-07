import urllib.request
import json
import os

scratch_dir = "/Users/abhinavsahu/.gemini/antigravity/brain/1ac154a3-f3a0-415b-9f5b-3135cda46e11/scratch"
gist_url = "https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson"

print("Downloading india_states.geojson Gist...")
try:
    urllib.request.urlretrieve(gist_url, os.path.join(scratch_dir, "india_states_gist.geojson"))
    print("Success Gist downloaded.")
except Exception as e:
    print("Error Gist:", e)

gist_path = os.path.join(scratch_dir, "india_states_gist.geojson")
if os.path.exists(gist_path):
    with open(gist_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print("Gist features:", len(data.get("features", [])))
    if data.get("features"):
        first_feat = data["features"][0]
        print("First feature properties:", first_feat.get("properties"))
