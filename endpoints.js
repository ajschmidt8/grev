const axios = require('axios');
const config = require('./config');

const endpoints = {
	"jira": axios.create({
		baseURL: 'https://recoverybrands.atlassian.net/rest/api/2',
		headers: {'Authorization': `Basic ${config.jira.key}`},
	}),

	"github": axios.create({
		baseURL: 'https://api.github.com',
		auth: {
			username: config.github.self,
			password: config.github.key,
		},
	}),

	"slack": axios.create({
		baseURL: 'https://slack.com/api',
		headers: {'Authorization': `Bearer ${config.slack.key}`},
	})
};

module.exports = endpoints;