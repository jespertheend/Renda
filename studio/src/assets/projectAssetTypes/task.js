/**
 * @typedef TaskProjectAssetDiskData
 * @property {string} taskType
 * @property {unknown} [taskConfig]
 * @property {Object<string, string>} [environmentVariables]
 */

export const taskProjectAssetType = /** @satisfies {import("../ProjectAssetTypeManager.js").ProjectAssetType<null, null, string>} @type {const} */ ({
	id: "renda:task",
	uuid: "b642e924-6aa4-47e1-a38e-65d7c10d3033",
	newFileName: "New Task",
})
