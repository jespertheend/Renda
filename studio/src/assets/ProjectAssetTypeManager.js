import { autoRegisterAssetTypes } from "./autoRegisterAssetTypes.js";
import { isUuid } from "../../../src/util/mod.js";

/** @typedef {string & {}} ProjectAssetTypeIdentifier */
/** @typedef {object | string | "binary" | undefined} ProjectAssetDiskDataType */


/**
 * @template TLiveAsset
 * @template TStudioData
 * @typedef {object} LiveAssetData
 * @property {TLiveAsset} liveAsset Live asset data is an object, usually an instance of a class, that is kept
 * in memory as long as renda studio needs it. This can be a Texture or Material instance for example.
 * @property {TStudioData} studioData Studio data is useful for storing info along with binary files that can't be stored in the assets themselves,
 * such as jpeg or glb files.
 */

/** @typedef {LiveAssetData<any, any>} LiveAssetDataAny */

/**
 * @template {ProjectAssetDiskDataType} T
 * @typedef {T extends "binary" ? Blob : T} ProjectAssetTypeGetFileData
 */
/**
 * @template {ProjectAssetDiskDataType} T
 * @typedef {T extends "binary" ? BlobPart : T} ProjectAssetTypeSaveFileData
 */

/**
 * ProjectAssetTypes are used to configure behaviour like parsing data
 * before reading/writing to disk and creating live assets among other things.
 *
 * If all you want to do is create an asset type that stores basic data with
 * basic properties ui, see `ProjectAssetTypeWebGpuPipelineConfig` for a good
 * example on how to do this.
 *
 * For a more complicated example, see `ProjectAssetTypeMaterial`.
 *
 * If you want an asset that is not a live asset, but only available in studio,
 * have a look at `ProjectAssetTypeAssetBundle`. It only configures a minimal amount.
 * Most of it is implemented in its `propertiesAssetContentConstructor`.
 * @template {any} TLiveAsset
 * @template {any} TStudioData
 * @template {ProjectAssetDiskDataType} TFileData
 * @template {any} [TAssetSettings = null]
 * @typedef ProjectAssetType
 * @property {ProjectAssetTypeIdentifier} id Identifier of the assetType. This is stored in various places
 * such as the asset settings file or the wrapped studio meta data.
 * This should have the format "namespace:assetType", for example: "renda:mesh".
 * @property {import("../../../src/mod.js").UuidString} uuid This will be used for storing the asset type in asset bundles.
 * This should have the format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".
 * You can generate a uuid in the browser console of studio using `Util.generateUuid()`.
 * @property {string[]} [matchExtensions] This is used to find out what type an asset is when it isn't json.
 * If this value is omitted and storeInProjectAsJson is false, `newFileExtension` will be used instead.
 * @property {string} [newFileName] Filename used when creating new assets of this type.
 * @property {string} [newFileExtension] Extension used when creating new assets of this type.
 * @property {string} [uiName] The text that is shown in ui when choosing from a list of asset types when creating a new asset.
 * @property {boolean} [storeInProjectAsJson] Defaults to true. When set to true,
 * the disk representation of the asset is expected to be a json file.
 * @property {boolean} [storeInProjectAsText] Defaults to false. When set to true,
 * the disk representation of the asset is expected to be a txt file.
 * @property {boolean} [wrapProjectJsonWithStudioMetaData] Defaults to true. When set to true,
 * the disk representation of the asset contains extra metadata such as the asset type and other asset settings.
 * @property {import("../ui/propertiesTreeView/types.ts").PropertiesTreeViewStructure} [propertiesAssetContentStructure] When set, the properties window will show ui generated from this structure.
 * This object will be fed into {@linkcode PropertiesTreeView.generateFromSerializableStructure}.
 * You can omit this if you don't want to show any ui or if you want to create custom ui using `propertiesAssetContentConstructor`.
 * @property {new (studio: import("../Studio.js").Studio) => import("../propertiesAssetContent/PropertiesAssetContent.js").PropertiesAssetContent<any>} [propertiesAssetContentConstructor] Set this to the constructor of an extended {@linkcode PropertiesAssetContent} class for
 * low level control over the properties window ui.
 * Alternatively, you can set `propertiesAssetContentStructure` to quickly create more basic ui.
 * @property {import("../ui/propertiesTreeView/types.ts").PropertiesTreeViewStructure} [assetSettingsStructure] Fill this with asset settings you want to appear in the properties window.
 * @property {(fileData: ProjectAssetTypeGetFileData<TFileData>?, recursionTracker: import("./liveAssetDataRecursionTracker/RecursionTracker.js").RecursionTracker) => Promise<LiveAssetData<TLiveAsset, TStudioData>>} [diskToLiveAssetData] This should convert the asset from disk data to live asset data.
 */

/** @typedef {ProjectAssetType<any, any, any, any>} ProjectAssetTypeAny */
/** @typedef {ProjectAssetType<unknown, unknown, object, unknown>} ProjectAssetTypeUnknown */

/**
 * @typedef {{
 * 	[AssetType in (typeof autoRegisterAssetTypes)[number] as AssetType["id"]]: AssetType;
 * }} ProjectAssetTypesByType
 */

export class ProjectAssetTypeManager {
	/** @type {Map<ProjectAssetTypeIdentifier, ProjectAssetTypeAny>} */
	#registeredAssetTypes = new Map();

	init() {
		for (const t of autoRegisterAssetTypes) {
			this.registerAssetType(t);
		}
	}

	/**
	 * @param {ProjectAssetTypeAny} projectAssetType
	 */
	registerAssetType(projectAssetType) {
		const { id } = projectAssetType;
		if (!id) {
			throw new Error("Tried to register a project asset type without an 'id' property.");
		}
		if (!id.includes(":") || id.split(":").filter((str) => Boolean(str)).length != 2) {
			throw new Error(`Tried to register project asset type with an invalid id format: "${id}". The 'id' property should have the format "namespace:identifier". For example: "myplugin:myasset".`);
		}
		if (!projectAssetType.uuid || !isUuid(projectAssetType.uuid)) {
			throw new Error(`Tried to register project asset type ("${id}") without a valid 'uuid' property.`);
		}

		this.#registeredAssetTypes.set(id, projectAssetType);
	}

	/**
	 * @param {ProjectAssetTypeIdentifier} type
	 */
	getAssetType(type) {
		return this.#registeredAssetTypes.get(type) ?? null;
	}

	*getAssetTypeIds() {
		for (const id of this.#registeredAssetTypes.keys()) {
			yield id;
		}
	}

	/**
	 * @param {import("../../../src/util/mod.js").UuidString} uuid
	 */
	getAssetTypeByUuid(uuid) {
		for (const assetType of this.#registeredAssetTypes.values()) {
			if (assetType.uuid == uuid) {
				return assetType;
			}
		}
		return null;
	}

	/**
	 * @param {new (...args: any) => any} constructor
	 */
	*getAssetTypesForLiveAssetConstructor(constructor) {
		for (const assetType of this.#registeredAssetTypes.values()) {
			if (assetType.expectedLiveAssetConstructor == constructor) {
				yield assetType;
			}
		}
	}

	/**
	 * @param {new (...args: any) => any} constructor
	 */
	constructorHasAssetType(constructor) {
		const generatorEmpty = this.getAssetTypesForLiveAssetConstructor(constructor).next().done;
		return !generatorEmpty;
	}

	/**
	 * @param {string} extension
	 */
	*getAssetTypesForExtension(extension) {
		for (const assetType of this.#registeredAssetTypes.values()) {
			if (assetType.matchExtensions.length > 0) {
				if (assetType.matchExtensions.includes(extension)) yield assetType;
			} else if (extension == assetType.newFileExtension) {
				yield assetType;
			}
		}
	}
}
