export default class AssetLoaderType {
	// this should be the same as the uuid used in ProjectAssetType.js
	static get typeUuid() {
		return null;
	}

	constructor(assetLoader) {
		this.assetLoader = assetLoader;
	}

	/**
	 * This method should parse an ArrayBuffer and return an
	 * instance of the desired class such as a Mesh or Texture.
	 * @param {ArrayBuffer} buffer
	 * @param {*} [assetOpts]
	 * @returns {Promise<*>}
	 */
	async parseBuffer(buffer, assetOpts) {}
}
