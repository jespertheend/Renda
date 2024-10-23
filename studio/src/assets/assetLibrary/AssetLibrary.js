import { generateUuid } from "../../../../src/util/util.js";
import { stringArrayEquals } from "../../../../src/util/stringArrayEquals.js";
import { getStudioInstance } from "../../studioInstance.js";

/**
 * An AssetLibrary stores a collection of assets.
 * Initially, the library only loads a list of asset uuids and how info on how to load the assets
 * but the library can then be used to create live assets.
 */
export class AssetLibrary {
	#studioAssetLoaderManager;

	/**
	 * @typedef AvailableAssetData
	 * @property {import("../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} filePath
	 * @property {import("../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} assetPath
	 */

	/**
	 * A map of asset uids and information about how to retreive the asset.
	 * @type {Map<import("../../../../src/mod.js").UuidString, AvailableAssetData>}
	 */
	#availableAssets = new Map();
	/**
	 * @type {Map<import("../../../../src/mod.js").UuidString, WeakRef<WeakKey>>}
	 */
	#loadedLiveAssets = new Map();

	#initialLoadPromise;
	#resolveInitialLoad;

	/**
	 * @type {Map<string, Promise<ArrayBuffer?>>}
	 */
	#pendingReadFilePromises = new Map();

	/**
	 * @param {import("../StudioAssetLoaderManager.js").StudioAssetLoaderManager} studioAssetLoaderManager
	 */
	constructor(studioAssetLoaderManager) {
		this.#studioAssetLoaderManager = studioAssetLoaderManager;
		/** @type {PromiseWithResolvers<void>} */
		const {promise, resolve} = Promise.withResolvers();
		this.#initialLoadPromise = promise;
		this.#resolveInitialLoad = resolve;
	}

	/**
	 * This should be called by the subclass to initiate the list of available assets.
	 * This will wipe the existing list of assets.
	 * Calls to things such as {@linkcode getLiveAssetByUuid} will not resolve until this is called.
	 * @param {import("../AssetSettingsDiskTypes.js").AssetSettingsProjectFile[]} projectFiles
	 */
	reloadAvailableAssets(projectFiles) {
		const existingUuids = new Set(this.#availableAssets.keys());
		/**
		 * @param {import("../../../../src/mod.js").UuidString} uuid
		 * @param {AvailableAssetData} availableAssetData
		 */
		const registerAvailableAsset = (uuid, availableAssetData) => {
			existingUuids.delete(uuid);
			this.#availableAssets.set(uuid, availableAssetData);
		}

		for (const projectFile of projectFiles) {
			if (projectFile.assets) {
				for (const [uuid, assetPath] of Object.entries(projectFile.assets)) {
					registerAvailableAsset(uuid, {
						filePath: projectFile.path,
						assetPath,
					});
				}
			} else if (projectFile.uuid) {
				registerAvailableAsset(projectFile.uuid, {
					filePath: projectFile.path,
					assetPath: ["main"],
				});
			}
		}

		for (const uuid of existingUuids) {
			this.#availableAssets.delete(uuid);
		}
		this.#resolveInitialLoad();
	}

	*getAvailableAssetUuids() {
		yield *this.#availableAssets.keys();
	}

	/**
	 * Should be implemented by subclasses and return an array buffer for the file that is read.
	 * @param {import("../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
	 * @returns {Promise<ArrayBuffer?>}
	 */
	async readFile(path) {
		return null;
	}

	/**
	 * Calls {@linkcode readFile} but reuses requests that are already in flight if they exist.
	 * @param {import("../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
	 */
	#readFileWithReusedPromises(path) {
		const cacheKey = JSON.stringify(path);
		const pendingPromise = this.#pendingReadFilePromises.get(cacheKey);
		if (pendingPromise) return pendingPromise;

		const newPromise = this.readFile(path);
		this.#pendingReadFilePromises.set(cacheKey, newPromise);
		(async () => {
			try {
				await newPromise;
			} finally {
				this.#pendingReadFilePromises.delete(cacheKey);
			}
		})();
		return newPromise;
	}

	/**
	 * @param {import("../../../../src/mod.js").UuidString} uuid
	 */
	#getLoadedLiveAssetByUuid(uuid) {
		const existingLiveAsset = this.#loadedLiveAssets.get(uuid);
		if (existingLiveAsset) {
			return existingLiveAsset.deref();
		}
	}

	/**
	 * @param {import("../../../../src/mod.js").UuidString} uuid
	 */
	async getLiveAssetByUuid(uuid) {
		await this.#initialLoadPromise;
		const existingLiveAsset = this.#getLoadedLiveAssetByUuid(uuid);
		if (existingLiveAsset) return existingLiveAsset;
		const availableAssetData = this.#availableAssets.get(uuid);
		if (!availableAssetData) return null;
		const fileName = availableAssetData.filePath.at(-1);
		if (!fileName) {
			throw new Error(`Assertion failed, asset with uuid "${uuid}" has no filePath.`)
		}
		const extension = fileName.split(".").at(-1);
		if (!extension) {
			throw new Error(`Failed to determine asset type for asset with uuid "${uuid}". File has no extension.`);
		}
		const assetLoader = this.#studioAssetLoaderManager.getAssetLoaderByExtension(extension);
		if (!assetLoader) {
			throw new Error(`No asset loader has been registered for ".${extension}" files.`);
		}
		if (!assetLoader.load) {
			throw new Error("Asset loader does not implement the 'load' method.")
		}
		const fileBuffer = await this.#readFileWithReusedPromises(availableAssetData.filePath);
		if (!fileBuffer) {
			throw new Error(`Failed to load asset with uuid "${uuid}". No file exists at "${availableAssetData.filePath.join("/")}".`);
		}

		const textDecoder = new TextDecoder();
		// Since we use WeakRefs for live assets and WeakRefs may be garbage collected at any time,
		// even right after creation, we will store all live assets that were created during
		// assetLoader.load() in an array to prevent garbage collection.
		/** @type {any[]} */
		const loadedLiveAssets = [];

		/** @type {import("../StudioAssetLoaderManager.js").StudioAssetLoadContext} */
		const loadContext = {
			studio: getStudioInstance(),
			parseText: (arrayBuffer) => {
				return textDecoder.decode(arrayBuffer);
			},
			createAsset: (assetPath) => {
				// TODO: Computed this value based on which uuid was requested
				// (and which uuids have been requested in the past)
				const needsLiveAsset= true;
				return {
					needsLiveAsset,
					setLiveAsset: (liveAsset) => {
						const filePath = availableAssetData.filePath;
						loadedLiveAssets.push(liveAsset);
						const existingAvailableAssetData = this.#getUuidFromPath(filePath, assetPath);
						if (!existingAvailableAssetData) {
							const uuid = generateUuid();
							this.#availableAssets.set(uuid, {
								assetPath,
								filePath,
							});
						}
						this.#loadedLiveAssets.set(uuid, new WeakRef(liveAsset));
					}
				}
			}
		}

		await assetLoader.load(fileBuffer, loadContext);

		const liveAsset = this.#getLoadedLiveAssetByUuid(uuid);
		if (!liveAsset) {
			throw new Error("The requested live asset was not created. Make sure to call `const asset = ctx.createAsset()` and `asset.setLiveAsset()` in the `load()` implementation of your studioAssetLoader.");
		}
		return liveAsset;
	}

	/**
	 * @param {import("../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} filePath
	 * @param {import("../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} assetPath
	 */
	#getUuidFromPath(filePath, assetPath) {
		for (const [uuid, availableAssetData] of this.#availableAssets) {
			if (stringArrayEquals(filePath, availableAssetData.filePath) && stringArrayEquals(assetPath, availableAssetData.assetPath)) {
				return uuid;
			}
		}
		return null;
	}
}
