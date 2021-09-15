export default class EditorConnectionsManager {
	constructor() {
		this.currentEndpoint = null;
		this.ws = null;
	}

	destructor() {
		this.setEndpoint(null);
	}

	/**
	 * @param {string} endpoint
	 */
	setEndpoint(endpoint) {
		if (endpoint == this.currentEndpoint) return;

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		if (endpoint) {
			this.ws = new WebSocket(endpoint);
		}
	}

	static getDefaultEndPoint() {
		return `ws://${window.location.hostname}:8082`;
	}
}