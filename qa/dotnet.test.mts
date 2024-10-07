import { Client, Directory } from "./types.mjs";
import {
  ContainerWithBestEffortExec,
  withBestEffortExec,
} from "../templates/dagger/exitCodeHelpers/withBestEffortExec.mjs";
import { DotnetRestoreOpts, DotnetTestOpts } from "./types.mjs";

/**
 *  Runs dotnet restore on the supplied solution and returns the entire source directory.
 */
export function dotnetRestore(
  client: Client,
  directory: Directory,
  opts: DotnetRestoreOpts
): Directory {
  return client
    .container()
    .from(
      "mcr.microsoft.com/playwright/dotnet:v1.47.0-jammy@sha256:57228e0751b744c58ba2cd829906cb5cd560cdb8825ec3cab430717339350295"
    )
    .withDirectory("/src", directory)
    .withMountedCache("/src/.nuget-cache", client.cacheVolume("nuget-cache"))
    .withWorkdir("/src")
    .withExec([
      "dotnet",
      "restore",
      "--packages",
      ".nuget-cache",
      opts.pathToSln,
    ])
    .directory("/src");
}

/**
 * Runs dotnet test against the supplied solution. the test result should go to .ci/dotnet-test
 * @return a directory containing the test results and a file containing the exit code
 */
export function dotnetE2ETest(
  client: Client,
  directory: Directory,
  opts: DotnetTestOpts
): { result: Directory; success: ContainerWithBestEffortExec } {
  const success: ContainerWithBestEffortExec = client
    .container()
    .from(
      "mcr.microsoft.com/playwright/dotnet:v1.47.0-jammy@sha256:57228e0751b744c58ba2cd829906cb5cd560cdb8825ec3cab430717339350295"
    )
    .withDirectory("/src", directory)
    .withMountedCache("/src/.nuget-cache", client.cacheVolume("nuget-cache"))
    .withWorkdir("/src")
    .withExec(["mkdir", "-p", "/out"])
    .withEnvVariable("CACHEBUSTER", Date.now().toString())
    .with(
      withBestEffortExec([
        "dotnet",
        "test",
        "-c",
        "Release",
        "--no-restore",
        "--results-directory",
        "/out",
        "--logger",
        "trx",
        opts.pathToSln,
      ])
    );
  const result = success.directory("/out");
  return { result, success };
}
