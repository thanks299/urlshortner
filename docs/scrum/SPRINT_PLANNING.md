# URL Shortener — Sprint Planning

---

## Sprint 1 — Core MVP
**Goal:** A working URL shortener that shortens, redirects, and handles errors.  
**Duration:** 2 weeks  **Velocity:** 9 pts  

| Story | Points | Assignee | Notes |
|-------|--------|----------|-------|
| US-01 Shorten URL | 3 | Dev A | POST /api/links, validator, service, repo |
| US-02 Custom code | 2 | Dev A | uniqueness check, regex validation |
| US-03 Redirect    | 2 | Dev B | GET /:code → 302 |
| US-04 Dedup       | 1 | Dev A | findByOriginalUrl before insert |
| US-05 Error pages | 1 | Dev B | 404/410 styled HTML pages |

**Sprint 1 Review:** All stories completed. 9/9 pts. Velocity established.  
**Retrospective actions:** Add integration tests before Sprint 2. Improve logger format.

---

## Sprint 2 — Analytics + Dashboard
**Goal:** Track clicks, display analytics, give users a management dashboard.  
**Duration:** 2 weeks  **Velocity:** 14 pts  

| Story | Points | Assignee | Notes |
|-------|--------|----------|-------|
| US-06 Click count      | 2 | Dev A | $inc on redirect |
| US-07 Click analytics  | 3 | Dev A | clickEvents array, analytics endpoint |
| US-08 Expiry dates     | 2 | Dev B | expiresAt field, TTL index |
| US-09 Expired page     | 1 | Dev B | 410 HTML page |
| US-10 Delete link      | 1 | Dev A | soft-delete (isActive=false) |
| US-11 Dashboard UI     | 3 | Dev C | table, badges, refresh |
| US-12 Pagination/sort  | 2 | Dev C | query params, repo.findAll |

**Sprint 2 Review:** 14/14 pts. Click analytics expandable drawer added as bonus.  
**Retrospective actions:** Consider moving clickEvents to separate collection for scale.

---

## Sprint 3 — Authentication (Planned)
**Goal:** Secure links behind user accounts with JWT auth.  
**Duration:** 2 weeks  **Estimated velocity:** 14 pts  

| Story | Points | Notes |
|-------|--------|-------|
| US-14 Register  | 5 | bcrypt, User model, POST /api/auth/register |
| US-15 Login/JWT | 3 | JWT, refresh tokens, POST /api/auth/login |
| US-16 Private links | 3 | createdBy field, auth middleware |
| US-17 Admin role    | 3 | role field, admin-only routes |

---

## Sprint 4 — DevOps & Scale (Planned)
**Goal:** Production-ready deployment with caching, Docker, and CI/CD.  
**Duration:** 2 weeks  **Estimated velocity:** 24 pts  

| Story | Points | Notes |
|-------|--------|-------|
| US-18 Docker       | 5 | Dockerfile, docker-compose (app + mongo + redis) |
| US-19 CI/CD        | 3 | GitHub Actions: lint → test → deploy |
| US-20 Redis cache  | 8 | Cache hot redirect codes, 10ms p99 target |
| US-21 Horizontal scale | 8 | Stateless app, Mongo replica set, nginx LB |
