import {assertEquals, assertExists, assertNotStrictEquals, assertStrictEquals, assertThrows} from "asserts";
import {Mesh, MeshAttributeBuffer, Vec2, Vec3} from "../../../../src/mod.js";
import {assertVecAlmostEquals} from "../../shared/asserts.js";

Deno.test({
	name: "throw an error when creating an unused buffer with not exactly one attribute",
	fn() {
		assertThrows(() => {
			new MeshAttributeBuffer({
				isUnused: true,
				attributes: [],
			});
		});

		assertThrows(() => {
			new MeshAttributeBuffer({
				isUnused: true,
				attributes: [
					{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: null},
					{offset: 4, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: null},
				],
			});
		});
	},
});

Deno.test({
	name: "setArrayStride() sets the specified array stride when not null",
	fn() {
		const buffer1 = new MeshAttributeBuffer();
		buffer1.setArrayStride(5);
		assertEquals(buffer1.arrayStride, 5);

		const buffer2 = new MeshAttributeBuffer();
		buffer2.setArrayStride(10);
		assertEquals(buffer2.arrayStride, 10);
	},
});

Deno.test({
	name: "setArrayStride() computes the max required array stride when null",
	fn() {
		const buffer1 = new MeshAttributeBuffer({
			attributes: [
				{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: null},
				{offset: 4, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: null},
			],
		});
		buffer1.setArrayStride(null);
		// Float32 (4 bytes) + Float32 (4 bytes) = 8 bytes
		assertEquals(buffer1.arrayStride, 8);

		const buffer2 = new MeshAttributeBuffer({
			attributes: [
				{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: null},
				{offset: 4, format: Mesh.AttributeFormat.FLOAT32, componentCount: 3, attributeType: null},
			],
		});
		buffer2.setArrayStride(null);
		// Float32 (4 bytes) + Float32 * 3 (12 bytes) = 16 bytes
		assertEquals(buffer2.arrayStride, 16);
	},
});

Deno.test({
	name: "getDataView() should reuse existing DataView when possible",
	fn() {
		const buffer = new MeshAttributeBuffer();
		buffer.setVertexCount(0);

		const dataView1 = buffer.getDataView();
		const dataView2 = buffer.getDataView();

		assertStrictEquals(dataView1, dataView2);
	},
});

Deno.test({
	name: "getDataView() should create a new DataView when the buffer changed",
	fn() {
		const buffer = new MeshAttributeBuffer();

		buffer.setVertexCount(0);
		const dataView1 = buffer.getDataView();

		buffer.setVertexCount(10);
		const dataView2 = buffer.getDataView();

		assertNotStrictEquals(dataView1, dataView2);
	},
});

Deno.test({
	name: "hasAttributeType() should return true when the attribute type is present",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: Mesh.AttributeType.COLOR}],
		});

		const result = buffer.hasAttributeType(Mesh.AttributeType.COLOR);

		assertEquals(result, true);
	},
});

Deno.test({
	name: "hasAttributeType() should return false when the attribute type is not present",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: Mesh.AttributeType.COLOR}],
		});

		const result = buffer.hasAttributeType(Mesh.AttributeType.POSITION);

		assertEquals(result, false);
	},
});

Deno.test({
	name: "getAttributeSettings() should return the attribute settings for the specified attribute type",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: Mesh.AttributeType.COLOR}],
		});

		const result = buffer.getAttributeSettings(Mesh.AttributeType.COLOR);

		assertExists(result);
		assertEquals(result.offset, 0);
		assertEquals(result.format, Mesh.AttributeFormat.FLOAT32);
		assertEquals(result.componentCount, 1);
		assertEquals(result.attributeType, Mesh.AttributeType.COLOR);
	},
});

Deno.test({
	name: "getAttributeSettings() should return null when the attribute type is not present",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: Mesh.AttributeType.COLOR}],
		});

		const result = buffer.getAttributeSettings(Mesh.AttributeType.POSITION);

		assertEquals(result, null);
	},
});

Deno.test({
	name: "setVertexCount() should keep data from the old buffer",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 3, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(1);
		buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec3(1, 2, 3)]);

		buffer.setVertexCount(2);

		const dataView = buffer.getDataView();

		assertEquals(dataView.getFloat32(0, true), 1);
		assertEquals(dataView.getFloat32(4, true), 2);
		assertEquals(dataView.getFloat32(8, true), 3);
	},
});

Deno.test({
	name: "setVertexCount() fires onBufferChanged callbacks",
	fn() {
		const buffer = new MeshAttributeBuffer({});
		buffer.setVertexCount(0);

		let onBufferChangedCalled = false;
		buffer.onBufferChanged(() => {
			onBufferChangedCalled = true;
		});

		buffer.setVertexCount(1);

		assertEquals(onBufferChangedCalled, true);
	},
});

Deno.test({
	name: "setVertexData() empty array should clear the buffer",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 3, attributeType: Mesh.AttributeType.POSITION}],
			arrayBuffer: new ArrayBuffer(12),
		});

		buffer.setVertexData(Mesh.AttributeType.POSITION, []);

		assertEquals(buffer.buffer?.byteLength, 0);
	},
});

Deno.test({
	name: "setVertexData() array of numbers",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(3);

		buffer.setVertexData(Mesh.AttributeType.POSITION, [1, 2, 3]);

		const dataView = buffer.getDataView();

		assertEquals(dataView.getFloat32(0, true), 1);
		assertEquals(dataView.getFloat32(4, true), 2);
		assertEquals(dataView.getFloat32(8, true), 3);
	},
});

Deno.test({
	name: "setVertexData() array of Vec2",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 2, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(2);

		buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec2(1, 2), new Vec2(3, 4)]);

		const dataView = buffer.getDataView();

		assertEquals(dataView.getFloat32(0, true), 1);
		assertEquals(dataView.getFloat32(4, true), 2);
		assertEquals(dataView.getFloat32(8, true), 3);
		assertEquals(dataView.getFloat32(12, true), 4);
	},
});

Deno.test({
	name: "setVertexData() array of Vec3",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 3, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(2);

		buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec3(1, 2, 3), new Vec3(4, 5, 6)]);

		const dataView = buffer.getDataView();

		assertEquals(dataView.getFloat32(0, true), 1);
		assertEquals(dataView.getFloat32(4, true), 2);
		assertEquals(dataView.getFloat32(8, true), 3);
		assertEquals(dataView.getFloat32(12, true), 4);
		assertEquals(dataView.getFloat32(16, true), 5);
		assertEquals(dataView.getFloat32(20, true), 6);
	},
});

Deno.test({
	name: "setVertexData() should throw when the attribute type is not present",
	fn() {
		const buffer = new MeshAttributeBuffer();
		buffer.setVertexCount(2);
		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec3(1, 2, 3), new Vec3(4, 5, 6)]);
		});
	},
});

Deno.test({
	name: "setVertexData() should throw when data doesn't match the component count (1)",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 1, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(2);

		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec2(), new Vec2()]);
		});
		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec3(), new Vec3()]);
		});
		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, /** @type {any} */ ([null, null]));
		});
	},
});

Deno.test({
	name: "setVertexData() should throw when data doesn't match the component count (2)",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 2, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(2);

		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, [1, 2]);
		});
		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec3(), new Vec3()]);
		});
		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, /** @type {any} */ ([null, null]));
		});
	},
});

Deno.test({
	name: "setVertexData() should throw when data doesn't match the component count (3)",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 3, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(2);

		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, [1, 2]);
		});
		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec2(), new Vec2()]);
		});
		assertThrows(() => {
			buffer.setVertexData(Mesh.AttributeType.POSITION, /** @type {any} */ ([null, null]));
		});
	},
});

Deno.test({
	name: "setVertexData() should fire onBufferChanged callbacks",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 3, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(2);

		let onBufferChangedCalled = false;
		buffer.onBufferChanged(() => {
			onBufferChangedCalled = true;
		});

		buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec3(1, 2, 3), new Vec3(4, 5, 6)]);

		assertEquals(onBufferChangedCalled, true);
	},
});

Deno.test({
	name: "getVertexData() should yield nothing when the buffer is empty",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 3, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(0);

		const result = Array.from(buffer.getVertexData(Mesh.AttributeType.POSITION));

		assertEquals(result, []);
	},
});

Deno.test({
	name: "getVertexData() yielding Vec3",
	fn() {
		const buffer = new MeshAttributeBuffer({
			attributes: [{offset: 0, format: Mesh.AttributeFormat.FLOAT32, componentCount: 3, attributeType: Mesh.AttributeType.POSITION}],
		});
		buffer.setVertexCount(2);
		buffer.setVertexData(Mesh.AttributeType.POSITION, [new Vec3(1, 2, 3), new Vec3(4, 5, 6)]);

		const result = Array.from(buffer.getVertexData(Mesh.AttributeType.POSITION));

		assertEquals(result.length, 2);
		assertVecAlmostEquals(result[0], [1, 2, 3]);
		assertVecAlmostEquals(result[1], [4, 5, 6]);
	},
});
