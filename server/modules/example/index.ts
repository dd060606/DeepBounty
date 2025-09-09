import type { ServerAPI } from "../../sdk/index.js";

export default class ExamplePlugin {
  constructor(private api: ServerAPI) {}

  async run() {
    this.api.logger.info("Example plugin: run");
  }

  async stop() {
    this.api.logger.info("Example plugin: stop");
  }
}
