/**
 * An AssetLibrary stores a collection of assets.
 * Initially, the library only loads a list of asset uuids and how info on how to load the assets
 * but the library can then be used to create live assets.
 */
export class AssetLibrary {
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
	}

	*getAvailableAssetUuids() {
		yield *this.#availableAssets.keys();
	}

	/**
	 * @param {import("../../../../src/mod.js").UuidString} uuid
	 */
	async getLiveAsset(uuid) {

	}
}
