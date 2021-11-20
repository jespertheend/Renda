import Mesh from "../../Core/Mesh.js";
import {EDITOR_DEFAULTS_IN_COMPONENTS} from "../../engineDefines.js";
import {StorageType} from "../../index.js";
import {Material} from "../../Rendering/Material.js";
import {Component} from "../Components.js";

export default class MeshComponent extends Component {
	static get componentName() {
		return "Mesh";
	}
	static get uuid() {
		return "c7fc3a04-fa51-49aa-8f04-864c0cebf49c";
	}

	/**
	 * @override
	 */
	static get guiStructure() {
		/** @type {import("../../../editor/src/UI/PropertiesTreeView/PropertiesTreeViewEntry.js").PropertiesTreeViewStructure} */
		const structure = {
			mesh: {
				type: "droppable",
				guiOpts: {
					supportedAssetTypes: [Mesh],
				},
			},
			materials: {
				type: "array",
				guiOpts: {
					arrayType: "droppable",
					arrayGuiOpts: {
						supportedAssetTypes: [Material],
					},
				},
			},
		};
		if (EDITOR_DEFAULTS_IN_COMPONENTS) {
			const defaultMaterialAssetLinkUuid = "f1e469e3-b463-4542-952a-091487bf5b4a";
			structure.materials.guiOpts.defaultValue = [defaultMaterialAssetLinkUuid];
		}
		return structure;
	}

	/**
	 * @returns {import("../../Util/BinaryComposer.js").BinaryComposerObjectToBinaryOptions}
	 */
	static get binaryComposerOpts() {
		return {
			structure: {
				mesh: StorageType.ASSET_UUID,
				materials: [StorageType.ASSET_UUID],
			},
			nameIds: {
				mesh: 1,
				materials: 2,
			},
		};
	}

	/**
	 * @typedef {Object} MeshComponentPropertyValues
	 * @property {Mesh} [mesh]
	 * @property {Material[]} [materials]
	 */

	/**
	 * @param {MeshComponentPropertyValues} propertyValues
	 * @param {import("../Component.js").ComponentConstructorRestArgs} args
	 */
	constructor(propertyValues = {}, ...args) {
		super();

		/** @type {Mesh} */
		this.mesh = null;
		/** @type {Material[]} */
		this.materials = [];

		this.initValues(propertyValues, ...args);
	}
}
