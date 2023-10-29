import {TypedMessenger} from "../../../util/TypedMessenger.js";
import {MessageHandlerWebRtc} from "../messageHandlers/MessageHandlerWebRtc.js";
import {DiscoveryMethod} from "./DiscoveryMethod.js";

/**
 * @fileoverview This DiscoveryManager allows connecting to other clients remotely.
 * Source code of the discovery server can be found at https://github.com/rendajs/studio-discovery-server.
 */

/** @typedef {"disconnected" | "connecting" | "connected"} DiscoveryServerStatusType */

/** @typedef {ReturnType<WebRtcDiscoveryMethod["getResponseHandlers"]>} ExternalDiscoveryManagerResponseHandlers */

/**
 * @typedef ExternalDiscoveryRelayOfferData
 * @property {"rtcDescription"} type
 * @property {RTCSessionDescriptionInit} description
 */
/**
 * @typedef ExternalDiscoveryRelayCandidateData
 * @property {"rtcIceCandidate"} type
 * @property {RTCIceCandidate} candidate
 */
/** @typedef {ExternalDiscoveryRelayOfferData | ExternalDiscoveryRelayCandidateData} ExternalDiscoveryRelayData */

/** @typedef {(status: DiscoveryServerStatusType) => void} OnDiscoveryManagerWebRtcStatusChangeCallback */

/**
 * This class allows you to discover other tabs via a central discovery server.
 * When created, a connection to a WebSocket is made, which can be used for connecting to another client via WebRTC.
 * @extends {DiscoveryMethod<typeof MessageHandlerWebRtc>}
 */
export class WebRtcDiscoveryMethod extends DiscoveryMethod {
	static type = /** @type {const} */ ("renda:webrtc");

	/**
	 * @param {string} endpoint The url where the WebSocket is hosted.
	 */
	constructor(endpoint) {
		super(MessageHandlerWebRtc);

		/** @private @type {DiscoveryServerStatusType} */
		this._status = "connecting";
		/** @private @type {Set<OnDiscoveryManagerWebRtcStatusChangeCallback>} */
		this.onStatusChangeCbs = new Set();

		/** @private */
		this._endpoint = endpoint;

		/** @private */
		this.ws = new WebSocket(endpoint);
		this.ws.addEventListener("open", () => {
			this._setStatus("connected");
		});

		/** @private @type {TypedMessenger<ExternalDiscoveryManagerResponseHandlers, import("https://raw.githubusercontent.com/rendajs/studio-discovery-server/423fa5d224dae56571a61bfd8d850b76fcdcc6fa/src/WebSocketConnection.js").StudioDescoveryResponseHandlers>} */
		this.webSocketMessenger = new TypedMessenger({globalTimeout: 20_000});
		this.webSocketMessenger.initializeWebSocket(this.ws, this.getResponseHandlers());
		this.webSocketMessenger.configureSendOptions({
			relayMessage: {
				expectResponse: false,
			},
			setProjectMetadata: {
				expectResponse: false,
			},
		});

		this.ws.addEventListener("close", () => {
			this._setStatus("disconnected");
			this.clearAvailableConnections();
		});
	}

	/**
	 * @override
	 */
	destructor() {
		this.ws.close();
	}

	/**
	 * @override
	 * @param {import("../DiscoveryManager.js").ClientType} clientType
	 */
	async registerClient(clientType) {
		await this.webSocketMessenger.send.registerClient(clientType);
	}

	get endpoint() {
		return this._endpoint;
	}

	get status() {
		return this._status;
	}

	/**
	 * @private
	 */
	getResponseHandlers() {
		/** @satisfies {import("../../../mod.js").TypedMessengerRequestHandlerReturn} */
		const disableResponseReturn = {
			$respondOptions: {
				respond: false,
			},
		};

		return {
			/**
			 * @param {import("../DiscoveryManager.js").AvailableStudioData[]} connections
			 */
			setAvailableConnections: connections => {
				this.setAvailableConnections(connections);
				return disableResponseReturn;
			},
			/**
			 * @param {import("../DiscoveryManager.js").AvailableStudioData} connection
			 */
			addAvailableConnection: connection => {
				this.addAvailableConnection(connection);
				return disableResponseReturn;
			},
			/**
			 * @param {import("../../../mod.js").UuidString} id
			 */
			removeAvailableConnection: id => {
				this.removeAvailableConnection(id);
				return disableResponseReturn;
			},
			/**
			 * @param {import("../../../mod.js").UuidString} uuid
			 * @param {import("../DiscoveryManager.js").RemoteStudioMetadata?} projectMetadata
			 */
			setConnectionProjectMetadata: (uuid, projectMetadata) => {
				this.setConnectionProjectMetadata(uuid, projectMetadata);
				return disableResponseReturn;
			},
			/**
			 * @param {import("../../../mod.js").UuidString} fromUuid
			 * @param {ExternalDiscoveryRelayData} relayData
			 */
			relayMessage: (fromUuid, relayData) => {
				if (relayData.type == "rtcDescription") {
					this._handleRtcDescription(fromUuid, relayData.description);
				} else if (relayData.type == "rtcIceCandidate") {
					this._handleRtcIceCandidate(fromUuid, relayData.candidate);
				}
				return disableResponseReturn;
			},
		};
	}

	/**
	 * @private
	 * @param {DiscoveryServerStatusType} status
	 */
	_setStatus(status) {
		if (status == this._status) return;
		this._status = status;
		this.onStatusChangeCbs.forEach(cb => cb(status));
	}

	/**
	 * @param {OnDiscoveryManagerWebRtcStatusChangeCallback} cb
	 */
	onStatusChange(cb) {
		this.onStatusChangeCbs.add(cb);
	}

	/**
	 * @param {OnDiscoveryManagerWebRtcStatusChangeCallback} cb
	 */
	removeOnStatusChange(cb) {
		this.onStatusChangeCbs.delete(cb);
	}

	/**
	 * @override
	 * @param {import("../DiscoveryManager.js").RemoteStudioMetadata?} metadata
	 */
	async setProjectMetadata(metadata) {
		await this.webSocketMessenger.send.setProjectMetadata(metadata);
	}

	/**
	 * @private
	 * @param {import("../../../mod.js").UuidString} connectionId
	 * @param {RTCSessionDescriptionInit} rtcDescription
	 */
	_handleRtcDescription(connectionId, rtcDescription) {
		let studioConnection = this.activeConnections.get(connectionId);
		if (!studioConnection) {
			studioConnection = this.addActiveConnection(connectionId, false, {
				sendRtcIceCandidate: (uuid, candidate) => {
					this.webSocketMessenger.send.relayMessage(uuid, {
						type: "rtcIceCandidate",
						candidate,
					});
				},
				sendRtcDescription: (uuid, description) => {
					this.webSocketMessenger.send.relayMessage(uuid, {
						type: "rtcDescription",
						description,
					});
				},
			});
		}
		studioConnection.handleRtcDescription(rtcDescription);
	}

	/**
	 * @private
	 * @param {import("../../../mod.js").UuidString} studioId
	 * @param {RTCIceCandidateInit} iceCandidate
	 */
	_handleRtcIceCandidate(studioId, iceCandidate) {
		const studioConnection = this.activeConnections.get(studioId);
		if (!studioConnection) return;

		studioConnection.handleRtcIceCandidate(iceCandidate);
	}
}
