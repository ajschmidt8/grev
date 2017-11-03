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
const querystring = require('querystring');

// Variable Setup
let prUrlLink;
let prOwnerRepo;
// Shortcut for chalk logging.
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
	"inReviewId": 111,
	"relatedIssueId": 10003,
};
const github = {
	"key": gitConfig.github.key,
	"self": gitConfig.github.username,
	"frontendTeamId": 2122156
}
const slack = {
	"key": gitConfig.slack.key,
	"prsChannelId": "G7SCGSSPK",
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
// Axios instance for Slack API
const slackAPI = axios.create({
	baseURL: 'https://slack.com/api',
	headers: {'Authorization': `Bearer ${slack.key}`},
});
// Temp file for markdown
const tempFile = tmp.fileSync({
	postfix: '.md',
});


// Gets the options for who's fork to submit PR to
const getForksData = () => {
	return Promise.all([
		githubAPI.get(`/teams/${github.frontendTeamId}/members`),
		githubAPI.get(`/repos/referralsolutionsgroup/${currentRepo}/forks`)
	])
}

const formatForkChoices = (frontendTeam, availableForks) => {
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

const getSlackUserInfo = (membersIdArray) => {
	const slackUserInfoPromises = membersIdArray.map((memberId) => {
		return slackAPI.post('/users.info', querystring.stringify({user: memberId}));
	});
	return Promise.all(slackUserInfoPromises);
};

const formatSlackMemberChoices = (membersInfoArray) => {
	return membersInfoArray.map((memberInfo) => {
		return {
			name: memberInfo.user.profile.display_name,
			value: memberInfo.user.id,
		};
	});
};


log(chalk.bold.underline('\nFollow the prompts to submit a PR.\n'))

getForksData()
.then(response => {
	const frontendTeamMembers = response[0].data;
	const haveForkedMembers = response[1].data;
	const formattedForkChoices = formatForkChoices(frontendTeamMembers, haveForkedMembers);

	return inquirer.prompt({
		type: 'autocomplete',
		name: 'prUserSelection',
		message: 'Choose whose repo you would like to submit the PR to:',
		source: (answers, input) => Promise.resolve().then(() => searchForks(input, formattedForkChoices)),
	})
})
.then(response => {
	prOwnerRepo = response.prUserSelection;
	return githubAPI.get(`/repos/${prOwnerRepo}/${currentRepo}/branches`),
})
.then(response => {
	const prOwnersBranches = response.data.map((branch) => {
		return branch.name;
	});

	return inquirer.prompt({
		type: 'autocomplete',
		name: 'prOwnerBaseBranch',
		message: 'Choose a base branch:',
		source: (answers, input) => Promise.resolve().then(() => searchBranches(input, prOwnersBranches)),
	});
})
.then(response => {
	const prOwnerBaseBranch = response[0].prOwnerBaseBranch;

	return Promise.all([
		prOwnerBaseBranch,
		jiraAPI.get(`/issue/${currentTask}/?fields=status,issuelinks,summary`)
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

	return githubAPI.post(`/repos/${prOwnerRepo}/${currentRepo}/pulls`, {
		title: prTitle,
		body: prBody,
		head: `${github.self}:${currentTask}`,
		base: prOwnerBaseBranch
	});
})
.then(response => {
	prUrlLink = response.data.html_url;

	log(chalk.bold(`PR Submitted: `) + prUrlLink);

	return jiraAPI.post(`/issue/${currentTask}/comment`, {
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

	return jiraAPI.post(`/issue/${currentTask}/transitions`, {
		transition: {
			id: jira.inReviewId
		},
	});
})
.then(response => {
	return slackAPI.post('/conversations.members', querystring.stringify({channel: slack.prsChannelId}))
})
.then(response => {
	return getSlackUserInfo(response.data.members);
})
.then(response => {
	const membersInfoArray = response.map((response) => {
		return response.data;
	});

	return formatSlackMemberChoices(membersInfoArray);
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

	return slackAPI.post('/chat.postMessage', querystring.stringify({
		channel: slack.prsChannelId,
		as_user: false,
		username: 'PR Notifier',
		icon_emoji: ':robot_face:',
		text: slackMessage,
	}))
})
