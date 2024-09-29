import type {UuidString} from "../../../src/mod.js";
import { StudioFileSystemPath } from "../util/fileSystems/StudioFileSystem.js";
import {AssetLinkConfig} from "./DefaultAssetLink.js";

export type AssetSettingsDiskData = {
	projectFiles?: AssetSettingsProjectFile[],
	defaultAssetLinks?: {
		[x: UuidString]: AssetLinkConfig,
	},
}

export type AssetSettingsProjectFile = {
	path: StudioFileSystemPath,
	uuid?: UuidString,
	assets?: {
		[x: UuidString]: StudioFileSystemPath,
	}
}

export type BuiltInAssetSettingsDiskData = {
	projectFiles: AssetSettingsProjectFile[],
}
