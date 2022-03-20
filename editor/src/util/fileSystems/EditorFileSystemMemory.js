import {EditorFileSystem} from "./EditorFileSystem.js";

/** @typedef {EditorFileSystemMemoryFilePointer | EditorFileSystemMemoryDirPointer} EditorFileSystemMemoryPointer */
/**
 * @typedef EditorFileSystemMemoryFilePointer
 * @property {true} isFile
 * @property {string} name
 * @property {File} file
 */
/**
 * @typedef EditorFileSystemMemoryDirPointer
 * @property {false} isFile
 * @property {string} name
 * @property {EditorFileSystemMemoryPointer[]} children
 */

/**
 * An EditorFileSystem that is stored in memory only. Restarting the application will clear all file data.
 * This is mostly useful for mocking in unit tests, but can also be used as
 * a fallback in case any other file system types are not supported on a platform.
 */
export class EditorFileSystemMemory extends EditorFileSystem {
	constructor() {
		super();

		/** @type {EditorFileSystemMemoryDirPointer} */
		this.rootObject = {
			isFile: false,
			name: "root",
			children: [],
		};
	}

	/**
	 * @private
	 * @param {import("./EditorFileSystem.js").EditorFileSystemPath} path
	 * @param {Object} [options]
	 * @param {boolean} [options.create]
	 * @param {"file" | "dir"} [options.createType]
	 */
	getObjectPointer(path, {
		create = false,
		createType = "dir",
	} = {}) {
		/** @type {EditorFileSystemMemoryPointer} */
		let currentObject = this.rootObject;
		for (const [i, name] of path.entries()) {
			if (currentObject.isFile) {
				throw new Error(`Couldn't get object at ${path.join("/")} because ${name} is a file.`);
			}
			/** @type {EditorFileSystemMemoryPointer[]} */
			const children = currentObject.children;
			let child = children.find(c => c.name == name);
			if (!child) {
				if (!create) {
					throw new Error(`${path.join("/")} not found, ${name} does not exist.`);
				}
				if (createType == "file" && i == path.length - 1) {
					child = {
						isFile: true,
						name,
						file: new File([], name),
					};
				} else {
					child = {
						isFile: false,
						name,
						children: [],
					};
				}
				children.push(child);
			}
			currentObject = child;
		}
		return currentObject;
	}

	/**
	 * @override
	 * @param {import("./EditorFileSystem.js").EditorFileSystemPath} path
	 * @returns {Promise<import("./EditorFileSystem.js").EditorFileSystemReadDirResult>}
	 */
	async readDir(path) {
		const files = [];
		const directories = [];
		const object = this.getObjectPointer(path);
		if (object.isFile) {
			throw new Error(`Cannot readDir: ${path.join("/")} is a file.`);
		}
		for (const child of object.children) {
			if (child.isFile) {
				files.push(child.name);
			} else {
				directories.push(child.name);
			}
		}
		return {files, directories};
	}

	/**
	 * @override
	 * @param {import("./EditorFileSystem.js").EditorFileSystemPath} path
	 */
	async createDir(path) {
		super.createDir(path);
		this.getObjectPointer(path, {
			create: true,
			createType: "dir",
		});
	}

	/**
	 * @override
	 * @param {import("./EditorFileSystem.js").EditorFileSystemPath} path
	 * @returns {Promise<File>}
	 */
	async readFile(path) {
		const object = this.getObjectPointer(path);
		if (!object.isFile) {
			throw new Error(`"${path.join("/")}" is not a file.`);
		}
		return object.file;
	}

	/**
	 * @override
	 * @param {import("./EditorFileSystem.js").EditorFileSystemPath} path
	 * @param {File | BufferSource | Blob | string} file
	 */
	async writeFile(path, file) {
		const object = this.getObjectPointer(path, {
			create: true,
			createType: "file",
		});
		if (!object.isFile) {
			throw new Error(`"${path.join("/")}" is not a file.`);
		}
		object.file = new File([file], object.name);
	}

	/**
	 * @override
	 * @param {import("./EditorFileSystem.js").EditorFileSystemPath} path
	 * @returns {Promise<boolean>}
	 */
	async isFile(path) {
		let object = null;
		try {
			object = this.getObjectPointer(path);
		} catch {
			return false;
		}
		return object.isFile;
	}

	/**
	 * @override
	 * @param {import("./EditorFileSystem.js").EditorFileSystemPath} path
	 * @returns {Promise<boolean>}
	 */
	async isDir(path) {
		let object = null;
		try {
			object = this.getObjectPointer(path);
		} catch {
			return false;
		}
		return !object.isFile;
	}
}