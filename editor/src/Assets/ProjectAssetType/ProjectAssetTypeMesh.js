import {ProjectAssetType} from "./ProjectAssetType.js";
import PropertiesAssetContentMesh from "../../PropertiesAssetContent/PropertiesAssetContentMesh.js";
import {BinaryComposer, BinaryDecomposer, Mesh, Vec3} from "../../../../src/index.js";
import editor from "../../editorInstance.js";

export class ProjectAssetTypeMesh extends ProjectAssetType {
	static type = "JJ:mesh";
	static typeUuid = "f202aae6-673a-497d-806d-c2d4752bb146";
	static newFileName = "New Mesh";
	static newFileExtension = "jjmesh";
	static storeInProjectAsJson = false;
	static propertiesAssetContentConstructor = PropertiesAssetContentMesh;

	/**
	 * @param {ConstructorParameters<typeof ProjectAssetType>} args
	 */
	constructor(...args) {
		super(...args);

		this.magicHeader = 0x68734D6A;
	}

	async createNewLiveAssetData() {
		const defaultVertexStateAssetUuid = "ad4146d6-f709-422e-b93e-5beb51e38fe4";
		const mesh = new Mesh();
		mesh.setVertexCount(24);
		const vertexStateLiveAsset = await editor.projectManager.assetManager.getLiveAsset(defaultVertexStateAssetUuid);
		mesh.setVertexState(vertexStateLiveAsset);
		mesh.setIndexData([0, 1, 2, 1, 2, 3, 4, 5, 6, 5, 6, 7, 8, 9, 10, 9, 10, 11, 12, 13, 14, 13, 14, 15, 16, 17, 18, 17, 18, 19, 20, 21, 22, 21, 22, 23]);
		mesh.setVertexData(Mesh.AttributeType.POSITION, [
			new Vec3(-1, -1, -1),
			new Vec3(-1, -1, 1),
			new Vec3(-1, 1, -1),
			new Vec3(-1, 1, 1),

			new Vec3(1, -1, -1),
			new Vec3(1, -1, 1),
			new Vec3(1, 1, -1),
			new Vec3(1, 1, 1),

			new Vec3(-1, -1, -1),
			new Vec3(-1, -1, 1),
			new Vec3(1, -1, -1),
			new Vec3(1, -1, 1),

			new Vec3(-1, 1, -1),
			new Vec3(-1, 1, 1),
			new Vec3(1, 1, -1),
			new Vec3(1, 1, 1),

			new Vec3(-1, -1, -1),
			new Vec3(-1, 1, -1),
			new Vec3(1, -1, -1),
			new Vec3(1, 1, -1),

			new Vec3(-1, -1, 1),
			new Vec3(-1, 1, 1),
			new Vec3(1, -1, 1),
			new Vec3(1, 1, 1),
		], {unusedFormat: Mesh.AttributeFormat.FLOAT32, unusedComponentCount: 3});
		mesh.setVertexData(Mesh.AttributeType.NORMAL, [
			new Vec3(-1, 0, 0),
			new Vec3(-1, 0, 0),
			new Vec3(-1, 0, 0),
			new Vec3(-1, 0, 0),

			new Vec3(1, 0, 0),
			new Vec3(1, 0, 0),
			new Vec3(1, 0, 0),
			new Vec3(1, 0, 0),

			new Vec3(0, -1, 0),
			new Vec3(0, -1, 0),
			new Vec3(0, -1, 0),
			new Vec3(0, -1, 0),

			new Vec3(0, 1, 0),
			new Vec3(0, 1, 0),
			new Vec3(0, 1, 0),
			new Vec3(0, 1, 0),

			new Vec3(0, 0, -1),
			new Vec3(0, 0, -1),
			new Vec3(0, 0, -1),
			new Vec3(0, 0, -1),

			new Vec3(0, 0, 1),
			new Vec3(0, 0, 1),
			new Vec3(0, 0, 1),
			new Vec3(0, 0, 1),
		], {unusedFormat: Mesh.AttributeFormat.FLOAT32, unusedComponentCount: 3});
		return {
			liveAsset: mesh,
			editorData: {
				vertexStateUuid: defaultVertexStateAssetUuid,
			},
		};
	}

	static expectedLiveAssetConstructor = Mesh;

	async getLiveAssetData(blob) {
		// todo: remove all of this and reuse the code in AssetLoaderTypeMesh
		const arrayBuffer = await blob.arrayBuffer();
		const decomposer = new BinaryDecomposer(arrayBuffer);
		if (decomposer.getUint32() != this.magicHeader) return null;
		if (decomposer.getUint16() != 1) {
			throw new Error("mesh version is too new");
		}
		const mesh = new Mesh();

		const vertexStateUuid = decomposer.getUuid();
		const layoutProjectAsset = await editor.projectManager.assetManager.getProjectAsset(vertexStateUuid);
		if (layoutProjectAsset) {
			mesh.setVertexState(await layoutProjectAsset.getLiveAsset());
			this.listenForUsedLiveAssetChanges(layoutProjectAsset);
		}

		const indexFormat = decomposer.getUint8();
		if (indexFormat != Mesh.IndexFormat.NONE) {
			let indexBufferLength = decomposer.getUint32();
			if (indexFormat == Mesh.IndexFormat.UINT_16) {
				indexBufferLength *= 2;
			} else if (indexFormat == Mesh.IndexFormat.UINT_32) {
				indexBufferLength *= 4;
			}
			const indexBuffer = decomposer.getBuffer(indexBufferLength);
			mesh.setIndexData(indexBuffer);
		}

		mesh.setVertexCount(decomposer.getUint32());
		const bufferCount = decomposer.getUint16();
		for (let i = 0; i < bufferCount; i++) {
			const attributes = [];
			const attributeCount = decomposer.getUint16();
			for (let j = 0; j < attributeCount; j++) {
				const attributeType = decomposer.getUint16();
				const format = decomposer.getUint8();
				const componentCount = decomposer.getUint8();
				const offset = decomposer.getUint32();
				attributes.push({offset, format, componentCount, attributeType});
			}
			const bufferLength = decomposer.getUint32();
			const buffer = decomposer.getBuffer(bufferLength);
			mesh.setBufferData({
				arrayBuffer: buffer,
				attributes,
			});
		}

		return {
			liveAsset: mesh,
			editorData: {
				vertexStateUuid,
			},
		};
	}

	meshToBuffer(liveAsset, vertexStateUuid) {
		const composer = new BinaryComposer();
		composer.appendUint32(this.magicHeader); // magic header: jMsh
		composer.appendUint16(1); // version

		composer.appendUuid(vertexStateUuid);

		if (!liveAsset.indexBuffer) {
			composer.appendUint8(Mesh.IndexFormat.NONE);
		} else {
			composer.appendUint8(liveAsset.indexFormat);
			let vertexCount = liveAsset.indexBuffer.byteLength;
			if (liveAsset.indexFormat == Mesh.IndexFormat.UINT_16) {
				vertexCount /= 2;
			} else if (liveAsset.indexFormat == Mesh.IndexFormat.UINT_32) {
				vertexCount /= 4;
			}
			composer.appendUint32(vertexCount);
			composer.appendBuffer(liveAsset.indexBuffer);
		}

		composer.appendUint32(liveAsset.vertexCount);
		const buffers = Array.from(liveAsset.getBuffers());
		composer.appendUint16(buffers.length);
		for (const buffer of buffers) {
			const attributes = buffer.attributes;
			composer.appendUint16(attributes.length);
			for (const attribute of attributes) {
				composer.appendUint16(attribute.attributeType);
				composer.appendUint8(attribute.format);
				composer.appendUint8(attribute.componentCount);
				composer.appendUint32(attribute.offset);
			}
			composer.appendUint32(buffer.buffer.byteLength);
			composer.appendBuffer(buffer.buffer);
		}
		return composer.getFullBuffer();
	}

	async saveLiveAssetData(liveAsset, editorData) {
		return this.meshToBuffer(liveAsset, editorData?.vertexStateUuid);
	}

	async createBundledAssetData(assetSettingOverrides = {}) {
		const {liveAsset, editorData} = await this.projectAsset.getLiveAssetData();
		const vertexStateUuid = editor.projectManager.assetManager.resolveDefaultAssetLinkUuid(editorData?.vertexStateUuid);
		return this.meshToBuffer(liveAsset, vertexStateUuid);
	}

	async *getReferencedAssetUuids() {
		const mesh = await this.projectAsset.getLiveAsset();
		yield editor.projectManager.assetManager.getAssetUuidFromLiveAsset(mesh.vertexState);
	}
}
