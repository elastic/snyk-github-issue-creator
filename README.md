# Jira Issue Creator

Creates Jira issues from Snyk Project issues.

> Note: This module is a proof of concept for how you can use the Snyk Jira integration via the API. We hope to roll the findings from this module into the Snyk CLI eventually, so consider this a work in progress.

## Prerequisites

To use this tool you must first set an environment variable `SNYK_TOKEN` with
your API key, as found at https://snyk.io/account.

## Installation

You can install this globally by running:

```bash
npm install -g @snyk/jira-issue-creator
```

You can find usage instructions by running:

```bash
snyk-jira-issue-creator --help
```

## Usage

```bash
snyk-jira-issue-creator --orgId=<orgId> --projectId=<projectId> --jiraProjectId=<jiraProjectId> --jiraIssueTypeId=<jiraIssueTypeId> --jiraUrl=https://<subdomain>.atlassian.net
```

- You can retrieve your orgId from your org settings page on [Snyk](https://snyk.io) or via the [Snyk API](https://snyk.docs.apiary.io/#reference/organisations/the-snyk-organisation-for-a-request/list-all-the-organisations-a-user-belongs-to).
- The projectId is available via the [Snyk API](https://snyk.docs.apiary.io/#reference/projects/projects-by-organisation/list-all-projects).
- Both the jiraProjectId and jiraIssueTypeId can be found via the Jira API
- The Jira URL is the domain you see when you visit your Jira install.

You will be presented with a list of vulnerability & license issues to
generate a Jira issue for. Type `t` or `true` to create an issue,
and `f` or `false` to skip it.

### Including existing issues

If you want to create multiple Jira issues for the same issue, include the flag `--includeExisting` and you will be presented with
existing issues.

### Auto generating Jira issues

If you wish to automatically generate Jira issues (e.g. if you want to run this as part of a CI pipeline), enter the flag `--autoGenerate`.
