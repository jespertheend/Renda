struct Light {
	pos : vec3<f32>;
	col : vec3<f32>;
};
[[block]] struct LightUniforms {
	lightCount : u32;
	lights : [[stride(32)]] array<Light, 10>;
};
[[group(0), binding(1)]] var<storage_buffer> lightUniforms : [[access(read)]] LightUniforms;