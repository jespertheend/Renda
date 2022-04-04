import {AssertionError, assert, assertEquals, assertThrows} from "asserts";
import {waitForMicrotasks} from "../../../../shared/waitForMicroTasks.js";
import {BASIC_PROJECTASSETTYPE, basicSetup} from "./shared.js";

Deno.test({
	name: "creating with isEmbedded true",
	fn() {
		const {projectAsset} = basicSetup({
			setMockEmbeddedParent: true,
		});

		assertEquals(projectAsset.isEmbedded, true);
	},
});

Deno.test({
	name: "readAssetData() on an embedded asset is an empty object by default",
	async fn() {
		const {projectAsset, mocks} = basicSetup({
			setMockEmbeddedParent: true,
			extraProjectAssetOpts: {
				assetType: BASIC_PROJECTASSETTYPE,
				path: [],
			},
		});

		mocks.fileSystem.readFile = async () => {
			throw new AssertionError("embedded assets should not read from disk.");
		};

		const result = await projectAsset.readAssetData();
		assertEquals(result, {});
	},
});

Deno.test({
	name: "writeAssetData() and then readAssetData() on an embedded asset",
	async fn() {
		const {projectAsset, mocks, mockParent} = basicSetup({
			setMockEmbeddedParent: true,
			extraProjectAssetOpts: {
				assetType: BASIC_PROJECTASSETTYPE,
				path: [],
			},
		});

		mocks.fileSystem.readFile = async () => {
			throw new AssertionError("embedded assets should not read from disk.");
		};
		mocks.fileSystem.writeFile = async () => {
			throw new AssertionError("embedded assets should not write to disk.");
		};

		const writeData = {
			num: 123,
			str: "foo",
		};

		/** @type {Set<() => void>} */
		const needsSavePromises = new Set();
		let needsSaveCallCount = 0;
		mockParent.childEmbeddedAssetNeedsSave = async () => {
			needsSaveCallCount++;
			/** @type {Promise<void>} */
			const promise = new Promise(r => needsSavePromises.add(r));
			await promise;
		};

		const writeAssetDataPromise = projectAsset.writeAssetData(writeData);

		let resolved = false;
		writeAssetDataPromise.then(() => {
			resolved = true;
		});
		await waitForMicrotasks();

		assert(!resolved, "writeEmbeddedAssetData() should not resolve until its parent childEmbeddedAssetNeedsSave() resolves.");

		needsSavePromises.forEach(r => r());
		await writeAssetDataPromise;

		assertEquals(needsSaveCallCount, 1);

		writeData.str = "modification";

		const result = await projectAsset.readAssetData();
		assert(result.str != "modification", "writeAssetData() should make a copy of the data");
		assertEquals(result, {
			num: 123,
			str: "foo",
		});

		result.str = "modification";
		const result2 = await projectAsset.readAssetData();
		assert(result2.str != "modification", "readAssetData() should make a copy of the data");
	},
});

Deno.test({
	name: "readEmbeddedAssetData() throws if the asset is not an embedded asset",
	async fn() {
		const {projectAsset} = basicSetup();

		assertThrows(() => {
			projectAsset.readEmbeddedAssetData();
		}, Error, "Unable to read embeddedassetData, asset is not an embedded asset.");
	},
});

Deno.test({
	name: "writeEmbeddedAssetDataImmediate() throws if the asset is not an embedded asset",
	async fn() {
		const {projectAsset} = basicSetup();

		assertThrows(() => {
			projectAsset.writeEmbeddedAssetDataImmediate({
				num: 123,
				str: "foo",
			});
		}, Error, "Unable to write embeddedassetData, asset is not an embedded asset.");
	},
});

Deno.test({
	name: "writeEmbeddedAssetDataImmediate() and then readEmbeddedAssetData() on an embedded asset",
	async fn() {
		const {projectAsset, mocks} = basicSetup({
			setMockEmbeddedParent: true,
			extraProjectAssetOpts: {
				assetType: BASIC_PROJECTASSETTYPE,
				path: [],
			},
		});

		mocks.fileSystem.readFile = async () => {
			throw new AssertionError("embedded assets should not read from disk.");
		};
		mocks.fileSystem.writeFile = async () => {
			throw new AssertionError("embedded assets should not write to disk.");
		};

		const writeData = {
			num: 123,
			str: "foo",
		};

		projectAsset.writeEmbeddedAssetDataImmediate(writeData);

		writeData.str = "modification";

		const result = projectAsset.readEmbeddedAssetData();
		assert(result.str != "modification", "writeAssetData() should make a copy of the data");
		assertEquals(result, {
			num: 123,
			str: "foo",
		});

		result.str = "modification";
		const result2 = projectAsset.readEmbeddedAssetData();
		assert(result2.str != "modification", "readAssetData() should make a copy of the data");
	},
});

Deno.test({
	name: "childEmbeddedAssetNeedsSave() for an asset type without a propertiesAssetContentStructure",
	async fn() {
		const {projectAsset} = basicSetup({
			extraProjectAssetOpts: {
				assetType: BASIC_PROJECTASSETTYPE,
				path: ["path", "to", "asset"],
			},
		});

		await projectAsset.childEmbeddedAssetNeedsSave();
	},
});

Deno.test({
	name: "writeEmbeddedAssetData() calls childEmbeddedAssetNeedsSave the parent",
	async fn() {
		const {projectAsset, mockParent} = basicSetup({
			setMockEmbeddedParent: true,
			extraProjectAssetOpts: {
				assetType: BASIC_PROJECTASSETTYPE,
				path: ["path", "to", "asset"],
			},
		});

		/** @type {Set<() => void>} */
		const needsSavePromises = new Set();
		let needsSaveCallCount = 0;
		mockParent.childEmbeddedAssetNeedsSave = async () => {
			needsSaveCallCount++;
			/** @type {Promise<void>} */
			const promise = new Promise(r => needsSavePromises.add(r));
			await promise;
		};

		const writePromise = projectAsset.writeEmbeddedAssetData({
			num: 123,
			str: "foo",
		});

		let resolved = false;
		writePromise.then(() => {
			resolved = true;
		});
		await waitForMicrotasks();

		assert(!resolved, "writeEmbeddedAssetData() should not resolve until its parent childEmbeddedAssetNeedsSave() resolves.");

		needsSavePromises.forEach(r => r());

		await writePromise;

		assertEquals(needsSaveCallCount, 1);
	},
});