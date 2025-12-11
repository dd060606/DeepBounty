# DeepBounty

An extensible bug bounty automation framework.

DeepBounty helps security researchers automate common bug bounty hunting tasks using a plugin system. The server orchestrates scans, collects findings, and sends alerts when misconfigurations, leaks, new endpoints, or vulnerabilities are detected on target scopes.

🚧 This project is currently in development.

## Key ideas

- Modular by design: extend the core with TypeScript modules via an SDK.
- Scalable workers: execute scans in sandboxed Docker environments, horizontally scalable.
- Web UI: modern interface to manage targets and view alerts.
- Planned: a Burp Suite extension to feed captured requests/JS and build a complete sitemap, enhancing module analyses.

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
                        |  Burp Suite Extension |
                        |  (planned)            |
                        +-----------+-----------+
                                    |
                                    v
                        Feeds requests/JS/sitemap
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
- Burp Suite Extension (Planned)
    - Sends captured request data and page JS to the server to enrich analysis and build a full sitemap.

## Tech stack

- Backend: Node.js, Express, TypeScript
- Frontend: React, TypeScript, TailwindCSS, shadcn/ui
- Execution: Docker-based workers
- Modules: TypeScript SDK

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - How the project is structured, perfect for AI-assisted development and deep understanding of the codebase structure, module system, and integration patterns.

---
