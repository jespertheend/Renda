import MessageHandler from "./MessageHandler.js";

export default class MessageHandlerInternal extends MessageHandler {
	/**
	 * @param {import("../../../Util/Util.js").UuidString} connectionId
	 * @param {import("../EditorConnectionsManager.js").default} connectionsManager
	 * @param {boolean} [isInitiator = false]
	 */
	constructor(connectionId, connectionsManager, isInitiator) {
		super();
		this.connectionId = connectionId;
		this.connectionsManager = connectionsManager;
		this.messagePort = null;

		if (isInitiator) {
			this.connectionsManager.requestInternalMessageChannelConnection(this.connectionId);
		}
	}

	/**
	 * @param {MessagePort} messagePort
	 */
	assignMessagePort(messagePort) {
		this.messagePort = messagePort;
		messagePort.addEventListener("message", e => {
			this.handleMessageReceived(e.data);
			console.log(e.data);
		});
		messagePort.start();
		this.setConnectionState("connected");
	}

	/**
	 * @override
	 * @param {*} data
	 */
	send(data) {
		this.messagePort.postMessage(data);
	}
}
