import {StorageType, binaryToObject, createObjectToBinaryOptions, objectToBinary} from "../../../../../src/util/binarySerialization.js";

/**
 * @param {import("../../../util/fileSystems/StudioFileSystem.js").StudioFileSystem} fileSystem
 */
export function createFileSystemHandlers(fileSystem) {
	return {
		/**
		 * @param {import("../../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
		 */
		"fileSystem.readDir": async path => {
			return await fileSystem.readDir(path);
		},
		/**
		 * @param {import("../../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
		 */
		"fileSystem.createDir": async path => {
			return await fileSystem.createDir(path);
		},
		/**
		 * @param {import("../../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
		 */
		"fileSystem.readFile": async path => {
			return await fileSystem.readFile(path);
		},
		/**
		 * @param {import("../../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
		 * @param {import("../../../util/fileSystems/StudioFileSystem.js").AllowedWriteFileTypes} file
		 */
		"fileSystem.writeFile": async (path, file) => {
			return await fileSystem.writeFile(path, file);
		},
		/**
		 * @param {import("../../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
		 */
		"fileSystem.isFile": async path => {
			return await fileSystem.isFile(path);
		},
		/**
		 * @param {import("../../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
		 */
		"fileSystem.isDir": async path => {
			return await fileSystem.isDir(path);
		},
		/**
		 * @param {import("../../../util/fileSystems/StudioFileSystem.js").StudioFileSystemPath} path
		 */
		"fileSystem.exists": async path => {
			return await fileSystem.exists(path);
		},
	};
}

const serializeFileBinaryOpts = createObjectToBinaryOptions({
	structure: {
		buffer: StorageType.ARRAY_BUFFER,
		name: StorageType.STRING,
		type: StorageType.STRING,
		lastModified: StorageType.FLOAT64,
	},
	nameIds: {
		buffer: 0,
		name: 1,
		type: 2,
		lastModified: 3,
	},
});

/**
 * @param {File} file
 */
async function serializeFile(file) {
	return objectToBinary({
		buffer: await file.arrayBuffer(),
		name: file.name,
		type: file.type,
		lastModified: file.lastModified,
	}, serializeFileBinaryOpts);
}

/**
 * @param {ArrayBuffer} buffer
 */
function deserializeFile(buffer) {
	const fileData = binaryToObject(buffer, serializeFileBinaryOpts);
	return new File([fileData.buffer], fileData.name, {
		type: fileData.type,
		lastModified: fileData.lastModified,
	});
}

export function createFileSystemRequestSerializers() {
	return {

	};
}

export function createFileSystemRequestDeserializers() {
	return {

	};
}

export function createFileSystemResponseSerializers() {
	return {
		/**
		 * @param {File} file
		 */
		"fileSystem.readFile": async file => {
			return await serializeFile(file);
		},
	};
}

export function createFileSystemResponseDeserializers() {
	return {
		/**
		 * @param {ArrayBuffer} buffer
		 */
		"fileSystem.readFile": buffer => {
			return deserializeFile(buffer);
		},
	};
}
