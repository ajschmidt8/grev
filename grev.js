#!/usr/bin/env node

// Imports
const chalk = require('chalk');
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
const tmp = require('tmp');
const { execSync } = require('child_process');
const fs = require('fs');
const getRepoName = require('git-repo-name');
const querystring = require('querystring');
const apis = require('./endpoints');
const config = require('./config');
const helpers = require('./helpers');

// Variable Setup
let prUrlLink;
let prOwnerRepo;
// Shortcut for chalk logging.
const log = console.log;
// Gets current branch name
const currentTask = require('git-rev-sync').branch();
// Repo name
const currentRepo = getRepoName.sync();
// Temp file for markdown
const tempFile = tmp.fileSync({
	postfix: '.md',
});


log(chalk.bold.underline('\nFollow the prompts to submit a PR.\n'))

helpers.getForksData(currentRepo)
.then(response => {
	const frontendTeamMembers = response[0].data;
	const haveForkedMembers = response[1].data;
	const formattedForkChoices = helpers.formatForkChoices(frontendTeamMembers, haveForkedMembers);

	return inquirer.prompt({
		type: 'autocomplete',
		name: 'prUserSelection',
		message: 'Choose whose repo you would like to submit the PR to:',
		source: (answers, input) => Promise.resolve().then(() => helpers.searchForks(input, formattedForkChoices)),
	})
})
.then(response => {
	prOwnerRepo = response.prUserSelection;
	return apis.github.get(`/repos/${prOwnerRepo}/${currentRepo}/branches`);
})
.then(response => {
	const prOwnersBranches = response.data.map((branch) => {
		return branch.name;
	});

	return inquirer.prompt({
		type: 'autocomplete',
		name: 'prOwnerBaseBranch',
		message: 'Choose a base branch:',
		source: (answers, input) => Promise.resolve().then(() => helpers.searchBranches(input, prOwnersBranches)),
	});
})
.then(response => {
	const prOwnerBaseBranch = response[0].prOwnerBaseBranch;

	return Promise.all([
		prOwnerBaseBranch,
		apis.jira.get(`/issue/${currentTask}/?fields=status,issuelinks,summary`)
	])
})
.then(response => {
	const prOwnerBaseBranch = response[0];
	const taskTitle = response[1].data.fields.summary;
	const prTitle = `[${currentTask}] - ${taskTitle}`;

	fs.writeFileSync(tempFile.name, `**Task:**\n\nhttps://recoverybrands.atlassian.net/browse/${currentTask}\n\n**Pages:**\n\n`);

	process.stdout.write(chalk.green('Editing markdown file...'));

	execSync('atom --wait ' + tempFile.name);
	const prBody = fs.readFileSync(tempFile.name, 'utf8');

	log(chalk.green('DONE!'));

	return apis.github.post(`/repos/${prOwnerRepo}/${currentRepo}/pulls`, {
		title: prTitle,
		body: prBody,
		head: `${config.github.self}:${currentTask}`,
		base: prOwnerBaseBranch
	});
})
.then(response => {
	prUrlLink = response.data.html_url;

	log(chalk.bold(`PR Submitted: `) + prUrlLink);

	return apis.jira.post(`/issue/${currentTask}/comment`, {
			body: `PR Link: ${prUrlLink}`,
		});
})
.then(response => {
	return inquirer.prompt([{
		type: 'list',
		name: 'transitionToInReview',
		message: 'Would you like to transition this task to "In Review"?',
		choices: [
			{
				name: "Yes",
				value: true,
			},
			{
				name: "No",
				value: false
			},
		]
	}])

})
.then(response => {

	if (!response.transitionToInReview) {
		return;
	}

	return apis.jira.post(`/issue/${currentTask}/transitions`, {
		transition: {
			id: config.jira.inReviewId
		},
	});
})
.then(response => {
	return apis.slack.post('/conversations.members', querystring.stringify({channel: config.slack.prsChannelId}))
})
.then(response => {
	return helpers.getSlackUserInfo(response.data.members);
})
.then(response => {
	const membersInfoArray = response.map((response) => {
		return response.data;
	});

	return helpers.formatSlackMemberChoices(membersInfoArray);
})
.then(response => {
	return inquirer.prompt([{
		type: 'checkbox',
		name: 'slackNotifyees',
		message: 'Choose the Slack users you would like to notify about your PR:',
		choices: response,
	}]);
})
.then(response => {
	const slackNotifyeeTags = response.slackNotifyees.reduce((tagsString, currentId) => {
		return tagsString + ` <@${currentId}>`;
	}, '');
	const slackMessage = `${prUrlLink} ${slackNotifyeeTags}`;

	return apis.slack.post('/chat.postMessage', querystring.stringify({
		channel: config.slack.prsChannelId,
		as_user: false,
		username: 'PR Notifier',
		icon_emoji: ':robot_face:',
		text: slackMessage,
	}))
});
