import Vec3 from "../../Math/Vec3.js";

export default {
	uuid: "b08e7f42-3919-47e4-ae3e-046e99362090",
	name: "Light",
	properties: {
		lightType: {
			type: ["point","directional","spot"],
		},
		color: {
			type: Vec3,
		}
	},
};