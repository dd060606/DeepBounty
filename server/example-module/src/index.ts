import type { ServerAPI, PluginLifecycle } from "@deepbounty/sdk";
import { sendTestRequest } from "./utils";

export default class ExamplePlugin implements PluginLifecycle {
  constructor(private api: ServerAPI) {}

  async run() {
    this.api.logger.info("Example plugin: run");
    // const response = await sendTestRequest();
    // this.api.logger.info(`GitHub API status: ${response.status}`);
    // Example of using the ModuleConfig
    await this.api.config.set("examplePluginLastRun", new Date().toISOString());
    await this.api.config.set("test1234", { a: 1, b: true, c: "string", d: [1, 2, 3] });
    this.api.config.getAll().then((cfg) => {
      this.api.logger.info(`Current config: ${JSON.stringify(cfg)}`);
    });
    this.api.config.get("test1234").then((v) => {
      this.api.logger.info(`Value of test1234: ${JSON.stringify(v.d)}`);
    });
    await this.api.config.remove("test1234");
    await this.api.config.setSetting("feature1", "aaaa");
    const feature2 = await this.api.config.getSetting("feature2");
    this.api.logger.info("Setting feature2: " + JSON.stringify(feature2));
    this.api.config.getAllSettings().then((settings) => {
      for (const s of settings) {
        this.api.logger.info(`Setting: ${s.name} = ${s.value}`);
        this.api.logger.info(` - Default: ${s.default}`);
        this.api.logger.info(` - Type: ${s.type}`);
        this.api.logger.info(` - Label: ${s.label}`);
      }
    });
  }

  async stop() {
    this.api.logger.info("Example plugin: stop");
  }
}
