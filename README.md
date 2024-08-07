# GitHub Issue Creator

[![Known Vulnerabilities](https://snyk.io/test/github/elastic/snyk-github-issue-creator/badge.svg?targetFile=package.json)](https://snyk.io/test/github/elastic/snyk-github-issue-creator?targetFile=package.json)

A CLI for creating GitHub issues based on vulnerabilities from your Snyk
projects.

## Installation

You can either install the package globally and then run it:

```
$ npm install --global @elastic/snyk-github-issue-creator
$ snyk-github-issue-creator --help
```

Or you can use `npx` to run it without having to install it globally
first:

```
$ npx @elastic/snyk-github-issue-creator --help
```

Note: The usage examples used in the rest of this documentation expects
that you have installed the package globally.

## Usage

```bash
$ snyk-github-issue-creator [options]
```

**Normal options:**

-   `--yes, -y`: Re-use previously saved configuration without asking.
-   `--help, -h`: Show the help.
-   `--version, -v`: Show release version.

**Advanced options:**

-   `--snykOrg=...`: The Snyk Organization UUID.
-   `--snykProjects=...`: A comma-separated list of Snyk project UUIDs.
-   `--ghOwner=...`: The name of the owner or organization under which
    the GitHub repository is located.
-   `--ghRepo=...`: The name of the GitHub repository where issues
    should be created.
-   `--projectName=...`: Alternative Snyk project name (optional).
-   `--ghLabels=...`: A comma-separated list of GitHub labels which will
    be applied to new issues. The label "snyk" will always be applied
    (optional).
-   `--severityLabel, --no-severityLabel`: If specified, the GitHub
    issue will have severity label(s) added automatically. Default: Yes.
-   `--parseManifestName, --no-parseManifestName`: If specified, the
    dependency paths will start with the manifest name instead of the
    project name. Default: Yes.
-   `--batch, --no-batch`: If specified, the selected findings will be
    combined into a single GitHub issue. Default: Yes.
-   `--minimumSeverity`: If specified, vulnerabilities will only be
    displayed if they meet the minimum severity level. Valid options are
    'low', 'medium', 'high', or 'critical'. Default: 'medium'.
-   `--sortByPackageName`, `--no-sortByPackageName`: If specified, Snyk
    vulnerabilities will be sorted by package name when listing all
    vulnerabilities in batch mode. Default: Sort by severity.
-   `--autoGenerate, --no-autoGenerate`: If specified, GitHub issues
    will be automatically generated without a confirmation prompt. Default: No.
-   `--dryRun`: Do not create any GitHub issues or labels.
-   `--stdin`: Read Snyk Organization UUID and Snyk Project UUID from
    STDIN. Used instead of `--snykOrg` / `--snykProjects`.

**Supported Environment Variables:**

-   `SNYK_TOKEN`: The Snyk API token.
-   `GH_PAT`: The GitHub Personal Access Token.

### Setup

When running `snyk-github-issue-creator`, you will be asked a series of
setup questions:

-   **Synk token**: Your Snyk API token which can be found at
    https://app.snyk.io/account.
-   **Synk organization** and **Snyk project UUIDs**: Either use the
    guided menus, or use the `--stdin` command line argument to parse
    the output of a snyk monitor command to retrieve the necessary
    parameters.
-   **GitHub Personal Access Token**: A _GitHub Personal Access Token_
    with privilege to create new issues in the repository specified
    under _"GitHub Repo"_ (create a new token at
    https://github.com/settings/personal-access-tokens/new). The minimum fine-grained access token configuration is:
       - Resource owner: owner of the repository specified
    under _"GitHub Repo"_
       - Repository access: Only selected repositories -> repository specified
    under _"GitHub Repo"_
       - Permissions -> Repository Permissions -> Issues: Read and write
       - Permissions -> Repository Permissions -> Metadata: Read-only
-   **GitHub Owner**: The name of the owner or organization under which
    the GitHub repository is located.
-   **GitHub Repo**: The name of the GitHub repository where issues
    should be created.
-   **Project name**: Allows you to overrride the project name from Snyk
    (useful when runing Snyk with CI/CLI integration).
-   **GitHub Labels**: Labels which will be applied to new issues (the
    label `snyk` will always be applied).
-   **Add severity labels to issues**: If specified, the GitHub issue
    will have severity label(s) added automatically.
-   **Parse manifest name**: If specified, the dependency paths will
    start with the manifest name instead of the project name.
-   **Batch**: If specified, the selected findings will be combined into
    a single GitHub issue (see this
    [example](screenshot-issue-batch.png)).
-   **Minimum severity level**: Vulnerabilities will only be displayed if
    they meet the minimum severity level. Valid options are 'low',
    'medium', or 'high'.
-   **Sort vulnerabilites by package name instead of severity**: If specified,
    Snyk vulnerabilities will be sorted by package name when listing all
    vulnerabilities in batch mode. Default: Sort by severity.
-   **Auto generate**: If specified, GitHub issues will be automatically
    generated without a confirmation prompt (e.g. if you want to run
    this as part of a CI pipeline).
-   **Save settings**: If specified, you can skip these questions the
    next time you run the program by using the `--yes` command line
    flag.

### Non-interactive mode

It's possible to run `snyk-github-issue-creator` in non-interative mode, i.e.
without being prompted for any input on the command line. This is useful when
running the tool as part of an automatic process, e.g. CI.

To run non-interactive, you must specify all required config options either via
a config file, via command line arguments/environment variables, or a
combination of these. It's also required that you set the `--autoGenerate`
flag.

Example with minimum number of required arguments:

```sh
$ export SNYK_TOKEN=...
$ export GH_PAT=...
$ snyk-github-issue-creator \
    --yes \
    --autoGenerate \
    --snykOrg=myOrg \
    --snykProjects=foo,bar \
    --ghOwner=myGitHubOrg \
    --ghRepo=myGitHubRepo
```

#### Limitations

Batch mode is not supported in non-interactive mode. So either explicitly set
`--no-batch` or ensure `--batch` isn't set.

### Picking Vulnerabilities

After answering the setup questions, you will be presented with a list of
vulnerabilities to generate a GitHub issue for. Type `t` or `true` to
create an issue, and `f` or `false` to skip it.

### Examples

Running the script against this repository will create a set of issues,
as seen here:

![screen shot of a created issue](screenshot-issue-dogfooding.png)
