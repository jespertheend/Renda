import {TreeView} from "./TreeView.js";

/**
 * @typedef {object} PropertiesTreeViewEntrySpyOnly
 * @property {unknown[][]} setValueCalls
 * @property {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").PropertiesTreeViewEntryOptions} constructorOptions
 */
/**
 * @typedef {import("./TreeView.js").TreeViewSpy & PropertiesTreeViewEntrySpyOnly} PropertiesTreeViewEntrySpy
 */

/**
 * @template {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").GuiTypeInstances} T
 * @typedef {object} PropertiesTreeViewEntryMockObjectOnly
 * @property {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").PropertiesTreeViewEntryChangeCallback<import("../../../../../studio/src/ui/propertiesTreeView/types.ts").GetValueType<T>>} fireOnValueChangeCbs
 * @property {(value: unknown) => void} setGetValueReturn
 */
/**
 * @template {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").GuiTypeInstances} T
 * @typedef {import("./TreeView.js").TreeViewMockObject & PropertiesTreeViewEntryMockObjectOnly<T>} PropertiesTreeViewEntryMockObject
 */

/**
 * @template {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").GuiTypeInstances} [T = any]
 */
export class PropertiesTreeViewEntry extends TreeView {
	/** @typedef {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").GetValueType<T>} ValueType */
	/** @typedef {(value: import("../../../../../studio/src/ui/propertiesTreeView/types.ts").PropertiesTreeViewEntryChangeCallback<ValueType>) => void} OnValueChangeCallback */

	/**
	 * @param {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").PropertiesTreeViewEntryOptions} opts
	 */
	constructor(opts) {
		super();

		/** @type {import("./TreeView.js").TreeViewSpy} */
		const superSpy = this.spy;
		/** @type {PropertiesTreeViewEntrySpy} */
		this.spy = {
			...superSpy,
			setValueCalls: [],
			constructorOptions: opts,
		};

		/** @type {import("./TreeView.js").TreeViewMockObject} */
		const superMock = this.mock;
		/** @type {PropertiesTreeViewEntryMockObject<T>} */
		this.mock = {
			...superMock,
			/**
			 * @param {any} event
			 */
			fireOnValueChangeCbs: event => {
				const castEvent = /** @type {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").PropertiesTreeViewEntryChangeCallback<ValueType>} */ (event);
				this.onValueChangeCbs.forEach(cb => cb(castEvent));
			},
			/**
			 * @param {unknown} value
			 */
			setGetValueReturn: value => {
				this.getValueReturn = value;
				this.getValueReturnSet = true;
			},
		};

		/** @private @type {Set<OnValueChangeCallback>} */
		this.onValueChangeCbs = new Set();

		/** @private @type {unknown} */
		this.getValueReturn = null;
		/** @private */
		this.getValueReturnSet = false;

		this.gui = {};
	}

	/**
	 * @param {OnValueChangeCallback} cb
	 */
	onValueChange(cb) {
		this.onValueChangeCbs.add(cb);
	}

	/**
	 * @param {unknown[]} args
	 */
	setValue(...args) {
		this.spy.setValueCalls.push(args);
	}

	get value() {
		return this.getValue();
	}

	getValue() {
		if (!this.getValueReturnSet) {
			throw new Error("getValue() was called before a mock value was set. Use .mock.setGetValueReturn() to set a mock value.");
		}
		return this.getValueReturn;
	}
}

/**
 * @template {import("../../../../../studio/src/ui/propertiesTreeView/types.ts").GuiTypeInstances} T
 * @typedef {PropertiesTreeViewEntry<T> & import("../../../../../studio/src/ui/propertiesTreeView/PropertiesTreeViewEntry.js").PropertiesTreeViewEntry<T>} MockPropertiesTreeViewEntry
 */
