const apis = require('./endpoints');
const intersection = require('lodash.intersection');
const fuzzy = require('fuzzy');
const querystring = require('querystring');

const helpers = {
	"getForksData": (currentRepo) => {
		return Promise.all([
			apis.github.get(`/teams/${config.github.frontendTeamId}/members`),
			apis.github.get(`/repos/referralsolutionsgroup/${currentRepo}/forks`)
		])
	},

	"formatForkChoices": (frontendTeam, availableForks) => {
		const filteredFrontendTeam = frontendTeam.map((teamMember) => {
			return teamMember.login
		});
		const filteredAvailableForks = availableForks.map((fork) => {
			return fork.owner.login
		});

		const filteredForkChoices = intersection(filteredFrontendTeam, filteredAvailableForks).sort();
		filteredForkChoices.unshift('referralsolutionsgroup');

		return filteredForkChoices;
	},

	"searchForks": (input, forks) => {
		input = input || '';
		return new Promise(function(resolve) {
				const fuzzyResult = fuzzy.filter(input, forks);
				resolve(fuzzyResult.map(function(el) {
				return el.original;
			}));
		});
	},

	"searchBranches": (input, branches) => {
		input = input || '';
		return new Promise(function(resolve) {
				const fuzzyResult = fuzzy.filter(input, branches);
				resolve(fuzzyResult.map(function(el) {
				return el.original;
			}));
		});
	},

	"getSlackUserInfo": (membersIdArray) => {
		const slackUserInfoPromises = membersIdArray.map((memberId) => {
			return apis.slack.post('/users.info', querystring.stringify({user: memberId}));
		});
		return Promise.all(slackUserInfoPromises);
	},

	"formatSlackMemberChoices": (membersInfoArray) => {
		return membersInfoArray.map((memberInfo) => {
			return {
				name: memberInfo.user.profile.display_name,
				value: memberInfo.user.id,
			};
		});
	}
};

module.exports = helpers;