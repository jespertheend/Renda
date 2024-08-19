import { ShaderSource } from "../../../../src/mod.js";

export const shaderSourceStudioAssetLoader = /** @satisfies {import("../StudioAssetLoaderManager.js").StudioAssetLoader} @type {const} */ ({
	extensions: ["wgsl", "glsl", "shader"],
	isStudioJson: false,
	async load(fileData, ctx) {
		const source = ctx.parseText(fileData);
		const { shaderCode, includedUuids } = await ctx.studio.webGpuShaderBuilder.buildShader(source);
		const liveAsset = new ShaderSource(shaderCode);
		const liveAssetRef = ctx.createLiveAsset(liveAsset);

		ctx.studio.webGpuShaderBuilder.onShaderInvalidated((uuid) => {
			if (includedUuids.includes(uuid)) {
				this.liveAssetNeedsReplacement();
			}
		});
	}
})
