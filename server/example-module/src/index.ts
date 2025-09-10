import type { ServerAPI, PluginLifecycle } from "@deepbounty/sdk";
import { sendTestRequest } from "./utils";

export default class ExamplePlugin implements PluginLifecycle {
  constructor(private api: ServerAPI) {}

  async run() {
    this.api.logger.info("Example plugin: run");
    const response = await sendTestRequest();
    this.api.logger.info(`GitHub API status: ${response.status}`);
  }

  async stop() {
    this.api.logger.info("Example plugin: stop");
  }
}
