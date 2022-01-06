import {TreeView} from "../TreeView.js";
import {VectorGui} from "../VectorGui.js";
import {NumericGui} from "../NumericGui.js";
import {BooleanGui} from "../BooleanGui.js";
import {DropDownGui} from "../DropDownGui.js";
import {TextGui} from "../TextGui.js";
import {DroppableGui} from "../DroppableGui.js";
import {ArrayGui} from "../ArrayGui.js";
import {Button} from "../Button.js";
import {LabelGui} from "../LabelGui.js";
import {ObjectGui} from "../ObjectGui.js";

import {prettifyVariableName} from "../../Util/Util.js";
import {ButtonSelectorGui} from "../ButtonSelectorGui.js";

/**
 * @typedef {Object} GuiOptions
 * @property {string} [label = ""] The label to show in front of the GUI element.
 * @property {boolean} [smallLabel = false] Set to true if you want the value GUI element to take up a bigger portion of the line.
 * @property {boolean} [disabled = false] Whether the GUI element is disabled.
 * @property {*} [defaultValue = null] The default value of the GUI element.
 */

/**
 * @typedef {Object} PropertiesTreeViewGuiOptionsMap
 * @property {import("../VectorGui.js").VectorGuiOptions<import("../../../../src/mod.js").Vec2>} vec2
 * @property {import("../VectorGui.js").VectorGuiOptions<import("../../../../src/mod.js").Vec3>} vec3
 * @property {import("../VectorGui.js").VectorGuiOptions<import("../../../../src/mod.js").Vec4>} vec4
 * @property {import("../TextGui.js").TextGuiOptions} string
 * @property {import("../NumericGui.js").NumericGuiOptions} number
 * @property {import("../BooleanGui.js").BooleanGuiOptions} boolean
 * @property {import("../Button.js").ButtonGuiOptions} button
 * @property {import("../ButtonSelectorGui.js").ButtonSelectorGuiOptions} buttonSelector
 * @property {import("../LabelGui.js").LabelGuiOptions} label
 * @property {import("../DropDownGui.js").DropDownGuiOptions} dropdown
 * @property {import("../DroppableGui.js").DroppableGuiOptions} droppable
 * @property {import("../ArrayGui.js").ArrayGuiOptions} array
 * @property {import("../ObjectGui.js").ObjectGuiOptions} object
 */

/**
 * @typedef {Object} PropertiesTreeViewGuiMap
 * @property {import("../VectorGui.js").VectorGui<import("../../../../src/mod.js").Vec2>} vec2
 * @property {import("../VectorGui.js").VectorGui<import("../../../../src/mod.js").Vec3>} vec3
 * @property {import("../VectorGui.js").VectorGui<import("../../../../src/mod.js").Vec4>} vec4
 * @property {import("../TextGui.js").TextGui} string
 * @property {import("../NumericGui.js").NumericGui} number
 * @property {import("../BooleanGui.js").BooleanGui} boolean
 * @property {import("../Button.js").Button} button
 * @property {import("../ButtonSelectorGui.js").ButtonSelectorGui} buttonSelector
 * @property {import("../LabelGui.js").LabelGui} label
 * @property {import("../DropDownGui.js").DropDownGui} dropdown
 * @property {import("../DroppableGui.js").DroppableGui<unknown>} droppable
 * @property {import("../ArrayGui.js").ArrayGui} array
 * @property {import("../ObjectGui.js").ObjectGui} object
 */

/** @typedef {keyof PropertiesTreeViewGuiOptionsMap} PropertiesTreeViewEntryType */

/**
 * @template T
 * @typedef {T extends keyof PropertiesTreeViewGuiOptionsMap ? {
 * type: T,
 * guiOpts?: PropertiesTreeViewGuiOptionsMap[T],
 * callbacksContext?: Object,
 * } : never} PropertiesTreeViewEntryOptionsGeneric
 */

/** @typedef {PropertiesTreeViewEntryOptionsGeneric<PropertiesTreeViewEntryType>} PropertiesTreeViewEntryOptions */

/** @typedef {Object.<string,PropertiesTreeViewEntryOptions>} PropertiesTreeViewStructure */

/**
 * @typedef {Object} GuiInterface
 * @property {(...args: any) => boolean} [isDefaultValue]
 * @property {boolean} [defaultValue]
 * @property {(...args: any) => any} [getValue]
 * @property {*} [value]
 * @property {function((value: any) => any) : void} [onValueChange]
 * @property {() => any} [destructor]
 * @property {(value: any) => any} [setValue]
 * @property {(disabled: boolean) => any} [setDisabled]
 */

/**
 * @template {PropertiesTreeViewEntryType} T
 * @typedef {Object} PropertiesTreeViewChangeEventType
 * @property {*} newValue
 * @property {PropertiesTreeViewEntry<T>} target
 */

/**
 * @template {PropertiesTreeViewEntryType} T
 * @typedef {import("../TreeView.js").TreeViewEvent & PropertiesTreeViewChangeEventType<T>} PropertiesTreeViewChangeEvent
 */

/**
 * @template {PropertiesTreeViewEntryType} T
 */
export class PropertiesTreeViewEntry extends TreeView {
	/**
	 * @param {PropertiesTreeViewEntryOptionsGeneric<T>} opts
	 */
	constructor({
		type,
		guiOpts = {},
		callbacksContext = {},
	}) {
		super({
			addCustomEl: true,
			selectable: false,
			rowVisible: false,
		});

		if (!this.customEl) throw new Error("Assertion failed, PropertiesTreeViewEntry should always have a customEl.");

		this.customEl.classList.add("guiTreeViewEntry");

		const smallLabel = guiOpts.smallLabel ?? false;
		this.label = document.createElement("div");
		this.label.classList.add("guiTreeViewEntryLabel");
		this.label.classList.toggle("smallLabel", smallLabel);
		this.label.textContent = prettifyVariableName(guiOpts.label);
		this.customEl.appendChild(this.label);

		this.valueEl = document.createElement("div");
		this.valueEl.classList.add("guiTreeViewEntryValue");
		this.valueEl.classList.toggle("smallLabel", smallLabel);
		this.customEl.appendChild(this.valueEl);

		/** @type {PropertiesTreeViewGuiMap[T]?} */
		this.gui = null;

		/**
		 * @template {PropertiesTreeViewEntryType} U
		 * @typedef {PropertiesTreeViewGuiOptionsMap[U]} GetGuiOpts
		 */

		this.type = type;
		/** @type {*} */
		let setGui = null;
		if (type == "string") {
			setGui = new TextGui(guiOpts);
			this.valueEl.appendChild(setGui.el);
		} else if (type === "vec2") {
			setGui = new VectorGui({
				size: 2,
				...guiOpts,
			});
			this.valueEl.appendChild(setGui.el);
		} else if (type === "vec3") {
			setGui = new VectorGui({
				size: 3,
				...guiOpts,
			});
			this.valueEl.appendChild(setGui.el);
		} else if (type === "vec4") {
			setGui = new VectorGui({
				size: 4,
				...guiOpts,
			});
			this.valueEl.appendChild(setGui.el);
		} else if (type == "number") {
			const castGuiOpts = /** @type {GetGuiOpts<typeof type>} */ (guiOpts);
			setGui = new NumericGui({
				...castGuiOpts,
			});
			this.valueEl.appendChild(setGui.el);
		} else if (type == "boolean") {
			setGui = new BooleanGui({
				...guiOpts,
			});
			this.valueEl.appendChild(setGui.el);
		} else if (type == "dropdown") {
			setGui = new DropDownGui({
				...guiOpts,
			});
			this.valueEl.appendChild(setGui.el);
		} else if (type == "array") {
			const castGuiOpts = /** @type {GetGuiOpts<typeof type>} */ (guiOpts);
			setGui = new ArrayGui({
				...castGuiOpts,
			});
			this.valueEl.appendChild(setGui.el);
			this.label.classList.add("multiLine");
			this.valueEl.classList.add("multiLine");
		} else if (type == "object") {
			setGui = new ObjectGui({
				structure: type,
				...guiOpts,
			});
			this.valueEl.appendChild(setGui.treeView.el);
			this.label.classList.add("multiLine");
			this.valueEl.classList.add("multiLine");
		} else if (type == "button") {
			setGui = new Button({
				...guiOpts,
				onClick: () => {
					const castGuiOpts = /** @type {GetGuiOpts<typeof type>} */ (guiOpts);
					if (castGuiOpts.onClick) castGuiOpts.onClick(callbacksContext);
				},
			});
			this.valueEl.appendChild(setGui.el);
		} else if (type == "buttonSelector") {
			setGui = new ButtonSelectorGui({
				...guiOpts,
			});
			this.valueEl.appendChild(setGui.el);
		} else if (type == "label") {
			setGui = new LabelGui(guiOpts);
			this.valueEl.appendChild(setGui.el);
		} else if (type == "droppable") {
			setGui = new DroppableGui({
				...guiOpts,
			});
			this.valueEl.appendChild(setGui.el);
		}
		this.gui = setGui;

		// todo: maybe instead of calling setvalue inside the constructor
		// of every gui class, call setValue over here

		this.registerNewEventType("propertiestreeviewentryvaluechange");
		const castGui = /** @type {GuiInterface} */ (this.gui);
		castGui?.onValueChange?.(newValue => {
			/** @type {PropertiesTreeViewChangeEvent<T>} */
			const event = {
				target: this,
				newValue,
			};
			this.fireEvent("propertiestreeviewentryvaluechange", event);
		});
	}

	destructor() {
		const castGui = /** @type {GuiInterface} */ (this.gui);
		castGui?.destructor?.();
		this.gui = null;
		super.destructor();
	}

	/**
	 * @param {boolean} disabled
	 */
	setDisabled(disabled) {
		const castGui = /** @type {GuiInterface} */ (this.gui);
		castGui?.setDisabled?.(disabled);
	}

	/**
	 * @typedef {PropertiesTreeViewGuiMap[T] extends {value: any} ? PropertiesTreeViewGuiMap[T]["value"] :
	 * PropertiesTreeViewGuiMap[T] extends {getValue: (...args: any) => any} ? ReturnType<PropertiesTreeViewGuiMap[T]["getValue"]> :
	 * never} GuiValueType
	 */

	/**
	 * @param {GuiValueType} newValue
	 * @param {*} setValueOpts
	 */
	setValue(newValue, setValueOpts = {}) {
		if (setValueOpts?.beforeValueSetHook) {
			newValue = setValueOpts.beforeValueSetHook({
				value: newValue,
				setOnObject: setValueOpts.setOnObject,
				setOnObjectKey: setValueOpts.setOnObjectKey,
			});
		}
		const castGui = /** @type {GuiInterface} */ (this.gui);
		if (castGui?.setValue) {
			castGui?.setValue(newValue, setValueOpts);
		} else if (castGui) {
			castGui.value = newValue;
		}
	}

	/**
	 * @param {(value: GuiValueType) => any} cb
	 */
	onValueChange(cb) {
		const castGui = /** @type {GuiInterface} */ (this.gui);
		castGui?.onValueChange?.(cb);
	}

	get value() {
		return this.getValue();
	}

	/**
	 * @param {any} guiOpts
	 * @returns {GuiValueType}
	 */
	getValue(guiOpts = {}) {
		if (!this.gui) return null;
		if (this.gui.getValue) {
			return this.gui.getValue(guiOpts);
		} else {
			return this.gui?.value;
		}
	}

	/**
	 * Useful for entries that should not have a value such as buttons, labels, etc.
	 * Is also used for stripping default values.
	 * @param {Object} guiOpts
	 * @param {import("./PropertiesTreeView.js").SerializableStructureOutputPurpose} [guiOpts.purpose]
	 * @param {boolean} [guiOpts.stripDefaultValues]
	 * @returns {boolean} If `true`, the value will be omitted from getSerializableStructureValues.
	 */
	omitFromSerializableStuctureValues(guiOpts) {
		if (this.gui instanceof Button || this.gui instanceof LabelGui) {
			return true;
		}
		let {
			purpose = "default",
			stripDefaultValues = false,
		} = guiOpts || {};
		if (purpose == "fileStorage") {
			stripDefaultValues = true;
		} else if (purpose == "binaryComposer") {
			stripDefaultValues = false;
		}
		if (stripDefaultValues) {
			const castGui = /** @type {GuiInterface} */ (this.gui);
			if (castGui.isDefaultValue) {
				if (castGui.isDefaultValue(guiOpts)) return true;
			} else if (this.gui.value == castGui.defaultValue) {
				return true;
			}
		}
		return false;
	}

	/** @typedef {import("./PropertiesTreeView.js").PropertiesTreeViewEventCbMap} PropertiesTreeViewEventCbMap */

	/**
	 * @template {keyof PropertiesTreeViewEventCbMap} T
	 * @param {T} eventType The identifier of the event type.
	 * @param {function(PropertiesTreeViewEventCbMap[T]) : void} cb The callback to invoke when the event occurs.
	 */
	addEventListener(eventType, cb) {
		// @ts-ignore
		// eslint-disable-next-line prefer-rest-params
		super.addEventListener(...arguments);
	}

	/**
	 * @template {keyof PropertiesTreeViewEventCbMap} T
	 * @param {T} eventType The identifier of the event type.
	 * @param {function(PropertiesTreeViewEventCbMap[T]) : void} cb The callback to remove.
	 */
	removeEventListener(eventType, cb) {
		// @ts-ignore
		// eslint-disable-next-line prefer-rest-params
		super.removeEventListener(...arguments);
	}

	/**
	 * Fires an event on this TreeView and its parents.
	 * @template {keyof PropertiesTreeViewEventCbMap} T
	 * @param {T} eventType The identifier of the event type.
	 * @param {PropertiesTreeViewEventCbMap[T]} event The data to pass to the event callbacks.
	 */
	fireEvent(eventType, event) {
		// @ts-ignore
		// eslint-disable-next-line prefer-rest-params
		super.fireEvent(...arguments);
	}
}
