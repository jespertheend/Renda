/**
 * @typedef {Object} ShaderLibraryItem
 * @property {string} shaderCode
 * @property {string} builtCode
 * @property {import("../util/mod.js").UuidString[]} includedUuids
 */

/**
 * @typedef {(uuid: import("../util/mod.js").UuidString) => Promise<string?>} ShaderUuidRequestedHook
 */

export class ShaderBuilder {
	constructor() {
		/** @type {Map<import("../util/mod.js").UuidString, ShaderLibraryItem>} */
		this.shaderLibrary = new Map();
		/** @type {Set<ShaderUuidRequestedHook>} */
		this.onShaderUuidRequestedCbs = new Set();
		this.onShaderInvalidatedCbs = new Set();
	}

	/**
	 * @param {import("../util/mod.js").UuidString} uuid
	 * @param {string} shaderCode
	 */
	addShader(uuid, shaderCode) {
		this.shaderLibrary.set(uuid, {
			shaderCode,
			builtCode: null,
			includedUuids: [],
		});
	}

	/**
	 * @param {import("../util/mod.js").UuidString?} uuid
	 */
	invalidateShader(uuid) {
		if (!uuid) return;
		this.shaderLibrary.delete(uuid);
		this.fireOnShaderInvalidated(uuid);
		for (const [existingUuid, shader] of this.shaderLibrary) {
			if (shader.includedUuids.includes(uuid)) {
				this.invalidateShader(existingUuid);
			}
		}
	}

	/**
	 * @param {string} shaderCode
	 */
	async buildShader(shaderCode) {
		/** @type {import("../util/mod.js").UuidString[]} */
		const includedUuids = [];
		const attemptedUuids = [];
		const regex = /^\s*\/\/\s*@import\s(.+?):?(?::(.+)|$)/gm;
		shaderCode = await this.replaceAsync(shaderCode, regex, async (match, uuid, params) => {
			if (attemptedUuids.includes(uuid)) return "";
			attemptedUuids.push(uuid);
			const block = await this.getShaderBlock(uuid, {params});
			if (block) {
				includedUuids.push(uuid);
				return block;
			}
			return "";
		});
		return {shaderCode, includedUuids};
	}

	async replaceAsync(str, regex, fn) {
		const promises = [];
		str.replace(regex, (...args) => {
			const promise = fn(...args);
			promises.push(promise);
		});
		const replaceData = await Promise.all(promises);
		return str.replace(regex, () => replaceData.shift());
	}

	async getShaderBlock(uuid, {
		params = null,
		buildRecursive = true,
	} = {}) {
		// todo, get only specific part of shader
		const shaderData = await this.getShader(uuid);
		if (!shaderData) {
			throw new Error(`Shader tried to #include uuid ${uuid} but it could not be found`);
		}
		if (buildRecursive) {
			if (shaderData.builtCode) {
				return shaderData.builtCode;
			} else {
				const {shaderCode, includedUuids} = await this.buildShader(shaderData.shaderCode);
				shaderData.builtCode = shaderCode;
				shaderData.includedUuids = includedUuids;
				return shaderData.builtCode;
			}
		} else {
			return shaderData.shaderCode;
		}
	}

	/**
	 * @param {import("../util/mod.js").UuidString} uuid
	 */
	async getShader(uuid) {
		if (!this.shaderLibrary.has(uuid)) {
			await this.fireShaderUuidRequested(uuid);
		}
		return this.shaderLibrary.get(uuid);
	}

	/**
	 * @param {ShaderUuidRequestedHook} hook
	 */
	onShaderUuidRequested(hook) {
		this.onShaderUuidRequestedCbs.add(hook);
	}

	/**
	 * @param {ShaderUuidRequestedHook} hook
	 */
	removeOnShaderUuidRequested(hook) {
		this.onShaderUuidRequestedCbs.delete(hook);
	}

	/**
	 * @param {import("../util/mod.js").UuidString} uuid
	 */
	async fireShaderUuidRequested(uuid) {
		/**
		 * @typedef {Object} PromiseItem
		 * @property {boolean} resolved
		 * @property {string} result
		 * @property {Promise<string>} promise
		 */

		/** @type {PromiseItem[]} */
		let unparsedPromiseItems = [];
		for (const cb of this.onShaderUuidRequestedCbs) {
			/** @type {PromiseItem} */
			const promiseItem = {
				resolved: false,
				result: null,
				promise: null,
			};
			promiseItem.promise = (async () => {
				promiseItem.result = await cb(uuid);
				promiseItem.resolved = true;
				return promiseItem.result;
			})();
			unparsedPromiseItems.push(promiseItem);
		}
		if (unparsedPromiseItems.length <= 0) {
			return;
		}
		/** @type {string} */
		let foundShaderCode = null;
		while (unparsedPromiseItems.length > 0 && !foundShaderCode) {
			const promises = unparsedPromiseItems.map(i => i.promise);
			try {
				foundShaderCode = await Promise.race(promises);
			} catch (_) {
				// fail silently
			}
			if (foundShaderCode) {
				break;
			} else {
				unparsedPromiseItems = unparsedPromiseItems.filter(p => !p.resolved);
			}
		}
		if (foundShaderCode) {
			this.addShader(uuid, foundShaderCode);
		}
	}

	onShaderInvalidated(cb) {
		this.onShaderInvalidatedCbs.add(cb);
	}

	removeShaderInvalidated(cb) {
		this.onShaderInvalidatedCbs.delete(cb);
	}

	fireOnShaderInvalidated(uuid) {
		for (const cb of this.onShaderInvalidatedCbs) {
			cb(uuid);
		}
	}

	static fillShaderDefines(shaderCode, defines) {
		for (const [key, value] of Object.entries(defines)) {
			shaderCode = shaderCode.replaceAll("${" + key + "}", value);
		}
		return shaderCode;
	}
}