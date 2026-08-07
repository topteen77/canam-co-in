# Deployment

## Environments

| Branch | Environment | Domain | Google indexing |
|--------|-------------|--------|-----------------|
| `main` | **production** | https://canam.co.in | Allowed |
| `dev` | **staging** | https://dev.canam.co.in | **Blocked** (`noindex` + `robots.txt` Disallow) |

GitHub Actions workflow: `.github/workflows/deploy.yml`  
Pushes to `main` or `dev` deploy automatically over SSH.

> **Production auto-deploy is currently DISABLED** (commented in the workflow) so you can test manually on the server first.  
> Staging (`dev`) can still deploy via Actions.  
> To re-enable production later: uncomment `- main` under `on.push.branches`, restore the `production` workflow_dispatch option, and remove the “PRODUCTION GUARD” / skip step in `.github/workflows/deploy.yml`.

---

## One-time server setup

### 1. DNS

| Record | Type | Value |
|--------|------|--------|
| `canam.co.in` | A | your server IP |
| `www.canam.co.in` | A/CNAME | your server IP / canam.co.in |
| `dev.canam.co.in` | A | your server IP |

### 2. Clone both deployments

```bash
# Production
sudo mkdir -p /var/www
sudo git clone -b main https://github.com/topteen77/canam-co-in.git /var/www/myapp
sudo chown -R "$USER":"$USER" /var/www/myapp

# Staging
sudo git clone -b dev https://github.com/topteen77/canam-co-in.git /var/www/myapp-staging
sudo chown -R "$USER":"$USER" /var/www/myapp-staging
```

### 3. Create `.env` on the server (never commit)

```bash
cp /var/www/myapp/.env.example /var/www/myapp/.env
nano /var/www/myapp/.env
```

**Production** (`/var/www/myapp/.env`) essentials:

```env
VITE_APP_ENV=production
VITE_NOINDEX=false
VITE_API_URL=https://canam.co.in/api
PUBLIC_FRONTEND_URL=https://canam.co.in
PUBLIC_BACKEND_URL=https://canam.co.in
PUBLIC_SITE_ORIGIN=https://canam.co.in
ALLOWED_HOSTS=canam.co.in,www.canam.co.in
PORT=5001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=db_nod_crm
JWT_SECRET=...
```

**Staging** (`/var/www/myapp-staging/.env`):

```env
VITE_APP_ENV=staging
VITE_NOINDEX=true
VITE_API_URL=https://dev.canam.co.in/api
PUBLIC_FRONTEND_URL=https://dev.canam.co.in
PUBLIC_BACKEND_URL=https://dev.canam.co.in
PUBLIC_SITE_ORIGIN=https://dev.canam.co.in
ALLOWED_HOSTS=dev.canam.co.in
PORT=5002
# Prefer a separate DB / credentials for staging
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=db_nod_crm_staging
JWT_SECRET=...
```

```bash
ln -sfn ../.env /var/www/myapp/server/.env
ln -sfn ../.env /var/www/myapp-staging/server/.env
```

### 4. Node + PM2

```bash
# Node 18+ (use nvm or nodesource)
cd /var/www/myapp && npm ci && cd server && npm ci
cd /var/www/myapp && APP_ENV=production BRANCH=main ./scripts/remote-deploy.sh

sudo npm i -g pm2
cd /var/www/myapp/server
pm2 start index.js --name crm-api-production
cd /var/www/myapp-staging/server
# After first staging deploy:
# pm2 start index.js --name crm-api-staging
pm2 save
pm2 startup
```

### 5. Nginx + TLS

Sample configs are in the repo:

- `deploy/nginx.canam.co.in.conf` → `/etc/nginx/sites-available/canam.co.in`
- `deploy/nginx.dev.canam.co.in.conf` → `/etc/nginx/sites-available/dev.canam.co.in`

```bash
sudo cp /var/www/myapp/deploy/nginx.canam.co.in.conf /etc/nginx/sites-available/canam.co.in
sudo cp /var/www/myapp/deploy/nginx.dev.canam.co.in.conf /etc/nginx/sites-available/dev.canam.co.in
sudo ln -sf /etc/nginx/sites-available/canam.co.in /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/dev.canam.co.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Certificates
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d canam.co.in -d www.canam.co.in
sudo certbot --nginx -d dev.canam.co.in
```

Staging nginx already sends `X-Robots-Tag: noindex, nofollow, noarchive`. Builds for staging also inject meta robots + `robots.txt` Disallow.

---

## GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Example | Required |
|--------|---------|----------|
| `DEPLOY_HOST` | `43.x.x.x` or hostname | yes |
| `DEPLOY_USER` | `ubuntu` or `dev` | yes |
| `DEPLOY_SSH_KEY` | private key PEM (full content) | yes |
| `DEPLOY_PORT` | `22` | optional |
| `PROD_DEPLOY_PATH` | `/var/www/myapp` | optional (default `/var/www/myapp`) |
| `STAGING_DEPLOY_PATH` | `/var/www/myapp-staging` | optional |

### SSH key on the server

```bash
# On your laptop
ssh-keygen -t ed25519 -C "github-deploy-canam" -f ./canam-deploy -N ""
# Add canam-deploy.pub to server ~/.ssh/authorized_keys for DEPLOY_USER
# Paste canam-deploy (private) into GitHub secret DEPLOY_SSH_KEY
```

Optional: create GitHub **Environments** named `production` and `staging` (Settings → Environments) for approval gates on production.

---

## How deploy works

1. Push to `main` or `dev` (or run workflow manually).
2. Action SSHs into the server.
3. Runs `scripts/remote-deploy.sh`:
   - `git fetch` + hard reset to branch
   - `npm ci` (app + server)
   - `npm run build` with `VITE_APP_ENV` / `VITE_NOINDEX`
   - reloads `pm2` API process `crm-api-production` or `crm-api-staging`
   - reloads nginx

### Manual deploy on server

```bash
cd /var/www/myapp && APP_ENV=production BRANCH=main ./scripts/remote-deploy.sh
cd /var/www/myapp-staging && APP_ENV=staging BRANCH=dev ./scripts/remote-deploy.sh
```

---

## Local development (`deploy.sh`)

```bash
cp .env.example .env   # first time
./deploy.sh setup      # MySQL + phpMyAdmin + backend + frontend
./deploy.sh restart
./deploy.sh status
```

See also: Docker MySQL data in `../db-data`, phpMyAdmin on `PHPMYADMIN_PORT` (default 8081).

---

## Staging must not appear in Google

Enforced three ways when `VITE_APP_ENV=staging` / `VITE_NOINDEX=true`:

1. HTML `<meta name="robots" content="noindex, nofollow, noarchive">`
2. `dist/robots.txt` → `Disallow: /`
3. Nginx `X-Robots-Tag` on `dev.canam.co.in`

After go-live, in [Google Search Console](https://search.google.com/search-console) you can also add `dev.canam.co.in` and use **Removals** if it was ever crawled.
