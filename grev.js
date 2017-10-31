// Imports
const parseGitConfig = require('parse-git-config');
const git = require('git-rev-sync');
const axios = require('axios');
const chalk = require('chalk');
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
const tmp = require('tmp');
const { execSync } = require('child_process');
const fs = require('fs');
const getRepoName = require('git-repo-name');
const _ = require('lodash');
const fuzzy = require('fuzzy');

// Variable Setup
// Shortcut for chalk logging
const log = console.log;
// username to use for absolute path to global .gitconfig file
const osUsername = require("os").userInfo().username;
// Parses global .gitconfig file
const gitConfig = parseGitConfig.sync({
	path: `/Users/${osUsername}/.gitconfig`,
});
// Sets up JIRA related variables
const jira = {
	"self": gitConfig.jira.username,
	"key": gitConfig.jira.key,
	"inReviewId": 21,
	"relatedIssueId": 10003,
};
const github = {
	"key": gitConfig.github.key,
	"self": gitConfig.github.username,
	"frontendTeamId": 2122156
}
// Gets current branch name
// const currentTask = git.branch();
const currentTask = 'REH-317';
// Repo name
// const repo = getRepoName.sync();
const currentRepo = 'rehabs-com';
// Axios instance for JIRA API
const jiraAPI = axios.create({
	baseURL: 'https://recoverybrands.atlassian.net/rest/api/2',
	headers: {'Authorization': `Basic ${jira.key}`},
});
// Axios instance for GitHub API
const githubAPI = axios.create({
	baseURL: 'https://api.github.com',
	auth: {
		username: github.self,
		password: github.key,
	},
});
// Temp file for markdown
const tempFile = tmp.fileSync({
	postfix: '.md',
});


// Gets the options for who's fork to submit PR to
const getForkData = () => {
	return Promise.all([
		githubAPI.get(`/teams/${github.frontendTeamId}/members`),
		githubAPI.get(`/repos/referralsolutionsgroup/${currentRepo}/forks`)
	])
}

const filterForkChoices = (frontendTeam, availableForks) => {
	const filteredFrontendTeam = frontendTeam.map((teamMember) => {
		return teamMember.login
	});
	const filteredAvailableForks = availableForks.map((fork) => {
		return fork.owner.login
	});

	const filteredForkChoices = _.intersection(filteredFrontendTeam, filteredAvailableForks).sort();
	filteredForkChoices.unshift('referralsolutionsgroup');

	return filteredForkChoices;
};


const searchBranches = (input, branches) => {
	input = input || '';
	return new Promise(function(resolve) {
			const fuzzyResult = fuzzy.filter(input, branches);
			resolve(fuzzyResult.map(function(el) {
			return el.original;
		}));
	});
};

const searchForks = (input, forks) => {
	input = input || '';
	return new Promise(function(resolve) {
			const fuzzyResult = fuzzy.filter(input, forks);
			resolve(fuzzyResult.map(function(el) {
			return el.original;
		}));
	});
};

getForkData()
.then(response => {
	const frontendTeam = response[0].data;
	const availableForks = response[1].data;
	const formattedForks = filterForkChoices(frontendTeam, availableForks);

	return inquirer.prompt({
		type: 'autocomplete',
		name: 'prUserSelection',
		message: 'Choose whose repo you would like to submit the PR to:',
		source: (answers, input) => Promise.resolve().then(() => searchForks(input, formattedForks)),
	})
})
.then(response => {
	const prUser = response.prUserSelection;
	return Promise.all([
		githubAPI.get(`/repos/${prUser}/${currentRepo}/branches`),
		prUser
	]);
})
.then(response => {
	const prUser = response[1];
	const formattedBranches = response[0].data.map((branch) => {
		return branch.name;
	});


	return Promise.all([
		inquirer.prompt({
			type: 'autocomplete',
			name: 'baseBranch',
			message: 'Choose a base branch:',
			source: (answers, input) => Promise.resolve().then(() => searchBranches(input, formattedBranches)),
		}),
		prUser
	]);
})
.then(response => {
	const baseBranch = response[0].baseBranch;
	const prUser = response[1];
	return Promise.all([
		baseBranch,
		prUser,
		jiraAPI.get(`/issue/${currentTask}/?fields=status,issuelinks,summary`)
	])
})
.then(response => {
	const baseBranch = response[0];
	const prUser = response[1];
	const taskTitle = response[2].data.fields.summary;
	const prTitle = `[${currentTask}] - ${taskTitle}`;

	fs.writeFileSync(tempFile.name, `**Task:**\n\nhttps://recoverybrands.atlassian.net/browse/${currentTask}\n\n**Pages:**\n\n`);

	log(chalk.green('Opening markdown file for PR body...'));

	execSync('atom --wait ' + tempFile.name);
	const prBody = fs.readFileSync(tempFile.name, 'utf8');
	log(prBody);

	log(`/repos/${prUser}/${currentRepo}/pulls`);
	log(prTitle);
	log(prUser);
	log(baseBranch);
	log(`${github.self}:${currentTask}`);

	return githubAPI.post(`/repos/${prUser}/${currentRepo}/pulls`, {
		title: prTitle,
		body: prBody,
		head: `${github.self}:${currentTask}`,
		base: baseBranch
	});
})
.then(response => {
	log(response);
})
