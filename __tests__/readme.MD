# SNIP — URL Shortener

> Production-grade URL shortener built with the **Scrum framework**, using **Node.js**, **Express**, and **MongoDB**.

---

## Architecture

This project follows a strict **layered architecture** for maintainability and testability:

```
HTTP Request
     │
     ▼
 Middleware           (helmet, cors, rate-limiter, morgan)
     │
     ▼
   Routes             (routes/api.js, routes/redirect.js)
     │
     ▼
 Validators           (validators/linkValidator.js)
     │
     ▼
 Controllers          (controllers/linkController.js)
     │
     ▼
  Services            (services/linkService.js)       ← Business Logic
     │
     ▼
 Repositories         (repositories/linkRepository.js) ← Data Access
     │
     ▼
   Models             (models/Link.js)                ← Mongoose Schema
     │
     ▼
  MongoDB
```

Each layer has a single responsibility. Tests mock the layer below — services test with a mocked repo; controllers test with a mocked service.

---

## Project Structure

```
snip/
├── src/
│   ├── app.js                          # Entry point — bootstrap, middleware, routes
│   ├── config/
│   │   ├── database.js                 # MongoDB connection (Mongoose)
│   │   └── logger.js                   # Winston logger (dev + prod formats)
│   ├── models/
│   │   └── Link.js                     # Mongoose schema: Link + ClickEvent sub-doc
│   ├── repositories/
│   │   └── linkRepository.js           # ALL MongoDB queries — no logic
│   ├── services/
│   │   └── linkService.js              # Business logic: shorten, resolve, analytics
│   ├── controllers/
│   │   ├── linkController.js           # REST API controllers
│   │   └── redirectController.js       # /:code redirect + HTML error pages
│   ├── routes/
│   │   ├── api.js                      # /api/* routes
│   │   └── redirect.js                 # / and /:code routes
│   ├── middlewares/
│   │   ├── rateLimiter.js              # express-rate-limit (100 req/15min)
│   │   ├── errorHandler.js             # Global error handler (Mongo + AppError)
│   │   └── notFound.js                 # 404 catch-all
│   ├── validators/
│   │   └── linkValidator.js            # Request body validation middleware
│   ├── utils/
│   │   ├── AppError.js                 # Custom operational error class
│   │   └── catchAsync.js               # Async error forwarding wrapper
│   └── public/
│       └── index.html                  # Frontend SPA (3 tabs: Shorten/Dashboard/API)
│
├── __tests__/
│   ├── unit/
│   │   └── linkService.test.js         # Service unit tests (repo fully mocked)
│   └── integration/
│       └── api.test.js                 # API integration tests (supertest)
│
├── docs/
│   └── scrum/
│       ├── PRODUCT_BACKLOG.md          # Epics, user stories, story points
│       └── SPRINT_PLANNING.md          # Sprint 1–4 plans, velocity, retro notes
│
├── .env.example                        # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## Scrum Framework

### Ceremonies
| Ceremony | Cadence | Purpose |
|----------|---------|---------|
| **Sprint Planning** | Start of each 2-week sprint | Select backlog items, estimate, assign |
| **Daily Standup** | Daily, 15 min | What I did / doing / blocked on |
| **Sprint Review** | End of sprint | Demo working software to stakeholders |
| **Retrospective** | End of sprint | Improve team process |

### Artifacts
| Artifact | Location |
|----------|----------|
| Product Backlog | `docs/scrum/PRODUCT_BACKLOG.md` |
| Sprint Plans | `docs/scrum/SPRINT_PLANNING.md` |
| Increment | This codebase |

### Sprints Completed
- **Sprint 1** — Core shortening, redirect, error handling ✅
- **Sprint 2** — Analytics, expiry, dashboard, delete ✅
- **Sprint 3** — Auth (JWT, users) 🔲 Planned
- **Sprint 4** — Redis cache, Docker, CI/CD 🔲 Planned

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)

### Installation
```bash
git clone <repo>
cd snip
npm install
cp .env.example .env   # edit MONGO_URI
npm run dev            # nodemon — auto-restarts on changes
```

Open **http://localhost:3000**

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `MONGO_URI` | `mongodb://localhost:27017/snip` | MongoDB connection string |
| `BASE_URL` | `http://localhost:3000` | Used to build short URLs |
| `CODE_LENGTH` | `7` | Auto-generated code length |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |

---

## REST API

### `POST /api/links` — Shorten a URL
```json
// Request body
{ "originalUrl": "https://...", "customCode": "my-slug", "expiresAt": "2025-12-31T23:59" }

// Response 201
{ "success": true, "data": { "shortCode": "my-slug", "shortUrl": "http://localhost:3000/my-slug", ... } }
```

### `GET /api/links` — List all links
Query params: `?page=1&limit=50&sortBy=clicks&order=desc`

### `GET /api/links/:code/analytics` — Click analytics
Returns per-click log (timestamp, IP, user-agent, referer).

### `DELETE /api/links/:code` — Delete a link (soft delete)

### `GET /:code` — Redirect
Returns 302 redirect, or styled 404/410 HTML page.

### `GET /api/health` — Health check

---

## Running Tests
```bash
npm test              # all tests
npm run test:watch    # watch mode
npm run test:cov      # with coverage report
```

Unit tests mock the repository layer — no MongoDB needed.
Integration tests require MongoDB (or use `@shelf/jest-mongodb` in-memory server).

---

## Scalability Roadmap (Sprint 3+)
- **Auth**: JWT-based user accounts, private links
- **Redis**: Cache hot short codes for sub-10ms redirects
- **Docker**: `docker-compose up` for app + mongo + redis
- **CI/CD**: GitHub Actions → lint → test → deploy
- **Move clickEvents**: Separate `click_events` collection for high-traffic links
- **QR codes**: Generate QR per link
- **Link previews**: `/preview/:code` page before redirect