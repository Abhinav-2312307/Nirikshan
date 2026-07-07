# CivicMap Naubasta Prototype

Google-Maps-inspired civic reporting UI with zoom-dynamic area quality polygons and place-centric complaint flow.

## Key UX

- Top navbar with search box for roads, parks, homes, shops, and landmarks
- Map-first interaction: click place geometry or any map point to open place sheet
- Place sheet: ratings, reviews, complaint form, lifecycle tracking
- AQI-style region colors with smooth zoom transitions:
  - macro regions
  - micro regions
  - sub-sub regions (`submicro`)

## Run

1. Install dependencies

```bash
npm install
```

2. Start app

```bash
npm start
```

3. Open

```text
http://localhost:4000
```

## Structure

```text
src/
  client/
    index.html
    assets/
      css/style.css
      js/app.js
  server/
    app.js
    server.js
    routes/
      areas.routes.js
      places.routes.js
      complaints.routes.js
      analytics.routes.js
    services/
      areaService.js
      placeService.js
      analyticsService.js
    repositories/
      dataRepository.js
    utils/
      geo.js
    data/
      areas.macro.geojson
      areas.micro.geojson
      areas.submicro.geojson
      places.geojson
      authorities.json
      reviews.json
      complaints.json
```

## Main APIs

- `GET /api/areas?level=macro|micro|submicro`
- `GET /api/places?limit=...&q=...`
- `GET /api/places/resolve?lat=...&lng=...`
- `GET /api/places/:id/reviews`
- `POST /api/places/:id/reviews`
- `POST /api/places/:id/complaints`
- `GET /api/complaints`
- `PATCH /api/complaints/:id/status`
- `GET /api/analytics/summary`
