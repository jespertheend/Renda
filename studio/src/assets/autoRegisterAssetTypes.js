import { clusteredLightsConfigProjectAssetType } from "./projectAssetTypes/clusteredLightsConfig.js";
import { entityProjectAssetType } from "./projectAssetTypes/entity.js";
import { htmlProjectAssetType } from "./projectAssetTypes/html.js";
import { javaScriptProjectAssetType } from "./projectAssetTypes/javaScript.js";
import { materialProjectAssetType } from "./projectAssetTypes/material.js";
import { materialMapProjectAssetType } from "./projectAssetTypes/materialMap.js";
import { meshProjectAssetType } from "./projectAssetTypes/mesh.js";
import { renderOutputConfigProjectAssetType } from "./projectAssetTypes/renderOutputConfig.js";
import { samplerProjectAssetType } from "./projectAssetTypes/sampler.js";
import { shaderSourceProjectAssetType } from "./projectAssetTypes/shaderSource.js";
import { taskProjectAssetType } from "./projectAssetTypes/task.js";
import { webGpuPipelineConfigProjectAssetType } from "./projectAssetTypes/webGpuPipelineConfig.js";

const autoRegisterAssetTypes = /** @satisfies {import("./ProjectAssetTypeManager.js").ProjectAssetTypeAny[]} @type {const} */ ([
	clusteredLightsConfigProjectAssetType,
	entityProjectAssetType,
	htmlProjectAssetType,
	javaScriptProjectAssetType,
	materialProjectAssetType,
	materialMapProjectAssetType,
	meshProjectAssetType,
	renderOutputConfigProjectAssetType,
	samplerProjectAssetType,
	shaderSourceProjectAssetType,
	taskProjectAssetType,
	webGpuPipelineConfigProjectAssetType,
]);
export { autoRegisterAssetTypes };
