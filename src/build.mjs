import { connect } from "@dagger.io/dagger";

connect(
  async (client) => {
    const buildEnv = (source) => {
      const nugetCache = client.cacheVolume("nuget-cache");

      return client
        .container()
        .from(
          "mcr.microsoft.com/playwright/dotnet:v1.47.0-jammy@sha256:57228e0751b744c58ba2cd829906cb5cd560cdb8825ec3cab430717339350295"
        )
        .withDirectory("/src", source)
        .withMountedCache("/src/.nuget-cache", nugetCache)
        .withWorkdir("/src")
        .withExec(["dotnet", "restore", "--packages", ".nuget-cache"]);
    };

    const test = async (source) => {
      return buildEnv(source)
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
    };

    const source = client.host().directory("./Test");

    const output = await test(source);

    console.log(output);
  },
  { LogOutput: process.stdout }
);
