# POS — Admin panel + API

Computer accessory shop admin (proposal-aligned): Next.js admin panel + Express + MySQL (no ORM).

## Layout

| Folder | Purpose |
|--------|---------|
| `admin-panel/` | Next.js 16 App Router, Shadcn UI, JWT client |
| `api/` | Express, TypeScript, `mysql2`, SQL migrations |

## Prerequisites

- Node.js ≥ 20.9
- MySQL 8.x (or compatible)

## MySQL setup

Create a database:

```sql
CREATE DATABASE pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## API (`api/`)

Copy `api/env.example` to `api/.env` and set:

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `4000`) |
| `CORS_ORIGIN` | Admin origin, e.g. `http://localhost:3000` |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_ACCESS_SECRET` | Strong secret for access tokens |
| `JWT_REFRESH_SECRET` | Strong secret for refresh tokens |
| `JWT_ACCESS_EXPIRES` | e.g. `15m` |
| `JWT_REFRESH_EXPIRES` | e.g. `7d` |

```bash
cd api
npm install
npm run migrate
npm run seed
npm run dev
```

Health: `GET http://localhost:4000/health`

Default seed user: `admin` / `Admin123!` (change immediately).

## Admin panel (`admin-panel/`)

Copy `admin-panel/env.example` to `admin-panel/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

```bash
cd admin-panel
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with the seeded admin.

## Production notes

- Use HTTPS and lock down `CORS_ORIGIN`.
- Rotate JWT secrets and database credentials.
- Do not expose MySQL publicly.
