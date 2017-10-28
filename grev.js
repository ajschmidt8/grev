// Imports
const parseGitConfig = require('parse-git-config');
const git = require('git-rev-sync');
const axios = require('axios');
const chalk = require('chalk');
const inquirer = require('inquirer');
const tmp = require('tmp');
const { execSync } = require('child_process');
const fs = require('fs');

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
}
// Gets current branch name
// const currentBranch = git.branch();
const currentBranch = 'REH-332';
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

const tempFile = tmp.fileSync({
	postfix: '.md',
});

log(tempFile);
execSync('atom --wait ' + tempFile.name);

let fileContents = fs.readFileSync(tempFile.name, 'utf8');

log(fileContents)
log('break')
execSync('atom --wait ' + tempFile.name);
