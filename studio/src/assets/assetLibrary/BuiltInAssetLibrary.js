import { SingleInstancePromise } from "../../../../src/mod.js";
import { IS_DEV_BUILD } from "../../studioDefines.js";
import { AssetLibrary } from "./AssetLibrary.js";

const BUILTIN_ASSETS_BASE_PATH = "builtInAssets/";

/**
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
export class BuiltInAssetLibrary extends AssetLibrary {
	/** @type {import("../../network/DevSocketManager.js").DevSocketManager?} */
	#devSocket = null;

	/**
	 * @param  {ConstructorParameters<typeof AssetLibrary>} args
	 */
	constructor(...args) {
		super(...args);
		this.#loadAssetsInstance.run();
	}

	#loadAssetsInstance = new SingleInstancePromise(async () => {
		const response = await fetch(BUILTIN_ASSETS_BASE_PATH + "assetSettings.json");
		/** @type {import("../AssetSettingsDiskTypes.js").BuiltInAssetSettingsDiskData} */
		const json = await response.json();
		this.reloadAvailableAssets(json.projectFiles);
	});

	/**
	 * @param {import("../../network/DevSocketManager.js").DevSocketManager} devSocket
	 */
	initDevSocket(devSocket) {
		if (!IS_DEV_BUILD) return;
		this.#devSocket = devSocket;
		devSocket.addListener("builtInAssetChange", (data) => {
			const asset = this.assets.get(data.uuid);
			if (asset) {
				asset.fileChangedExternally();
			}
		});
		devSocket.addListener("builtInAssetListUpdate", () => {
			this.#loadAssetsInstance.run();
		});
	}

	/**
	 * @override
	 * @param {import("../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
	 */
	async readFile(path) {
		const response = await fetch(BUILTIN_ASSETS_BASE_PATH + path.join("/"));
		if (!response.ok) return null;
		return await response.arrayBuffer();
	}
}
