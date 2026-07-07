import json
import os
import random

project_dir = "/Users/abhinavsahu/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Project/civic-map-project"
scratch_dir = "/Users/abhinavsahu/.gemini/antigravity/brain/1ac154a3-f3a0-415b-9f5b-3135cda46e11/scratch"

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

def point_in_polygon(point, polygon):
    inside = False
    for i in range(len(polygon)):
        j = i - 1
        xi, yi = polygon[i][0], polygon[i][1]
        xj, yj = polygon[j][0], polygon[j][1]
        intersect = ((yi > point[1]) != (yj > point[1])) and (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi + 1e-15) + xi)
        if intersect:
            inside = not inside
    return inside

def clip_polygon_by_line(poly, A, B, C):
    output_list = []
    if not poly:
        return []
    points = list(poly)
    if points[0] != points[-1]:
        points.append(points[0])
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i+1]
        
        v1 = A * p1[0] + B * p1[1] + C
        v2 = A * p2[0] + B * p2[1] + C
        
        p1_inside = (v1 >= -1e-9)
        p2_inside = (v2 >= -1e-9)
        
        if p1_inside:
            if p2_inside:
                output_list.append(p2)
            else:
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                denom = A * dx + B * dy
                if abs(denom) > 1e-12:
                    t = -v1 / denom
                    intersect = [p1[0] + t * dx, p1[1] + t * dy]
                    output_list.append(intersect)
        else:
            if p2_inside:
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                denom = A * dx + B * dy
                if abs(denom) > 1e-12:
                    t = -v1 / denom
                    intersect = [p1[0] + t * dx, p1[1] + t * dy]
                    output_list.append(intersect)
                output_list.append(p2)
    if output_list and output_list[0] != output_list[-1]:
        output_list.append(output_list[0])
    return output_list

def generate_voronoi_cells(parent_poly, generators):
    """
    Generates cells for each generator point clipped to parent_poly.
    """
    cells = {}
    for i, g_i in enumerate(generators):
        cell_poly = list(parent_poly)
        for j, g_j in enumerate(generators):
            if i == j:
                continue
            # Bisector of g_i and g_j: closer to g_i
            # 2(x_i - x_j)x + 2(y_i - y_j)y + (x_j^2 + y_j^2 - x_i^2 - y_i^2) >= 0
            A = 2 * (g_i[0] - g_j[0])
            B = 2 * (g_i[1] - g_j[1])
            C = (g_j[0]**2 + g_j[1]**2) - (g_i[0]**2 + g_i[1]**2)
            cell_poly = clip_polygon_by_line(cell_poly, A, B, C)
        cells[i] = cell_poly
    return cells

def get_polygon_centroid(poly):
    if not poly or len(poly) < 3:
        return [0, 0]
    # Remove duplicates
    pts = []
    for p in poly:
        if not pts or p != pts[-1]:
            pts.append(p)
    if pts[0] == pts[-1]:
        pts.pop()
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [sum(xs)/len(xs), sum(ys)/len(ys)]

def main():
    print("=== STARTING SPATIAL HIERARCHY GENERATOR ===")
    
    # 1. Process India States
    states_input = os.path.join(scratch_dir, "india_states_gist.geojson")
    states_output = os.path.join(project_dir, "src/server/data/india.states.geojson")
    with open(states_input, "r", encoding="utf-8") as f:
        states_data = json.load(f)
    
    processed_states = []
    for f in states_data["features"]:
        name = f["properties"].get("ST_NM") or f["properties"].get("state_name") or f["properties"].get("name")
        if not name: continue
        state_id = get_state_id(name)
        capital = CAPITALS.get(name, "Capital")
        
        base_score = 50
        if state_id == "STATE_UP": base_score = 52
        elif state_id == "STATE_DL": base_score = 25
        elif state_id == "STATE_MH": base_score = 75
        elif state_id == "STATE_KA": base_score = 83
        elif state_id == "STATE_TN": base_score = 79
        elif state_id == "STATE_BR": base_score = 41
        elif state_id == "STATE_RJ": base_score = 67
        else: base_score = random.randint(45, 80)
        
        f["properties"] = {
            "area_id": state_id,
            "name": name,
            "level": "state",
            "city": capital,
            "state": name,
            "base_score": base_score
        }
        processed_states.append(f)
    states_data["features"] = processed_states
    with open(states_output, "w", encoding="utf-8") as f:
        json.dump(states_data, f, indent=2)
    print(f"Saved {len(processed_states)} state features.")

    # 2. Process Uttar Pradesh Districts
    up_input = os.path.join(project_dir, "UttarPradesh.geojson")
    up_output = os.path.join(project_dir, "src/server/data/up.districts.geojson")
    with open(up_input, "r", encoding="utf-8") as f:
        up_data = json.load(f)
        
    processed_districts = []
    kanpur_nagar_poly = None
    
    for f in up_data["features"]:
        props = f["properties"]
        name = props.get("Name")
        d_id = props.get("d_id_11")
        if not name: continue
        
        # Distinguish Kanpur Nagar and Kanpur Dehat
        if name == "Kanpur":
            if d_id == 533:
                name = "Kanpur Nagar"
                kanpur_nagar_poly = f["geometry"]["coordinates"][0]
            else:
                name = "Kanpur Dehat"
                
        dist_id = "DIST_" + name.upper().replace(" ", "_")
        
        base_score = 50
        if name == "Kanpur Nagar": base_score = 53
        elif name == "Lucknow": base_score = 46
        elif name == "Prayagraj": base_score = 62
        elif name == "Varanasi": base_score = 58
        elif name == "Ghaziabad": base_score = 34
        elif name == "Agra": base_score = 55
        else: base_score = random.randint(40, 75)
        
        f["properties"] = {
            "area_id": dist_id,
            "parent_area_id": "STATE_UP",
            "name": name,
            "level": "district",
            "city": name,
            "state": "Uttar Pradesh",
            "base_score": base_score
        }
        processed_districts.append(f)
    up_data["features"] = processed_districts
    with open(up_output, "w", encoding="utf-8") as f:
        json.dump(up_data, f, indent=2)
    print(f"Saved {len(processed_districts)} UP district features.")

    if not kanpur_nagar_poly:
        print("CRITICAL: Kanpur Nagar polygon not found in UttarPradesh.geojson!")
        return

    # 3. Generate Subdistricts (Tehsils) inside Kanpur Nagar
    subdist_output = os.path.join(project_dir, "src/server/data/kanpur.subdistricts.geojson")
    # 3 generators: Bilhaur (North), Sadar (Central), Ghatampur (South)
    subdist_gens = [
        [80.15, 26.70],  # Bilhaur
        [80.32, 26.41],  # Kanpur Sadar
        [80.15, 26.15]   # Ghatampur
    ]
    subdist_cells = generate_voronoi_cells(kanpur_nagar_poly, subdist_gens)
    
    subdistricts = [
        {
            "id": "SUBDIST_BILHAUR",
            "name": "Bilhaur Subdivision",
            "base_score": 68
        },
        {
            "id": "SUBDIST_KANPUR_CITY",
            "name": "Kanpur City Subdivision",
            "base_score": 55
        },
        {
            "id": "SUBDIST_GHATAMPUR",
            "name": "Ghatampur Subdivision",
            "base_score": 61
        }
    ]
    
    subdist_features = []
    sadar_poly = None
    
    for idx, sd in enumerate(subdistricts):
        poly = subdist_cells[idx]
        if sd["id"] == "SUBDIST_KANPUR_CITY":
            sadar_poly = poly
            
        feat = {
            "type": "Feature",
            "properties": {
                "area_id": sd["id"],
                "parent_area_id": "DIST_KANPUR_NAGAR",
                "name": sd["name"],
                "level": "subdistrict",
                "city": "Kanpur",
                "state": "Uttar Pradesh",
                "base_score": sd["base_score"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [poly]
            }
        }
        subdist_features.append(feat)
        
    subdist_data = {
        "type": "FeatureCollection",
        "features": subdist_features
    }
    with open(subdist_output, "w", encoding="utf-8") as f:
        json.dump(subdist_data, f, indent=2)
    print(f"Generated {len(subdist_features)} subdistricts.")

    # 4. Generate 8 Macro Wards inside Kanpur Sadar
    macro_output = os.path.join(project_dir, "src/server/data/areas.macro.geojson")
    ward_gens = [
        [80.305, 26.418], # Ward A: Naubasta Central
        [80.325, 26.425], # Ward B: Galla Mandi Belt
        [80.285, 26.435], # Ward C: Machhariya Extension
        [80.345, 26.410], # Ward D: Hanspuram Fringe
        [80.295, 26.402], # Ward E: South Naubasta
        [80.325, 26.395], # Ward F: Ratanpur Corridor
        [80.250, 26.430], # Ward G: Panki Industrial
        [80.290, 26.445]  # Ward H: Barra Extension
    ]
    ward_details = [
        {"id": "NAUBASTA_WARD_A", "name": "Naubasta Central", "auth": "KNN", "auth_name": "Kanpur Nagar Nigam", "score": 55},
        {"id": "NAUBASTA_WARD_B", "name": "Galla Mandi Belt", "auth": "KNN", "auth_name": "Kanpur Nagar Nigam", "score": 49},
        {"id": "NAUBASTA_WARD_C", "name": "Machhariya Extension", "auth": "KDA", "auth_name": "Kanpur Development Authority", "score": 63},
        {"id": "NAUBASTA_WARD_D", "name": "Hanspuram Fringe", "auth": "KNN", "auth_name": "Kanpur Nagar Nigam", "score": 41},
        {"id": "NAUBASTA_WARD_E", "name": "South Naubasta", "auth": "JAL", "auth_name": "Jal Kal Vibhag", "score": 37},
        {"id": "NAUBASTA_WARD_F", "name": "Ratanpur Corridor", "auth": "KNN", "auth_name": "Kanpur Nagar Nigam", "score": 58},
        {"id": "NAUBASTA_WARD_G", "name": "Panki Industrial Area", "auth": "KNN", "auth_name": "Kanpur Nagar Nigam", "score": 52},
        {"id": "NAUBASTA_WARD_H", "name": "Barra Extension", "auth": "KDA", "auth_name": "Kanpur Development Authority", "score": 60}
    ]
    
    ward_cells = generate_voronoi_cells(sadar_poly, ward_gens)
    macro_features = []
    
    for idx, wd in enumerate(ward_details):
        poly = ward_cells[idx]
        feat = {
            "type": "Feature",
            "properties": {
                "area_id": wd["id"],
                "parent_area_id": "SUBDIST_KANPUR_CITY",
                "name": wd["name"],
                "level": "macro",
                "city": "Kanpur",
                "state": "Uttar Pradesh",
                "authority_id": wd["auth"],
                "authority": wd["auth_name"],
                "base_score": wd["score"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [poly]
            }
        }
        macro_features.append(feat)
        
    macro_data = {
        "type": "FeatureCollection",
        "features": macro_features
    }
    with open(macro_output, "w", encoding="utf-8") as f:
        json.dump(macro_data, f, indent=2)
    print(f"Generated {len(macro_features)} macro wards.")

    # 5. Generate 2 Micro Blocks per ward (16 features)
    micro_output = os.path.join(project_dir, "src/server/data/areas.micro.geojson")
    micro_features = []
    
    for wd_feat in macro_features:
        w_id = wd_feat["properties"]["area_id"]
        w_name = wd_feat["properties"]["name"]
        w_poly = wd_feat["geometry"]["coordinates"][0]
        w_auth = wd_feat["properties"]["authority_id"]
        w_auth_name = wd_feat["properties"]["authority"]
        
        centroid = get_polygon_centroid(w_poly)
        gens = [
            [centroid[0] - 0.005, centroid[1] - 0.005],
            [centroid[0] + 0.005, centroid[1] + 0.005]
        ]
        cells = generate_voronoi_cells(w_poly, gens)
        
        for idx in range(2):
            cell_poly = cells[idx]
            cell_id = f"{w_id}_MICRO_{idx + 1}"
            feat = {
                "type": "Feature",
                "properties": {
                    "area_id": cell_id,
                    "parent_area_id": w_id,
                    "name": f"{w_name} Block {idx + 1}",
                    "level": "micro",
                    "city": "Kanpur",
                    "state": "Uttar Pradesh",
                    "authority_id": w_auth,
                    "authority": w_auth_name,
                    "base_score": wd_feat["properties"]["base_score"] + random.randint(-4, 4)
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [cell_poly]
                }
            }
            micro_features.append(feat)
            
    micro_data = {
        "type": "FeatureCollection",
        "features": micro_features
    }
    with open(micro_output, "w", encoding="utf-8") as f:
        json.dump(micro_data, f, indent=2)
    print(f"Generated {len(micro_features)} micro blocks.")

    # 6. Generate 2 Submicro Segments per block (32 features)
    submicro_output = os.path.join(project_dir, "src/server/data/areas.submicro.geojson")
    submicro_features = []
    
    for mb_feat in micro_features:
        m_id = mb_feat["properties"]["area_id"]
        m_name = mb_feat["properties"]["name"]
        m_poly = mb_feat["geometry"]["coordinates"][0]
        m_auth = mb_feat["properties"]["authority_id"]
        m_auth_name = mb_feat["properties"]["authority"]
        
        centroid = get_polygon_centroid(m_poly)
        gens = [
            [centroid[0] - 0.002, centroid[1]],
            [centroid[0] + 0.002, centroid[1]]
        ]
        cells = generate_voronoi_cells(m_poly, gens)
        
        for idx in range(2):
            cell_poly = cells[idx]
            cell_id = f"{m_id}_SUB_{idx + 1}"
            feat = {
                "type": "Feature",
                "properties": {
                    "area_id": cell_id,
                    "parent_area_id": m_id,
                    "name": f"{m_name} Segment {idx + 1}",
                    "level": "submicro",
                    "city": "Kanpur",
                    "state": "Uttar Pradesh",
                    "authority_id": m_auth,
                    "authority": m_auth_name,
                    "base_score": mb_feat["properties"]["base_score"] + random.randint(-2, 2)
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [cell_poly]
                }
            }
            submicro_features.append(feat)
            
    submicro_data = {
        "type": "FeatureCollection",
        "features": submicro_features
    }
    with open(submicro_output, "w", encoding="utf-8") as f:
        json.dump(submicro_data, f, indent=2)
    print(f"Generated {len(submicro_features)} submicro segments.")

    # 7. Update Places and Complaints area_id dynamically
    print("\nRe-resolving coordinates for pre-populated places and complaints...")
    
    # We will build an index of submicro segments
    submicro_list = submicro_data["features"]
    
    def find_new_area_id(lat, lng):
        pt = [lng, lat]
        for f in submicro_list:
            if point_in_polygon(pt, f["geometry"]["coordinates"][0]):
                return f["properties"]["area_id"]
        # Fallback to macro wards
        for f in macro_features:
            if point_in_polygon(pt, f["geometry"]["coordinates"][0]):
                return f["properties"]["area_id"]
        # Fallback to subdistricts
        for f in subdist_features:
            if point_in_polygon(pt, f["geometry"]["coordinates"][0]):
                return f["properties"]["area_id"]
        return None

    # Load and update places
    places_path = os.path.join(project_dir, "src/server/data/places.geojson")
    with open(places_path, "r", encoding="utf-8") as f:
        places_data = json.load(f)
        
    for f in places_data["features"]:
        geom = f["geometry"]
        lat, lng = 0, 0
        if geom["type"] == "Point":
            lng, lat = geom["coordinates"]
        elif geom["type"] == "LineString":
            lng, lat = geom["coordinates"][0]
        elif geom["type"] == "Polygon":
            lng, lat = geom["coordinates"][0][0]
            
        new_id = find_new_area_id(lat, lng)
        if new_id:
            f["properties"]["area_id"] = new_id
            print(f"  Place '{f['properties']['name']}' -> area_id = {new_id}")
            
    with open(places_path, "w", encoding="utf-8") as f:
        json.dump(places_data, f, indent=2)

    # Load and update complaints
    complaints_path = os.path.join(project_dir, "src/server/data/complaints.json")
    with open(complaints_path, "r", encoding="utf-8") as f:
        complaints_list = json.load(f)
        
    for c in complaints_list:
        lat, lng = c["latitude"], c["longitude"]
        new_id = find_new_area_id(lat, lng)
        if new_id:
            c["area_id"] = new_id
            print(f"  Complaint '{c['complaint_id']}' ({c['issue_type']}) -> area_id = {new_id}")
            
    with open(complaints_path, "w", encoding="utf-8") as f:
        json.dump(complaints_list, f, indent=2)

    print("\n=== SPATIAL HIERARCHY GENERATOR COMPLETED ===")

if __name__ == "__main__":
    main()
