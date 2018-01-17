# Grev

Grev (_gee-rev_, short for _git review_) is a command line utility that streamlines the process of submitting a code review at Recovery Brands. It integrates with JIRA, GitHub, and Slack to transition JIRA task statuses, open a GitHub PR, and notify peer code-reviewers in Slack. Additionally, it contains conveinence features like automatically inserting the JIRA task link in the GitHub PR body and inserting the GitHub PR link in the JIRA task's comment section. Grev works by utilizing each of the previously mentioned services' APIs with the help of InquirerJS for collecting input from the user.

## How It Works

_As of right now, grev is only designed to work for Recovery Brands. You can fork this repo and edit [config.js](config.js) to make it work for your own company. You will also need to make sure your JIRA transition IDs are configured accordingly._

Grev starts by identifying the name of the current repository you are working on. It then prompts the user for whose repo (i.e. _referralsolutionsgroup_'s or someone's fork) they would like to submit a pull-request (PR) to. Next, it prompts the user to select a base branch for the PR (this branch list is populated by using the previously selected repo and GitHub's API). Next, grev will open up your preferred code editor (specified in your global `.gitconfig` file, described in following section) where you can enter the text for your PR. The code editor will already have inserted a link to the JIRA task for convenience. When the code editor is closed, grev will submit the PR to GitHub, post the link in the terminal, and comment the JIRA task with the GitHub PR link. Next, grev will ask the user if they would like to transition the JIRA task to _In Review_. Then, grev will ask which members you would like to notify about the PR in Slack (pulled from the `prsChannelId` value in [config.js](config.js) via Slack API). Finally, grev notifies those members in Slack.

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