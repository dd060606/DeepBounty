import type { ServerAPI, PluginLifecycle } from "@deepbounty/sdk";

export default class ExamplePlugin implements PluginLifecycle {
  constructor(private api: ServerAPI) {}

  async run() {
    this.api.logger.info("Example plugin: run");
  }

  async stop() {
    this.api.logger.info("Example plugin: stop");
  }
}
