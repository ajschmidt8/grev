// Imports
const git = require('git-rev-sync');

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

// Gets current branch name
const currentTask = git.branch();
// const currentTask = 'REH-317';
// Repo name
const repo = getRepoName.sync();
// const currentRepo = 'rehabs-com';

const apis = require('./endpoints');


// Temp file for markdown
const tempFile = tmp.fileSync({
	postfix: '.md',
});


// Gets the options for who's fork to submit PR to
const getForksData = () => {
	return Promise.all([
		apis.github.get(`/teams/${github.frontendTeamId}/members`),
		apis.github.get(`/repos/referralsolutionsgroup/${currentRepo}/forks`)
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
		return apis.slack.post('/users.info', querystring.stringify({user: memberId}));
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
		source: (answers, input) => Promise.resolve().then(() => searchBranches(input, prOwnersBranches)),
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
		head: `${github.self}:${currentTask}`,
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
			id: jira.inReviewId
		},
	});
})
.then(response => {
	return apis.slack.post('/conversations.members', querystring.stringify({channel: slack.prsChannelId}))
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

	return apis.slack.post('/chat.postMessage', querystring.stringify({
		channel: slack.prsChannelId,
		as_user: false,
		username: 'PR Notifier',
		icon_emoji: ':robot_face:',
		text: slackMessage,
	}))
})
