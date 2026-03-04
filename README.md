# Bluelytics

Umpire and manager performance tracking system for organizations. Admins manage games, assign umpires and managers, and review ratings and incidents. Umpires and managers rate each other after each game through a structured submission window.

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Backend     | Node.js, Express v5, TypeScript                 |
| Database    | PostgreSQL (Supabase), Prisma v6                |
| Frontend    | React, Vite, TypeScript, Tailwind CSS v4        |
| Auth        | JWT (jsonwebtoken)                              |
| Validation  | Zod v4                                          |
| Email       | SendGrid                                        |
| CSV Import  | csv-parse, multer                               |
| Charts      | Recharts                                        |

---

## API Routes

All routes are prefixed with `/api`.

### Auth

| Method | Path                          | Description                         |
|--------|-------------------------------|-------------------------------------|
| POST   | /auth/register                | Register a new user                 |
| POST   | /auth/login                   | Login and receive JWT               |
| GET    | /auth/me                      | Get current authenticated user      |
| POST   | /auth/send-verification       | Resend email verification link      |
| GET    | /auth/verify-email            | Verify email via token (link click) |

### Orgs

| Method | Path                              | Description                                  |
|--------|-----------------------------------|----------------------------------------------|
| POST   | /orgs                             | Create a new organization                    |
| GET    | /orgs/:orgId                      | Get org details                              |
| PATCH  | /orgs/:orgId                      | Update org name (admin)                      |
| DELETE | /orgs/:orgId                      | Delete org (admin)                           |
| GET    | /orgs/:orgId/members              | List org members                             |
| PATCH  | /orgs/:orgId/members/:userId      | Update member role (admin)                   |
| DELETE | /orgs/:orgId/members/:userId      | Remove member from org (admin)               |
| POST   | /orgs/:orgId/invite               | Generate invite code (admin)                 |
| POST   | /orgs/join                        | Join org via invite code                     |

### Users

| Method | Path       | Description               |
|--------|------------|---------------------------|
| PATCH  | /users/me  | Update own profile        |

### Games

| Method | Path                              | Description                                  |
|--------|-----------------------------------|----------------------------------------------|
| POST   | /orgs/:orgId/games                | Create a game (admin)                        |
| GET    | /orgs/:orgId/games                | List games (filterable by status)            |
| GET    | /orgs/:orgId/games/:gameId        | Get game detail                              |
| PATCH  | /orgs/:orgId/games/:gameId        | Update game (admin)                          |
| DELETE | /orgs/:orgId/games/:gameId        | Delete game (admin)                          |
| POST   | /orgs/:orgId/games/import         | Import games from CSV (admin)                |
| POST   | /orgs/:orgId/games/:gameId/umpires          | Assign umpire to game             |
| DELETE | /orgs/:orgId/games/:gameId/umpires/:userId  | Remove umpire from game           |
| POST   | /orgs/:orgId/games/:gameId/managers         | Assign manager to game            |
| DELETE | /orgs/:orgId/games/:gameId/managers/:userId | Remove manager from game          |

### Submissions

| Method | Path                                                              | Description                              |
|--------|-------------------------------------------------------------------|------------------------------------------|
| POST   | /orgs/:orgId/games/:gameId/submissions                            | Manually open a submission (admin)       |
| GET    | /orgs/:orgId/games/:gameId/submissions                            | List submissions for a game              |
| GET    | /orgs/:orgId/submissions/:submissionId                            | Get submission detail (role-scoped)      |
| PATCH  | /orgs/:orgId/submissions/:submissionId/close                      | Close a submission (admin)               |
| POST   | /orgs/:orgId/submissions/:submissionId/remind                     | Send manual reminder (admin)             |
| POST   | /orgs/:orgId/submissions/:submissionId/coach-ratings              | Submit coach ratings for all umpires     |
| PATCH  | /orgs/:orgId/submissions/:submissionId/coach-ratings/:umpireId    | Update a single coach rating             |
| POST   | /orgs/:orgId/submissions/:submissionId/umpire-ratings             | Submit umpire ratings for all managers   |
| PATCH  | /orgs/:orgId/submissions/:submissionId/umpire-ratings/:managerId  | Update a single umpire rating            |

### Incidents

| Method | Path                                        | Description                              |
|--------|---------------------------------------------|------------------------------------------|
| POST   | /orgs/:orgId/incidents                      | File an incident                         |
| GET    | /orgs/:orgId/incidents                      | List incidents (admin, filterable)       |
| GET    | /orgs/:orgId/incidents/:incidentId          | Get incident detail (admin)              |
| PATCH  | /orgs/:orgId/incidents/:incidentId          | Update incident (admin)                  |
| PATCH  | /orgs/:orgId/incidents/:incidentId/resolve  | Toggle resolved status (admin)           |
| DELETE | /orgs/:orgId/incidents/:incidentId          | Delete incident (admin)                  |

### Stats & Notifications

| Method | Path                          | Description                                     |
|--------|-------------------------------|-------------------------------------------------|
| GET    | /orgs/:orgId/stats            | Org-wide stats (umpires, managers, games, incidents) |
| GET    | /orgs/:orgId/notifications    | Email notification log (admin)                  |
| GET    | /orgs/:orgId/members/:userId/profile | Member profile with ratings & feedback   |
