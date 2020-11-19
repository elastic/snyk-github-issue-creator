# GitHub Issue Creator

[![Known Vulnerabilities](https://snyk.io/test/github/pierre-ernst/snyk-github-issue-creator/badge.svg?targetFile=package.json)](https://snyk.io/test/github/pierre-ernst/snyk-github-issue-creator?targetFile=package.json)

Creates GitHub issues from Snyk Project issues.

## Installation

```bash
$ npm install
$ chmod u+x ./cli/index.js
$ npm link
```

## Usage

```bash
$ snyk-github-issue-creator [options]
```

**Options:**

-   `--help, -h`: Show the help.
-   `--stdin`: Read Synk org/projects from STDIN.
-   `--auto`: Re-use previously saved configuration.

### Setup

When running `snyk-github-issue-creator`, you will be asked a series of
setup questions:

-   **Synk token**: Your Snyk API token which can be found at https://app.snyk.io/account.
-   **Synk organization** and **Snyk project UUIDs**: Either use the guided menus, or use the `--stdin` command line argument to parse the output of a snyk monitor command to retrieve the necessary parameters.
-   **GitHub Personal Access Token**: A _GitHub Personal Access Token_ with privilege to create new issues in the repository specified under _"GitHub Repo"_ (create a new token at https://github.com/settings/tokens/new).
-   **GitHub Owner**: The name of the owner or organization under which the GitHub repository is located.
-   **GitHub Repo**: The name of the GitHub repository where issues should be created.
-   **Project name**: Allows you to overrride the project name from Snyk (useful when runing Snyk with CI/CLI integration).
-   **GitHub Labels**: Labels which will be applied to new issues (the label `Snyk` will always be applied).
-   **Add severity labels to issues**: If specified, the GitHub issue will have severity label(s) added automatically.
-   **Parse manifest name**: If specified, the dependency paths will start with the manifest name instead of the project name.
-   **Batch**: If specified, the selected findings will be combined into a single GitHub issue (see this [example](screenshot-issue-batch.png)).
-   **Auto generate**: If specified, GitHub issues will be automatically generated without a confirmation prompt (e.g. if you want to run this as part of a CI pipeline).
-   **Save settings**: If specified, you can skip these questions the next time you run the program by using the `--auto` command line flag.

### Picking Vulnerabilities

After answering the setup questions, you will be presented with a list
of _high_ and _medium_ vulnerability issues to generate a GitHub issue
for. Type `t` or `true` to create an issue, and `f` or `false` to skip
it.

### Examples

Running the script against this repository will create a set of issues,
as seen here:

![screen shot of a created issue](screenshot-issue-dogfooding.png)
