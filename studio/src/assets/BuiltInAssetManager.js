import { ProjectAsset } from "./ProjectAsset.js";
import { arrayBufferToBase64, toFormattedJsonString } from "../../../src/mod.js";
import { SingleInstancePromise } from "../../../src/util/SingleInstancePromise.js";
import { IS_DEV_BUILD } from "../studioDefines.js";
import { AssetManager } from "./AssetManager.js";
import { getStudioInstance } from "../studioInstance.js";

/**
 * @typedef {(uuid: import("../../../src/mod.js").UuidString) => any} BuiltInAssetChangeCallback
 */

const BUILTIN_ASSETS_BASE_PATH = "builtInAssets/";

/**
 * This class handles the loading of built-in assets.
 * Built-in assets work very similar to regular assets, but they can't be edited in studio.
 * To make development easier however, built-in assets are still editable in
 * development builds of studio. This is achieved by connecting to the
 * devsocket. When an asset is changed from studio, a message is sent to the
 * devsocket which saves the file in studio/builtInAssets folder.
 * Assets loaded from within the engine will be reloaded if they use
 * `EngineAssetsManager.watchAsset()`.
 *
 * This setup allows for using assets such as shaders and textures for the
 * renderer for instance.
 */
export class BuiltInAssetManager {
	/**
	 * @param {import("./ProjectAssetTypeManager.js").ProjectAssetTypeManager} projectAssetTypeManager
	 */
	constructor(projectAssetTypeManager) {
		/** @type {Map<import("../../../src/mod.js").UuidString, import("./ProjectAsset.js").ProjectAssetAny>}*/
		this.assets = new Map();

		this.devSocket = null;

		if (IS_DEV_BUILD) {
			/** @type {Set<BuiltInAssetChangeCallback>} */
			this.onAssetChangeCbs = new Set();
		}
	}

	async waitForLoad() {
		await this.loadAssetsInstance.waitForFinishOnce();
	}

	get allowAssetEditing() {
		if (!IS_DEV_BUILD || !this.devSocket) return false;
		return this.devSocket.connected;
	}

	/**
	 * @param {string[]} path
	 */
	async exists(path) {
		await this.waitForLoad();
		for (const asset of this.assets.values()) {
			if (AssetManager.testPathMatch(asset.path, path)) return true;
		}
		return false;
	}

	/**
	 * Fetches an asset from the built-in assets directory.
	 * This uses a regular fetch rather than the devsocket. That way, if the
	 * devsocket isn't running for whatever reason, built-in assets can still be used.
	 * @param {string[]} path
	 * @param {"json" | "text" | "binary"} format
	 */
	async fetchAsset(path, format = "json") {
		const response = await fetch(BUILTIN_ASSETS_BASE_PATH + path.join("/"));
		if (format == "json") {
			return await response.json();
		} else if (format == "text") {
			return await response.text();
		} else if (format == "binary") {
			return await response.arrayBuffer();
		}
		return null;
	}

	/**
	 * @param {BuiltInAssetChangeCallback} cb
	 */
	onAssetChange(cb) {
		if (!IS_DEV_BUILD) return;
		this.onAssetChangeCbs.add(cb);
	}

	assertDevBuildBeforeWrite() {
		if (!IS_DEV_BUILD) {
			throw new Error("Writing built-in assets is only supported in development builds.");
		}
	}

	/**
	 * @param {string[]} path
	 * @param {any} json
	 */
	async writeJson(path, json) {
		this.assertDevBuildBeforeWrite();
		const jsonStr = toFormattedJsonString(json);
		await this.writeText(path, jsonStr);
	}

	/**
	 * @param {string[]} path
	 * @param {string} text
	 */
	async writeText(path, text) {
		this.assertDevBuildBeforeWrite();
		const encoder = new TextEncoder();
		const buffer = encoder.encode(text);
		await this.writeBinary(path, buffer.buffer);
	}

	/**
	 * @param {string[]} path
	 * @param {ArrayBufferLike} arrayBuffer
	 */
	async writeBinary(path, arrayBuffer) {
		this.assertDevBuildBeforeWrite();
		if (!this.devSocket) return;
		await this.devSocket.sendRoundTripMessage("writeBuiltInAsset", {
			path,
			writeData: arrayBufferToBase64(arrayBuffer),
		});
	}
}
