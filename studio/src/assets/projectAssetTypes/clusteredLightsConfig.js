import { AssetLoaderTypeClusteredLightsConfig, ClusteredLightsConfig, Vec3 } from "../../../../src/mod.js";

export const clusteredLightsConfigProjectAssetType = /** @satisfies {import("../ProjectAssetTypeManager.js").ProjectAssetType<ClusteredLightsConfig, null, import("../../../../src/rendering/ClusteredLightsConfig.js").ClusteredLightsConfigOptions>} @type {const} */ ({
	id: "renda:clusteredLightsConfig",
	uuid: "13194e5c-01e8-4ecc-b645-86626b9d5e4c",
	newFileName: "New Clustered Lights Config",
	uiName: "Clustered Lights Config",
	propertiesAssetContentStructure: {
		clusterCount: {
			type: "vec3",
			guiOpts: {
				min: 1,
				step: 1,
				defaultValue: new Vec3(16, 9, 24),
			},
		},
		maxLightsPerClusterPass: {
			type: "number",
			guiOpts: {
				min: 1,
				step: 1,
				defaultValue: 10,
			},
		},
	},
	// static expectedLiveAssetConstructor = ClusteredLightsConfig;
	// static usedAssetLoaderType = AssetLoaderTypeClusteredLightsConfig;

	// /** @type {import("../../tasks/task/TaskGenerateServices.js").AssetLoaderTypeImportConfig} */
	// static assetLoaderTypeImportConfig = {
	// 	identifier: "AssetLoaderTypeClusteredLightsConfig",
	// };

	async diskToLiveAssetData(fileData) {
		const liveAsset = new ClusteredLightsConfig(fileData || {});
		return { liveAsset, studioData: null };
	}
});
