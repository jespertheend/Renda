import {AssetManager} from "../../../../../../editor/src/assets/AssetManager.js";
import {EditorFileSystemMemory} from "../../../../../../editor/src/util/fileSystems/EditorFileSystemMemory.js";
import {createMockProjectAssetType} from "../shared/createMockProjectAssetType.js";
import {createMockProjectAssetTypeManager} from "../shared/createMockProjectAssetTypeManager.js";

export const BASIC_ASSET_UUID = "BASIC_ASSET_UUID";
export const NONEXISTENT_ASSET_UUID = "NONEXISTENT_ASSET_UUID";
export const BASIC_ASSET_PATH = ["path", "to", "asset.json"];
export const BASIC_PROJECTASSETTYPE = "test:basicprojectassettype";
export const NONEXISTENT_PROJECTASSETTYPE = "test:nonexistentprojectassettype";
export const ASSET_SETTINGS_PATH = ["ProjectSettings", "assetSettings.json"];
export const DEFAULT_BASIC_ASSET_NUM_ON_DISK = 2309779523;
export const DEFAULT_BASIC_ASSET_STR_ON_DISK = "basic asset on disk";
export const BASIC_PERSISTENCE_KEY = "persistenceKey";
export const STRINGIFIED_PERSISTENCE_KEY = `"persistenceKey"`;
export const BASIC_ASSET_EXTENSION = "BASIC_ASSET_EXTENSION";

export async function basicSetup({
	waitForAssetSettingsLoad = true, assetType = BASIC_PROJECTASSETTYPE,
} = {}) {
	const mockProjectManager = /** @type {import("../../../../../../editor/src/projectSelector/ProjectManager.js").ProjectManager} */ ({});

	const mockBuiltinAssetManager = /** @type {import("../../../../../../editor/src/assets/BuiltInAssetManager.js").BuiltInAssetManager} */ ({
		assets: new Map(),
	});

	const mockBuiltInDefaultAssetLinksManager = /** @type {import("../../../../../../editor/src/assets/BuiltInDefaultAssetLinksManager.js").BuiltInDefaultAssetLinksManager} */ ({
		registeredAssetLinks: new Set(),
	});

	const {MockProjectAssetType, ProjectAssetType, MockProjectAssetTypeLiveAsset} = createMockProjectAssetType(BASIC_PROJECTASSETTYPE);

	const mockProjectAssetTypeManager = createMockProjectAssetTypeManager({
		BASIC_ASSET_EXTENSION, BASIC_PROJECTASSETTYPE,
		ProjectAssetType,
	});

	const mockFileSystem = new EditorFileSystemMemory();
	await mockFileSystem.writeJson(ASSET_SETTINGS_PATH, {
		assets: {
			[BASIC_ASSET_UUID]: {
				path: BASIC_ASSET_PATH,
			},
		},
	});
	await mockFileSystem.writeJson(BASIC_ASSET_PATH, {
		assetType,
		asset: {
			num: DEFAULT_BASIC_ASSET_NUM_ON_DISK,
			str: DEFAULT_BASIC_ASSET_STR_ON_DISK,
		},
	});

	const assetManager = new AssetManager(mockProjectManager, mockBuiltinAssetManager, mockBuiltInDefaultAssetLinksManager, mockProjectAssetTypeManager, mockFileSystem);
	if (waitForAssetSettingsLoad) {
		await assetManager.waitForAssetSettingsLoad();
	}

	return {
		assetManager,
		mockFileSystem,
		MockProjectAssetType,
		ProjectAssetType,
		MockProjectAssetTypeLiveAsset,
	};
}