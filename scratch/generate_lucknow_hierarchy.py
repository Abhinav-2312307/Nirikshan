import json
import os
import random

project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(project_dir, "src", "server", "data")

def point_in_polygon(point, polygon):
    inside = False
    n = len(polygon)
    for i in range(n):
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

def clip_polygon_y(poly, y_limit, keep_above):
    output_list = []
    if not poly:
        return []
    points = list(poly)
    if points[0] != points[-1]:
        points.append(points[0])
    for i in range(len(points) - 1):
        p1, p2 = points[i], points[i+1]
        p1_inside = (p1[1] >= y_limit) if keep_above else (p1[1] <= y_limit)
        p2_inside = (p2[1] >= y_limit) if keep_above else (p2[1] <= y_limit)
        if p1_inside:
            if p2_inside:
                output_list.append(p2)
            else:
                dy = p2[1] - p1[1]
                t = (y_limit - p1[1]) / dy if abs(dy) > 1e-9 else 0
                output_list.append([p1[0] + t * (p2[0] - p1[0]), y_limit])
        else:
            if p2_inside:
                dy = p2[1] - p1[1]
                t = (y_limit - p1[1]) / dy if abs(dy) > 1e-9 else 0
                output_list.append([p1[0] + t * (p2[0] - p1[0]), y_limit])
                output_list.append(p2)
    if output_list and output_list[0] != output_list[-1]:
        output_list.append(output_list[0])
    return output_list

def main():
    print("=== PROCESSING LUCKNOW SPATIAL HIERARCHY ===")
    random.seed(42)  # Deterministic seed for consistency

    # 1. Generate Lucknow Subdistricts from up.districts.geojson
    up_dist_path = os.path.join(data_dir, "up.districts.geojson")
    with open(up_dist_path, "r", encoding="utf-8") as f:
        up_dist = json.load(f)

    lko_dist = None
    for f in up_dist["features"]:
        if "lucknow" in f["properties"]["name"].lower():
            lko_dist = f
            break

    if not lko_dist:
        raise RuntimeError("Lucknow district not found in up.districts.geojson")

    poly = lko_dist["geometry"]["coordinates"][0]
    bkt_poly = clip_polygon_y(poly, 26.96, keep_above=True)
    below_26_96 = clip_polygon_y(poly, 26.96, keep_above=False)
    lko_city_poly = clip_polygon_y(below_26_96, 26.72, keep_above=True)
    mhl_poly = clip_polygon_y(below_26_96, 26.72, keep_above=False)

    lko_subdists = [
        {
            "type": "Feature",
            "properties": {
                "area_id": "SUBDIST_BAKSHI_KA_TALAB",
                "parent_area_id": "DIST_LUCKNOW",
                "name": "Bakshi Ka Talab Subdivision",
                "level": "subdistrict",
                "city": "Lucknow",
                "state": "Uttar Pradesh",
                "base_score": 67
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [bkt_poly]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "area_id": "SUBDIST_LUCKNOW_CITY",
                "parent_area_id": "DIST_LUCKNOW",
                "name": "Lucknow City Subdivision",
                "level": "subdistrict",
                "city": "Lucknow",
                "state": "Uttar Pradesh",
                "base_score": 54
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [lko_city_poly]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "area_id": "SUBDIST_MOHANLALGANJ",
                "parent_area_id": "DIST_LUCKNOW",
                "name": "Mohanlalganj Subdivision",
                "level": "subdistrict",
                "city": "Lucknow",
                "state": "Uttar Pradesh",
                "base_score": 62
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [mhl_poly]
            }
        }
    ]

    # Update kanpur.subdistricts.geojson (Subdistricts dataset)
    subdist_path = os.path.join(data_dir, "kanpur.subdistricts.geojson")
    with open(subdist_path, "r", encoding="utf-8") as f:
        subdist_data = json.load(f)

    # Keep Kanpur subdistricts, filter out previous Lucknow subdistricts if any
    kanpur_subdists = [f for f in subdist_data["features"] if not f["properties"]["area_id"].startswith("SUBDIST_LUCKNOW") and f["properties"]["area_id"] not in ["SUBDIST_BAKSHI_KA_TALAB", "SUBDIST_MOHANLALGANJ"]]
    all_subdists = kanpur_subdists + lko_subdists
    subdist_data["features"] = all_subdists
    with open(subdist_path, "w", encoding="utf-8") as f:
        json.dump(subdist_data, f, indent=2)
    print(f"Updated subdistricts: {len(all_subdists)} total ({len(kanpur_subdists)} Kanpur + {len(lko_subdists)} Lucknow)")

    # 2. Process Lucknow Macro Wards (wards_lucknow.geojson)
    wards_input = os.path.join(project_dir, "wards_lucknow.geojson")
    with open(wards_input, "r", encoding="utf-8") as f:
        wards_data = json.load(f)

    macro_path = os.path.join(data_dir, "areas.macro.geojson")
    with open(macro_path, "r", encoding="utf-8") as f:
        macro_data = json.load(f)

    # Keep Kanpur wards
    kanpur_macro = [f for f in macro_data["features"] if not f["properties"]["area_id"].startswith("WARD_LKO_")]

    lucknow_macro = []
    auth_options = [
        ("LNN", "Lucknow Nagar Nigam"),
        ("LDA", "Lucknow Development Authority"),
        ("JAL", "Jal Sansthan Lucknow")
    ]

    for idx, f in enumerate(wards_data["features"]):
        props = f["properties"]
        wid = props.get("id", idx + 1)
        wnum = props.get("Ward Num", 0)
        wname = props.get("Ward Name") or f"Ward {wnum}"
        zone = props.get("Zone", 0)

        # Distribute authorities
        if wid % 4 == 0:
            auth_id, auth_name = auth_options[1]  # LDA
        elif wid % 5 == 0:
            auth_id, auth_name = auth_options[2]  # JAL
        else:
            auth_id, auth_name = auth_options[0]  # LNN

        new_feat = {
            "type": "Feature",
            "properties": {
                "area_id": f"WARD_LKO_{wid}",
                "parent_area_id": "SUBDIST_LUCKNOW_CITY",
                "name": wname,
                "level": "macro",
                "city": "Lucknow",
                "state": "Uttar Pradesh",
                "authority_id": auth_id,
                "authority": auth_name,
                "base_score": random.randint(45, 78),
                "ward_num": wnum,
                "zone": zone
            },
            "geometry": f["geometry"]
        }
        lucknow_macro.append(new_feat)

    all_macro = kanpur_macro + lucknow_macro
    macro_data["features"] = all_macro
    with open(macro_path, "w", encoding="utf-8") as f:
        json.dump(macro_data, f, indent=2)
    print(f"Updated macro wards: {len(all_macro)} total ({len(kanpur_macro)} Kanpur + {len(lucknow_macro)} Lucknow)")

    # 3. Generate Micro Blocks for Lucknow Wards (2 per ward)
    micro_path = os.path.join(data_dir, "areas.micro.geojson")
    with open(micro_path, "r", encoding="utf-8") as f:
        micro_data = json.load(f)

    kanpur_micro = [f for f in micro_data["features"] if not f["properties"]["area_id"].startswith("WARD_LKO_")]
    lucknow_micro = []

    for wd_feat in lucknow_macro:
        w_id = wd_feat["properties"]["area_id"]
        w_name = wd_feat["properties"]["name"]
        w_auth = wd_feat["properties"]["authority_id"]
        w_auth_name = wd_feat["properties"]["authority"]
        w_score = wd_feat["properties"]["base_score"]

        geom = wd_feat["geometry"]
        w_poly = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]

        centroid = get_polygon_centroid(w_poly)
        gens = [
            [centroid[0] - 0.003, centroid[1] - 0.003],
            [centroid[0] + 0.003, centroid[1] + 0.003]
        ]
        cells = generate_voronoi_cells(w_poly, gens)

        for idx in range(2):
            cell_poly = cells[idx]
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
                    "city": "Lucknow",
                    "state": "Uttar Pradesh",
                    "authority_id": w_auth,
                    "authority": w_auth_name,
                    "base_score": max(30, min(95, w_score + random.randint(-4, 4)))
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [cell_poly]
                }
            }
            lucknow_micro.append(feat)

    all_micro = kanpur_micro + lucknow_micro
    micro_data["features"] = all_micro
    with open(micro_path, "w", encoding="utf-8") as f:
        json.dump(micro_data, f, indent=2)
    print(f"Updated micro blocks: {len(all_micro)} total ({len(kanpur_micro)} Kanpur + {len(lucknow_micro)} Lucknow)")

    # 4. Generate Submicro Segments for Lucknow Micro Blocks (2 per block)
    submicro_path = os.path.join(data_dir, "areas.submicro.geojson")
    with open(submicro_path, "r", encoding="utf-8") as f:
        submicro_data = json.load(f)

    kanpur_submicro = [f for f in submicro_data["features"] if not f["properties"]["area_id"].startswith("WARD_LKO_")]
    lucknow_submicro = []

    for mb_feat in lucknow_micro:
        m_id = mb_feat["properties"]["area_id"]
        m_name = mb_feat["properties"]["name"]
        m_auth = mb_feat["properties"]["authority_id"]
        m_auth_name = mb_feat["properties"]["authority"]
        m_score = mb_feat["properties"]["base_score"]

        geom = mb_feat["geometry"]
        m_poly = geom["coordinates"][0]

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
                    "city": "Lucknow",
                    "state": "Uttar Pradesh",
                    "authority_id": m_auth,
                    "authority": m_auth_name,
                    "base_score": max(25, min(98, m_score + random.randint(-2, 2)))
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [cell_poly]
                }
            }
            lucknow_submicro.append(feat)

    all_submicro = kanpur_submicro + lucknow_submicro
    submicro_data["features"] = all_submicro
    with open(submicro_path, "w", encoding="utf-8") as f:
        json.dump(submicro_data, f, indent=2)
    print(f"Updated submicro segments: {len(all_submicro)} total ({len(kanpur_submicro)} Kanpur + {len(lucknow_submicro)} Lucknow)")

    print("\n=== LUCKNOW SPATIAL HIERARCHY GENERATION COMPLETE ===")

if __name__ == "__main__":
    main()
