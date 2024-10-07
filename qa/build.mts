import { Pipeline } from "./types.mjs";
import {
  materializeDotnetWorkflowResult,
  PlaywrightDotnetWorkflow,
} from "./workflow.mjs";
import { Client } from "./types.mjs";

await new Pipeline(async (client: Client) => {
  let QaE2eWorkflow = new PlaywrightDotnetWorkflow({
    module: "./dagger-issue/Test",
    targetSln: "./dagger-issue/Test",
    projectToPublish: "",
    fileIncludes: ["./dagger-issue/Test"],
    fileExcludes: ["**/bin/", "**/obj/", "**/.idea/"],
  });

  const result = QaE2eWorkflow.execute(client);
  await materializeDotnetWorkflowResult(QaE2eWorkflow.opts, result);
}).run();
