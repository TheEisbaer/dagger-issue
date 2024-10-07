import { CallbackFct, connect } from "@dagger.io/dagger";
import type {
  ClientContainerOpts,
  ContainerWithDirectoryOpts,
  ContainerWithMountedDirectoryOpts,
  Client as DaggerClient,
  Container as DaggerContainer,
  Directory as DaggerDirectory,
  Host as DaggerHost,
  HostDirectoryOpts,
  QueryTree,
} from "@dagger.io/dagger";
import events from "node:events";
import path from "node:path";

export type Container = {
  [key in keyof Omit<
    DaggerContainer,
    "with" | "withDirectory" | "withMountedDirectory"
  >]: DaggerContainer[key] extends (...args: infer R) => DaggerContainer
    ? (...args: R) => Container
    : DaggerContainer[key] extends (...args: infer R) => DaggerDirectory
    ? (...args: R) => Directory
    : DaggerContainer[key];
} & {
  with: <T>(arg: (param: Container) => T) => T;
  withDirectory(
    path: string,
    directory: Directory,
    opts?: ContainerWithDirectoryOpts
  ): Container;
  withMountedDirectory(
    path: string,
    source: Directory,
    opts?: ContainerWithMountedDirectoryOpts
  ): Container;
};

export type Client = {
  [key in keyof Omit<
    DaggerClient,
    "host" | "container" | "pipeline"
  >]: DaggerClient[key] extends (...args: infer R) => DaggerContainer
    ? (...args: R) => Container
    : DaggerClient[key];
} & {
  /** @see DaggerClient#host **/
  host: () => Host;
  /** @see DaggerClient#container **/
  container(opts?: ClientContainerOpts): Container;
};

export type Directory = {
  [key in keyof Omit<
    DaggerDirectory,
    "dockerBuild"
  >]: DaggerDirectory[key] extends (...args: infer R) => DaggerDirectory
    ? (...args: R) => Directory
    : DaggerDirectory[key];
} & {
  dockerBuild(...args: Parameters<DaggerDirectory["dockerBuild"]>): Container;
};

export type Host = {
  [key in keyof Omit<DaggerHost, "directory">]: DaggerHost[key];
} & {
  directory(path: string, opts?: HostDirectoryOpts): Directory;
};

export class Pipeline {
  private readonly pipeline: (client: Client) => Promise<void>;

  constructor(pipeline: (client: Client) => Promise<void>) {
    this.pipeline = pipeline;
  }

  public async run(): Promise<void> {
    // due to "Possible EventEmitter memory leak detected. 11 close listeners added to [TLSSocket]. Use emitter.setMaxListeners() to increase limit"
    events.EventEmitter.defaultMaxListeners = 15;
    await connect(this.pipeline as CallbackFct, { LogOutput: process.stdout });
  }
}

export interface HasModule {
  /** The base directory (relative to the sba repository root) of the module to be built by this workflow. */
  module: string;
}

export abstract class Workflow<TOpts extends HasModule, TResult> {
  constructor(public readonly opts: TOpts) {}

  public abstract execute(client: Client): TResult;
}
export class Util {
  public static getSourceFromHost = (
    client: Client,
    directoryOpts: HostDirectoryOpts
  ): Directory =>
    // Get the repository dir from the host
    client.host().directory(path.join(process.cwd(), ".."), directoryOpts);
}

export function resolvePipelineName(qt: QueryTree[]): string {
  return qt
    .filter((q) => q.operation === "pipeline")
    .map((q) => q.args?.["name"])
    .join(":");
}

export function resolveLatestExec(qt: QueryTree[]): string | undefined {
  const args = qt.reverse().find((q) => q.operation === "withExec")?.args;
  return args ? `Container.withExec(${JSON.stringify(args)})` : undefined;
}

export type DotnetTestOpts = {
  pathToSln: string;
  filter?: string;
};

export type DotnetRestoreOpts = {
  pathToSln: string;
};
