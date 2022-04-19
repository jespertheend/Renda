import {assertEquals, assertExists, assertStrictEquals, assertThrows} from "std/testing/asserts";
import {injectMockEditorInstance} from "../../../../../../editor/src/editorInstance.js";
import {BASIC_ASSET_UUID, BASIC_PROJECTASSETTYPE, NONEXISTENT_ASSET_UUID, NONEXISTENT_PROJECTASSETTYPE, basicSetup} from "./shared.js";

injectMockEditorInstance(/** @type {any} */ ({}));

Deno.test({
	name: "getProjectAssetFromUuidSync()",
	async fn() {
		const {assetManager} = await basicSetup();

		const asset = assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID);

		assertExists(asset);
	},
});

Deno.test({
	name: "getProjectAssetFromUuidSync() with null",
	async fn() {
		const {assetManager} = await basicSetup();

		const asset = assetManager.getProjectAssetFromUuidSync(null);

		assertEquals(asset, null);
	},
});

Deno.test({
	name: "getProjectAssetFromUuidSync() when asset settings are not loaded returns null",
	async fn() {
		const {assetManager} = await basicSetup({waitForAssetSettingsLoad: false});

		const asset = assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID);

		assertEquals(asset, null);

		await assetManager.waitForAssetSettingsLoad();
	},
});

Deno.test({
	name: "getProjectAssetFromUuidSync() non existent",
	async fn() {
		const {assetManager} = await basicSetup();

		const asset = assetManager.getProjectAssetFromUuidSync(NONEXISTENT_ASSET_UUID);

		assertEquals(asset, null);
	},
});

Deno.test({
	name: "getProjectAssetFromUuidSync() assert asset type, valid asset type, but project asset not initialized yet",
	async fn() {
		const {assetManager, ProjectAssetType} = await basicSetup();

		assertThrows(() => {
			assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID, {
				assertAssetType: ProjectAssetType,
			});
		}, Error, `Unexpected asset type while getting project asset. Expected "test:basicprojectassettype" but got "none".`);
	},
});

Deno.test({
	name: "getProjectAssetFromUuidSync() assert asset type, valid asset type, project asset initialized",
	async fn() {
		const {assetManager, ProjectAssetType} = await basicSetup();

		const asset1 = assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID);
		assertExists(asset1);
		await asset1.waitForInit();

		const asset2 = assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID, {
			assertAssetType: ProjectAssetType,
		});

		assertExists(asset2);
		assertStrictEquals(asset1, asset2);
	},
});

Deno.test({
	name: "getProjectAssetFromUuidSync() assert asset type, invalid asset type",
	async fn() {
		const {assetManager} = await basicSetup();

		class ExpectedProjectAssetType {
			static type = "namespace:expected";
		}

		const asset = assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID);
		assertExists(asset);
		await asset.waitForInit();

		assertThrows(() => {
			assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID, {
				assertAssetType: /** @type {any} */ (ExpectedProjectAssetType),
			});
		}, Error, `Unexpected asset type while getting project asset. Expected "namespace:expected" but got "${BASIC_PROJECTASSETTYPE}".`);
	},
});

Deno.test({
	name: "getProjectAssetFromUuidSync() assert asset type, no asset type",
	async fn() {
		const {assetManager} = await basicSetup({
			assetType: NONEXISTENT_PROJECTASSETTYPE,
		});

		class ExpectedProjectAssetType {
			static type = "namespace:expected";
		}

		const asset = assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID);
		assertExists(asset);
		await asset.waitForInit();

		assertThrows(() => {
			assetManager.getProjectAssetFromUuidSync(BASIC_ASSET_UUID, {
				assertAssetType: /** @type {any} */ (ExpectedProjectAssetType),
			});
		}, Error, `Unexpected asset type while getting project asset. Expected "namespace:expected" but got "none".`);
	},
});