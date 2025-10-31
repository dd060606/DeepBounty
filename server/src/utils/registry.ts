import { LoadedModule, ScheduledTask, TaskExecution, Tool } from "@deepbounty/sdk/types";

/**
 * Global server registry
 * Manages all loaded modules, scheduled tasks, and task executions
 */
class ServerRegistry {
  private static instance: ServerRegistry | null = null;

  // Modules by id
  private modules: Map<string, LoadedModule> = new Map();

  // Tools by name (key: toolName)
  private tools: Map<string, Tool> = new Map();

  // Scheduled tasks by id (task templates)
  private scheduledTasks: Map<number, ScheduledTask> = new Map();

  // Task executions by execution id (active/completed task instances)
  private taskExecutions: Map<number, TaskExecution> = new Map();

  // Task ID counter
  private nextTaskId: number = 1;

  // Execution ID counter
  private nextExecutionId: number = 1;

  private constructor() {}

  // Return the singleton instance
  public static getRegistry(): ServerRegistry {
    if (!ServerRegistry.instance) {
      ServerRegistry.instance = new ServerRegistry();
    }
    return ServerRegistry.instance;
  }

  // ==================== MODULES ====================

  // Register a module
  public registerModule(module: LoadedModule): void {
    this.modules.set(module.id, module);
  }

  // Get all loaded modules
  public getLoadedModules(): LoadedModule[] {
    return Array.from(this.modules.values());
  }

  // Get a specific module by id
  public getModule(id: string): LoadedModule | undefined {
    return this.modules.get(id);
  }

  // Unregister a module
  public unregisterModule(id: string): void {
    this.modules.delete(id);
  }

  // Check if a module is registered
  public hasModule(id: string): boolean {
    return this.modules.has(id);
  }

  // Get the count of registered modules
  public moduleCount(): number {
    return this.modules.size;
  }

  // ==================== TOOLS ====================

  // Register a tool
  public registerTool(tool: Tool): void {
    this.tools.set(`${tool.name}@${tool.version}`, tool);
  }

  // Get a tool by name and version
  public getTool(name: string, version: string): Tool | undefined {
    return this.tools.get(`${name}@${version}`);
  }

  // Get all registered tools
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  // Check if a tool is registered
  public hasTool(name: string, version: string): boolean {
    return this.tools.has(`${name}@${version}`);
  }

  // Find tools by identifiers (toolname@version)
  public findTools(toolIdentifiers: string[]): Tool[] {
    return toolIdentifiers
      .map((id) => this.tools.get(id))
      .filter((tool) => tool !== undefined) as Tool[];
  }

  // ==================== SCHEDULED TASKS ====================

  // Generate next task ID
  public generateTaskId(): number {
    return this.nextTaskId++;
  }

  // Register a scheduled task
  public registerScheduledTask(task: ScheduledTask): void {
    this.scheduledTasks.set(task.id, task);
  }

  // Get a scheduled task by id
  public getScheduledTask(id: number): ScheduledTask | undefined {
    return this.scheduledTasks.get(id);
  }

  // Get all scheduled tasks
  public getAllScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  // Get scheduled tasks by module id
  public getScheduledTasksByModule(moduleId: string): ScheduledTask[] {
    return this.getAllScheduledTasks().filter((task) => task.moduleId === moduleId);
  }

  // Update a scheduled task
  public updateScheduledTask(id: number, updates: Partial<ScheduledTask>): void {
    const task = this.scheduledTasks.get(id);
    if (task) {
      Object.assign(task, updates);
    }
  }

  // Delete a scheduled task
  public deleteScheduledTask(id: number): void {
    this.scheduledTasks.delete(id);
  }

  // Check if a scheduled task exists
  public hasScheduledTask(id: number): boolean {
    return this.scheduledTasks.has(id);
  }

  // Get scheduled tasks that are due for execution
  public getDueScheduledTasks(): ScheduledTask[] {
    const now = new Date();
    return this.getAllScheduledTasks().filter((task) => task.nextExecutionAt <= now);
  }

  // ==================== TASK EXECUTIONS ====================

  // Generate next execution ID
  public generateExecutionId(): number {
    return this.nextExecutionId++;
  }

  // Register a task execution
  public registerTaskExecution(execution: TaskExecution): void {
    this.taskExecutions.set(execution.executionId, execution);
  }

  // Get a task execution by id
  public getTaskExecution(executionId: number): TaskExecution | undefined {
    return this.taskExecutions.get(executionId);
  }

  // Get all task executions
  public getAllTaskExecutions(): TaskExecution[] {
    return Array.from(this.taskExecutions.values());
  }

  // Get task executions by status
  public getTaskExecutionsByStatus(status: TaskExecution["status"]): TaskExecution[] {
    return this.getAllTaskExecutions().filter((execution) => execution.status === status);
  }

  // Get task executions by worker id
  public getTaskExecutionsByWorkerId(workerId: number): TaskExecution[] {
    return this.getAllTaskExecutions().filter((execution) => execution.workerId === workerId);
  }

  // Get task executions by scheduled task id
  public getTaskExecutionsByScheduledTask(scheduledTaskId: number): TaskExecution[] {
    return this.getAllTaskExecutions().filter(
      (execution) => execution.scheduledTaskId === scheduledTaskId
    );
  }

  // Update a task execution
  public updateTaskExecution(executionId: number, updates: Partial<TaskExecution>): void {
    const execution = this.taskExecutions.get(executionId);
    if (execution) {
      Object.assign(execution, updates);
    }
  }

  // Delete a task execution
  public deleteTaskExecution(executionId: number): void {
    this.taskExecutions.delete(executionId);
  }

  // Clear old completed/failed executions
  public clearOldExecutions(olderThan: Date) {
    this.taskExecutions.forEach((execution, id) => {
      if (
        (execution.status === "completed" || execution.status === "failed") &&
        execution.createdAt < olderThan
      ) {
        this.taskExecutions.delete(id);
      }
    });
  }
}

export default ServerRegistry.getRegistry;
