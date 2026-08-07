# Deployment

## Prerequisites
- Node.js 18+
- Docker
- (Optional) Firebase project for auth

## Configure globals (`.env`)

All dynamic website settings live in the **project-root** `.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DOCKER_NAME` | Single Docker image + container name |
| `DB_DATA_DIR` | Persistent MySQL data (relative to project root) |
| `SQL_DUMP_PATH` | SQL dump for first-time import |
| `FRONTEND_HOST` / `FRONTEND_PORT` | Vite dev server |
| `BACKEND_HOST` / `PORT` | Express API |
| `PUBLIC_FRONTEND_URL` / `PUBLIC_BACKEND_URL` | URLs shown after deploy |
| `VITE_API_URL` | Browser API base (include `/api`) |
| `DB_*` | MySQL connection |

`server/.env` is a symlink to `../.env`.

```bash
cp .env.example .env
# edit .env — DB password, ports, URLs, etc.
```

## Local MySQL + project setup (`deploy.sh`)

```bash
./deploy.sh setup       # npm install + MySQL + backend + frontend
./deploy.sh restart     # stop → start all (keeps DB data)
./deploy.sh rebuild     # rebuild MySQL image, then start all (keeps data)
./deploy.sh stop        # stop MySQL + frontend + backend
./deploy.sh remove      # remove MySQL container + image (keeps db-data; stops apps)
./deploy.sh status      # ports, PIDs, connect URLs
```

Or: `npm run deploy:setup`, `deploy:restart`, `deploy:rebuild`, …

If **MySQL / frontend / backend ports** are already open by another process, deploy prints a specific error. Change `DB_PORT`, `FRONTEND_PORT`, or `PORT` in `.env` if needed.

After setup/restart/rebuild, deploy starts the apps and prints:

- Frontend URL  
- Backend URL  
- API URL  
- phpMyAdmin URL (`PHPMYADMIN_PORT`, default **8081**)  
- MySQL host:port  
- Log paths under `logs/`

Login to phpMyAdmin with `DB_USER` / `DB_PASSWORD` from `.env`.

## Run apps

Prefer `./deploy.sh setup` / `restart` (starts everything). Manual:

```bash
cd server && npm run start-full   # backend
npm run dev                       # frontend
```

## Production notes

- Point reverse proxy to `PUBLIC_BACKEND_URL` / static `dist/`
- Set `VITE_API_URL` (and public URLs) in `.env` before `npm run build`
