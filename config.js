const parseGitConfig = require('parse-git-config');

// username to use for absolute path to global .gitconfig file
const osUsername = require("os").userInfo().username;

// Parses global .gitconfig file
const gitConfig = parseGitConfig.sync({
	path: `/Users/${osUsername}/.gitconfig`,
});

const config = {
	"jira": {
		"self": gitConfig.jira.username,
		"key": gitConfig.jira.key,
		"inReviewId": 51,
		"url": gitConfig.jira.url
	},

	"github": {
		"key": gitConfig.github.key,
		"self": gitConfig.github.username,
		"editor": gitConfig.core.editor,
		"frontendTeamId": 2122156,
	},

	"slack": {
		"key": gitConfig.slack.key,
		"notificationChannelId": gitConfig.slack.notificationChannelId,
	}
};

module.exports = config;
