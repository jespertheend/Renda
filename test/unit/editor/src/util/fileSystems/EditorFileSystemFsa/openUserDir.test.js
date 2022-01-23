import {assert} from "https://deno.land/std@0.118.0/testing/asserts.ts";
import {EditorFileSystemFsa} from "../../../../../../../editor/src/util/fileSystems/EditorFileSystemFsa.js";
import {FakeHandle} from "./shared.js";

Deno.test({
	name: "openUserDir",
	fn: async () => {
		const mockHandle = /** @type {any} */ (new FakeHandle("directory", ""));
		const mockShowDirectoryPicker = async () => {
			return mockHandle;
		};
		const castGlobalThis = /** @type {any} */ (globalThis);
		castGlobalThis.showDirectoryPicker = mockShowDirectoryPicker;

		const fs = await EditorFileSystemFsa.openUserDir();

		assert(fs.handle === mockHandle);
	},
});