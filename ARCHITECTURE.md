# DeepBounty Architecture Documentation

> **Purpose**: This document provides a comprehensive overview of DeepBounty's architecture, module system, and APIs. It's designed to help AI agents and developers quickly understand how the system works and how to build modules.

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Module System](#module-system)
4. [Task Scheduling System](#task-scheduling-system)
5. [Module API Reference](#module-api-reference)
6. [Data Flow](#data-flow)
7. [Event System](#event-system)
8. [Storage Architecture](#storage-architecture)
9. [Creating a Module](#creating-a-module)

---

## System Overview

DeepBounty is an extensible bug bounty automation platform with a modular architecture. The system consists of:

- **Server**: Core orchestration layer (Node.js + TypeScript + Express)
- **Workers**: Sandboxed Docker containers executing security scans
- **Webapp**: React-based UI for managing targets and viewing alerts
- **Modules**: TypeScript plugins extending functionality via SDK
- **SDK**: Type-safe API for module development (`@deepbounty/sdk`)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Webapp (React)                      │
│              Targets • Alerts • Modules • Settings          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    Server (Node.js + Express)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Module     │  │    Task      │  │   Alert      │       │
│  │   Loader     │  │   Manager    │  │   System     │       │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘       │
│         │                 │                                 │
│  ┌──────▼─────────────────▼────────────┐                    │
│  │        Module SDK Bridge            │                    │
│  │   (ServerAPI implementation)        │                    │
│  └──────┬──────────────────────────────┘                    │
└─────────┼───────────────────────────────────────────────────┘
          │
          ├──► Module 1 (@deepbounty/sdk)
          ├──► Module 2 (@deepbounty/sdk)
          └──► Module N (@deepbounty/sdk)
                     │
                     ↓ Task Scheduling
┌─────────────────────────────────────────────────────────────┐
│                    Workers (Docker)                         │
│    Execute scans, run tools, send results back              │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Server (`/server`)

**Purpose**: Orchestrates the entire system, manages modules, schedules tasks, and provides a REST API.

**Key Directories**:

- `src/modules/` - Module loader and SDK implementation
- `src/tasks/` - Task scheduling and execution management
- `src/controllers/` - REST API endpoints
- `src/db/` - Database schema (Drizzle ORM + PostgreSQL)
- `src/events/` - Event bus for inter-module communication
- `src/services/` - Business logic (alerts, notifications)

**Database**: PostgreSQL with Drizzle ORM

- Schema: `server/src/db/schema.ts`
- Migrations: `server/drizzle/*.sql`

### 2. SDK (`/sdk`)

**Purpose**: Type-safe API for module development. Modules import `@deepbounty/sdk` to interact with the server.

**Structure**:

```
sdk/src/
  ├── index.ts           # Main API interfaces (ServerAPI, ConfigAPI, etc.)
  ├── events.ts          # Event system types
  └── types/
      ├── tasks.ts       # Task scheduling types
      ├── tools.ts       # Tool definitions
      ├── targets.ts     # Target management
      ├── alerts.ts      # Alert types
      └── ...
```

### 3. Workers (`/worker`)

**Purpose**: Execute tasks in isolated Docker containers. Workers poll the server for pending tasks, execute commands/tools, and return results.

**Key Features**:

- Tool installation and caching
- Sandboxed execution environment
- Horizontal scalability (multiple workers per server)

### 4. Modules (`/example-module`, `/modules/*`)

**Purpose**: Extend DeepBounty functionality. Each module is a TypeScript package implementing the `ModuleLifecycle` interface.

**Module Structure**:

```
example-module/
  ├── module.yml          # Module manifest
  ├── src/
  │   ├── index.ts        # Main module class
  │   ├── tasks/          # Task definitions
  │   ├── tools.ts        # Tool registrations
  │   └── storage.ts      # Module-specific DB
  └── package.json
```

---

## Module System

### Module Lifecycle

1. **Loading** (`server/src/modules/loader.ts`):
    - Server scans `server/modules/` directory
    - Reads `module.yml` manifest
    - Validates module structure
    - Instantiates module class with `ServerAPI`

2. **Initialization**:
    - Module's `run()` method called
    - Module registers tools, tasks, and event listeners
    - Module initializes storage/configuration

3. **Runtime**:
    - Module responds to events
    - Task templates schedule executions
    - Module processes task results via callbacks

4. **Shutdown**:
    - Module's `stop()` method called (optional)
    - Event listeners cleaned up

### Module Manifest (`module.yml`)

```yaml
name: Example Module # Display name
id: example-module # Unique module identifier
version: 1.0.0 # Semantic version
description: This is an example module for demonstration purposes. # Description
entry: index.js # Entry point (compiled JS)
author: Your name # Author
settings: # User-configurable settings
    - name: feature1
      type: checkbox
      label: Enable Feature 1
      default: true
    - name: feature2
      type: text
      label: Feature 2 Configuration
      default: "default value"
    - name: feature3
      type: select
      label: Choose Feature 3 Option
      options:
          - option1
          - option2
          - option3
      default: option1
    - name: feature4
      type: info
      label: Feature 4 Information
      default: "This is some information about Feature 4."
```

### Module Interface

```typescript
import type { ServerAPI, ModuleLifecycle } from "@deepbounty/sdk";

export default class MyModule implements ModuleLifecycle {
	constructor(private api: ServerAPI) {}

	async run() {
		// Register tools, tasks, event listeners
		this.api.registerTool(MY_TOOL);
		await this.api.registerTaskTemplate(/* ... */);
		this.api.events.subscribe("http:js", this.handleJS);
	}

	async stop() {
		// Cleanup (optional)
	}
}
```

---

## Task Scheduling System

### Overview

DeepBounty's task system allows modules to schedule automated scans/analyses. Tasks are based on **templates** that define what to execute and how often.

### Scheduling Types

Tasks use one of three scheduling strategies:

#### 1. **TARGET_BASED** (Default)

- **Behavior**: Creates one task instance per active target
- **Use Case**: Scans that need to run for each target (e.g., subdomain enumeration)
- **Example**: If you have 10 active targets, 10 task instances are created
- **Target Access**: Tasks receive `{{TARGET_DOMAIN}}`, `{{TARGET_ID}}` placeholders

```typescript
await api.registerTaskTemplate(
	"subdomain-scan",
	"Subdomain Discovery",
	"Find subdomains for each target",
	{
		commands: ["subfinder -d {{TARGET_DOMAIN}}"],
		requiredTools: [SUBFINDER_TOOL],
	},
	3600, // Run every hour
	"TARGET_BASED" // One task per target
);
```

#### 2. **GLOBAL**

- **Behavior**: Creates a single task instance (no target association)
- **Use Case**: Global checks that don't depend on specific targets (e.g., CVE monitoring, threat intel feeds)
- **Example**: One task instance runs regardless of target count
- **Target Access**: No target placeholders available

```typescript
await api.registerTaskTemplate(
	"cve-monitor",
	"CVE Monitoring",
	"Check for new CVEs",
	{
		commands: ["curl https://cve.api.com/latest"],
	},
	7200, // Run every 2 hours
	"GLOBAL" // Single global task
);
```

#### 3. **CUSTOM**

- **Behavior**: No automatic task instances. Either a scheduler triggers an `onSchedule` callback at intervals, or purely manual triggering.
- **Use Case**: Dynamic scheduling, batching, conditional execution, event-driven scans
- **Example**: Module analyzes targets periodically or responds to events, creating optimized task instances
- **Immediate Execution**: Task instances created via `createTaskInstance` start immediately, without waiting for the next interval
- **How It Works**:
  **With Automatic Scheduling (interval > 0)**:
    1. One scheduler task is created with the template's interval
    2. When the interval expires, the `onSchedule` callback is invoked with the template ID
    3. Inside `onSchedule`, module calls `api.createTaskInstance()` to create actual task instances
    4. Task instances start executing immediately (no waiting for next scheduler cycle)
    5. Task instances execute and return results
    6. The `onComplete` callback receives results from each instance (if provided)
       **With Manual-Only Mode (interval <= 0)**:
    7. No scheduler task is created
    8. The `onSchedule` callback is **never** called automatically
    9. Module must manually call `api.createTaskInstance()` when needed (e.g., in response to events)
    10. Task instances execute immediately upon creation

````typescript
// Example 1: CUSTOM with automatic scheduling (interval > 0)
const scheduledTemplateId = await api.registerTaskTemplate(
	"custom-scan",
	"Custom Scan",
	"Dynamically scheduled scan",
	{
		commands: ["tool:{scanner} {{HOSTNAME}} {{PORT}}"],
	},
	3600, // onSchedule callback invoked every hour
	"CUSTOM",
	(result) => {
		// Called for EACH task instance result
		console.log(`Instance ${result.executionId} completed:`, result.output);
		if (result.success) {
			// Process result data
		}
	},
	async (templateId) => {
		// Called every hour by the scheduler
		// Fetch targets and create optimized instances
		const targets = await getTargetsGroupedByHostname();

		for (const [hostname, ports] of targets) {
			// Create one task instance per hostname (batching by hostname)
			await api.createTaskInstance(
				templateId,
				undefined,
				{
					HOSTNAME: hostname,
					PORT: ports.join(","),
				}
			);
		}
	}
);

// Example 2: CUSTOM with manual-only mode (interval <= 0)
const manualTemplateId = await api.registerTaskTemplate(
	"event-driven-scan",
	"Event-Driven Scan",
	"Scan triggered by events only",
	{
		commands: ["tool:{scanner} {{URL}}"],
	},
	0, // No automatic scheduling (manual mode)
	"CUSTOM",
	(result) => {
		// Called for each manually triggered task result
		if (result.success) {
			console.log(`Scan completed for ${result.customData?.URL}`);
		}
	}
);

// Later, trigger scans manually based on events:
api.events.subscribe("http:new-endpoint", async (event) => {
	// Create task instance on-demand
	await api.createTaskInstance(manualTemplateId, event.data.targetId, {
		URL: event.data.url,
	});
});
```### Task Template Structure

```typescript
interface TaskContent {
	commands: string[]; // Shell commands to execute
	requiredTools?: Tool[]; // Tools to install (see Tool Registration)
	extractResult?: boolean; // Extract output between markers
}

interface TaskTemplate {
	id: number; // Auto-generated ID
	moduleId: string; // Module that owns this template
	uniqueKey: string; // Module-unique identifier
	name: string; // Display name
	description?: string; // Description
	content: TaskContent; // Commands and tools
	interval: number; // Seconds between executions
	schedulingType: SchedulingType; // TARGET_BASED | GLOBAL | CUSTOM
	active: boolean; // Global enable/disable
}
````

### Placeholders

Commands can use placeholders that are replaced at runtime:

#### Target Placeholders (TARGET_BASED only)

- `{{TARGET_DOMAIN}}` - Target domain (e.g., `example.com`)
- `{{TARGET_ID}}` - Target database ID
- `{{USER_AGENT}}` - Configurable user-agent in target settings
- `{{CUSTOM_HEADER}}` - Configurable custom header in target settings

#### Tool Placeholders

- `tool:{toolName}` - Path to installed tool (e.g., `tool:{subfinder}` → `/tools/subfinder`)

#### Custom Data Placeholders (CUSTOM mode)

- `{{KEY}}` - Any key from `customData` object
- Supports primitives, arrays, objects (JSON-stringified)

**Example**:

```typescript
commands: ["tool:{nmap} -p {{PORTS}} {{IP}}", "echo 'Scanning {{HOSTNAME}}'"];

// With customData: { IP: "1.2.3.4", PORTS: "80,443", HOSTNAME: "example.com" }
// Becomes:
// /tools/nmap -p 80,443 1.2.3.4
// echo 'Scanning example.com'
```

### Task Execution Flow

```
1. Task is due (interval expired)
   ↓
2. TaskManager creates TaskExecution
   ↓
3. TaskBuilder replaces placeholders in commands
   ↓
4. TaskManager assigns TaskExecution to Worker
   ↓
5. Worker installs required tools (if needed)
   ↓
6. Worker executes commands
   ↓
7. Worker extracts result (if extractResult=true)
   ↓
8. Worker sends TaskResult back to server
   ↓
9. Server invokes module's onComplete callback
   ↓
10. If oneTime=true, delete scheduled task
```

### Task Result Handling

```typescript
interface TaskResult {
	executionId: number;
	scheduledTaskId: number;
	success: boolean;
	output?: any; // Extracted result (if enabled)
	error?: string; // Error message (from stderr)
	customData?: Record<string, any>; // Custom data from task instance
	targetId?: number; // If this execution was for a specific target
}

// Handle results in callback
await api.registerTaskTemplate(
	"scan",
	"Scan",
	"...",
	taskContent,
	3600,
	"TARGET_BASED",
	(result: TaskResult) => {
		if (result.success && result.output) {
			// Parse and process result
			const findings = JSON.parse(result.output);
			findings.forEach((f) => api.createAlert(/* ... */));
		}
	}
);
```

### Task Instances (CUSTOM mode)

For CUSTOM scheduling mode, task instances are **always one-time** and automatically deleted after execution:

```typescript
await api.createTaskInstance(templateId, targetId, {
	url: "https://example.com/new-endpoint",
});
```

**Behavior**:

- **Auto-Cleanup**: Task instances are automatically deleted after execution completes
- **No Rescheduling**: Unlike template-based tasks, instances don't reschedule on interval
- **Manual Creation**: Instances must be created explicitly (typically in `onSchedule` callback)

**Use Cases**:

- On-demand scans triggered by events
- One-off checks for specific targets or conditions
- Dynamic batching based on runtime data

---

## Module API Reference

### ServerAPI

Main interface passed to modules via constructor.

```typescript
interface ServerAPI {
  version: string;              // SDK version
  logger: Logger;               // Logging interface
  config: ConfigAPI;            // Module configuration
  storage: StorageAPI;          // Module-specific SQLite database
  events: IEventBus;            // Event pub/sub system

  // Task management
  registerTaskTemplate(...): Promise<number>;
  unregisterTaskTemplate(templateId: number): Promise<boolean>;
  createTaskInstance(...): Promise<number>;

  // Tool registration
  registerTool(tool: Tool): void;

  // Alert creation
  createAlert(...): Promise<Alert>;
}
```

### Logger

```typescript
interface Logger {
	info(...args: any[]): void;
	warn(...args: any[]): void;
	error(...args: any[]): void;
}

// Usage
this.api.logger.info("Module initialized");
this.api.logger.error("Failed to process:", error);
```

### ConfigAPI

Persistent key-value storage for module configuration.

```typescript
interface ConfigAPI {
	// Generic config (any data)
	get<T>(key: string, defaultValue?: T): Promise<T>;
	set<T>(key: string, value: T): Promise<void>;
	remove(key: string): Promise<void>;
	getAll(): Promise<Record<string, any>>;

	// Module settings (defined in module.yml)
	getSetting(name: string): Promise<ModuleSetting>;
	setSetting(name: string, value: any): Promise<void>;
	getAllSettings(): Promise<ModuleSetting[]>;
}

// Example
await api.config.set("lastRun", new Date().toISOString());
const apiKey = await api.config.getSetting("apiKey");
```

### StorageAPI

Module-specific SQLite database (isolated from other modules).

```typescript
interface StorageAPI {
	// Query data
	query<T>(sql: string, params?: any[]): T[];
	queryOne<T>(sql: string, params?: any[]): T | undefined;

	// Modify data
	execute(
		sql: string,
		params?: any[]
	): {
		changes: number | bigint;
		lastInsertRowid: number | bigint;
	};

	// Schema management
	createTable(tableName: string, schema: string): void;
	dropTable(tableName: string): void;
}

// Example
api.storage.createTable(
	"findings",
	`
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  severity TEXT,
  discovered_at TEXT
`
);

api.storage.execute(
	"INSERT INTO findings (url, severity, discovered_at) VALUES (?, ?, ?)",
	["https://example.com", "high", new Date().toISOString()]
);

const findings = api.storage.query<Finding>(
	"SELECT * FROM findings WHERE severity = ?",
	["high"]
);
```

### Task Registration

````typescript
async registerTaskTemplate(
  uniqueKey: string,              // Module-unique identifier
  name: string,                   // Display name
  description: string,            // Description
  taskContent: TaskContent,       // Commands and tools
  interval: number,               // Seconds between executions. For CUSTOM: if <= 0, no automatic scheduling
  schedulingType?: SchedulingType, // TARGET_BASED | GLOBAL | CUSTOM (default: TARGET_BASED)
  onComplete?: (result: TaskResult) => void, // Called when task instances complete
  onSchedule?: (templateId: number) => void | Promise<void> // For CUSTOM: called at interval (not if interval <= 0)
): Promise<number>; // Returns template ID

// Example: TARGET_BASED with result callback
const templateId = await api.registerTaskTemplate(
  "subdomain-scan",
  "Subdomain Discovery",
  "Find subdomains using subfinder",
  {
    commands: [
      'echo "<<<RESULT_START>>>"',
      "tool:{subfinder} -d {{TARGET_DOMAIN}} -silent -json",
      'echo "<<<RESULT_END>>>"'
    ],
    requiredTools: [SUBFINDER_TOOL],
    extractResult: true
  },
  3600, // 1 hour
  "TARGET_BASED",
  (result) => {
    if (result.success && result.extractedResult) {
      const subdomains = JSON.parse(result.extractedResult);
      // Process subdomains...
    }
  }
);

// Example: CUSTOM with both callbacks
const customTemplateId = await api.registerTaskTemplate(
  "batched-scan",
  "Batched Scan",
  "Optimized batched scanning",
  {
    commands: ["tool:{scanner} {{TARGETS}}"],
  },
  7200, // onSchedule called every 2 hours
  "CUSTOM",
  (result) => {
    // Called for each instance result
    console.log(`Batch completed: ${result.customData?.TARGETS}`);
  },
  async (templateId) => {
    // Called every 2 hours by scheduler
    const targets = await getActiveTargets();
    const batches = createBatches(targets, 10);

    for (const batch of batches) {
      await api.createTaskInstance(
        templateId,
        undefined,
        { TARGETS: batch.join(",") }
      );
    }
  }
);
```### Manual Task Instance Creation (CUSTOM mode)

```typescript
async createTaskInstance(
  templateId: number,             // Template to instantiate
  targetId?: number,              // Optional target association
  customData?: Record<string, any> // Custom placeholder data
): Promise<number>; // Returns scheduled task ID

// Example: Task instance (automatically deleted after execution)
const taskId = await api.createTaskInstance(
  templateId,
  undefined,
  {
    HOSTNAME: "api.example.com",
    ENDPOINTS: JSON.stringify(["/v1", "/v2", "/admin"])
  }
);
````

### Tool Registration

```typescript
interface Tool {
	name: string; // Unique tool name
	version: string; // Tool version
	downloadUrl: string; // Download URL (zip/tar.gz)
	description: string; // Description
	preInstallCommands?: string[]; // Commands before download
	postInstallCommands?: string[]; // Commands after extraction
}

// Example
const SUBFINDER_TOOL: Tool = {
	name: "subfinder",
	version: "2.9.0",
	downloadUrl:
		"https://github.com/projectdiscovery/subfinder/releases/download/v2.9.0/subfinder_2.9.0_linux_amd64.zip",
	description: "Subdomain discovery tool",
	postInstallCommands: [
		"unzip -o subfinder_2.9.0_linux_amd64.zip",
		"rm subfinder_2.9.0_linux_amd64.zip",
	],
};

api.registerTool(SUBFINDER_TOOL);
```

### Alert Creation

```typescript
async createAlert(
  name: string,                   // Alert title
  subdomain: string,              // Subdomain/hostname (auto-detects target)
  score: number,                  // 0=Info, 1=Low, 2=Medium, 3=High, 4=Critical
  description: string,            // Detailed description
  endpoint: string,               // Specific path/endpoint
  confirmed?: boolean             // Manually confirmed (default: false)
): Promise<Alert>;

// Example
await api.createAlert(
  "Exposed Admin Panel",
  "admin.example.com",
  3, // High severity
  "Admin panel accessible without authentication",
  "/admin/login",
  true
);
```

**Target Auto-Detection**:

The `subdomain` parameter is used to automatically detect which target the alert belongs to. It checks:

1. Exact match with target's main domain (`targets.domain`)
2. Exact match with registered subdomains (`targets_subdomains.subdomain`)
3. Wildcard pattern match (e.g., `*.example.com` matches `api.example.com`, `*.cdn.apple.com` matches `static.cdn.apple.com`)

If no target is found, an error is thrown.

---

## Data Flow

### Task Execution Flow

```
┌────────────┐
│   Module   │
│ registers  │
│   task     │
└──────┬─────┘
       │
       ↓
┌──────────────────┐
│  TaskManager     │ ← Syncs tasks for templates
│  - Creates       │   based on scheduling type
│    scheduled     │
│    tasks         │
└────────┬─────────┘
         │
         ↓ (interval expires)
┌──────────────────┐
│  TaskExecution   │ ← Creates execution record
│  - Picks target  │
│  - Builds        │
│    commands      │
└────────┬─────────┘
         │
         ↓ (worker polls)
┌──────────────────┐
│     Worker       │ ← Executes in Docker sandbox
│  - Installs      │
│    tools         │
│  - Runs commands │
│  - Collects      │
│    output        │
└────────┬─────────┘
         │
         ↓ (sends result)
┌──────────────────┐
│  TaskManager     │ ← Receives result
│  - Stores result │
│  - Enriches with │
│    customData    │
│  - Invokes       │
│    callback      │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│   Module         │ ← Processes result
│  - Parses output │   in callback
│  - Creates       │
│    alerts        │
└──────────────────┘
```

### Alert Flow

```
Module detects issue
       ↓
api.createAlert()
       ↓
AlertService stores in DB
       ↓
Notification services triggered (Discord, Ntfy.sh, etc.)
       ↓
User views in webapp
```

---

## Event System

Modules can communicate via a pub/sub event bus.

### Core Events

Predefined events emitted by the server:

```typescript
interface CoreEvents {
	"http:traffic": HttpTraffic; // HTTP request/response captured
	"http:js": {
		// JavaScript detected in response
		context: TrafficContext;
		js: string;
	};
}
```

### Event Bus API

```typescript
interface IEventBus {
	// Subscribe to events
	subscribe<K extends keyof CoreEvents>(
		event: K,
		handler: (data: CoreEvents[K]) => void | Promise<void>
	): EventSubscription;

	// Subscribe to custom events
	subscribe<T = any>(
		event: string,
		handler: (data: T) => void | Promise<void>
	): EventSubscription;

	// Emit events
	emit<K extends keyof CoreEvents>(event: K, data: CoreEvents[K]): void;
	emit<T = any>(event: string, data: T): void;

	// Clear listeners
	clear(event?: string): void;
}

interface EventSubscription {
	unsubscribe(): void;
}
```

### Usage Examples

```typescript
// Subscribe to core event with origin filtering
const sub = api.events.subscribe("http:js", async (event) => {
  // Event is wrapped with metadata: { origin, moduleId?, data }
  if (event.origin === "server") {
    api.logger.info(`Received JS from server: ${event.data.context.url}`);
    // Analyze JavaScript code from server
    const { context, js } = event.data;
  }
});

// Subscribe to custom event and filter by module
api.events.subscribe("custom:new-endpoint", async (event) => {
  // Only process events from specific modules
  if (event.origin === "module" && event.moduleId === "crawler-module") {
    api.logger.info(`New endpoint discovered by crawler: ${event.data}`);
    // Trigger scan for this endpoint
  }
});

// Emit custom event (automatically tagged with module origin)
api.events.emit("custom:scan-complete", {
  targetId: 123,
  findings: [...]
});

// Example: Filter only server events
api.events.subscribe("http:traffic", async (event) => {
  if (event.origin === "server") {
    // Process only traffic from the server, not from other modules
    const traffic = event.data;
  }
});

// Cleanup
sub.unsubscribe();
```

### Event Metadata

All events are automatically wrapped with metadata:

```typescript
interface EventMetadata<T> {
	origin: "server" | "module"; // Where the event originated
	moduleId?: string; // Module ID (only if origin === "module")
	data: T; // Actual event data
}
```

**Usage Pattern**:

```typescript
api.events.subscribe("some-event", async (event) => {
	// Filter by origin
	if (event.origin === "server") {
		// Event from core system
	} else if (event.origin === "module") {
		// Event from another module
		console.log(`From module: ${event.moduleId}`);
	}

	// Access actual data
	const actualData = event.data;
});
```

### Event Isolation

- Each module gets an isolated event bus
- Modules can only emit/receive events they're subscribed to
- Core events are broadcast to all modules
- Custom events use namespacing (e.g., `moduleName:eventName`)

---

## Storage Architecture

### Database Layers

1. **Core PostgreSQL** (server): Shared data (targets, alerts, tasks, users)
2. **Module SQLite** (per-module): Isolated storage for each module

### Module Storage

Each module gets a dedicated SQLite database file: `server/storage/modules/{moduleId}.db`

**Characteristics**:

- Isolated: Modules cannot access other modules' data
- Persistent: Data survives server restarts
- SQLite: Lightweight, file-based, no external dependencies
- Full SQL: Supports CREATE TABLE, INSERT, UPDATE, DELETE, joins, indexes, etc.

**Best Practices**:

```typescript
// Initialize schema in run() method
initializeStorage(api: ServerAPI) {
  api.storage.createTable("discovered_subdomains", `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    discovered_at TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    alive BOOLEAN DEFAULT 1
  `);

  api.storage.execute(`
    CREATE INDEX IF NOT EXISTS idx_target_id
    ON discovered_subdomains(target_id)
  `);
}

// Store findings
storeFinding(targetId: number, subdomain: string) {
  api.storage.execute(
    `INSERT OR REPLACE INTO discovered_subdomains
     (target_id, subdomain, discovered_at, last_seen)
     VALUES (?, ?, ?, ?)`,
    [targetId, subdomain, new Date().toISOString(), new Date().toISOString()]
  );
}

// Query findings
getRecentFindings(targetId: number, hours: number = 24) {
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  return api.storage.query<Subdomain>(
    `SELECT * FROM discovered_subdomains
     WHERE target_id = ? AND discovered_at > ?
     ORDER BY discovered_at DESC`,
    [targetId, cutoff]
  );
}
```

---

## Creating a Module

### Step-by-Step Guide

#### 1. Initialize Module

```bash
# Copy example module
cp -r example-module my-module
cd my-module

# Install dependencies
npm install
```

#### 2. Update `module.yml`

```yaml
name: My Module
id: my-module
description: This is my custom module.
version: 1.0.0
entry: index.js
author: Your name
settings:
    - name: feature1
      type: checkbox
      label: Enable Feature 1
      default: true
```

#### 3. Implement Module

```typescript
// src/index.ts
import type { ServerAPI, ModuleLifecycle } from "@deepbounty/sdk";
export default class MyModule implements ModuleLifecycle {
	constructor(private api: ServerAPI) {}

	async run() {
		this.api.logger.info("MyModule starting...");

		// Initialize storage
		this.initStorage();

		// Register tools
		this.registerTools();

		// Register tasks
		await this.registerTasks();

		// Subscribe to events
		this.subscribeToEvents();
	}

	private initStorage() {
		this.api.storage.createTable(
			"my_data",
			`
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      checked_at TEXT NOT NULL
    `
		);
	}

	private registerTools() {
		this.api.registerTool({
			name: "mytool",
			version: "1.0.0",
			downloadUrl: "https://example.com/mytool.zip",
			description: "Custom tool",
		});
	}

	private async registerTasks() {
		await this.api.registerTaskTemplate(
			"custom-scan",
			"Custom Scan",
			"Run custom security check",
			{
				commands: [
					'echo "<<<RESULT_START>>>"',
					"tool:{mytool} {{TARGET_DOMAIN}}",
					'echo "<<<RESULT_END>>>"',
				],
				requiredTools: [
					{
						/* tool definition */
					},
				],
				extractResult: true,
			},
			3600, // 1 hour
			"TARGET_BASED",
			(result) => this.handleResult(result)
		);
	}

	private subscribeToEvents() {
		this.api.events.subscribe("http:js", async (event) => {
			// Analyze JavaScript
		});
	}

	private handleResult(result: TaskResult) {
		if (!result.success) return;

		// Parse result
		const findings = JSON.parse(result.extractedResult || "[]");

		// Store in module storage
		findings.forEach((f) => {
			this.api.storage.execute(
				"INSERT INTO my_data (url, checked_at) VALUES (?, ?)",
				[f.url, new Date().toISOString()]
			);
		});

		// Create alerts for high-severity findings
		findings
			.filter((f) => f.severity === "high")
			.forEach((f) => {
				this.api.createAlert(
					f.title,
					f.subdomain,
					3, // High
					f.description,
					f.endpoint
				);
			});
	}

	async stop() {
		this.api.logger.info("MyModule stopping...");
	}
}
```

#### 4. Build and Deploy

```bash
# Build TypeScript
npm run build

# Copy to server modules directory
cp -r . ../server/modules/my-module

# Restart server
cd ../server
npm run dev
```

#### 5. Verify

- View in webapp: Modules page should show your module
- Configure settings if needed
- Monitor task executions and alerts

---

## Advanced Patterns

### Dynamic Task Scheduling

Use CUSTOM scheduling for optimized, conditional task creation:

```typescript
// Register template with CUSTOM scheduling
const templateId = await api.registerTaskTemplate(
	"optimized-scan",
	"Optimized Scan",
	"Batched scan by hostname",
	{
		commands: ["tool:{scanner} {{HOSTNAMES}}"],
	},
	3600, // Callback invoked every hour
	"CUSTOM",
	async (templateId) => {
		// Called every hour - analyze and create optimized instances
		const targets = await getActiveTargets();
		const grouped = groupByHostname(targets);

		for (const [hostname, targetIds] of grouped) {
			await api.createTaskInstance(templateId, targetIds[0], {
				HOSTNAMES: targetIds.map((id) => getTargetDomain(id)).join(","),
				TARGET_IDS: targetIds.join(","),
			});
		}
	}
);
```

### Event-Driven Scans (Manual-Only CUSTOM Mode)

For purely event-driven scans, use CUSTOM mode with `interval <= 0` to disable automatic scheduling:

```typescript
// Register template in manual-only mode (no automatic scheduling)
const scanTemplateId = await api.registerTaskTemplate(
	"event-scan",
	"Event-Driven Scan",
	"Scan triggered by discovered endpoints",
	{
		commands: ["tool:{scanner} {{ENDPOINT}}"],
		requiredTools: [SCANNER_TOOL],
		extractResult: true,
	},
	0, // interval <= 0: manual mode only, no automatic scheduling
	"CUSTOM",
	(result) => {
		if (result.success && result.output) {
			// Process scan results
			const findings = JSON.parse(result.output);
			findings.forEach((f) => api.createAlert(/* ... */));
		}
	}
);

// Trigger scans manually based on events
api.events.subscribe("http:traffic", async (event) => {
	const { request, response } = event.data;
	// New endpoint discovered
	if (response.status === 200 && !isKnownEndpoint(request.url)) {
		api.logger.info(`New endpoint: ${request.url}`);

		// Create targeted scan instance (executes immediately)
		await api.createTaskInstance(
			scanTemplateId,
			getTargetIdFromUrl(request.url),
			{ ENDPOINT: request.url }
		);
	}
});
```

### Inter-Module Communication

```typescript
// Module A: Subdomain discovery
api.events.emit("subdomains:discovered", {
	targetId: 123,
	subdomains: ["api.example.com", "admin.example.com"],
});

// Module B: Port scanner
api.events.subscribe("subdomains:discovered", async (event) => {
	const { targetId, subdomains } = event.data;
	for (const subdomain of subdomains) {
		await api.createTaskInstance(portScanTemplateId, targetId, {
			HOST: subdomain,
		});
	}
});
```

---

## Troubleshooting

### Module Not Loading

1. Check `module.yml` syntax (valid YAML)
2. Verify `entry` points to compiled JS file
3. Check server logs: `server/logs/latest.txt`
4. Ensure module directory is in `server/modules/`

### Task Not Executing

1. Check template is active: `GET /api/tasks/templates`
2. Verify task scheduling type matches expectations
3. Check worker is running and connected
4. Review worker logs for execution errors
5. Ensure required tools are registered correctly

### Storage Issues

1. Check SQLite file exists: `server/storage/modules/{moduleId}.db`
2. Verify SQL syntax (SQLite dialect)
3. Use `api.logger` to debug queries

### Event Not Received

1. Verify event name matches exactly (case-sensitive)
2. Check subscription is created before event is emitted
3. Use `api.logger` to confirm handler is called
4. Ensure event bus is not cleared prematurely

---

## Best Practices

### Security

- **Never hardcode secrets**: Use module settings for API keys
- **Validate input**: Sanitize data from external sources
- **Limit blast radius**: Use module storage instead of shared DB
- **Rate limiting**: Don't spam external APIs

### Performance

- **Batch operations**: Group database queries
- **Efficient scheduling**: Use CUSTOM mode for optimization
- **Avoid blocking**: Use async/await, don't block event loop
- **Resource cleanup**: Unsubscribe from events in `stop()`

### Reliability

- **Error handling**: Wrap async code in try/catch
- **Idempotency**: Handle duplicate task executions gracefully
- **Logging**: Use `api.logger` extensively
- **Graceful degradation**: Continue on non-critical errors

### Maintainability

- **Type safety**: Leverage TypeScript types from SDK
- **Modular code**: Split logic into separate files
- **Documentation**: Comment complex logic
- **Version control**: Follow semantic versioning

---

## Example: Complete Module

See `/example-module` for a working reference implementation demonstrating:

- ✅ Task registration with TARGET_BASED scheduling
- ✅ Tool registration (subfinder)
- ✅ Module storage initialization
- ✅ Event subscription (http:js)
- ✅ Result processing and alert creation
- ✅ Configuration management
- ✅ Proper lifecycle implementation

---

## Additional Resources

- **SDK Types**: `/sdk/src/types/` - Full type definitions
- **Server Code**: `/server/src/` - Implementation reference
- **Example Module**: `/example-module/` - Working example
- **Database Schema**: `/server/src/db/schema.ts` - Core data structures
- **API Endpoints**: `/server/swagger.yml` - REST API documentation

---

**Last Updated**: December 2025  
**SDK Version**: 1.1.8
**Minimum Server Version**: 1.0.0
