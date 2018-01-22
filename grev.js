#!/usr/bin/env node

// Imports
const chalk = require('chalk');
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
const tmp = require('tmp');
const { execSync } = require('child_process');
const fs = require('fs');
const querystring = require('querystring');
const remoteOriginUrl = require('git-remote-origin-url');
const opn = require('opn');
const apis = require('./endpoints');
const config = require('./config');
const helpers = require('./helpers');

// Variable Setup
let prUrlLink;
let prOwnerRepo;
let currentRepo;
let baseBranch;
const executionPath = process.cwd();
// Shortcut for chalk logging.
const log = console.log;
// Gets current branch name
const currentTask = require('git-rev-sync').branch(executionPath);
// Temp file for markdown
const tempFile = tmp.fileSync({
	postfix: '.md',
});


log(chalk.bold.underline('\nFollow the prompts to submit a Pull Request.\n'))

remoteOriginUrl(executionPath)
.then((url) => {
	currentRepo = helpers.getRepoName(url);

	return Promise.all([
		apis.github.get(`/teams/${config.github.frontendTeamId}/members`),
		apis.github.get(`/repos/referralsolutionsgroup/${currentRepo}/forks`)
	]);
})
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
		name: 'baseBranch',
		message: 'Choose a base branch:',
		source: (answers, input) => Promise.resolve().then(() => helpers.searchBranches(input, prOwnersBranches)),
	});
})
.then((response) => {
	baseBranch = response.baseBranch;

	log(chalk.green('Opening browser to compare changes...'));
	opn(`https://github.com/${prOwnerRepo}/${currentRepo}/compare/${baseBranch}...${config.github.self}:${currentTask}`, {wait: false});

	return inquirer.prompt({
			type: 'list',
			name: 'continuePR',
			message: 'Would you like to continue with the PR process?',
			choices: helpers.yesNo
		});
})
.then((response) => {
	if (!response.continuePR) {
		process.exit();
	}
	return;
})
.then(response => {
	return apis.jira.get(`/issue/${currentTask}/?fields=status,issuelinks,summary`);
})
.then(response => {
	const taskTitle = response.data.fields.summary;
	const prTitle = `[${currentTask}] - ${taskTitle}`;

	fs.writeFileSync(tempFile.name, `**Task:**\n\nhttps://recoverybrands.atlassian.net/browse/${currentTask}\n\n**Pages:**\n\n`);

	process.stdout.write(chalk.green('Editing markdown file...'));

	execSync(`${config.github.editor} ${tempFile.name}`);
	const prBody = fs.readFileSync(tempFile.name, 'utf8');

	log(chalk.green('DONE!'));

	return apis.github.post(`/repos/${prOwnerRepo}/${currentRepo}/pulls`, {
		title: prTitle,
		body: prBody,
		head: `${config.github.self}:${currentTask}`,
		base: baseBranch
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
		choices: helpers.yesNo
	}]);

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
	}));
})
.catch((err) => {
	throw err;
});
