# Build CroWeather Pro

## Mission

Create a **production-quality showcase application** called **CroWeather Pro**.

The project will be used as a demonstration of modern containerized development using **WSL Containers (`wslc`)** on Windows.

The final result should feel like a premium web application, comparable in visual quality to Apple Weather, Windy, and modern Microsoft Fluent design.

This is not a tutorial project.

This should be architected and coded as a real application.

---

# Primary Goal

Create a beautiful weather dashboard for Croatia based on live data from:

[https://vrijeme.hr/hrvatska1_n.xml](https://vrijeme.hr/hrvatska1_n.xml)

Data source:

- DHMZ / vrijeme.hr XML feed
- Refresh every 60 seconds
- Cache responses in Redis

---

# Architecture

Use:

Frontend

    Next.js 15
    TypeScript
    Tailwind CSS v4
    shadcn/ui
    Recharts
    Framer Motion

Backend

    FastAPI
    Python 3.12

Cache

    Redis

Containers

    WSL Containers (wslc)

Architecture:

```text
┌─────────────┐
│ Next.js UI  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ FastAPI API │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Redis Cache │
└─────────────┘
```

---

# Deployment Requirements

Must run without Docker Desktop.

Use only:

```text
wslc
```

Provide:

- Dockerfile
- Dockerfile.frontend
- Dockerfile.backend

or equivalent structure.

Include:

- build-wslc.ps1
- run-wslc.ps1
- stop-wslc.ps1

---

# Visual Design

Visual style:

### Apple Weather

Use:

- glassmorphism
- blurred cards
- gradients
- subtle animations

### Microsoft Fluent

Use:

- acrylic effects
- elevation
- shadows
- rounded corners

### Windy

Use:

- weather-focused visualizations
- map-driven experience

---

# UI Requirements

## Home Page

Hero section:

```text
CroWeather Pro
Real-Time Weather Across Croatia
Powered by WSL Containers
```

Animated background.

---

## Dashboard

Cards:

- Temperature
- Humidity
- Pressure
- Wind
- Conditions

Use colored indicators.

---

## Search

Instant search.

Examples:

```text
zag
```

should find:

- Zagreb-Maksimir
- Zagreb-Grič
- Zagreb-aerodrom

Search must be fuzzy.

---

## Dark Mode

Required.

---

## Light Mode

Required.

---

# Croatia Geographic Engine

This is a critical feature.

Many Croatian settlements are not present in the DHMZ station feed.

Solve this.

---

## Requirement

Create a Croatian location database.

Include:

- Cities
- Municipalities
- Settlements

Only Croatia.

No need for the rest of the world.

Use openly available datasets if needed.

---

## Location Resolution

Example:

User searches:

```text
Samobor
```

No weather station exists.

System:

```text
find coordinates
↓
find nearest weather station
↓
return weather
```

Result:

```text
Nearest Station:
Zagreb-Maksimir
Distance:
12 km
```

---

# Geolocation

Use browser GPS.

```javascript
navigator.geolocation
```

Workflow:

```text
Detect user location
↓
Find nearest station
↓
Show weather immediately
```

Fallback:

Search by city

---

# Croatia Map

Implement a clickable SVG map.

Requirements:

- Counties
- Stations
- Hover effects
- Zoom
- Animations

User can:

- Click county
- Click station
- View weather

---

# Weather Station Engine

Create station metadata.

Each station should include:

```json
{
  "name": "Zagreb-Maksimir",
  "lat": 45.82,
  "lon": 16.02,
  "region": "Grad Zagreb"
}
```

Add coordinates for all weather stations found in the XML.

---

# Smart Station Matching

Implement:

```python
haversine_distance()
```

Use nearest neighbour selection.

---

# Backend Requirements

FastAPI.

Provide:

- /api/weather
- /api/stations
- /api/station/{name}
- /api/location
- /api/search
- /api/health
- /api/metrics

Swagger:

```text
/docs
```

must work.

---

# Caching

Redis cache.

Weather feed should not hit DHMZ continuously.

Cache for:

60 seconds

---

# Data Models

Use Pydantic.

Strong typing required.

---

# Frontend Requirements

Next.js 15.

TypeScript.

App Router.

Server Components where appropriate.

Responsive.

Mobile-first.

---

# Charts

Use Recharts.

Create:

### Temperature

Last refresh history.

### Humidity

Trend chart.

### Pressure

Trend chart.

### Wind

Visualization.

---

# Animation

Use Framer Motion.

Add:

- Page transitions
- Card hover effects
- Chart reveals
- Map interactions

Keep professional.

No excessive animations.

---

# Performance

Requirements:

- Lazy loading
- Code splitting
- Caching
- Typed APIs
- Image optimization

Lighthouse target:

90+

---

# Accessibility

Requirements:

- Keyboard navigation
- ARIA labels
- High contrast
- Screen reader support

---

# Health Monitoring

Implement:

```text
/api/health
```

Returns:

```json
{
  "backend": "ok",
  "redis": "ok",
  "weather_feed": "ok"
}
```

---

# Observability

Add:

```text
/api/metrics
```

Prometheus-compatible format preferred.

---

# Project Structure

Generate a complete repository.

Example:

```text
cro-weather-pro/
├── frontend/
├── backend/
├── redis/
├── docs/
├── build-wslc.ps1
├── run-wslc.ps1
├── stop-wslc.ps1
├── README.md
├── LICENSE
└── .gitignore
```

---

# Documentation

Generate:

- README.md
- ARCHITECTURE.md
- DEPLOYMENT.md

Include:

## Building

```text
wslc build ...
```

## Running

```text
wslc run ...
```

## Networking

Container communication examples.

---

# Quality Requirements

Do not generate placeholders.

Do not generate pseudo-code.

Generate:

- complete code
- production-ready code
- runnable code
- proper Dockerfiles
- proper TypeScript types
- proper Python typing
- proper error handling

Every file must be fully implemented.

The generated repository must be able to run after dependency installation and container build.

---

# Deliverable

Create the entire repository.

Output all files.

If the output is too large:

1. Generate repository structure first.
2. Then generate files in batches.
3. Continue until the repository is complete.

Never simplify functionality to save tokens.

Build the application as if it were going to be featured in a professional article demonstrating the power of WSL Containers as a modern alternative to Docker Desktop.
