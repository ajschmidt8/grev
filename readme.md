# Grev

Grev (_gee-rev_, short for _git review_) is a command line utility that streamlines the process of submitting a code review at Recovery Brands. It integrates with JIRA, GitHub, and Slack to transition JIRA task statuses, open a GitHub PR, and notify peer code-reviewers in Slack. Additionally, it contains conveinence features like automatically inserting the JIRA task link in the GitHub PR body and inserting the GitHub PR link in the JIRA task's comment section. Grev works by utilizing each of the previously mentioned services' APIs with the help of InquirerJS for collecting input from the user.

## How It Works

_As of right now, grev is only designed to work for Recovery Brands. You can fork this repo and edit [config.js](config.js) to make it work for your own company. You will also need to make sure your JIRA transition IDs are configured accordingly._

`grev` uses [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) to prompt the user for input and perform the following actions:

1. Prompts the user for whether they would like to submit a pull-request (PR) to the source repo or a fork (gets available forks via GitHub API).
2. Prompts the user for the base branch (gets available branches via GitHub API).
3. Opens up browser to allow for code changes to be reviewed against base branch.
4. Prompts user for whether or not they would like to proceed after viewing changes. If yes, `grev` continues. If no, `grev` exits.
5. Opens up user's default code editor (as configured in next section) so they can enter PR body (in markdown format) for GitHub. The code editor will already have inserted a link to the JIRA task for convenience. `grev` will continue once code editor is closed.
6. Submits the PR to GitHub and posts the PR link in both the terminal window and as a comment in the JIRA task.
7. Prompts the user for whether they would like to transition the JIRA task status to _In Review_.
8. Prompts the user for which co-workers in Slack they would like to notifiy about the PR (pulls users via Slack API).
9. Posts a link to the GitHub PR in the `frontend-prs` Slack channel and tags the users specified in the previous step.

## Installation and Use

Grev should be installed as a global npm package:

```javascript
npm install -g grev
```

or

```javascript
yarn global add grev
```

Before you can run the tool, you'll need to make sure you have the following entries added to your global `.gitconfig` file (should be located @ `/Users/USERNAME/.gitconfig`):

```
[github]
    key = YOUR_GITHUB_API_KEY
    self = YOUR_GITHUB_USERNAME
[jira]
    key = YOUR_JIRA_API_KEY
    self = YOUR_JIRA_USERNAME
[slack]
    key = YOUR_SLACK_API_KEY
[core]
    editor = code --wait
```

After the initial installation and configuration, you're all set to use grev. You'll need to make sure your current working directory is inside of one of RB's site folders and the branch name corresponds with the JIRA task you are working on (i.e. `FE-192`). As long are those requirements are met, you can simply run the following command to initiate grev:

```bash
grev
```
