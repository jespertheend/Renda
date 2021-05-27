#include 8cd64104-1d45-4536-972a-5685a2523725
#include 41eaba39-e2aa-48a3-8deb-47f410542bc2

//todo: update max lights and cluster count based on cam settings
struct ClusterLightIndices {
	lightCount : u32;
	indices : [[stride(4)]] array<u32, 10>;
};
//todo: don't hardcode clusters array length
[[block]] struct ClusterLightIndicesArray {
	clusters : [[stride(44)]] array<ClusterLightIndices, 3456>;
};
[[group(0), binding(2)]] var<storage> clusterLightIndices : [[access(read)]] ClusterLightIndicesArray;

fn depthToLinear(z : f32) -> f32 {
	// let m : mat4x4<f32> = viewUniforms.projectionMatrix;
	return - (z * viewUniforms.projectionMatrix[3][3] - viewUniforms.projectionMatrix[3][2]) / (z * viewUniforms.projectionMatrix[2][3] - viewUniforms.projectionMatrix[2][2]);
}

//todo: don't hard code this
let clusterCount : vec3<u32> = vec3<u32>(16u, 9u, 24u);

fn getClusterCoord(fragCoord : vec4<f32>) -> vec3<u32> {
	let viewCoord : vec2<f32> = fragCoord.xy / viewUniforms.screenSize.xy;

	//todo: precompute sliceScale and sliceBias on the cpu
	let sliceScale : f32 = f32(clusterCount.z) / log2(viewUniforms.clippingPanes.y / viewUniforms.clippingPanes.x);
	let sliceBias : f32 = - (f32(clusterCount.z) * log2(viewUniforms.clippingPanes.x) / log2(viewUniforms.clippingPanes.y / viewUniforms.clippingPanes.x));
	let zTile : u32 = u32(max(log2(depthToLinear(fragCoord.z)) * sliceScale + sliceBias, 0.0));

	let clusterCoord : vec3<u32> = vec3<u32>(vec2<u32>(viewCoord.xy * vec2<f32>(clusterCount.xy)), zTile);
	return clusterCoord;
}

fn getClusterIndex(fragCoord : vec4<f32>) -> u32 {
	let clusterCoord : vec3<u32> = getClusterCoord(fragCoord);
	return clusterCoord.x + clusterCoord.y * clusterCount.x + clusterCoord.z * clusterCount.x * clusterCount.y;
}


struct FragmentInput {
	[[location(0)]] vWorldPos : vec3<f32>;
	[[location(1)]] normal : vec3<f32>;
	[[builtin(position)]] fragCoord : vec4<f32>;
};

struct FragmentOutput {
	[[location(0)]] outColor : vec4<f32>;
};

[[stage(fragment)]]
fn main(input : FragmentInput) -> FragmentOutput {
	var color : vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);

	let clusterIndex : u32 = getClusterIndex(input.fragCoord);
	let cluster : ClusterLightIndices = clusterLightIndices.clusters[clusterIndex];
	for(var i : u32 = 0u; i < cluster.lightCount; i = i + 1u){
		let lightIndex : u32 = clusterLightIndices.clusters[clusterIndex].indices[i];
		let light : Light = lightUniforms.lights[lightIndex];
		let deltaLightPos : vec3<f32> = light.pos - input.vWorldPos;
		let lightDir : vec3<f32> = normalize(deltaLightPos);
		let lightDist : f32 = length(deltaLightPos);
		let attenuation : f32 = 1.0 / (lightDist * lightDist);

		let NdotL : f32 = max(dot(input.normal, lightDir), 0.0);

		color = color + light.col * NdotL * attenuation;
	}

	var gamma : f32 = 1.0/2.2;
	color = pow(color, vec3<f32>(gamma, gamma, gamma));
	var fragOut : FragmentOutput;
	fragOut.outColor = vec4<f32>(color, 1.0);
	let clusterCoord : vec3<u32> = getClusterCoord(input.fragCoord);
	return fragOut;
}