const axios = require('axios');
const config = require('./config');

class Endpoints {
	constructor() {
		this.jira = axios.create({
			baseURL: 'https://recoverybrands.atlassian.net/rest/api/2',
			headers: {'Authorization': `Basic ${config.jira.key}`},
		});

		this.github = axios.create({
			baseURL: 'https://api.github.com',
			auth: {
				username: config.github.self,
				password: config.github.key,
			},
		});

		this.slack = axios.create({
			baseURL: 'https://slack.com/api',
			headers: {'Authorization': `Bearer ${config.slack.key}`},
		});
	}
}

module.exports = new Endpoints();