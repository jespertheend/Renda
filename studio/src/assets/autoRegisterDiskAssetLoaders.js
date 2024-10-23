import { shaderSourceStudioAssetLoader } from "./studioAssetLoaders/shaderSource.js";

const autoRegisterStudioAssetLoaders = /** @satisfies {import("./StudioAssetLoaderManager.js").StudioAssetLoader[]} @type {const} */ ([
	shaderSourceStudioAssetLoader,
]);
export { autoRegisterStudioAssetLoaders };
