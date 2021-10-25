import {isUuid} from "../index.js";
import {Component} from "./Components.js";

export default class ComponentTypeManager {
	constructor() {
		this.components = new Map(); // Map<uuid, componentData>
	}

	/**
	 * @param {typeof Component} constructor
	 */
	registerComponent(constructor) {
		if (!(constructor.prototype instanceof Component)) {
			console.warn("Tried to register Component (" + constructor.name + ") that does not extend the Component class.");
			return;
		}
		if (!isUuid(constructor.uuid)) {
			console.warn("Tried to register Component (" + constructor.name + ") without a valid uuid value, override the static uuid value in order for this loader to function properly.");
			return;
		}

		this.components.set(constructor.uuid, constructor);
	}

	/**
	 * @param {import("../../editor/src/Util/Util.js").UuidString} uuid
	 * @returns {typeof Component}
	 */
	getComponentConstructorForUuid(uuid) {
		return this.components.get(uuid);
	}

	*getAllComponents() {
		for (const component of this.components.values()) {
			yield component;
		}
	}
}
