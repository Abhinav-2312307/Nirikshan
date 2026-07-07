import json
import os
import random

scratch_dir = "/Users/abhinavsahu/.gemini/antigravity/brain/1ac154a3-f3a0-415b-9f5b-3135cda46e11/scratch"
project_dir = "/Users/abhinavsahu/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Project/civic-map-project"

CAPITALS = {
    "Andhra Pradesh": "Amaravati", "Arunachal Pradesh": "Itanagar", "Assam": "Dispur",
    "Bihar": "Patna", "Chhattisgarh": "Raipur", "Goa": "Panaji", "Gujarat": "Gandhinagar",
    "Haryana": "Chandigarh", "Himachal Pradesh": "Shimla", "Jharkhand": "Ranchi",
    "Karnataka": "Bengaluru", "Kerala": "Thiruvananthapuram", "Madhya Pradesh": "Bhopal",
    "Maharashtra": "Mumbai", "Manipur": "Imphal", "Meghalaya": "Shillong", "Mizoram": "Aizawl",
    "Nagaland": "Kohima", "Odisha": "Bhubaneswar", "Punjab": "Chandigarh", "Rajasthan": "Jaipur",
    "Sikkim": "Gangtok", "Tamil Nadu": "Chennai", "Telangana": "Hyderabad", "Tripura": "Agartala",
    "Uttar Pradesh": "Lucknow", "Uttarakhand": "Dehradun", "West Bengal": "Kolkata",
    "Andaman & Nicobar Island": "Port Blair", "Andaman & Nicobar Islands": "Port Blair",
    "Chandigarh": "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu": "Daman",
    "Dadra and Nagar Haveli and Daman and Diu": "Daman", "Delhi": "New Delhi",
    "NCT of Delhi": "New Delhi", "Jammu & Kashmir": "Srinagar", "Jammu and Kashmir": "Srinagar",
    "Ladakh": "Leh", "Lakshadweep": "Kavaratti", "Puducherry": "Puducherry", "Lakshadweep Islands": "Kavaratti"
}

def get_state_id(state_name):
    mapping = {
        "Uttar Pradesh": "STATE_UP", "Delhi": "STATE_DL", "Maharashtra": "STATE_MH",
        "Karnataka": "STATE_KA", "Tamil Nadu": "STATE_TN", "Bihar": "STATE_BR",
        "Rajasthan": "STATE_RJ", "Andaman & Nicobar Island": "STATE_AN",
        "Andaman & Nicobar Islands": "STATE_AN", "Andhra Pradesh": "STATE_AP",
        "Arunachal Pradesh": "STATE_AR", "Assam": "STATE_AS", "Chandigarh": "STATE_CH",
        "Chhattisgarh": "STATE_CT", "Dadra & Nagar Haveli and Daman & Diu": "STATE_DN",
        "Dadra and Nagar Haveli and Daman and Diu": "STATE_DN", "Goa": "STATE_GA",
        "Gujarat": "STATE_GJ", "Haryana": "STATE_HR", "Himachal Pradesh": "STATE_HP",
        "Jammu & Kashmir": "STATE_JK", "Jammu and Kashmir": "STATE_JK", "Jharkhand": "STATE_JH",
        "Kerala": "STATE_KL", "Ladakh": "STATE_LA", "Lakshadweep": "STATE_LD",
        "Lakshadweep Islands": "STATE_LD", "Madhya Pradesh": "STATE_MP", "Manipur": "STATE_MN",
        "Meghalaya": "STATE_ML", "Mizoram": "STATE_MZ", "Nagaland": "STATE_NL",
        "Odisha": "STATE_OR", "Puducherry": "STATE_PY", "Punjab": "STATE_PB",
        "Sikkim": "STATE_SK", "Telangana": "STATE_TG", "Tripura": "STATE_TR",
        "Uttarakhand": "STATE_UT", "West Bengal": "STATE_WB"
    }
    return mapping.get(state_name, "STATE_" + state_name.upper().replace(" ", "_"))

def process_states():
    input_path = os.path.join(scratch_dir, "india_states_gist.geojson")
    output_path = os.path.join(project_dir, "src/server/data/india.states.geojson")
    
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    out_features = []
    for feat in data.get("features", []):
        props = feat.get("properties", {})
        # The key might be 'ST_NM' or similar
        state_name = props.get("ST_NM") or props.get("state_name") or props.get("name")
        if not state_name:
            continue
            
        state_id = get_state_id(state_name)
        capital = CAPITALS.get(state_name, "Capital")
        
        # Predefined base scores matching previous plan or reasonable values
        base_score = 50
        if state_id == "STATE_UP": base_score = 52
        elif state_id == "STATE_DL": base_score = 25
        elif state_id == "STATE_MH": base_score = 75
        elif state_id == "STATE_KA": base_score = 83
        elif state_id == "STATE_TN": base_score = 79
        elif state_id == "STATE_BR": base_score = 41
        elif state_id == "STATE_RJ": base_score = 67
        else: base_score = random.randint(45, 80)
        
        new_feat = {
            "type": "Feature",
            "properties": {
                "area_id": state_id,
                "name": state_name,
                "level": "state",
                "city": capital,
                "state": state_name,
                "base_score": base_score
            },
            "geometry": feat.get("geometry")
        }
        out_features.append(new_feat)
        
    out_data = {
        "type": "FeatureCollection",
        "features": out_features
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2)
    print(f"Processed states: saved {len(out_features)} features to {output_path}")

def process_districts():
    input_path = os.path.join(scratch_dir, "up.geojson")
    output_path = os.path.join(project_dir, "src/server/data/up.districts.geojson")
    
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    out_features = []
    for feat in data.get("features", []):
        props = feat.get("properties", {})
        district_name = props.get("district") or props.get("NAME_2")
        if not district_name:
            continue
            
        dist_id = "DIST_" + district_name.upper().replace(" ", "_")
        
        # Predefined base scores matching previous plan
        base_score = 50
        if district_name == "Kanpur Nagar": base_score = 53
        elif district_name == "Lucknow": base_score = 46
        elif district_name == "Prayagraj": base_score = 62
        elif district_name == "Varanasi": base_score = 58
        elif district_name == "Ghaziabad": base_score = 34
        elif district_name == "Agra": base_score = 55
        else: base_score = random.randint(40, 75)
        
        new_feat = {
            "type": "Feature",
            "properties": {
                "area_id": dist_id,
                "parent_area_id": "STATE_UP",
                "name": district_name,
                "level": "district",
                "city": district_name,
                "state": "Uttar Pradesh",
                "base_score": base_score
            },
            "geometry": feat.get("geometry")
        }
        out_features.append(new_feat)
        
    out_data = {
        "type": "FeatureCollection",
        "features": out_features
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2)
    print(f"Processed UP districts: saved {len(out_features)} features to {output_path}")

def process_subdistricts():
    input_path = os.path.join(scratch_dir, "kanpur.subdistricts_clipped.geojson")
    output_path = os.path.join(project_dir, "src/server/data/kanpur.subdistricts.geojson")
    
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    out_features = []
    for feat in data.get("features", []):
        props = feat.get("properties", {})
        props["parent_area_id"] = "DIST_KANPUR_NAGAR"  # Connect it to the new parent district ID!
        feat["properties"] = props
        out_features.append(feat)
        
    out_data = {
        "type": "FeatureCollection",
        "features": out_features
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2)
    print(f"Processed subdistricts: saved {len(out_features)} features to {output_path}")

def process_macro_wards():
    input_path = os.path.join(project_dir, "src/server/data/areas.macro.geojson")
    
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    out_features = []
    for feat in data.get("features", []):
        props = feat.get("properties", {})
        props["parent_area_id"] = "SUBDIST_KANPUR_CITY"  # Connect Naubasta wards to the Sadar subdivision
        feat["properties"] = props
        out_features.append(feat)
        
    out_data = {
        "type": "FeatureCollection",
        "features": out_features
    }
    
    # Overwrite the original
    with open(input_path, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2)
    print(f"Processed macro wards: updated {len(out_features)} features in areas.macro.geojson")

def main():
    process_states()
    process_districts()
    process_subdistricts()
    process_macro_wards()
    print("All processed successfully!")

if __name__ == "__main__":
    main()
