import {StudioConnectionsManager} from "../../../../src/network/studioConnections/StudioConnectionsManager.js";
import {DiscoveryManagerInternal} from "../../../../src/network/studioConnections/discoveryManagers/DiscoveryManagerInternal.js";
import {DiscoveryManagerWebRtc} from "../../../../src/network/studioConnections/discoveryManagers/DiscoveryManagerWebRtc.js";
import {createStudioHostHandlers} from "./handlers.js";

/** @typedef {import("../../../../src/network/studioConnections/StudioConnection.js").StudioConnection<{}, ReturnType<createStudioHostHandlers>>} StudioClientHostConnection */

export class StudioConnectionsManagerManager {
	#projectManager;
	#preferencesManager;
	/** @type {StudioConnectionsManager?} */
	#studioConnectionsManager = null;
	/** @type {DiscoveryManagerInternal?} */
	#discoveryManagerInternal = null;
	/** @type {DiscoveryManagerWebRtc?} */
	#discoveryManagerWebRtc = null;

	/** @type {string?} */
	#webRtcDiscoveryEndpoint = null;

	/** @type {Set<import("../../../../src/network/studioConnections/discoveryManagers/DiscoveryManagerWebRtc.js").OnDiscoveryManagerWebRtcStatusChangeCallback>} */
	#onWebRtcDiscoveryServerStatusChangeCbs = new Set();
	/** @type {Set<() => void>} */
	#onConnectionsChangedCbs = new Set();

	/** @type {import("../../../../src/network/studioConnections/discoveryManagers/DiscoveryManager.js").RemoteStudioMetaData?} */
	#lastSentProjectMetaData = null;

	/**
	 * @param {import("../../projectSelector/ProjectManager.js").ProjectManager} projectManager
	 * @param {import("../../Studio.js").Studio["preferencesManager"]} preferencesManager
	 */
	constructor(projectManager, preferencesManager) {
		this.#projectManager = projectManager;
		this.#preferencesManager = preferencesManager;

		projectManager.onProjectOpen(this.#updateStudioConnectionsManager);
		projectManager.onRootHasWritePermissionsChange(this.#updateStudioConnectionsManager);
		projectManager.onProjectOpenEntryChange(this.#updateStudioConnectionsManager);

		preferencesManager.onChange("studioConnections.allowInternalIncoming", null, this.#updateStudioConnectionsManager);
		preferencesManager.onChange("studioConnections.allowRemoteIncoming", null, this.#updateStudioConnectionsManager);
	}

	#getDefaultInternalDiscoveryEndPoint() {
		return new URL("internalDiscovery", window.location.href).href;
	}

	getDefaultWebRtcDiscoveryEndPoint() {
		if (window.location.hostname == "renda.studio" || window.location.hostname.endsWith(".renda.studio")) {
			return "discovery.renda.studio";
		} else {
			const protocol = window.location.protocol == "https:" ? "wss" : "ws";
			return `${protocol}://${window.location.host}/studioDiscovery`;
		}
	}

	/**
	 * @param {import("../../../../src/network/studioConnections/StudioConnectionsManager.js").ClientType} initiatorType
	 * @param {import("../../../../src/network/studioConnections/StudioConnectionsManager.js").ClientType} receiverType
	 */
	#isValidConnectionConfiguration(initiatorType, receiverType) {
		if (initiatorType == receiverType) return false;
		if (receiverType == "studio-client" && initiatorType == "studio-host") return false;

		return true;
	}

	#updateStudioConnectionsManager = () => {
		const allowInternalIncoming = this.#preferencesManager.get("studioConnections.allowInternalIncoming", null);
		const allowRemoteIncoming = this.#preferencesManager.get("studioConnections.allowRemoteIncoming", null);

		/** @type {import("../../../../src/network/studioConnections/StudioConnectionsManager.js").ClientType?} */
		const desiredClientType = this.#projectManager.currentProjectIsRemote ? "studio-client" : "studio-host";

		if (this.#studioConnectionsManager && (!desiredClientType || desiredClientType != this.#studioConnectionsManager.clientType)) {
			this.#studioConnectionsManager.destructor();
			this.#studioConnectionsManager = null;
			this.#discoveryManagerInternal = null;
			this.#discoveryManagerWebRtc = null;
		}

		if (desiredClientType && !this.#studioConnectionsManager && this.#projectManager.currentProjectFileSystem) {
			const certainFileSystem = this.#projectManager.currentProjectFileSystem;
			const studioConnectionsManager = new StudioConnectionsManager(desiredClientType);
			this.#studioConnectionsManager = studioConnectionsManager;
			this.#lastSentProjectMetaData = null;
			studioConnectionsManager.onConnectionsChanged(() => {
				if (studioConnectionsManager != this.#studioConnectionsManager) {
					throw new Error("Assertion failed, studio connections manager callback fired after it has been destructed.");
				}
				this.#onConnectionsChangedCbs.forEach(cb => cb());
			});
			studioConnectionsManager.onConnectionRequest(connectionRequest => {
				if (studioConnectionsManager != this.#studioConnectionsManager) {
					throw new Error("Assertion failed, studio connections manager callback fired after it has been destructed.");
				}

				let initiatorType;
				let receiverType;
				if (connectionRequest.initiatedByMe) {
					initiatorType = studioConnectionsManager.clientType;
					receiverType = connectionRequest.clientType;
				} else {
					initiatorType = connectionRequest.clientType;
					receiverType = studioConnectionsManager.clientType;
				}

				if (!this.#isValidConnectionConfiguration(initiatorType, receiverType)) {
					throw new Error(`Assertion failed, tried to connect two connections that are incompatible: "${initiatorType}" tried to connect to "${receiverType}"`);
				}

				// TODO: Add an allowlist #751

				if (connectionRequest.initiatedByMe) {
					/** @type {StudioClientHostConnection} */
					const connection = connectionRequest.accept({});
					this.#projectManager.assignRemoteConnection(connection);
				}
				if (studioConnectionsManager.clientType == "studio-host" && connectionRequest.clientType == "studio-client") {
					connectionRequest.accept(createStudioHostHandlers(certainFileSystem));
				}
			});
		}
		if (this.#studioConnectionsManager) {
			// create/destroy internal discovery manager when needed
			const needsInternalDiscovery = allowInternalIncoming || this.#projectManager.currentProjectIsRemote;
			if (this.#discoveryManagerInternal && !needsInternalDiscovery) {
				this.#studioConnectionsManager.removeDiscoveryManager(this.#discoveryManagerInternal);
			} else if (!this.#discoveryManagerInternal && needsInternalDiscovery) {
				this.#discoveryManagerInternal = this.#studioConnectionsManager.addDiscoveryManager(DiscoveryManagerInternal, this.#getDefaultInternalDiscoveryEndPoint());
			}

			// create/destroy webrtc discovery manager when needed
			const needsWebRtcDiscovery = allowRemoteIncoming || this.#projectManager.currentProjectIsRemote;
			const desiredWebRtcEndpoint = this.#webRtcDiscoveryEndpoint || this.getDefaultWebRtcDiscoveryEndPoint();
			if (this.#discoveryManagerWebRtc && (!needsWebRtcDiscovery || this.#discoveryManagerWebRtc.endpoint != desiredWebRtcEndpoint)) {
				this.#studioConnectionsManager.removeDiscoveryManager(this.#discoveryManagerWebRtc);
				this.#onWebRtcDiscoveryServerStatusChangeCbs.forEach(cb => cb("disconnected"));
				this.#discoveryManagerWebRtc = null;
			}
			if (!this.#discoveryManagerWebRtc && needsWebRtcDiscovery) {
				this.#discoveryManagerWebRtc = this.#studioConnectionsManager.addDiscoveryManager(DiscoveryManagerWebRtc, {
					endpoint: desiredWebRtcEndpoint,
				});
				this.#discoveryManagerWebRtc.onStatusChange(status => {
					this.#onWebRtcDiscoveryServerStatusChangeCbs.forEach(cb => cb(status));
				});
				const status = this.#discoveryManagerWebRtc.status;
				this.#onWebRtcDiscoveryServerStatusChangeCbs.forEach(cb => cb(status));
			}
		}

		this.#updateProjectMetaData();
	};

	/**
	 * @param {() => void} cb
	 */
	onConnectionsChanged(cb) {
		this.#onConnectionsChangedCbs.add(cb);
	}

	/**
	 * @param {() => void} cb
	 */
	removeOnConnectionsChanged(cb) {
		this.#onConnectionsChangedCbs.delete(cb);
	}

	/**
	 * @param {import("../../../../src/network/studioConnections/discoveryManagers/DiscoveryManager.js").RemoteStudioMetaData?} oldData
	 * @param {import("../../../../src/network/studioConnections/discoveryManagers/DiscoveryManager.js").RemoteStudioMetaData?} newData
	 */
	#metaDataEquals(oldData, newData) {
		if (oldData == newData) return true;
		if (
			newData && oldData &&
			oldData.name == newData.name &&
			oldData.uuid == newData.uuid &&
			oldData.fileSystemHasWritePermissions == newData.fileSystemHasWritePermissions
		) return true;

		return false;
	}

	/**
	 * Sends the current state of project metadata to remote and internal studio connections.
	 */
	#updateProjectMetaData() {
		if (!this.#studioConnectionsManager) return;
		const metaData = this.#projectManager.getCurrentProjectMetaData();
		if (this.#metaDataEquals(metaData, this.#lastSentProjectMetaData)) return;
		this.#studioConnectionsManager.setProjectMetaData(metaData);
	}

	/**
	 * @param {string?} endpoint
	 */
	setWebRtcDiscoveryEndpoint(endpoint) {
		this.#webRtcDiscoveryEndpoint = endpoint;
		this.#updateStudioConnectionsManager();
	}

	/** @type {import("../../../../src/network/studioConnections/discoveryManagers/DiscoveryManagerWebRtc.js").DiscoveryServerStatusType} */
	get webRtcDiscoveryServerStatus() {
		if (!this.#discoveryManagerWebRtc) return "disconnected";
		return this.#discoveryManagerWebRtc.status;
	}

	/**
	 * @param {import("../../../../src/network/studioConnections/discoveryManagers/DiscoveryManagerWebRtc.js").OnDiscoveryManagerWebRtcStatusChangeCallback} cb
	 */
	onWebRtcDiscoveryServerStatusChange(cb) {
		this.#onWebRtcDiscoveryServerStatusChangeCbs.add(cb);
	}

	/**
	 * @param {import("../../../../src/network/studioConnections/discoveryManagers/DiscoveryManagerWebRtc.js").OnDiscoveryManagerWebRtcStatusChangeCallback} cb
	 */
	removeOnWebRtcDiscoveryServerStatusChange(cb) {
		this.#onWebRtcDiscoveryServerStatusChangeCbs.delete(cb);
	}

	*availableConnections() {
		if (!this.#studioConnectionsManager) return;
		yield* this.#studioConnectionsManager.availableConnections();
	}

	/**
	 * Attempts to initiate a new connection.
	 * If the connection succeeds, state changes can be observed using {@linkcode onConnectionsChanged}.
	 * @param {import("../../../../src/mod.js").UuidString} id
	 */
	requestConnection(id) {
		if (!this.#studioConnectionsManager) {
			throw new Error("Assertion failed, studio connections manager does not exist");
		}
		this.#studioConnectionsManager.requestConnection(id);
	}

	/**
	 * @typedef FindConnectionConfig
	 * @property {string} connectionType
	 * @property {import("../../../../src/mod.js").UuidString} projectUuid
	 */

	/**
	 * Attempts to connect to a specific connection.
	 * If the connection doesn't exist yet, this will wait for it to become available.
	 * @param {FindConnectionConfig} config
	 */
	async requestSpecificConnection(config) {
		this.#updateStudioConnectionsManager();
		const connection = this.#findConnection(config);
		if (connection) {
			this.requestConnection(connection.id);
		} else {
			/** @type {import("../../../../src/network/studioConnections/discoveryManagers/DiscoveryManager.js").AvailableConnectionData} */
			const connection = await new Promise(resolve => {
				const cb = () => {
					const connection = this.#findConnection(config);
					if (connection) {
						this.removeOnConnectionsChanged(cb);
						resolve(connection);
					}
				};
				this.onConnectionsChanged(cb);
			});
			this.requestConnection(connection.id);
		}
	}

	/**
	 * @param {FindConnectionConfig} config
	 */
	#findConnection(config) {
		if (!this.#studioConnectionsManager) return null;
		for (const connection of this.#studioConnectionsManager.availableConnections()) {
			if (
				connection.projectMetaData?.uuid == config.projectUuid &&
				connection.connectionType == config.connectionType
			) {
				return connection;
			}
		}
		return null;
	}

	async getInternalClientId() {
		if (!this.#studioConnectionsManager) return null;
		if (!this.#discoveryManagerInternal) return null;
		return this.#discoveryManagerInternal.getClientId();
	}

	/**
	 * We don't allow all incoming connections, otherwise any browser tab would be able to connect to open projects
	 * simply by creating the discovery iframe and connecting to the first studio client it can find.
	 * But pages created by the build view should always be allowed.
	 * Therefore, we create tokens for every page created by the build view.
	 * Inspectors can provide these tokens when connecting, and we'll always allow the connection when the token is valid.
	 * @type {Set<string>}
	 */
	#internalConnectionTokens = new Set();

	/**
	 * Any new connections can use this token and their connection will automatically be allowed,
	 * regardless of its origin, the connection type, or whether internal connections are enabled.
	 */
	createInternalConnectionToken() {
		const token = crypto.randomUUID();
		this.#internalConnectionTokens.add(token);
		return token;
	}

	/**
	 * Prevents any new connections from being made using this token.
	 * This doesn't close existing connections that were made using the token.
	 * @param {string} token
	 */
	deleteConnectionToken(token) {
		this.#internalConnectionTokens.delete(token);
	}
}
