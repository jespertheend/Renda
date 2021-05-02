import Mat4 from "../../Math/Mat4.js";

export default {
	uuid: "1a78b3f2-7688-4776-b512-ed1ee2326d8a",
	name: "Camera",
	properties: {
		fov: {
			defaultValue: 70,
			guiOpts: {
				min: 0,
				max: 180,
			},
		},
		clipNear: {
			defaultValue: 0.01,
			guiOpts: {
				min: 0,
			},
		},
		clipFar: {
			defaultValue: 1000,
			guiOpts: {
				min: 0,
			}
		},
		aspect: {
			defaultValue: 1,
			guiOpts: {
				min: 0,
			},
		},
		autoUpdateProjectionMatrix: {
			defaultValue: true,
		},
		projectionMatrix: {
			type: Mat4,
		},
		// autoManageRootRenderEntities: {
		// 	type: "bool",
		// 	defaultValue: true,
		// },
		// rootRenderEntities: {
		// 	type: "array",
		// }
	},
};