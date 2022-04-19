import {assertEquals, assertStrictEquals} from "std/testing/asserts";
import {ComponentGizmos} from "../../../../../../editor/src/componentGizmos/gizmos/ComponentGizmos.js";
import {Gizmo} from "../../../../../../src/mod.js";

const mockEditor = /** @type {import("../../../../../../editor/src/Editor.js").Editor} */ ({});
const mockComponent = /** @type {import("../../../../../../src/mod.js").Component} */ ({});
function getMockGizmoManager() {
	/** @type {unknown[]} */
	const addGizmoCalls = [];
	/** @type {unknown[]} */
	const removeGizmoCalls = [];
	const mockGizmoManager = /** @type {import("../../../../../../src/mod.js").GizmoManager} */ ({
		addGizmo(gizmo) {
			addGizmoCalls.push(gizmo);
			return /** @type {import("../../../../../../src/gizmos/gizmos/Gizmo.js").Gizmo} */ ({});
		},
		removeGizmo(gizmo) {
			removeGizmoCalls.push(gizmo);
		},
	});
	return {
		mockGizmoManager,
		addGizmoCalls,
		removeGizmoCalls,
	};
}

class ExtendedGizmo extends Gizmo {}

/**
 * @extends {ComponentGizmos<typeof mockComponent, [ExtendedGizmo]>}
 */
class ExtendedComponentGizmos extends ComponentGizmos {
	static requiredGizmos = [ExtendedGizmo];
}

Deno.test({
	name: "creating a ComponentGizmos instance automatically creates the required gizmos",
	fn() {
		const {mockGizmoManager, addGizmoCalls} = getMockGizmoManager();
		const componentGizmos = new ExtendedComponentGizmos(mockEditor, mockComponent, mockGizmoManager);

		assertEquals(componentGizmos.createdGizmos.length, 1);
		assertEquals(addGizmoCalls.length, 1);
		assertStrictEquals(addGizmoCalls[0], ExtendedGizmo);
	},
});

Deno.test({
	name: "destructor removes the created gizmos from the manager",
	fn() {
		const {mockGizmoManager, removeGizmoCalls} = getMockGizmoManager();
		const componentGizmos = new ExtendedComponentGizmos(mockEditor, mockComponent, mockGizmoManager);

		componentGizmos.destructor();

		assertEquals(removeGizmoCalls.length, 1);
	},
});
