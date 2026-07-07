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
    cells = {}
    for i, g_i in enumerate(generators):
        cell_poly = list(parent_poly)
        for j, g_j in enumerate(generators):
            if i == j:
                continue
            A = 2 * (g_i[0] - g_j[0])
            B = 2 * (g_i[1] - g_j[1])
            C = (g_j[0]**2 + g_j[1]**2) - (g_i[0]**2 + g_i[1]**2)
            cell_poly = clip_polygon_by_line(cell_poly, A, B, C)
        cells[i] = cell_poly
    return cells

def get_polygon_centroid(poly):
    if not poly or len(poly) < 3:
        return [0, 0]
    pts = []
    for p in poly:
        if not pts or p != pts[-1]:
            pts.append(p)
    if pts[0] == pts[-1]:
        pts.pop()
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [sum(xs)/len(xs), sum(ys)/len(ys)]

def downsample_ring(ring, factor=5):
    if len(ring) < 12:
        return ring
    res = ring[::factor]
    if res[-1] != ring[-1]:
        res.append(ring[-1])
    return res

def simplify_geom(geom, factor=5):
    if not geom:
        return geom
    g_type = geom.get("type")
    coords = geom.get("coordinates", [])
    if g_type == "Polygon":
        new_coords = [downsample_ring(r, factor) for r in coords if len(r) > 0]
        return {"type": "Polygon", "coordinates": new_coords}
    elif g_type == "MultiPolygon":
        new_coords = []
        for poly in coords:
            new_poly = [downsample_ring(r, factor) for r in poly if len(r) > 0]
            new_coords.append(new_poly)
        return {"type": "MultiPolygon", "coordinates": new_coords}
    return geom

def main():
    print("=== STARTING SPATIAL HIERARCHY GENERATOR V2 ===")
    
    # 1. Process India States (india_state.geojson)
    states_input = os.path.join(project_dir, "india_state.geojson")
    states_output = os.path.join(project_dir, "src/server/data/india.states.geojson")
    with open(states_input, "r", encoding="utf-8") as f:
        states_data = json.load(f)
    
    processed_states = []
    for f in states_data["features"]:
        props = f["properties"]
        name = props.get("NAME_1") or props.get("state_name") or props.get("name")
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
        
        # Simplify geometry by downsampling vertices by 6 for states
        sim_geom = simplify_geom(f.get("geometry"), factor=6)
        
        new_feat = {
            "type": "Feature",
            "properties": {
                "area_id": state_id,
                "name": name,
                "level": "state",
                "city": capital,
                "state": name,
                "base_score": base_score
            },
            "geometry": sim_geom
        }
        processed_states.append(new_feat)
        
    states_data["features"] = processed_states
    with open(states_output, "w", encoding="utf-8") as f:
        json.dump(states_data, f, indent=2)
    print(f"Saved {len(processed_states)} state features to {states_output}.")

    # 2. Process Uttar Pradesh Districts (filter and simplify india_district.geojson)
    # We will filter to keep ONLY Uttar Pradesh districts to keep the map fast & responsive,
    # which has 70 districts in the user's file.
    dist_input = os.path.join(project_dir, "india_district.geojson")
    dist_output = os.path.join(project_dir, "src/server/data/up.districts.geojson")
    with open(dist_input, "r", encoding="utf-8") as f:
        dist_data = json.load(f)
        
    processed_districts = []
    kanpur_nagar_poly = None
    
    for f in dist_data["features"]:
        props = f["properties"]
        state_name = props.get("NAME_1")
        district_name = props.get("NAME_2")
        d_id = props.get("ID_2")
        
        if state_name != "Uttar Pradesh":
            continue
            
        if not district_name:
            continue
            
        # Distinguish Kanpur Nagar and Kanpur Dehat
        if district_name == "Kanpur":
            if d_id == 533:
                district_name = "Kanpur Nagar"
                # Store Kanpur Nagar polygon for tehsil generation
                if f["geometry"]["type"] == "Polygon":
                    kanpur_nagar_poly = f["geometry"]["coordinates"][0]
                elif f["geometry"]["type"] == "MultiPolygon":
                    kanpur_nagar_poly = f["geometry"]["coordinates"][0][0]
            else:
                district_name = "Kanpur Dehat"
                
        dist_id = "DIST_" + district_name.upper().replace(" ", "_")
        
        base_score = 50
        if district_name == "Kanpur Nagar": base_score = 53
        elif district_name == "Lucknow": base_score = 46
        elif district_name == "Prayagraj": base_score = 62
        elif district_name == "Varanasi": base_score = 58
        elif district_name == "Ghaziabad": base_score = 34
        elif district_name == "Agra": base_score = 55
        else: base_score = random.randint(40, 75)
        
        # Simplify geometry by downsampling vertices by 4 for districts
        sim_geom = simplify_geom(f.get("geometry"), factor=4)
        
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
            "geometry": sim_geom
        }
        processed_districts.append(new_feat)
        
    dist_data["features"] = processed_districts
    with open(dist_output, "w", encoding="utf-8") as f:
        json.dump(dist_data, f, indent=2)
    print(f"Saved {len(processed_districts)} UP district features to {dist_output}.")

    if not kanpur_nagar_poly:
        print("CRITICAL: Kanpur Nagar polygon not found in india_district.geojson!")
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
        {"id": "SUBDIST_BILHAUR", "name": "Bilhaur Subdivision", "base_score": 68},
        {"id": "SUBDIST_KANPUR_CITY", "name": "Kanpur City Subdivision", "base_score": 55},
        {"id": "SUBDIST_GHATAMPUR", "name": "Ghatampur Subdivision", "base_score": 61}
    ]
    
    subdist_features = []
    for idx, sd in enumerate(subdistricts):
        poly = subdist_cells[idx]
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
    print(f"Generated {len(subdist_features)} subdivisions.")

    # 4. Import the 58 real wards from wards_kanpur.geojson (Macro Wards)
    wards_input = os.path.join(project_dir, "wards_kanpur.geojson")
    macro_output = os.path.join(project_dir, "src/server/data/areas.macro.geojson")
    with open(wards_input, "r", encoding="utf-8") as f:
        wards_data = json.load(f)
        
    macro_features = []
    authorities = ["KNN", "KDA", "JAL"]
    auth_names = {"KNN": "Kanpur Nagar Nigam", "KDA": "Kanpur Development Authority", "JAL": "Jal Kal Vibhag"}
    
    for idx, f in enumerate(wards_data["features"]):
        props = f["properties"]
        ward_no = props.get("Ward No")
        if ward_no is None:
            ward_no = idx + 1
        ward_name = props.get("Ward Name") or f"Ward No {ward_no}"
        
        ward_id = f"WARD_{ward_no}"
        
        # Distribute authorities
        auth = "KNN"
        if ward_no % 4 == 0: auth = "KDA"
        elif ward_no % 5 == 0: auth = "JAL"
        
        f["properties"] = {
            "area_id": ward_id,
            "parent_area_id": "SUBDIST_KANPUR_CITY",
            "name": ward_name,
            "level": "macro",
            "city": "Kanpur",
            "state": "Uttar Pradesh",
            "authority_id": auth,
            "authority": auth_names[auth],
            "base_score": random.randint(40, 75)
        }
        macro_features.append(f)
        
    macro_data = {
        "type": "FeatureCollection",
        "features": macro_features
    }
    with open(macro_output, "w", encoding="utf-8") as f:
        json.dump(macro_data, f, indent=2)
    print(f"Imported {len(macro_features)} real macro wards.")

    # 5. Generate 2 Micro Blocks per ward (116 features)
    micro_output = os.path.join(project_dir, "src/server/data/areas.micro.geojson")
    micro_features = []
    
    for wd_feat in macro_features:
        w_id = wd_feat["properties"]["area_id"]
        w_name = wd_feat["properties"]["name"]
        
        geom = wd_feat["geometry"]
        w_poly = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
        
        w_auth = wd_feat["properties"]["authority_id"]
        w_auth_name = wd_feat["properties"]["authority"]
        
        centroid = get_polygon_centroid(w_poly)
        gens = [
            [centroid[0] - 0.003, centroid[1] - 0.003],
            [centroid[0] + 0.003, centroid[1] + 0.003]
        ]
        cells = generate_voronoi_cells(w_poly, gens)
        
        for idx in range(2):
            cell_poly = cells[idx]
            # If clipping results in an empty polygon, fallback to parent
            if len(cell_poly) < 3:
                cell_poly = w_poly
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

    # 6. Generate 2 Submicro Segments per block (232 features)
    submicro_output = os.path.join(project_dir, "src/server/data/areas.submicro.geojson")
    submicro_features = []
    
    for mb_feat in micro_features:
        m_id = mb_feat["properties"]["area_id"]
        m_name = mb_feat["properties"]["name"]
        
        geom = mb_feat["geometry"]
        m_poly = geom["coordinates"][0]
        
        m_auth = mb_feat["properties"]["authority_id"]
        m_auth_name = mb_feat["properties"]["authority"]
        
        centroid = get_polygon_centroid(m_poly)
        gens = [
            [centroid[0] - 0.001, centroid[1]],
            [centroid[0] + 0.001, centroid[1]]
        ]
        cells = generate_voronoi_cells(m_poly, gens)
        
        for idx in range(2):
            cell_poly = cells[idx]
            if len(cell_poly) < 3:
                cell_poly = m_poly
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
        for f in macro_features:
            geom = f["geometry"]
            w_poly = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
            if point_in_polygon(pt, w_poly):
                return f["properties"]["area_id"]
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

    print("\n=== SPATIAL HIERARCHY GENERATOR V2 COMPLETED ===")

if __name__ == "__main__":
    main()
