# Builds with Dagger

We are using the build tool [Dagger](https://dagger.io/).

# Setup

Dagger consists of two parts: The **Dagger CLI**, which we use to execute Dagger builds, and the **Dagger SDK**, which is the language-specific framework used to interact with the Dagger Engine. In our case, this is a npm package, since we write our pipelines in Typescript.

## Prerequisites

- **Docker Desktop** or one of it's alternatives. **Rancher Desktop** works also fine.
- **Node** (tested with version v21.5.0)
- **npm** (tested with version 10.2.4)

## Dagger CLI (Optional)

 > Note: You can safely omit this step. The CLI is only required for fancy progressive cli rendering.

Follow the official instructions on the [Quickstart Guide](https://docs.dagger.io/quickstart/729236/cli) to install the Dagger CLI (make sure to install the correct version - see the pipeline definition / `package.json`).

## Dagger SDK

Open a shell and navigate to `./pipelines` in the sba Monorepo. Run `npm i` to install the Dagger dependencies as specified in the `package.json`. The version installed here must be in tandem with the Dagger CLI version.

# Running Dagger

## Example: Build shared-components

All pipelines are executed from the `./pipelines` directory. Right now, only the shared-components application is implemented in Dagger. The base command for executing the pipeline is as follows:

`dagger run node --import=@septh/ts-run shared-components/build.mts`

OR run it without the CLI (a slightly different ux):

`node --import=@septh/ts-run shared-components/build.mts`

### Scope

The Dagger pipeline currently executes tests, static code analysis, publishing the Docker image, etc.

## Login to Azure Container Registry (ACR)

To be able to pull images from `sbadev.azurecr.io/cached/*` and avoid rate limiting from e.g. docker.io you have to login to acr locally, otherwise you are getting `ImagePullBackoff` Errors:

```bash
az acr login -n sbadev
```


## Environment Variables

Build-Time variables, such as image names or secrets used for third-party services, are expected by the pipeline to be set via environment variables. The pipeline feeds the variables into the command like so:

```bash
  DAGGER_SKIP_TARGETS="prettier,dotnetformat,sonarscan,snyk-code,snyk-container,snyk-oss,publish" \
  DAGGER_SONAR_TOKEN=$(SONAR_TOKEN) \
  DAGGER_SNYK_TOKEN=$(SNYK_TOKEN) \
  DAGGER_BRANCH_NAME=$(Build.SourceBranch) \
  DAGGER_OCI_TAGS=main-$(Build.BuildId) \
  DAGGER_BUILD_REASON=$(Build.Reason) \
  DAGGER_PULL_REQUEST_ID=$(System.PullRequest.PullRequestId) \
  dagger run node --import=@septh/ts-run shared-components/build.mts
```

How you set them and which ones you set is up to you. You could alternatively use `.env` files or a similar approach.

### Skipping targets

As you can see in the example above, there is a variable named `DAGGER_SKIP_TARGETS`, which allows you to run only specific build steps (for example, you may not want to run Sonar Scan from your local machine or may not have a token required for it). Refer to the individual build step's code module to see the values that can be specified here.

# CI Integration

The Dagger CLI is called from our classic yaml files in the pipeline.

# Motivation

## Locally Reproducible

Dagger runs all pipelines inside Docker containers, meaning every single build step can be fully reproduced and executed locally. This means developers no longer have to "push and pray" to see if their changes pass the pipeline.

## Cached Build Layers

Like in Dockerfiles, every single line of our build steps gets cached and only executed if something actually changes. This can lead to very fast builds (<10s) even with highly complex build pipelines. Dagger achieves this by using Buildkit, the same technology used for building Dockerfiles.

## Parallel Execution

Dagger executes as many build steps as possible in parallel. In order to achieve this, dagger builds a directed, acyclic graph (DAG) to figure out which build steps depend on which other steps.

## Pipelines as Code

The classic yaml files often come to their limits when it comes to language capabilities, especially in control flow. While conditions and loops can be used, they are hard to read and prone to errors. The files are also hard to lint / check automatically, and often times small adjustments need to be made repeatedly until the pipeline finally works.

With Dagger, we are switching our pipeline language to Typescript, which gives us the ability to use the full power of the language, including linting and other means of static analysis.

# Caveats

Currently, there are a couple downsides to our Dagger implementation. Some of them are fixable - either by us or by the Dagger devs - in the future. Some others inherently come with switching to Dagger / switching away from "native" yaml pipelines.

## Complex Syntax

Compared to classic yaml pipelines, Dagger pipelines written in Typescript can be a bit intimidating at first. We can counteract this by offloading code into modules, making it reusable, and essentially write our pipelines like we would write any other piece of code: keeping Clean Code principles in mind, writing documentation and so on.

## Sensitive to small changes / caching breaks easily

It can be quite difficult to grasp the concepts of Dagger at first, specifically how the caching works and under what circumstances the cache gets invalidated (eg. build steps need to be re-executed). This gets alleviated over time as our experience with Dagger grows and Dagger itself receives better documentation.

## "Early Adopters" / lack of documentation

Dagger is still quite new and the documentation often incomplete. Breaking changes are still introduced regularly. We are confident that this situation will improve over time - in the meantime, it is important that we pin the versions of both the Dagger CLI and the Dagger SDK in the pipeline to ensure our builds are reproducible by everyone.
