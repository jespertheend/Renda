import { autoRegisterStudioAssetLoaders } from "./autoRegisterDiskAssetLoaders.js";

/**
 * @typedef StudioAssetLoader
 * @property {boolean} [isStudioJson] If true (which is the default) the asset will be loaded as json file in the Renda Studio format.
 * @property {string[]} [extensions] The extensions to match against when determining whether a file should be loaded using this loader.
 * This does nothing when `isStudioJson` is set to true.
 * @property {(fileData: ArrayBuffer, ctx: StudioAssetLoadContext) => void | Promise<void>} [load] This is called when data from a file needs to be loaded into one or more live assets.
 */

/**
 * @typedef StudioAssetLoadContext
 * @property {import("../Studio.js").Studio} studio
 * @property {(fileData: ArrayBuffer) => string} parseText
 * @property {(assetPath: import("../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath) => StudioAssetLoadAsset} createAsset
 */

/**
 * @typedef StudioAssetLoadAsset
 * @property {boolean} needsLiveAsset
 * @property {(liveAsset: any) => void} setLiveAsset
 */

export class StudioAssetLoaderManager {
	/** @type {Map<string, StudioAssetLoader>} */
	#registeredAssetLoaders = new Map();

	init() {
		for (const t of autoRegisterStudioAssetLoaders) {
			this.registerAssetLoader(t);
		}
	}

	/**
	 * @param {StudioAssetLoader} studioAssetLoader
	 */
	registerAssetLoader(studioAssetLoader) {
		const { extensions } = studioAssetLoader;
		if (extensions) {
			for (const extension of extensions) {
				if (!extension) {
					throw new Error("Tried to register an asset loader with an empty extension string.");
				}
			}

			for (const extension of extensions) {
				if (this.#registeredAssetLoaders.has(extension)) {
					throw new Error(`An asset loader for the extension ".${extension}" has already been registered.`);
				}
				this.#registeredAssetLoaders.set(extension, studioAssetLoader);
			}
		}
	}

	/**
	 * @param {string} extension
	 */
	getAssetLoaderByExtension(extension) {
		// TODO: throw an error for .json files
		return this.#registeredAssetLoaders.get(extension) ?? null;
	}
}