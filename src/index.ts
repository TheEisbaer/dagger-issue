import { dag, Container, Directory, object, func } from "@dagger.io/dagger";

@object()
class Pipelines {
  @func()
  buildEnv(source: Directory): Container {
    const nugetCache = dag.cacheVolume("nuget-cache");

    return dag
      .container()
      .from(
        "mcr.microsoft.com/playwright/dotnet:v1.47.0-jammy@sha256:57228e0751b744c58ba2cd829906cb5cd560cdb8825ec3cab430717339350295"
      )
      .withDirectory("/src", source)
      .withMountedCache("/src/.nuget-cache", nugetCache)
      .withWorkdir("/src")
      .withExec(["dotnet", "restore", "--packages", ".nuget-cache"]);
  }

  @func()
  async test(source: Directory): Promise<string> {
    return this.buildEnv(source)
      .withExec(["mkdir", "-p", "/out"])
      .withExec([
        "dotnet",
        "test",
        "-c",
        "Release",
        "--no-restore",
        "--results-directory",
        "/out",
        "--logger",
        "trx",
      ])
      .stdout();
  }
}
