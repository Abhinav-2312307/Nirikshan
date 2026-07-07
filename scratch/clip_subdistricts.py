import json
import os

def clip_polygon_y(poly, y_limit, keep_above):
    """
    Clips a polygon (list of [x, y] coordinates) against a horizontal line y = y_limit.
    keeps the part above if keep_above is True, otherwise keeps the part below.
    """
    output_list = []
    if not poly:
        return []
    
    # Ensure the polygon is closed, but we process edges
    # We will treat the list of points
    points = list(poly)
    if points[0] != points[-1]:
        points.append(points[0])
        
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i+1]
        
        # Check if points are inside
        p1_inside = (p1[1] >= y_limit) if keep_above else (p1[1] <= y_limit)
        p2_inside = (p2[1] >= y_limit) if keep_above else (p2[1] <= y_limit)
        
        if p1_inside:
            if p2_inside:
                output_list.append(p2)
            else:
                # p1 is inside, p2 is outside. Intersection point.
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                if abs(dy) > 1e-9:
                    t = (y_limit - p1[1]) / dy
                    intersect_x = p1[0] + t * dx
                    output_list.append([intersect_x, y_limit])
        else:
            if p2_inside:
                # p1 is outside, p2 is inside. Intersection point then p2.
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                if abs(dy) > 1e-9:
                    t = (y_limit - p1[1]) / dy
                    intersect_x = p1[0] + t * dx
                    output_list.append([intersect_x, y_limit])
                output_list.append(p2)
            else:
                # Both outside
                pass
                
    if output_list and output_list[0] != output_list[-1]:
        output_list.append(output_list[0])
    return output_list

def main():
    scratch_dir = "/Users/abhinavsahu/.gemini/antigravity/brain/1ac154a3-f3a0-415b-9f5b-3135cda46e11/scratch"
    up_path = os.path.join(scratch_dir, "up.geojson")
    
    with open(up_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    kanpur_feature = None
    for f in data.get("features", []):
        if f.get("properties", {}).get("district") == "Kanpur Nagar":
            kanpur_feature = f
            break
            
    if not kanpur_feature:
        print("Kanpur Nagar feature not found")
        return
        
    poly = kanpur_feature["geometry"]["coordinates"][0]
    
    # Split 1: Bilhaur (North) - above y = 26.48
    bilhaur_poly = clip_polygon_y(poly, 26.48, keep_above=True)
    
    # Split 2: Remaining below 26.48
    below_26_48 = clip_polygon_y(poly, 26.48, keep_above=False)
    
    # Split 3: Kanpur Sadar (Central) - between 26.22 and 26.48
    kanpur_sadar_poly = clip_polygon_y(below_26_48, 26.22, keep_above=True)
    
    # Split 4: Ghatampur (South) - below 26.22
    ghatampur_poly = clip_polygon_y(below_26_48, 26.22, keep_above=False)
    
    print("Bilhaur points:", len(bilhaur_poly))
    print("Kanpur Sadar points:", len(kanpur_sadar_poly))
    print("Ghatampur points:", len(ghatampur_poly))
    
    # Save a test GeoJSON for subdistricts
    subdistricts_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "area_id": "SUBDIST_BILHAUR",
                    "parent_area_id": "DIST_KANPUR",
                    "name": "Bilhaur Subdivision",
                    "level": "subdistrict",
                    "city": "Kanpur",
                    "state": "Uttar Pradesh",
                    "base_score": 68
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [bilhaur_poly]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "area_id": "SUBDIST_KANPUR_CITY",
                    "parent_area_id": "DIST_KANPUR",
                    "name": "Kanpur City Subdivision",
                    "level": "subdistrict",
                    "city": "Kanpur",
                    "state": "Uttar Pradesh",
                    "base_score": 55
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [kanpur_sadar_poly]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "area_id": "SUBDIST_GHATAMPUR",
                    "parent_area_id": "DIST_KANPUR",
                    "name": "Ghatampur Subdivision",
                    "level": "subdistrict",
                    "city": "Kanpur",
                    "state": "Uttar Pradesh",
                    "base_score": 61
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [ghatampur_poly]
                }
            }
        ]
    }
    
    out_path = os.path.join(scratch_dir, "kanpur.subdistricts_clipped.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(subdistricts_geojson, f, indent=2)
    print("Saved subdistricts clipped to:", out_path)

if __name__ == "__main__":
    main()
