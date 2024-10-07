import { Workflow } from "./types.mjs";
import { Util } from "./types.mjs";
import { Client, Container, Directory } from "./types.mjs";
import {
  ContainerWithBestEffortExec,
  recoverFromWithBestEffort,
} from "../templates/dagger/exitCodeHelpers/withBestEffortExec.mjs";
import path from "path";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dotnetE2ETest, dotnetRestore } from "./dotnet.test.mjs";

export type PlaywrightDotnetWorkflowOpts = {
  module: string;
  targetSln: string;
  projectToPublish: string;
  fileIncludes: string[];
  fileExcludes: string[];
  container?: {
    buildBase: (client: Client, buildResult: Directory) => Container;
    repository: string;
  };
};

export type PlaywrightDotnetWorkflowResult = {
  test: {
    result: Directory;
    success: ContainerWithBestEffortExec;
  };
};

export class PlaywrightDotnetWorkflow extends Workflow<
  PlaywrightDotnetWorkflowOpts,
  PlaywrightDotnetWorkflowResult
> {
  public execute(client: Client): PlaywrightDotnetWorkflowResult {
    // Parse env variables
    // Get source directory
    const sourceDir = Util.getSourceFromHost(client, {
      include: this.opts.fileIncludes,
      exclude: this.opts.fileExcludes,
    });
    const gitDir: Directory = Util.getSourceFromHost(client, {
      include: ["./.git"],
    }).directory(".git");
    // Run dotnet restore
    const restoreResult = dotnetRestore(client, sourceDir, {
      pathToSln: this.opts.targetSln,
    });

    const test = dotnetE2ETest(client, restoreResult, {
      pathToSln: this.opts.targetSln,
    });

    return {
      test,
    };
  }
}

export async function materializeDotnetWorkflowResult(
  opts: PlaywrightDotnetWorkflowOpts,
  result: PlaywrightDotnetWorkflowResult
): Promise<void> {
  const ciDir = path.join(process.cwd(), "..", opts.module, ".ci");
  rmSync(ciDir, { recursive: true, force: true });
  if (!existsSync(ciDir)) {
    mkdirSync(ciDir, { recursive: true });
  }

  // collect outputs
  await Promise.all([
    result.test.result.export(path.join(ciDir, "dotnet-test")),
    recoverFromWithBestEffort(result.test.success)
      .recordedStdErr()
      .export(path.join(ciDir, "dotnet-test/dotnet-test-err.txt")),
    recoverFromWithBestEffort(result.test.success)
      .recordedStdOut()
      .export(path.join(ciDir, "dotnet-test/dotnet-test-out.txt")),
  ]);

  // ensure all non skipped steps have been executed successfully.
  const requiredSteps: PromiseSettledResult<any>[] = await Promise.allSettled([
    recoverFromWithBestEffort(result.test.success).ifSuccessful(),
  ]);

  console.info("Pipeline is happy 🥹");
}
