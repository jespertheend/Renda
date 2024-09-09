import type {UuidString} from "../../../src/mod.js";
import {AssetLinkConfig} from "./DefaultAssetLink.js";

export type AssetSettingsDiskData = {
	assets?: {
		[x: UuidString]: AssetSettingsAssetDiskData,
	},
	defaultAssetLinks?: {
		[x: UuidString]: AssetLinkConfig,
	},
}

export type AssetSettingsAssetDiskData = {
	path: string[],
	assetSettings?: Object,
}
