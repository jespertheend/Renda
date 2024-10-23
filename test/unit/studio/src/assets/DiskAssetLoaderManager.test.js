import { assertEquals, assertExists, assertStrictEquals, assertThrows } from "std/testing/asserts.ts";
import { StudioAssetLoaderManager } from "../../../../../studio/src/assets/StudioAssetLoaderManager.js";

Deno.test({
	name: "init(), registers the default asset loaders",
	fn() {
		const manager = new StudioAssetLoaderManager();
		manager.init();

		const result = manager.getAssetLoaderByExtension("shader");

		assertExists(result);
	},
});

Deno.test({
	name: "registering an asset loader with a empty extensions array throws",
	fn() {
		const manager = new StudioAssetLoaderManager();

		assertThrows(() => {
			manager.registerAssetLoader({
				extensions: [],
			});
		}, Error, "Tried to register an asset loader with an empty extensions array.");
	},
});

Deno.test({
	name: "registering an asset loader with an empty extension string throws",
	fn() {
		const manager = new StudioAssetLoaderManager();

		assertThrows(() => {
			manager.registerAssetLoader({
				extensions: ["valid", "", "alosvalid"]
			});
		}, Error, `Tried to register an asset loader with an empty extension string.`);

		assertEquals(manager.getAssetLoaderByExtension("valid"), null);
		assertEquals(manager.getAssetLoaderByExtension("alsovalid"), null);
	},
});

Deno.test({
	name: "getAssetType() by extension",
	fn() {
		const manager = new StudioAssetLoaderManager();
		const loader = {
			extensions: ["extension"]
		}
		manager.registerAssetLoader(loader);

		const result = manager.getAssetLoaderByExtension("extension");

		assertStrictEquals(result, loader);
	},
});

Deno.test({
	name: "getAssetType() by identifier that doesn't exist",
	fn() {
		const manager = new StudioAssetLoaderManager();

		const result = manager.getAssetLoaderByExtension("nonexistent");

		assertEquals(result, null);
	},
});
