# CroWeather Pro — WSL Containers (`wslc`) Command Guide

**Purpose:** Learn to build, run, inspect, troubleshoot, and stop the CroWeather Pro application directly with `wslc` on **Windows 11**, without Docker Desktop or the project's PowerShell wrapper scripts.

**Last checked:** 8 October 2026
**Run commands in:** **Windows PowerShell** (or Windows Terminal with a PowerShell profile), from the **`cro-weather-pro` repository root** unless stated otherwise. Run the `wslc` commands in a **normal, non-administrator terminal**. Administrative privileges may be needed only for initial WSL installation and system updates.

> **Prerequisite:** WSL version **2.9.3 or later**, with the built-in `wslc.exe` CLI. You do not need Docker Desktop, `docker.exe`, Docker Compose, or a running Ubuntu shell for these examples. `wslc` builds standard OCI/container images from Dockerfiles.

---

## 0. Understand the three-container architecture

```text
Windows browser
    |
    | http://localhost:3000
    v
cro-weather-web        Next.js 15          image: cro-weather-frontend:1.0.0
    |  API_INTERNAL_URL=http://cro-weather-api:8000
    |  private network: cro-weather-net
    v
cro-weather-api        FastAPI            image: cro-weather-backend:1.0.0
    |  REDIS_URL=redis://cro-weather-redis:6379/0
    |  private network: cro-weather-net
    v
cro-weather-redis      Redis              image: redis:7.4-alpine
    |
    v
cro-weather-redis-data named volume        persistent Redis AOF/data

FastAPI also fetches the DHMZ observations feed over HTTPS.
Only ports 3000 (web) and 8000 (API/docs) are published to Windows.
Redis port 6379 is NOT published to Windows.
```

Vocabulary:

- **Image:** packaged filesystem + instructions for an application (`cro-weather-backend:1.0.0`). Created by `wslc build` or fetched from a registry.
- **Container:** running or stopped instance of an image (`cro-weather-api`). Created by `wslc run`.
- **Network:** private bridge for DNS-based communication between containers (`cro-weather-net`).
- **Volume:** persistent data storage independent of the container's lifecycle (`cro-weather-redis-data`).
- **`-p`:** publish a container port to Windows. **`-e`:** pass an environment variable. **`-v`:** mount a volume. **`-d`:** run detached (background). **`--rm`:** remove a container automatically when it stops.

## 1. Check the WSL Containers installation

Run these from Windows PowerShell:

```powershell
wsl --version
wsl --update
wslc version
wslc --help
wslc run --rm hello-world
```

What happens:

1. `wsl --version` displays the WSL release. `wsl --update` updates WSL; updating may require administrator permissions.
2. `wslc version` confirms that the native Windows container CLI is installed.
3. `wslc run --rm hello-world` downloads/runs a tiny test image and removes its container afterward.

If `wslc` is not recognized, first make sure WSL reports version 2.9.3+ and restart the terminal after updating. Do not substitute `docker` commands: this tutorial is deliberately using `wslc`.

## 2. Change to the extracted project directory

For example, if you extracted the ZIP to `D:\Development\cro-weather-pro`:

```powershell
cd D:\Development\cro-weather-pro
Get-ChildItem
```

You should see `backend`, `frontend`, `redis`, `build-wslc.ps1`, and `run-wslc.ps1`. The examples below do **not** execute those `.ps1` files.

## 3. Build both application images

Run exactly these two commands from the **repository root** (`D:\Development\cro-weather-pro`):

```powershell
wslc build -t cro-weather-backend:1.0.0 .\backend
wslc build -t cro-weather-frontend:1.0.0 .\frontend
```

`-t` assigns the image name/tag; `.\backend` and `.\frontend` identify separate build contexts, each containing its own `Dockerfile`. **Do not use `-f Dockerfile` from the repository root**: there is no `Dockerfile` at that level. If you choose `-f`, point explicitly to `.\backend\Dockerfile` or `.\frontend\Dockerfile`. The backend build installs Python dependencies and imports Croatian geographic data. The frontend build installs Node dependencies, downloads Croatia county geometry, and compiles the production Next.js application.

**The first build needs Internet access** for image registries, PyPI, npm, Croatian location data, and county polygons. It can take substantially longer than incremental builds. It is expected to fail if geographic sources are unavailable; the project intentionally does not silently fabricate those datasets.

See the built images:

```powershell
wslc image list
wslc image inspect cro-weather-backend:1.0.0
wslc image inspect cro-weather-frontend:1.0.0
```

**Important:** An image is not yet a running application. The next steps create shared infrastructure and start actual containers.

## 4. Create the shared network and persistent Redis volume

Run **once** for the initial setup:

```powershell
wslc network create cro-weather-net
wslc volume create cro-weather-redis-data
```

Inspect them:

```powershell
wslc network list
wslc network inspect cro-weather-net
wslc volume list
wslc volume inspect cro-weather-redis-data
```

Why these are important:

- `--network cro-weather-net` puts all three containers on the same isolated application bridge. This allows the hostnames `cro-weather-api` and `cro-weather-redis` to resolve inside the network.
- `cro-weather-redis-data:/data` preserves Redis persistence files after the Redis **container** is removed or replaced.

If you repeat `network create` or `volume create` for resources that already exist, the CLI may report an error. Do **not** delete the Redis volume simply to get rid of an “already exists” message: reuse it.

## 5. Run Redis (first container)

```powershell
wslc run -d --rm --name cro-weather-redis --network cro-weather-net -v cro-weather-redis-data:/data redis:7.4-alpine redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
```

Meaning:

- `-d` runs in the background; `--rm` cleans up the container when stopped.
- `--name cro-weather-redis` registers this name in the application network.
- `-v cro-weather-redis-data:/data` mounts the named volume.
- `redis:7.4-alpine` is the upstream Redis container image (pulled automatically on first use).
- `redis-server ...` enables append-only persistence, a 128 MB memory limit, and LRU eviction.

Verify Redis is responding:

```powershell
wslc exec cro-weather-redis redis-cli ping
```

Expected output: `PONG`.

## 6. Run FastAPI (second container)

```powershell
wslc run -d --rm --name cro-weather-api --network cro-weather-net -p 127.0.0.1:8000:8000 -e REDIS_URL=redis://cro-weather-redis:6379/0 cro-weather-backend:1.0.0
```

- `-p 127.0.0.1:8000:8000` exposes the container's port 8000 on **Windows loopback only**.
- `REDIS_URL=redis://cro-weather-redis:6379/0` points FastAPI to Redis by **container name**, not `localhost`.
- The backend contacts the DHMZ XML weather feed and caches observations in Redis.

Confirm the API is reachable:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:8000/api/weather
```

**Note:** It is possible to see a temporary HTTP 503 at cold start (before the first successful weather-feed download). Check logs and retry. The API docs route is `http://localhost:8000/docs`.

## 7. Run Next.js (third container)

```powershell
wslc run -d --rm --name cro-weather-web --network cro-weather-net -p 127.0.0.1:3000:3000 -e API_INTERNAL_URL=http://cro-weather-api:8000 cro-weather-frontend:1.0.0
```

- `-p 127.0.0.1:3000:3000` makes the Next.js UI available to the Windows browser, but not directly to other machines on the LAN.
- `API_INTERNAL_URL=http://cro-weather-api:8000` is used **inside** the network. This is intentionally not `http://localhost:8000`, because `localhost` inside the frontend container means the frontend container itself.

Open the app and API documentation:

```powershell
Start-Process http://localhost:3000
Start-Process http://localhost:8000/docs
```

## 8. Check container status, logs, and resource usage

```powershell
wslc container list
wslc container list --all
wslc stats
```

View logs independently:

```powershell
wslc container logs cro-weather-redis
wslc container logs cro-weather-api
wslc container logs cro-weather-web
```

Inspect full container configuration:

```powershell
wslc container inspect cro-weather-api
wslc container inspect cro-weather-web
wslc network inspect cro-weather-net
```

If you suspect a startup error, inspect `wslc container list --all` and logs first. A detached `wslc run -d` returning successfully does **not** guarantee the application is healthy.

## 9. Execute commands *inside* a container

These commands are especially helpful for learning the boundary between **Windows**, **the WSL container runtime**, and **each Linux container**:

```powershell
# Linux kernel details from inside FastAPI
wslc exec cro-weather-api uname -a

# Check Python runtime inside FastAPI
wslc exec cro-weather-api python --version

# Verify Redis connectivity using its own CLI
wslc exec cro-weather-redis redis-cli ping

# Inspect Redis weather-related keys without modifying them
wslc exec cro-weather-redis redis-cli --scan --pattern 'weather:*'

# Check internal API routing from inside the Next.js container
wslc exec cro-weather-web node -e "fetch('http://cro-weather-api:8000/api/health').then(r => console.log('HTTP', r.status)).catch(e => { console.error(e); process.exitCode = 1 })"
```

Compare addressing:

| Where you are | Address to use | Why |
|---|---|---|
| Windows browser | `http://localhost:3000` | Published frontend port |
| Windows PowerShell | `http://127.0.0.1:8000` | Published backend port |
| Next.js container | `http://cro-weather-api:8000` | Private DNS over `cro-weather-net` |
| FastAPI container | `redis://cro-weather-redis:6379/0` | Private DNS over `cro-weather-net` |
| Windows | No published Redis port | Redis remains internal |

## 10. Stop everything safely

Stop in reverse dependency order:

```powershell
wslc container stop cro-weather-web
wslc container stop cro-weather-api
wslc container stop cro-weather-redis
```

These containers were created using `--rm`, so stopping each one also removes its **container record**. Their **images**, **network**, and **named Redis volume** remain intact.

To start again, repeat **sections 5, 6, and 7**. You do **not** need to rebuild the images, recreate the network, or recreate the volume unless you have removed those resources.

## 11. Rebuild after changing source code

From the project root, stop the old application:

```powershell
wslc container stop cro-weather-web
wslc container stop cro-weather-api
wslc container stop cro-weather-redis
```

Rebuild one or both images depending on what you changed:

```powershell
# Backend source changed
wslc build -t cro-weather-backend:1.0.0 .\backend

# Frontend source changed
wslc build -t cro-weather-frontend:1.0.0 .\frontend
```

Then re-run the three **`wslc run`** commands from sections 5–7. A build changes an **image**; it does not replace an already-running **container**. Your Redis data remains in `cro-weather-redis-data` throughout this cycle.

## 12. Remove resources (optional; read before using)

For routine shutdown, use section 10 instead. Resource deletion is for when you intentionally want to dismantle this stack.

After stopping all containers, remove **only the project network**:

```powershell
wslc network remove cro-weather-net
```

Delete **only the project's images** if you no longer need them:

```powershell
wslc image remove cro-weather-backend:1.0.0
wslc image remove cro-weather-frontend:1.0.0
```

**Destructive operation — deletes the Redis cache/history/persisted state:**

```powershell
wslc volume remove cro-weather-redis-data
```

Do not run the last command if you want to retain weather history across restarts. Avoid broad `prune` commands when other WSL Containers projects exist on your PC; they can affect unrelated resources.

## 13. Troubleshooting the most common mistakes

**`wslc : The term 'wslc' is not recognized`**

Check `wsl --version` (must be >= 2.9.3), run `wsl --update`, and restart PowerShell. If WSL is not installed at all, install it first via `wsl --install` and follow Windows restart instructions.

**`wslc version` succeeds, but `wslc build` says `The system cannot find the file specified` / `ERROR_FILE_NOT_FOUND`.**

In the original `build-wslc.ps1`, the backend build used `-f Dockerfile` from the repository root. The actual file is `backend/Dockerfile`, not a root-level Dockerfile. **That is a likely cause of the reported error; it is not evidence of a GeoNames outage.** The corrected script in this package omits `-f` and lets `wslc` locate each context's default Dockerfile.

In PowerShell, verify the files and retry without the wrapper:

```powershell
Set-Location D:\Development\cro-weather-pro
Test-Path .\backend\Dockerfile
Test-Path .\frontend\Dockerfile
wslc build -t cro-weather-backend:1.0.0 .\backend
wslc build -t cro-weather-frontend:1.0.0 .\frontend
```

Both `Test-Path` commands should print `True`. Another valid syntax, if you want an explicit `-f`, is:

```powershell
wslc build -f .\backend\Dockerfile -t cro-weather-backend:1.0.0 .\backend
```

If `ERROR_FILE_NOT_FOUND` persists **before any Dockerfile build step appears**, isolate the runtime from this project:

```powershell
wslc run --rm hello-world
wslc --help
wslc build --help
wsl --version
wsl --status
```

A successful `hello-world` only proves that running/pulling containers works; it does **not** prove image-building is healthy. Test a tiny image from a fresh directory:

```powershell
New-Item -ItemType Directory -Force .\wslc-smoke | Out-Null
'FROM alpine:3.21' | Set-Content .\wslc-smoke\Dockerfile -Encoding ascii
wslc build -t cro-weather-smoke:local .\wslc-smoke
```

If the smoke build also fails, investigate `wslc` rather than GeoNames or CroWeather Pro. If only a **previously deleted/recreated Windows context path** fails, Microsoft WSL [issue #41287](https://github.com/microsoft/WSL/issues/41287) documents a stale context-mount bug. In that specific situation, a *new build-context directory* or a WSL Containers session reset may help. **Do not reset the session while other containers are running.** On an idle machine only, `wslc system session terminate` followed by a retry is the documented issue workaround; it interrupts that session's running workloads.

**Frontend build: `npm ERR! ETARGET No matching version found for @types/d3-geo@^3.1.12`.**

The original CroWeather Pro frontend manifest contained a nonexistent `@types/d3-geo` version. Version `3.1.1` exists and is used in the corrected repository. If you downloaded an earlier package, update `frontend/package.json` from `"@types/d3-geo": "^3.1.12"` to `"@types/d3-geo": "^3.1.1"`, then rebuild only the frontend:

```powershell
$path = ".\frontend\package.json"
(Get-Content $path -Raw).Replace('"@types/d3-geo": "^3.1.12"', '"@types/d3-geo": "^3.1.1"') | Set-Content $path -Encoding utf8
wslc build -t cro-weather-frontend:1.0.0 .\frontend
```

The backend image does not need rebuilding. Unlike image builds, a `wslc run` command only works after its image was successfully built. This ETARGET failure comes from npm inside the container build, not from `wslc` itself.

**The backend or frontend build fails at a Dockerfile step.**

Build output should identify the failing Dockerfile step. Check connectivity to Docker Hub, npm, PyPI, GeoNames and geoBoundaries. Both image builds rely on external services and a working Linux-container runtime.

**A `wslc run` command reports “already exists.”**

Use `wslc container list --all`. If that project container already exists, inspect or stop it rather than starting another with the same name. For the project network/volume, reuse existing resources.

**Port 3000 or 8000 is busy.**

Find the listener on Windows:

```powershell
Get-NetTCPConnection -LocalPort 3000,8000 -State Listen -ErrorAction SilentlyContinue
```

Stop the conflicting listener (for example, another development server), or change the **host-side** part of the `-p` mapping, such as `127.0.0.1:3001:3000` for the frontend. Then browse `http://localhost:3001`.

**The website loads but the weather feed is empty or delayed.**

```powershell
wslc container logs cro-weather-api
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

The API refreshes/checks cached feed data on a 60-second cycle; **DHMZ observations themselves do not necessarily update every minute**. Historical charts start accumulating observations after your instance first fetches them.

**The browser cannot reach the API via container hostname.**

That's expected: `cro-weather-api` resolves on the **private** network. The browser uses `localhost:3000`; Next.js proxies calls to the backend internally. Don't change browser URLs to `http://cro-weather-api:8000`.

**An image seems to have vanished when you switch PowerShell to Administrator.**

WSL Containers can use separate runtime sessions between elevated and unelevated Windows terminals. Prefer one consistent **normal PowerShell** session so images and containers appear together.

## 14. Compact command reference (Docker-to-WSLC mental model)

| Task | WSL Containers command |
|---|---|
| CLI version | `wslc version` |
| CLI help | `wslc --help` |
| Build an image | `wslc build -t app:1.0 .` |
| List images | `wslc image list` |
| Run in background | `wslc run -d --name app -p 8080:80 nginx` |
| List running containers | `wslc container list` |
| List all containers | `wslc container list --all` |
| Show logs | `wslc container logs app` |
| Execute inside container | `wslc exec app cat /etc/os-release` |
| Inspect a container | `wslc container inspect app` |
| Resource usage | `wslc stats` |
| Stop a container | `wslc container stop app` |
| Create a network | `wslc network create appnet` |
| Create a named volume | `wslc volume create appdata` |

### Why `wslc` is interesting for a Windows development article

`wslc` exposes a container workflow **directly from Windows** with familiar commands and standard Dockerfiles. For CroWeather Pro, a three-service setup becomes a sequence of explicit commands: **build images → create network/volume → run Redis → run API → run UI → observe and troubleshoot**. It demonstrates the container lifecycle without Docker Desktop or a Compose orchestration layer.

However, `wslc` is **not** a drop-in replacement for every Docker Desktop feature: the built-in CLI does not supply Docker Desktop's GUI or its full Compose/Kubernetes development experience. For this project, that is why the startup is expressed as three independent `wslc run` commands and optional `.ps1` wrappers.

---

## Sources and project files

Official documentation:

- [Microsoft Learn — Get started with WSL container](https://learn.microsoft.com/en-us/windows/wsl/tutorials/wsl-containers)
- [Microsoft Learn — WSL container overview](https://learn.microsoft.com/en-us/windows/wsl/wsl-container)
- [Microsoft Windows Developer Blog — WSL containers generally available (29 Sep 2026)](https://blogs.windows.com/windowsdeveloper/2026/09/29/wsl-containers-now-generally-available/)

CroWeather Pro implementation cross-checked against:

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `build-wslc.ps1`, `run-wslc.ps1`, `stop-wslc.ps1`
- `DEPLOYMENT.md`

**Verification limitation:** These commands are matched to the provided source files and current `wslc` documentation, but they have **not been executed against a Windows 11 machine** in this environment. Check `wslc <command> --help` for any installed-version differences.
