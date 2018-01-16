const axios = require('axios');

class Endpoints {
	constructor() {
		this.jira = axios.create({
			baseURL: 'https://recoverybrands.atlassian.net/rest/api/2',
			headers: {'Authorization': `Basic ${jira.key}`},
		});

		this.github = axios.create({
			baseURL: 'https://api.github.com',
			auth: {
				username: github.self,
				password: github.key,
			},
		});

		this.slack = axios.create({
			baseURL: 'https://slack.com/api',
			headers: {'Authorization': `Bearer ${slack.key}`},
		});
	}
}

module.exports = new Endpoints();