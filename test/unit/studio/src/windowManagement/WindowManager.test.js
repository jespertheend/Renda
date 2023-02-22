import {Importer} from "fake-imports";
import {stub} from "std/testing/mock.ts";
import {assertEquals, assertInstanceOf, assertStrictEquals} from "std/testing/asserts.ts";
import {installFakeDocument, uninstallFakeDocument} from "fake-dom/FakeDocument.js";
import {FakeMouseEvent} from "fake-dom/FakeMouseEvent.js";
import {injectMockStudioInstance} from "../../../../../studio/src/studioInstance.js";

const importer = new Importer(import.meta.url);
importer.redirectModule("../../../../../src/util/IndexedDbUtil.js", "../../shared/MockIndexedDbUtil.js");
importer.makeReal("../../../../../studio/src/studioInstance.js");
importer.makeReal("../../../../../src/mod.js");
importer.makeReal("../../../../../src/util/mod.js");

/** @type {import("../../../../../studio/src/windowManagement/WindowManager.js")} */
const WindowManagerMod = await importer.import("../../../../../studio/src/windowManagement/WindowManager.js");
const {WindowManager} = WindowManagerMod;

/** @type {import("../../../../../studio/src/windowManagement/StudioWindow.js")} */
const StudioWindowMod = await importer.import("../../../../../studio/src/windowManagement/StudioWindow.js");
const {StudioWindow} = StudioWindowMod;
const onFocusedWithinChangeSym = Symbol("onFocusedWithinChange");

/** @typedef {import("../../../../../studio/src/windowManagement/StudioWindow.js").StudioWindow & {[onFocusedWithinChangeSym]: Set<(hasFocus: boolean) => void>}} StudioWindowWithSym */
// eslint-disable-next-line no-unused-expressions
() => {};

stub(StudioWindow.prototype, "onFocusedWithinChange", function(cb) {
	// eslint-disable-next-line no-invalid-this
	const castThis = /** @type {StudioWindowWithSym} */ (this);
	if (!castThis[onFocusedWithinChangeSym]) {
		castThis[onFocusedWithinChangeSym] = new Set();
	}
	castThis[onFocusedWithinChangeSym].add(cb);
});

/** @type {import("../../../../../studio/src/windowManagement/SplitStudioWindow.js")} */
const StudioWindowSplitMod = await importer.import("../../../../../studio/src/windowManagement/SplitStudioWindow.js");
const {SplitStudioWindow} = StudioWindowSplitMod;

/** @type {import("../../../../../studio/src/windowManagement/TabsStudioWindow.js")} */
const StudioWindowTabsMod = await importer.import("../../../../../studio/src/windowManagement/TabsStudioWindow.js");
const {TabsStudioWindow} = StudioWindowTabsMod;
stub(TabsStudioWindow.prototype, "updateTabSelectorSpacer", () => {});

/** @type {import("../../../../../studio/src/windowManagement/contentWindows/ContentWindow.js")} */
const ContentWindowMod = await importer.import("../../../../../studio/src/windowManagement/contentWindows/ContentWindow.js");
const {ContentWindow} = ContentWindowMod;

/** @type {import("../../../../../studio/src/windowManagement/WorkspaceManager.js")} */
const WorkspaceManagerMod = await importer.import("../../../../../studio/src/windowManagement/WorkspaceManager.js");
const {WorkspaceManager} = WorkspaceManagerMod;
stub(WorkspaceManager.prototype, "getCurrentWorkspace", async () => {
	/** @type {import("../../../../../studio/src/windowManagement/WorkspaceManager.js").WorkspaceData} */
	const workspaceData = {
		rootWindow: {
			type: "split",
			splitHorizontal: true,
			splitPercentage: 0.5,
			windowA: {
				type: "tabs",
				tabTypes: ["tabtype1", "tabtype2"],
				tabUuids: ["uuid1", "uuid2"],
				activeTabIndex: 0,
			},
			windowB: {
				type: "tabs",
				tabTypes: ["tabtype3"],
				tabUuids: ["uuid3"],
				activeTabIndex: 0,
			},
		},
	};
	return workspaceData;
});

/**
 * @typedef {[name: string, value: string | boolean][]} SetValueCalls
 */

/**
 * @typedef WindowManagerTestContext
 * @property {import("../../../../../studio/src/windowManagement/WindowManager.js").WindowManager} manager
 * @property {SetValueCalls} shortcutConditionSetValueCalls
 */

/**
 * @param {object} options
 * @param {(ctx: WindowManagerTestContext) => Promise<void> | void} options.fn The test function to run.
 */
async function basicSetup({
	fn,
}) {
	installFakeDocument();

	/** @type {SetValueCalls} */
	const shortcutConditionSetValueCalls = [];

	const mockStudio = /** @type {import("../../../../../studio/src/Studio.js").Studio} */ ({
		keyboardShortcutManager: {
			getCondition(name) {
				return {
					requestValueSetter() {
						return {
							/**
							 * @param {string | boolean} value
							 */
							setValue(value) {
								shortcutConditionSetValueCalls.push([name, value]);
							},
						};
					},
				};
			},
		},
	});
	injectMockStudioInstance(mockStudio);

	try {
		const manager = new WindowManager();
		class ContentWindowTab1 extends ContentWindow {
			static contentWindowTypeId = "tabtype1";
		}
		manager.registerContentWindow(ContentWindowTab1);
		class ContentWindowTab2 extends ContentWindow {
			static contentWindowTypeId = "tabtype2";
		}
		manager.registerContentWindow(ContentWindowTab2);
		class ContentWindowTab3 extends ContentWindow {
			static contentWindowTypeId = "tabtype3";
		}
		manager.registerContentWindow(ContentWindowTab3);
		await manager.init();

		await fn({manager, shortcutConditionSetValueCalls});
	} finally {
		uninstallFakeDocument();
		injectMockStudioInstance(null);
	}
}

Deno.test({
	name: "loading basic workspace",
	async fn() {
		await basicSetup({
			fn({manager}) {
				assertInstanceOf(manager.rootWindow, SplitStudioWindow);
				assertInstanceOf(manager.rootWindow.windowA, TabsStudioWindow);
				assertInstanceOf(manager.rootWindow.windowB, TabsStudioWindow);
			},
		});
	},
});

Deno.test({
	name: "lastClickedContentWindow",
	async fn() {
		await basicSetup({
			async fn({manager, shortcutConditionSetValueCalls}) {
				assertInstanceOf(manager.rootWindow, SplitStudioWindow);
				assertInstanceOf(manager.rootWindow.windowA, TabsStudioWindow);
				const e = new FakeMouseEvent("click");
				manager.rootWindow.windowA.el.dispatchEvent(e);

				assertStrictEquals(manager.lastClickedContentWindow, manager.rootWindow.windowA.tabs[0]);
				assertEquals(shortcutConditionSetValueCalls, [["windowManager.lastClickedContentWindowTypeId", "tabtype1"]]);
			},
		});
	},
});

Deno.test({
	name: "lastFocusedContentWindow",
	async fn() {
		await basicSetup({
			async fn({manager, shortcutConditionSetValueCalls}) {
				assertInstanceOf(manager.rootWindow, SplitStudioWindow);
				assertInstanceOf(manager.rootWindow.windowA, TabsStudioWindow);
				const castWindow = /** @type {StudioWindowWithSym} */ (/** @type {unknown} */ (manager.rootWindow.windowA));
				castWindow[onFocusedWithinChangeSym].forEach(cb => cb(true));

				assertStrictEquals(manager.lastFocusedContentWindow, manager.rootWindow.windowA.tabs[0]);
				assertEquals(shortcutConditionSetValueCalls, [["windowManager.lastFocusedContentWindowTypeId", "tabtype1"]]);
			},
		});
	},
});
