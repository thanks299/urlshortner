# URL Shortener — Scrum Product Backlog

**Product:** URL Shortener  
**Product Owner:** TBD  
**Last Updated:** Sprint 2 Planning  

---

## Definition of Done (DoD)
A story is **Done** when:
- [ ] Code written and peer-reviewed (PR approved)
- [ ] Unit tests written (coverage ≥ 80%)
- [ ] Integration tests pass
- [ ] No lint errors
- [ ] Documentation updated (README / API docs)
- [ ] Deployed to staging and smoke-tested

---

## EPIC 1 — Core URL Shortening  ✅ Sprint 1
| ID    | Story | Points | Status |
|-------|-------|--------|--------|
| US-01 | As a user, I can paste a long URL and receive a short link | 3 | ✅ Done |
| US-02 | As a user, I can choose a custom short code | 2 | ✅ Done |
| US-03 | As a visitor, clicking a short link redirects me to the original URL | 2 | ✅ Done |
| US-04 | As a user, duplicate URLs return the same short link (dedup) | 1 | ✅ Done |
| US-05 | As a user, invalid URLs show a clear error message | 1 | ✅ Done |

---

## EPIC 2 — Analytics & Tracking  ✅ Sprint 2
| ID    | Story | Points | Status |
|-------|-------|--------|--------|
| US-06 | As a user, I can see total click counts per link | 2 | ✅ Done |
| US-07 | As a user, I can view per-click data (timestamp, IP, user-agent) | 3 | ✅ Done |
| US-08 | As a user, I can set an expiry date on a link | 2 | ✅ Done |
| US-09 | As a visitor, clicking an expired link shows a clear error page | 1 | ✅ Done |
| US-10 | As a user, I can delete a link | 1 | ✅ Done |

---

## EPIC 3 — Dashboard & UX  ✅ Sprint 2
| ID    | Story | Points | Status |
|-------|-------|--------|--------|
| US-11 | As a user, I can view all my links in a dashboard | 3 | ✅ Done |
| US-12 | As a user, links in the dashboard are sortable and paginated | 2 | ✅ Done |
| US-13 | As a user, I can expand a link row to see its click log | 2 | ✅ Done |

---

## EPIC 4 — Authentication  🔲 Sprint 3 (Backlog)
| ID    | Story | Points | Status |
|-------|-------|--------|--------|
| US-14 | As a new user, I can register with email + password | 5 | 🔲 Backlog |
| US-15 | As a user, I can log in and receive a JWT | 3 | 🔲 Backlog |
| US-16 | As a user, my links are private to my account | 3 | 🔲 Backlog |
| US-17 | As an admin, I can manage all links | 3 | 🔲 Backlog |

---

## EPIC 5 — Scalability & Ops  🔲 Sprint 4 (Backlog)
| ID    | Story | Points | Status |
|-------|-------|--------|--------|
| US-18 | As DevOps, the app is containerised with Docker | 5 | 🔲 Backlog |
| US-19 | As DevOps, CI/CD pipeline runs tests on every PR | 3 | 🔲 Backlog |
| US-20 | As DevOps, Redis caches hot redirects for <10ms p99 | 8 | 🔲 Backlog |
| US-21 | As DevOps, the app scales horizontally behind a load balancer | 8 | 🔲 Backlog |
| US-22 | As a user, I see a QR code for each short link | 3 | 🔲 Backlog |
