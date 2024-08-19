import { assertEquals, assertExists, assertStrictEquals, assertThrows } from "std/testing/asserts.ts";
import "../../shared/initializeStudio.js";
import { ProjectAssetTypeManager } from "../../../../../studio/src/assets/ProjectAssetTypeManager.js";

const BASIC_UUID = "00000000-0000-0000-0000-000000000000";
const BASIC_UUID2 = "00000000-0000-0000-0000-000000000001";
const BASIC_ASSET_TYPE = "namespace:type";
const BASIC_ASSET_TYPE2 = "namespace:type2";

function createBasicProjectAssetType() {
	/** @type {import("../../../../../studio/src/assets/ProjectAssetTypeManager.js").ProjectAssetTypeAny} */
	const projectAssetType = {
		type: BASIC_ASSET_TYPE,
		typeUuid: BASIC_UUID,
	};
	return projectAssetType;
}

Deno.test({
	name: "init(), registers the default asset types",
	fn() {
		const manager = new ProjectAssetTypeManager();
		manager.init();

		const result = manager.getAssetType("renda:mesh");

		assertExists(result);
	},
});

Deno.test({
	name: "registering an asset type with a missing 'type' property throws",
	fn() {
		const manager = new ProjectAssetTypeManager();

		assertThrows(() => {
			manager.registerAssetType(/** @type {import("../../../../../studio/src/assets/ProjectAssetTypeManager.js").ProjectAssetTypeAny} */ (/** @type {unknown} */ ({})));
		}, Error, "Tried to register a project asset type without a type property.");
	},
});

Deno.test({
	name: "registering an asset type with an incorrect 'type' format throws",
	fn() {
		const manager = new ProjectAssetTypeManager();

		assertThrows(() => {
			manager.registerAssetType({
				type: "missingColon",
				typeUuid: "",
			});
		}, Error, `Tried to register project asset type with an invalid format: "missingColon". The 'type' property should have the format "namespace:identifier". For example: "renda:mesh".`);
		assertThrows(() => {
			manager.registerAssetType({
				type: ":noNamespace",
				typeUuid: "",
			});
		}, Error, `Tried to register project asset type with an invalid format: ":noNamespace". The 'type' property should have the format "namespace:identifier". For example: "renda:mesh".`);
		assertThrows(() => {
			manager.registerAssetType({
				type: "noType:",
				typeUuid: "",
			});
		}, Error, `Tried to register project asset type with an invalid format: "noType:". The 'type' property should have the format "namespace:identifier". For example: "renda:mesh".`);
	},
});

Deno.test({
	name: "registering an asset type with a wrong 'typeUuid' property throws",
	fn() {
		const manager = new ProjectAssetTypeManager();

		const wrongUuids = [
			null,
			"not an uuid",
			"also-not-an-uuid",
		];

		for (const [i, wrongUuid] of wrongUuids.entries()) {
			const type = "namespace:type" + i;
			assertThrows(() => {
				manager.registerAssetType({
					type,
					typeUuid: /** @type {import("../../../../../src/mod.js").UuidString} */ (wrongUuid),
				});
			}, Error, `Tried to register project asset type ("${type}") without a valid 'typeUuid' property.`);
		}
	},
});

Deno.test({
	name: "getAssetType() by identifier",
	fn() {
		const manager = new ProjectAssetTypeManager();
		const projectAssetType = createBasicProjectAssetType();
		manager.registerAssetType(projectAssetType);

		const result = manager.getAssetType(BASIC_ASSET_TYPE);

		assertStrictEquals(result, projectAssetType);
	},
});

Deno.test({
	name: "getAssetType() by identifier that doesn't exist",
	fn() {
		const manager = new ProjectAssetTypeManager();

		const result = manager.getAssetType(BASIC_ASSET_TYPE);

		assertEquals(result, null);
	},
});

Deno.test({
	name: "getAssetTypeIds()",
	fn() {
		const manager = new ProjectAssetTypeManager();
		manager.registerAssetType(createBasicProjectAssetType());

		const result = Array.from(manager.getAssetTypeIds());
		assertEquals(result, [BASIC_ASSET_TYPE]);
	},
});

Deno.test({
	name: "getAssetTypeByUuid()",
	fn() {
		const manager = new ProjectAssetTypeManager();
		const projectAssetType = createBasicProjectAssetType();
		manager.registerAssetType(projectAssetType);

		const result = manager.getAssetTypeByUuid(BASIC_UUID);

		assertStrictEquals(result, projectAssetType);
	},
});

Deno.test({
	name: "getAssetTypeByUuid() that doesn't exist",
	fn() {
		const manager = new ProjectAssetTypeManager();

		const result = manager.getAssetTypeByUuid(BASIC_UUID);

		assertEquals(result, null);
	},
});

Deno.test({
	name: "getAssetTypesForLiveAssetConstructor()",
	fn() {
		const manager = new ProjectAssetTypeManager();

		class MockConstructor {}

		/** @extends {ProjectAssetType<any, any, any, any>} */
		class AssetType1 extends ProjectAssetType {
			static type = BASIC_ASSET_TYPE;
			static typeUuid = BASIC_UUID;
			static expectedLiveAssetConstructor = MockConstructor;
		}
		manager.registerAssetType(AssetType1);

		/** @extends {ProjectAssetType<any, any, any, any>} */
		class AssetType2 extends ProjectAssetType {
			static type = BASIC_ASSET_TYPE2;
			static typeUuid = BASIC_UUID2;
			static expectedLiveAssetConstructor = MockConstructor;
		}
		manager.registerAssetType(AssetType2);

		const result = Array.from(manager.getAssetTypesForLiveAssetConstructor(MockConstructor));

		assertEquals(result.length, 2);
		assertStrictEquals(result[0], AssetType1);
		assertStrictEquals(result[1], AssetType2);
	},
});

Deno.test({
	name: "constructorHasAssetType true",
	fn() {
		const manager = new ProjectAssetTypeManager();

		class MockConstructor {}

		/** @extends {ProjectAssetType<any, any, any, any>} */
		class AssetType1 extends ProjectAssetType {
			static type = BASIC_ASSET_TYPE;
			static typeUuid = BASIC_UUID;
			static expectedLiveAssetConstructor = MockConstructor;
		}
		manager.registerAssetType(AssetType1);

		const result = manager.constructorHasAssetType(MockConstructor);

		assertEquals(result, true);
	},
});

Deno.test({
	name: "constructorHasAssetType false",
	fn() {
		const manager = new ProjectAssetTypeManager();

		class MockConstructor {}

		const result = manager.constructorHasAssetType(MockConstructor);

		assertEquals(result, false);
	},
});

Deno.test({
	name: "getAssetTypesForExtension()",
	fn() {
		const manager = new ProjectAssetTypeManager();

		/** @extends {ProjectAssetType<any, any, any, any>} */
		class AssetType1 extends ProjectAssetType {
			static type = BASIC_ASSET_TYPE;
			static typeUuid = BASIC_UUID;
			static matchExtensions = ["ext1"];
		}
		manager.registerAssetType(AssetType1);

		/** @extends {ProjectAssetType<any, any, any, any>} */
		class AssetType2 extends ProjectAssetType {
			static type = BASIC_ASSET_TYPE2;
			static typeUuid = BASIC_UUID2;
			static newFileExtension = "ext1";
		}
		manager.registerAssetType(AssetType2);

		const result = Array.from(manager.getAssetTypesForExtension("ext1"));

		assertEquals(result.length, 2);
		assertStrictEquals(result[0], AssetType1);
		assertStrictEquals(result[1], AssetType2);
	},
});
