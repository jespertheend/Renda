import {assert, assertEquals} from "asserts";
import {Mat4, Vec2, Vec3} from "../../../../src/mod.js";
import {elementSpaceToScreenSpace, getRaycastRayFromScreenPos, screenSpaceToElementSpace, worldToScreenPos} from "../../../../src/util/cameraUtil.js";
import {assertVecAlmostEquals} from "../../shared/asserts.js";
import {HtmlElement} from "../../shared/fakeDom/FakeHtmlElement.js";

Deno.test({
	name: "worldToScreenPos, with world matrix",
	fn: () => {
		const projectionMatrix = Mat4.createPerspective(90, 0.01, 1000);
		const worldMatrix = Mat4.createTranslation(0, 1, 0);

		const pos = worldToScreenPos(new Vec3(0, 1, 1), projectionMatrix, worldMatrix);

		assertEquals([pos.x, pos.y], [0, 0]);
	},
});

Deno.test({
	name: "worldToScreenPos, no world matrix",
	fn: () => {
		const projectionMatrix = Mat4.createPerspective(90, 0.01, 1000);

		const pos = worldToScreenPos(new Vec3(0, 0, 1), projectionMatrix);

		assertEquals([pos.x, pos.y], [0, 0]);
	},
});

Deno.test({
	name: "worldToScreenPos, slightly up",
	fn: () => {
		const projectionMatrix = Mat4.createPerspective(90, 0.01, 1000);

		const pos = worldToScreenPos(new Vec3(0, 0.1, 1), projectionMatrix);

		assertEquals(pos.x, 0);
		assert(pos.y > 0, "pos.y > 0");
	},
});

Deno.test({
	name: "worldToScreenPos, slightly down",
	fn: () => {
		const projectionMatrix = Mat4.createPerspective(90, 0.01, 1000);

		const pos = worldToScreenPos(new Vec3(0, -0.1, 1), projectionMatrix);

		assertEquals(pos.x, 0);
		assert(pos.y < 0, "pos.y < 0");
	},
});

Deno.test({
	name: "worldToScreenPos, slightly left",
	fn: () => {
		const projectionMatrix = Mat4.createPerspective(90, 0.01, 1000);

		const pos = worldToScreenPos(new Vec3(-0.1, 0, 1), projectionMatrix);

		assert(pos.x < 0, "pos.x < 0");
		assertEquals(pos.y, 0);
	},
});

Deno.test({
	name: "worldToScreenPos, slightly right",
	fn: () => {
		const projectionMatrix = Mat4.createPerspective(90, 0.01, 1000);

		const pos = worldToScreenPos(new Vec3(0.1, 0, 1), projectionMatrix);

		assert(pos.x > 0, "pos.x > 0");
		assertEquals(pos.y, 0);
	},
});

Deno.test({
	name: "getRaycastRayFromScreenPos, with world matrix",
	fn: () => {
		const worldMatrix = Mat4.createTranslation(0, 1, 0);
		const projectionMatrix = Mat4.createPerspective(90, 1, 10);
		const {start, dir} = getRaycastRayFromScreenPos(new Vec2(0.5, 0.5), projectionMatrix, worldMatrix);

		assert(start.x > 0.49 && start.x < 0.51, "start.x is not near 0.5");
		assert(start.y > 1.49 && start.y < 1.51, "start.y is not near 1.5");
		assert(start.z > 0.99 && start.z < 1.01, "start.z is not near 1.0");

		assert(dir.magnitude > 0.99 && dir.magnitude < 1.01, "dir.magnitude is not normalized");

		assert(dir.x > 0.3 && dir.x < 0.5, "dir.x is not near 0.4");
		assert(dir.y > 0.3 && dir.y < 0.5, "dir.y is not near 0.4");
		assert(dir.z > 0.7 && dir.z < 0.9, "dir.z is not near 0.8");
	},
});

Deno.test({
	name: "getRaycastRayFromScreenPos, no world matrix",
	fn: () => {
		const projectionMatrix = Mat4.createPerspective(90, 1, 10);
		const {start, dir} = getRaycastRayFromScreenPos(new Vec2(0.5, 0.5), projectionMatrix);

		assert(start.x > 0.49 && start.x < 0.51, "start.x is not near 0.5");
		assert(start.y > 0.49 && start.y < 0.51, "start.y is not near 0.5");
		assert(start.z > 0.99 && start.z < 1.01, "start.z is not near 1.0");

		assert(dir.magnitude > 0.99 && dir.magnitude < 1.01, "dir.magnitude is not normalized");

		assert(dir.x > 0.3 && dir.x < 0.5, "dir.x is not near 0.4");
		assert(dir.y > 0.3 && dir.y < 0.5, "dir.y is not near 0.4");
		assert(dir.z > 0.7 && dir.z < 0.9, "dir.z is not near 0.8");
	},
});

Deno.test({
	name: "elementSpaceToScreenSpace()",
	fn: () => {
		const el = new HtmlElement({
			x: 100,
			y: 100,
			clientWidth: 100,
			clientHeight: 100,
		});

		const screen1 = elementSpaceToScreenSpace(el, 150, 150);
		assertVecAlmostEquals(screen1, [0, 0]);

		const screen2 = elementSpaceToScreenSpace(el, [100, 100]);
		assertVecAlmostEquals(screen2, [-1, -1]);

		const screen3 = elementSpaceToScreenSpace(el, new Vec2(200, 200));
		assertVecAlmostEquals(screen3, [1, 1]);
	},
});

Deno.test({
	name: "elementSpaceToScreenSpace() out of bounds",
	fn: () => {
		const el = new HtmlElement({
			x: 100,
			y: 100,
			clientWidth: 100,
			clientHeight: 100,
		});

		const screen = elementSpaceToScreenSpace(el, 250, 250);
		assertVecAlmostEquals(screen, [2, 2]);
	},
});

Deno.test({
	name: "elementSpaceToScreenSpace() with padding, left top",
	fn: () => {
		const el = new HtmlElement({
			x: 100,
			y: 100,
			clientWidth: 100,
			clientHeight: 100,
			paddingLeft: 50,
			paddingTop: 50,
		});

		const screen1 = elementSpaceToScreenSpace(el, 100, 100);
		assertVecAlmostEquals(screen1, [-2, -2]);
	},
});

Deno.test({
	name: "elementSpaceToScreenSpace() with padding, right bottom",
	fn: () => {
		const el = new HtmlElement({
			x: 100,
			y: 100,
			clientWidth: 100,
			clientHeight: 100,
			paddingRight: 50,
			paddingBottom: 50,
		});

		const screen1 = elementSpaceToScreenSpace(el, 200, 200);
		assertVecAlmostEquals(screen1, [1, 1]);
	},
});

Deno.test({
	name: "screenSpaceToElementSpace()",
	fn: () => {
		const el = new HtmlElement({
			x: 100,
			y: 100,
			clientWidth: 100,
			clientHeight: 100,
		});

		const screen1 = screenSpaceToElementSpace(el, 0, 0);
		assertVecAlmostEquals(screen1, [150, 150]);

		const screen2 = screenSpaceToElementSpace(el, [-1, -1]);
		assertVecAlmostEquals(screen2, [100, 100]);

		const screen3 = screenSpaceToElementSpace(el, new Vec2(1, 1));
		assertVecAlmostEquals(screen3, [200, 200]);
	},
});

Deno.test({
	name: "screenSpaceToElementSpace() out of bounds",
	fn: () => {
		const el = new HtmlElement({
			x: 100,
			y: 100,
			clientWidth: 100,
			clientHeight: 100,
		});

		const screen = screenSpaceToElementSpace(el, 2, 2);
		assertVecAlmostEquals(screen, [250, 250]);
	},
});

Deno.test({
	name: "screenSpaceToElementSpace() with padding, left top",
	fn: () => {
		const el = new HtmlElement({
			x: 100,
			y: 100,
			clientWidth: 100,
			clientHeight: 100,
			paddingLeft: 50,
			paddingTop: 50,
		});

		const screen1 = screenSpaceToElementSpace(el, -2, -2);
		assertVecAlmostEquals(screen1, [100, 100]);
	},
});

Deno.test({
	name: "screenSpaceToElementSpace() with padding, right bottom",
	fn: () => {
		const el = new HtmlElement({
			x: 100,
			y: 100,
			clientWidth: 100,
			clientHeight: 100,
			paddingRight: 50,
			paddingBottom: 50,
		});

		const screen1 = screenSpaceToElementSpace(el, 1, 1);
		assertVecAlmostEquals(screen1, [200, 200]);
	},
});
