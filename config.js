const parseGitConfig = require('parse-git-config');

// username to use for absolute path to global .gitconfig file
const osUsername = require("os").userInfo().username;

// Parses global .gitconfig file
const gitConfig = parseGitConfig.sync({
	path: `/Users/${osUsername}/.gitconfig`,
});

class Config {
	constructor() {
		this.jira = {
			"self": gitConfig.jira.username,
			"key": gitConfig.jira.key,
			"inReviewId": 111,
			"relatedIssueId": 10003,
		};

		this.github = {
			"key": gitConfig.github.key,
			"self": gitConfig.github.username,
			"frontendTeamId": 2122156
		}

		this.slack = {
			"key": gitConfig.slack.key,
			"prsChannelId": "G7SCGSSPK",
		}
	}
}

module.exports = new Config();