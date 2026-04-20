# Smart Parking — local setup (from zip or clone)

This repository contains **two separate Node.js projects**:

| Folder | Role |
|--------|------|
| `api-server/` | REST API (Express + SQLite via sql.js) — run **first** |
| `smart-parking/` | Web UI (Vite + React) |

You need **Node.js 20+** (LTS recommended). Check with:

```bash
node -v
npm -v
```

---

## 1. Unzip and open a terminal

1. Extract the zip to a folder, e.g. `Smart`.
2. Open a terminal **in that folder** (the one that contains `api-server` and `smart-parking`).

---

## 2. Install dependencies

Install **both** projects (they do not share one `node_modules` at the root).

**Windows (PowerShell):**

```powershell
cd path\to\Smart
cd api-server
npm install
cd ..\smart-parking
npm install
cd ..
```

**macOS / Linux (bash or zsh):**

```bash
cd /path/to/Smart
cd api-server && npm install && cd ../smart-parking && npm install && cd ..
```

---

## 3. Start the API (port 8080)

The UI expects the API at **`http://localhost:8080`** unless you set `VITE_API_BASE_URL` (see §5).

**Windows (PowerShell):**

```powershell
cd api-server
npm run build
$env:PORT = "8080"
npm run start:fast
```

Leave this terminal **open**. You should see a log line that the server is listening on port **8080**.

**Why `start:fast`?**  
The `npm run start` script rebuilds every time; `start:fast` runs the already-built `dist/index.mjs`. After you change API code, run `npm run build` again, then `npm run start:fast`.

**macOS / Linux:**

```bash
cd api-server
npm run build
PORT=8080 npm run start:fast
```

**Note:** The `npm run dev` script in `api-server` uses Unix-style `NODE_ENV=development ...` in one line; on Windows it may fail. Use **build + start:fast** as above instead.

---

## 4. Start the web app (Vite dev server)

Open a **second** terminal.

**Windows / macOS / Linux:**

```bash
cd smart-parking
npm run dev
```

Vite prints a local URL (often **`http://localhost:5173`**). Open it in your browser.

---

## 5. Point the UI at the API (optional)

In **local development**, if you do **not** set anything, the app defaults the API base to **`http://localhost:8080`** (see `smart-parking/src/lib/api-client.ts`).

If your API runs elsewhere (different host/port or HTTPS), copy `smart-parking/.env.example` to **`smart-parking/.env.local`** and set:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Restart `npm run dev` after changing env files.

For a **production build** of the frontend, `VITE_API_BASE_URL` must be set at build time to wherever the API is hosted.

---

## 6. Demo logins (seed database)

On first run the API creates **`api-server/data/parking.db`** (git-ignored). Default demo accounts (change in production):

| Username | Password   | Role  |
|----------|------------|-------|
| `admin`  | `Admin#123` | admin |
| `driver` | `Driver#123` | user  |
| `sp`     | `Sp#123`    | user  |

---

## 7. API environment variables (optional)

Set these in the shell **before** `npm run start:fast`, or use a process manager / `.env` loader in production.

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default **8080**). |
| `JWT_SECRET` | Secret for signing JWTs. Set a long random string in production; do not rely on defaults. |
| `CORS_ORIGIN` | Comma-separated origins, or `*` (see your deployment policy). |
| `DATABASE_PATH` | Path to SQLite file (default `./data/parking.db` under `api-server`). |

---

## 8. Production-style commands

**API:**

```bash
cd api-server
npm run build
PORT=8080 JWT_SECRET="your-secret-here" npm run start:fast
```

**Frontend static build:**

```bash
cd smart-parking
# Set VITE_API_BASE_URL to your public API URL before building
npm run build
```

Output is in `smart-parking/dist/`. Serve that folder with any static host; the app uses **hash routing** (`#/...`), which works on static hosts without SPA fallback rules if configured correctly.

Preview locally:

```bash
cd smart-parking
npm run serve
```

---

## 9. Run API tests

```bash
cd api-server
npm test
```

---

## 10. Troubleshooting

| Issue | What to try |
|--------|-------------|
| **UI shows API errors / network failed** | Confirm the API terminal is running and **`http://localhost:8080/api/healthz`** responds in the browser. |
| **Port 8080 already in use** | Stop the other program or set `PORT` to another value and set `VITE_API_BASE_URL` in `smart-parking/.env.local` to match. |
| **`npm install` errors** | Use Node 20+; delete `node_modules` and `package-lock.json` only as a last resort, then `npm install` again. |
| **Windows: `npm run dev` in api-server fails** | Use **§3** (`build` + `start:fast`) instead of `npm run dev` in `api-server`. |

---

## 11. More documentation

- **`PROJECT_PRESENTATION.md`** — overview for academic presentation (architecture, stack, limits, security notes).

---

## Project layout

```
Smart/
├── api-server/       # Backend
├── smart-parking/    # Frontend
├── README.md         # This file
└── PROJECT_PRESENTATION.md
```
