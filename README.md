# DeepBounty

An extensible bug bounty automation framework.

DeepBounty helps security researchers automate common bug bounty hunting tasks using a plugin system. The server orchestrates scans, collects findings, and sends alerts when misconfigurations, leaks, new endpoints, or vulnerabilities are detected on target scopes.

🚧 This project is currently in development.

## Features

- Modular by design: extend the core with TypeScript modules via an SDK.
- Scalable workers: execute scans in sandboxed Docker environments, horizontally scalable.
- Web UI: modern interface to manage targets and view alerts.
- Burp Suite and Caido extensions to feed captured requests/JS enhancing module analyses.

## Architecture

```text
+-----------------------+                        +--------------------------+
|        Webapp         | <--------------------> |          Server          |
| React + TS            |                        | Node.js + Express (TS)   |
| TailwindCSS + shadcn  |    Alerts / Targets    | Module SDK (TypeScript)  |
+-----------+-----------+                        +-----------+--------------+
            ^                                                |
            |                                                |
            |                                                v
            |                                     +----------+-----------+
            |                                     |        Modules       |
            |                                     |   (plugins via SDK)  |
            |                                     +----------+-----------+
            |                                                |
            |                                         schedules tasks
            |                                                v
            |                                     +----------+-----------+
            |                                     |        Workers       |
            |                                     |  Docker-sandboxed    |
            |                                     |  run tools/scanners  |
            |                                     +----------+-----------+
            |                                                |
            |                                        scan/observe targets
            |                                                |
            |                                                |
            |                                                |
            |      +-------------------------------+         |
            +------+     Alerts / Results back     |<--------+
                   +-------------------------------+

                        +-----------------------+
                        |  Burp Suite / Caido   |
                        |      Extensions       |
                        +-----------+-----------+
                                    |
                                    v
                            Feeds requests/JS
                                into Server
```

## Components

- Server (Core)
    - Orchestrates scans and data flow between modules, workers, and the webapp.
    - Exposes APIs for module integration and real-time alerting.
- Workers
    - Execute scanning/analysis in sandboxed Docker environments.
    - Multiple workers can connect to a single server for resilience and scale.
- Webapp
    - Modern UI to manage targets and review alerts/findings.
- Modules (Plugins)
    - Extend functionality using the TypeScript SDK to add scanners, analyzers, and automations.
- Burp Suite / Caido Extensions
    - Sends captured request data and page JS to the server to enrich analysis.

## Tech stack

- Backend: Node.js, Express, TypeScript
- Frontend: React, TypeScript, TailwindCSS, shadcn/ui
- Execution: Docker-based workers
- Modules: TypeScript SDK

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - How the project is structured, perfect for AI-assisted development and deep understanding of the codebase structure, module system, and integration patterns.

## Deployment (Docker / Production)

This repo includes production Dockerfiles for the full stack:

- Server (Express + WebSocket)
- Webapp (Vite build served by nginx)
- Worker (runs tasks/tools)
- PostgreSQL

The webapp container also acts as a reverse proxy:

- Browser UI is served on `/`
- API is reachable on `/api/*` (proxied to the server)
- Callbacks remain on `/cb/*` (proxied to the server)

### 1) Prerequisites

- Docker + Docker Compose

### 2) Configure environment

Create a repo-root [.env](.env) from the example:

- Copy [.env.example](.env.example) to [.env](.env)
- Set `DB_PASSWORD` and `EXTERNAL_URL` to your public URL (must match where `/cb/*` is reachable)
- Generate a 64-hex worker key and set `WORKER_KEY`

Example worker key generation:

- `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 4) Start the stack

From the repository root:

- `docker compose up -d --build`

Open the UI:

- `http://localhost:8080` (or your `WEBAPP_PORT`)
