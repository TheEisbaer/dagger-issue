import { ContainerWithExecOpts, File } from "@dagger.io/dagger";
import {
  resolveLatestExec,
  resolvePipelineName,
  Container,
  Directory,
} from "../../../qa/types.mjs";

const exitCodeFile = "/tmp/exit_code";
const lastCommandFile = "/tmp/last_command";
const stdErrFile = "/tmp/stderr";
const stdOutFile = "/tmp/stdout";

declare const tags: unique symbol;

/**
 * A Container that had an withExec that would write its stderr to /tmp/stderr
 * and its recent exit code to /tmp/exit_code
 */
export type ContainerWithBestEffortExec = {
  [tags]: { ContainerWithBestEffortExec: void };
  withExec: (
    args: string[],
    opts?: ContainerWithExecOpts
  ) => ContainerWithBestEffortExec;
} & Container;

/**
 * Execute in a subshell: This 'workaround' is needed to reliably ignore the exit code but make it accessible.
 * Ignores the containers entrypoint.
 */
export function withBestEffortExec(
  args: string[],
  opts: ContainerWithExecOpts | undefined = undefined
): (c: Container) => ContainerWithBestEffortExec {
  const command = args.join(" ");

  const mergedOps: ContainerWithExecOpts = {
    ...(opts || {}),
    redirectStderr: stdErrFile,
    redirectStdout: stdOutFile,
  };
  const cmd = [
    "sh",
    "-c",
    `BEST_EFFORT_CMD='${command}'; eval $BEST_EFFORT_CMD; echo -n $? > ${exitCodeFile}; echo -n $\{BEST_EFFORT_CMD\} > ${lastCommandFile}`,
  ];
  return (c) => c.withExec(cmd, mergedOps) as ContainerWithBestEffortExec;
}

/**
 * Wraps a given ContainerWithBestEffortExec into an object that provides access
 * to files and directoreis
 */
export function recoverFromWithBestEffort(
  c: ContainerWithBestEffortExec
): PossiblyFailedExecContainer {
  return new PossiblyFailedExecContainerImpl(c);
}

export interface PossiblyFailedExecContainer {
  /**
   * Returns a promise of the successful container.
   * Rejects the promise if the exec was not executed correctly.
   * The Rejection tries to imitate the rejection that would be fired as if the exec was synced without error handling.
   **/
  ifSuccessful(): Promise<Container>;

  /**
   * Retrieves a file at the given path that should exist even if the exec failed.
   * @see Container#file
   */
  file(path: string): File;

  /**
   * Retrieves a directory at the given that should exist even if the exec failed.
   * @see Container#directory
   */
  directory(path: string): Directory;
  exitCode(): Promise<number>;
  recordedStdOut(): File;
  recordedStdErr(): File;
}

class PossiblyFailedExecContainerImpl implements PossiblyFailedExecContainer {
  public constructor(private readonly source: ContainerWithBestEffortExec) {}

  async exitCode(): Promise<number> {
    const exitCodeFileContent = await this.source.file(exitCodeFile).contents();
    return Number.parseInt(exitCodeFileContent.trim());
  }

  async ifSuccessful(): Promise<Container> {
    const exitCode = await this.exitCode();
    if (exitCode == 0) {
      return this.source;
    } else {
      const stdErrContent = await this.recordedStdErr().contents();
      const stdOutContent = await this.recordedStdOut().contents();

      const pipelineName = resolvePipelineName(this.source.queryTree);
      const exec = resolveLatestExec(this.source.queryTree);
      throw new Error(
        "Pipeline " +
          pipelineName +
          " at " +
          exec +
          " was not successful:\n----\n" +
          stdErrContent +
          "\n" +
          stdOutContent +
          "----\n"
      );
    }
  }

  file(path: string): File {
    return this.source.file(path);
  }

  directory(path: string): Directory {
    return this.source.directory(path);
  }

  recordedStdErr(): File {
    return this.source.file(stdErrFile);
  }
  recordedStdOut(): File {
    return this.source.file(stdOutFile);
  }
}
