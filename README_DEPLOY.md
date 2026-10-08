# Rogue Carrier Narrative Editor — Cloud Deployment Guide

This guide describes how to deploy the narrative editor to **Render**, **Railway**, or any Docker host with automated updates and persistent storage.

---

## 1. Quick Deploy on Render (Recommended)

1. **Push this directory to a GitHub/GitLab repository** (e.g. `github.com/n-ix/rogue-carrier-narrative-editor`).
2. Go to **[Render.com](https://render.com)** and sign in.
3. Click **New +** -> **Blueprint**.
4. Connect your repository. Render will automatically detect `render.yaml` and configure:
   - Python runtime with auto-deploy on `git push`.
   - 5GB persistent disk mounted for saves & backups.
   - Dynamic port routing.
5. In the Environment settings:
   - Add `RESEND_API_KEY` (optional, for real email sending via Resend API). If omitted, email dispatches are logged to `notifications.log` on the server.
6. Click **Apply**. Your app will be live at `https://rogue-carrier-narrative-editor.onrender.com`.

---

## 2. Quick Deploy on Railway

1. Install Railway CLI or connect via GitHub at **[railway.app](https://railway.app)**.
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Railway automatically detects `Dockerfile` or `Procfile`.
4. Under **Settings** -> **Volumes**, add a Persistent Volume mounted at `/app/saves` and `/app/backups`.
5. Under **Variables**, add `PORT=8000` and `RESEND_API_KEY` (if available).
6. Railway assigns a public HTTPS URL (e.g., `https://narrative-editor-production.up.railway.app`).

---

## 3. Deploy with Docker Anywhere

```bash
# Build the image
docker build -t rogue-carrier-editor .

# Run container with persistent volume for saves & backups
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/saves:/app/saves \
  -v $(pwd)/backups:/app/backups \
  -e RESEND_API_KEY="your-key-here" \
  --name narrative-editor \
  rogue-carrier-editor
```

---

## 4. Automatic Updates Pipeline

Every time you commit changes to the `main` branch of your repository, Render/Railway will automatically rebuild and deploy the latest version without downtime. Persistent data (`saves/`, `backups/`, `users.json`, `comments.json`) is preserved across deployments.

---

## 5. Security & Access Rules

- **Allowed Domain**: Only emails ending in `@n-ix.com` can register.
- **Administrator**: `dpoludonnyi@n-ix.com` is automatically provisioned as Admin with full rights to manage users, restore backups, and configure settings.
- **Approved Users**: Any team member with `@n-ix.com` who verifies via 6-digit OTP is granted editor rights to create, modify, and save events and dialogues.
- **Automated Backups**: A point-in-time snapshot is taken on every save and stored in `/backups/`.
- **Comment Notifications**: Any comment tagging `@username` triggers automated email notification to their `@n-ix.com` inbox.
