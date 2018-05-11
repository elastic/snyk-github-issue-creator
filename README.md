# Jira Issue Creator

Creates Jira issues from Snyk Project issues

## Prerequisites

To use this tool you must first set an environment variable `SNYK_TOKEN` with
your API key, as found at https://snyk.io/account.

## Installation

You can install this globally by running:

```bash
npm install -g @snyk/jira-issue-creator
```

This will make the tool available by running:

```bash
snyk-jira-issue-creator
```

## Usage

The simplest way to use this is in guided mode, by running:

```bash
snyk-jira-issue-creator
```

Alternatively, you can specify the org, project, Jira project,
Jira issue type and Jira URL upfront by running with command line arguments:

```bash
snyk-jira-issue-creator --orgId=<orgId> --projectId=<projectId> --jiraProjectId=<jiraProjectId> --jiraIssueTypeId=<jiraIssueTypeId> --jiraUrl=https://<subdomain>.atlassian.net
```

You will be presented with a list of vulnerability & license issues to
generate a Jira issue for. Type `t` or `true` to create an issue,
and `f` or `false` to skip it.
