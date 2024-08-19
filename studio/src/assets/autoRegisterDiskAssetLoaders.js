import { shaderSourceStudioAssetLoader } from "./studioAssetLoaders/shaderSource.js";
import { taskStudioAssetLoader } from "./studioAssetLoaders/task.js";

const autoRegisterStudioAssetLoaders = /** @satisfies {import("./StudioAssetLoaderManager.js").StudioAssetLoader[]} @type {const} */ ([
	shaderSourceStudioAssetLoader,
	taskStudioAssetLoader,
]);
export { autoRegisterStudioAssetLoaders };
