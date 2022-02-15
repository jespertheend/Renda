import {ENABLE_WEBGPU_CLUSTERED_LIGHTS} from "../../../engineDefines.js";
import {Renderer} from "../Renderer.js";
import {WebGpuRendererDomTarget} from "./WebGpuRendererDomTarget.js";
import {WebGpuChunkedBuffer} from "./bufferHelper/WebGpuChunkedBuffer.js";
import {CachedCameraData} from "./CachedCameraData.js";
import {CachedMeshData} from "./CachedMeshData.js";
import {Mat4} from "../../../math/Mat4.js";
import {Vec4} from "../../../math/Vec4.js";
import {LightComponent, MeshComponent} from "../../../components/mod.js";
import {Mesh} from "../../../core/Mesh.js";
import {MultiKeyWeakMap} from "../../../util/MultiKeyWeakMap.js";
import {ShaderBuilder} from "../../ShaderBuilder.js";
import {MaterialMapTypeWebGpu} from "./MaterialMapTypeWebGpu.js";

export {WebGpuPipelineConfig} from "./WebGpuPipelineConfig.js";
export {MaterialMapTypeLoaderWebGpuRenderer} from "./MaterialMapTypeLoaderWebGpuRenderer.js";

/**
 * @typedef {Object} CachedMaterialData
 * @property {import("./WebGpuPipelineConfig.js").WebGpuPipelineConfig} forwardPipelineConfig
 */

export class WebGpuRenderer extends Renderer {
	static get domTargetConstructor() {
		return WebGpuRendererDomTarget;
	}

	/**
	 * @param {import("../../../mod.js").EngineAssetsManager} engineAssetManager
	 */
	constructor(engineAssetManager) {
		super();

		this.engineAssetManager = engineAssetManager;

		this.maxLights = 512;

		this.adapter = null;
		this.device = null;
		this.viewBindGroupLayout = null;
		this.lightsBuffer = null;
		if (ENABLE_WEBGPU_CLUSTERED_LIGHTS) {
			this.computeClusterBoundsBindGroupLayout = null;
			this.computeClusterLightsBindGroupLayout = null;
			this.computeClusterBoundsShaderCode = null;
			this.computeClusterLightsShaderCode = null;
		}
		this.viewUniformsBuffer = null;
		this.materialUniformsBuffer = null;
		this.objectUniformsBuffer = null;
		this.pipelineLayout = null;

		this.isInit = false;
		this.onInitCbs = new Set();

		/** @type {WeakMap<import("../../../components/builtIn/CameraComponent.js").CameraComponent, CachedCameraData>} */
		this.cachedCameraData = new WeakMap();

		/** @type {WeakMap<import("../../Material.js").Material, CachedMaterialData>} */
		this.cachedMaterialData = new WeakMap();

		/** @type {MultiKeyWeakMap<*[], GPURenderPipeline>} */
		this.cachedPipelines = new MultiKeyWeakMap();

		// (legacy) for every pipeline, maintain a list of objects that the pipeline is used by
		// this.pipelinesUsedByLists = new WeakMap(); //<WebGpuPipeline, Set[WeakRef]

		this.cachedMeshData = new WeakMap();

		this.cachedShaderModules = new MultiKeyWeakMap(); // <[ShaderSource, clusteredLightsConfig], GPUShaderModule>;
	}

	async init() {
		this.adapter = await navigator.gpu.requestAdapter();
		const device = await this.adapter.requestDevice();
		this.device = device;

		this.viewBindGroupLayout = device.createBindGroupLayout({
			label: "viewBindGroupLayout",
			entries: [
				{
					binding: 0, // view uniforms
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
					buffer: {},
				},
				{
					binding: 1, // lights
					visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
					buffer: {type: "read-only-storage"},
				},
				{
					binding: 2, // cluster light indices
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {type: "storage"},
				},
			],
		});

		this.lightsBuffer = new WebGpuChunkedBuffer({
			device,
			label: "lights",
			bindGroupLength: 2048,
			chunkSize: 2048,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		if (ENABLE_WEBGPU_CLUSTERED_LIGHTS) {
			this.computeClusterBoundsBindGroupLayout = device.createBindGroupLayout({
				label: "computeClusterBoundsBindGroupLayout",
				entries: [
					{
						binding: 0, // cluster bounds buffer
						visibility: GPUShaderStage.COMPUTE,
						buffer: {type: "storage"},
					},
				],
			});

			this.computeClusterLightsBindGroupLayout = device.createBindGroupLayout({
				label: "computeClusterLightsBindGroupLayout",
				entries: [
					{
						binding: 0, // cluster bounds buffer
						visibility: GPUShaderStage.COMPUTE,
						buffer: {type: "storage"},
					},
					{
						binding: 1, // cluster lights buffer
						visibility: GPUShaderStage.COMPUTE,
						buffer: {type: "storage"},
					},
				],
			});

			await this.engineAssetManager.watchAsset("892d56b3-df77-472b-93dd-2c9c38ec2f3d", asset => {
				this.computeClusterBoundsShaderCode = asset;
			});
			await this.engineAssetManager.watchAsset("a2b8172d-d910-47e9-8d3b-2a8ea3280153", asset => {
				this.computeClusterLightsShaderCode = asset;
			});
		}

		this.viewUniformsBuffer = new WebGpuChunkedBuffer({
			device,
			label: "viewUniforms",
			bindGroupLayout: this.viewBindGroupLayout,
		});

		this.materialUniformsBuffer = new WebGpuChunkedBuffer({
			device,
			label: "materialUniforms",
			bindGroupLayout: device.createBindGroupLayout({
				label: "materialUniformsBufferBindGroupLayout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
						buffer: {
							type: "uniform",
							hasDynamicOffset: true,
						},
					},
				],
			}),
		});

		this.objectUniformsBuffer = new WebGpuChunkedBuffer({
			device,
			label: "objectUniforms",
			bindGroupLayout: device.createBindGroupLayout({
				label: "objectUniformsBufferBindGroupLayout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX,
						buffer: {
							type: "uniform",
							hasDynamicOffset: true,
						},
					},
				],
			}),
			chunkSize: 65536,
		});

		this.pipelineLayout = device.createPipelineLayout({
			label: "default pipeline layout",
			bindGroupLayouts: [
				this.viewBindGroupLayout,
				this.materialUniformsBuffer.bindGroupLayout,
				this.objectUniformsBuffer.bindGroupLayout,
			],
		});

		this.isInit = true;
		for (const cb of this.onInitCbs) {
			cb();
		}
		this.onInitCbs.clear();
	}

	async waitForInit() {
		if (this.isInit) return;
		await new Promise(r => this.onInitCbs.add(r));
	}

	createDomTarget() {
		const domTarget = super.createDomTarget();
		this.configureSwapChainAsync(domTarget);
		return domTarget;
	}

	async configureSwapChainAsync(domTarget) {
		await this.waitForInit();
		domTarget.gpuReady();
	}

	/**
	 * @override
	 * @param {WebGpuRendererDomTarget} domTarget
	 * @param {import("../../../components/builtIn/CameraComponent.js").CameraComponent} camera
	 */
	render(domTarget, camera) {
		if (!this.isInit) return;
		if (!domTarget.ready) return;

		// todo, support for auto cam aspect based on domTarget size

		camera.updateProjectionMatrixIfEnabled();
		if (camera.renderOutputConfig) {
			domTarget.setRenderOutputConfig(camera.renderOutputConfig);
		}
		const outputConfig = domTarget.outputConfig;

		/**
		 * @typedef {Object} MeshRenderData
		 * @property {MeshComponent} component
		 * @property {Mat4} worldMatrix
		 */

		/** @type {MeshRenderData[]} */
		const meshRenderDatas = [];
		/** @type {LightComponent[]} */
		const lightComponents = [];
		/** @type {import("../../../core/Entity.js").Entity[]} */
		const rootRenderEntities = [camera.entity.getRoot()];
		// TODO: don't get root every frame, only when changed
		// see state of CameraComponent.js in commit 5d2efa1
		for (const root of rootRenderEntities) {
			for (const {child, traversedPath} of root.traverseDown()) {
				for (const component of child.getComponents(MeshComponent)) {
					if (!component.mesh || !component.mesh.vertexState) continue;
					const worldMatrix = child.getWorldMatrix(traversedPath);
					meshRenderDatas.push({component, worldMatrix});
				}
				for (const component of child.getComponents(LightComponent)) {
					lightComponents.push(component);
				}
			}
		}

		const commandEncoder = this.device.createCommandEncoder({
			label: "default command encoder",
		});

		this.viewUniformsBuffer.resetEntryLocation();
		this.lightsBuffer.resetEntryLocation();
		this.materialUniformsBuffer.resetEntryLocation();
		this.objectUniformsBuffer.resetEntryLocation();

		const viewMatrix = camera.entity.worldMatrix.inverse();
		const vpMatrix = Mat4.multiplyMatrices(viewMatrix, camera.projectionMatrix);
		const inverseProjectionMatrix = camera.projectionMatrix.inverse();

		// todo, only update when something changed
		this.viewUniformsBuffer.appendData(new Vec4(domTarget.width, domTarget.height, 0, 0)); // todo, pass as integer?
		this.viewUniformsBuffer.appendData(camera.projectionMatrix);
		this.viewUniformsBuffer.appendData(inverseProjectionMatrix);
		this.viewUniformsBuffer.appendData(viewMatrix);
		this.viewUniformsBuffer.appendData(new Vec4(camera.clipNear, camera.clipFar));

		this.viewUniformsBuffer.writeAllChunksToGpu();

		const cameraData = this.getCachedCameraData(camera);
		if (ENABLE_WEBGPU_CLUSTERED_LIGHTS) {
			const success = cameraData.clusterComputeManager.computeLightIndices(commandEncoder);
			if (!success) return;
		}

		this.lightsBuffer.appendData(lightComponents.length, "u32");
		this.lightsBuffer.skipBytes(12);
		for (const light of lightComponents) {
			this.lightsBuffer.appendData(light.entity.pos);
			this.lightsBuffer.skipBytes(4);
			this.lightsBuffer.appendData(light.color);
			this.lightsBuffer.skipBytes(4);
		}
		this.lightsBuffer.writeAllChunksToGpu();

		const renderPassDescriptor = domTarget.getRenderPassDescriptor();
		const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		renderPassEncoder.setBindGroup(0, cameraData.getViewBindGroup());

		/** @type {Map<import("../../Material.js").Material, Map<GPURenderPipeline, MeshRenderData[]>>} */
		const materialRenderDatas = new Map();
		for (const renderData of meshRenderDatas) {
			for (const material of renderData.component.materials) {
				if (!material || material.destructed || !material.materialMap) continue; // todo: log a (supressable) warning when the material is destructed

				const materialData = this.getCachedMaterialData(material);
				if (!materialData.forwardPipelineConfig) {
					const webgpuMap = material.materialMap.getMapTypeInstance(MaterialMapTypeWebGpu);
					materialData.forwardPipelineConfig = webgpuMap.forwardPipelineConfig;
					// this.addUsedByObjectToPipeline(materialData.forwardPipeline, material);
				}
				const forwardPipeline = this.getPipeline(materialData.forwardPipelineConfig, renderData.component.mesh.vertexState, outputConfig, camera.clusteredLightsConfig);

				let pipelines = materialRenderDatas.get(material);
				if (!pipelines) {
					pipelines = new Map();
					materialRenderDatas.set(material, pipelines);
				}

				let renderDatas = pipelines.get(forwardPipeline);
				if (!renderDatas) {
					renderDatas = [];
					pipelines.set(forwardPipeline, renderDatas);
				}
				renderDatas.push(renderData);
			}
		}

		for (const [material, pipelines] of materialRenderDatas) {
			const {bindGroup, dynamicOffset} = this.materialUniformsBuffer.getCurrentEntryLocation();
			renderPassEncoder.setBindGroup(1, bindGroup, [dynamicOffset]);

			for (const [, value] of material.getAllMappedProperties(MaterialMapTypeWebGpu)) {
				this.materialUniformsBuffer.appendData(value, "f32");
			}

			for (const [pipeline, renderDatas] of pipelines) {
				renderPassEncoder.setPipeline(pipeline);
				for (const {component: meshComponent, worldMatrix} of renderDatas) {
					const {bindGroup, dynamicOffset} = this.objectUniformsBuffer.getCurrentEntryLocation();
					renderPassEncoder.setBindGroup(2, bindGroup, [dynamicOffset]);
					const mesh = meshComponent.mesh;
					const meshData = this.getCachedMeshData(mesh);
					for (const {index, gpuBuffer, newBufferData} of meshData.getBufferGpuCommands()) {
						if (newBufferData) {
							this.device.queue.writeBuffer(gpuBuffer, 0, newBufferData);
						}
						renderPassEncoder.setVertexBuffer(index, gpuBuffer);
					}
					const indexBufferData = meshData.getIndexedBufferGpuCommands();
					if (indexBufferData) {
						/** @type {GPUIndexFormat} */
						let indexFormat = null;
						if (mesh.indexFormat == Mesh.IndexFormat.UINT_16) {
							indexFormat = "uint16";
						} else if (mesh.indexFormat == Mesh.IndexFormat.UINT_32) {
							indexFormat = "uint32";
						}
						renderPassEncoder.setIndexBuffer(indexBufferData, indexFormat);
						renderPassEncoder.drawIndexed(mesh.indexCount, 1, 0, 0, 0);
					} else {
						renderPassEncoder.draw(mesh.vertexCount, 1, 0, 0);
					}

					const mvpMatrix = Mat4.multiplyMatrices(worldMatrix, vpMatrix);
					this.objectUniformsBuffer.appendMatrix(mvpMatrix);
					this.objectUniformsBuffer.appendMatrix(vpMatrix);
					this.objectUniformsBuffer.appendMatrix(worldMatrix);
					this.objectUniformsBuffer.nextEntryLocation();
				}
			}

			this.materialUniformsBuffer.nextEntryLocation();
		}
		this.materialUniformsBuffer.writeAllChunksToGpu();
		this.objectUniformsBuffer.writeAllChunksToGpu();

		renderPassEncoder.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}

	/**
	 * @param {import("../../../components/builtIn/CameraComponent.js").CameraComponent} camera
	 */
	getCachedCameraData(camera) {
		let data = this.cachedCameraData.get(camera);
		if (!data) {
			data = new CachedCameraData(camera, this);
			this.cachedCameraData.set(camera, data);
		}
		return data;
	}

	/**
	 * @param {import("../../Material.js").Material} material
	 */
	getCachedMaterialData(material) {
		/** @type {CachedMaterialData} */
		let data = this.cachedMaterialData.get(material);
		if (!data) {
			data = {
				forwardPipelineConfig: null,
			};
			this.cachedMaterialData.set(material, data);
			material.onDestructor(() => {
				this.disposeMaterial(material);
			});
		}
		return data;
	}

	/**
	 * @param {import("./WebGpuPipelineConfig.js").WebGpuPipelineConfig} pipelineConfig
	 * @param {import("../../VertexState.js").VertexState} vertexState
	 * @param {import("../../RenderOutputConfig.js").RenderOutputConfig} outputConfig
	 * @param {import("../../ClusteredLightsConfig.js").ClusteredLightsConfig} clusteredLightsConfig
	 */
	getPipeline(pipelineConfig, vertexState, outputConfig, clusteredLightsConfig) {
		/** @type {*[]} */
		const keys = [outputConfig, vertexState, pipelineConfig];
		if (ENABLE_WEBGPU_CLUSTERED_LIGHTS && clusteredLightsConfig) {
			keys.push(clusteredLightsConfig);
		}
		let pipeline = this.cachedPipelines.get(keys);
		if (!pipeline) {
			let vertexModule; let fragmentModule;
			if (ENABLE_WEBGPU_CLUSTERED_LIGHTS) {
				vertexModule = this.getCachedShaderModule(pipelineConfig.vertexShader, {clusteredLightsConfig});
				fragmentModule = this.getCachedShaderModule(pipelineConfig.fragmentShader, {clusteredLightsConfig});
			} else {
				vertexModule = this.getCachedShaderModule(pipelineConfig.vertexShader);
				fragmentModule = this.getCachedShaderModule(pipelineConfig.fragmentShader);
			}
			pipeline = this.device.createRenderPipeline({
				// todo: add better label
				label: "Material Pipeline",
				layout: this.pipelineLayout,
				vertex: {
					module: vertexModule,
					entryPoint: "main",
					...vertexState.getDescriptor(),
				},
				primitive: {
					topology: pipelineConfig.primitiveTopology,
				},
				depthStencil: {
					format: outputConfig.depthStencilFormat,
					depthCompare: "less",
					depthWriteEnabled: true,
				},
				multisample: {
					count: outputConfig.multisampleCount,
				},
				fragment: {
					module: fragmentModule,
					entryPoint: "main",
					targets: outputConfig.fragmentTargets,
				},
			});
			this.cachedPipelines.set(keys, pipeline);
		}
		return pipeline;
	}

	disposeMaterial(material) {
		// const materialData = this.getCachedMaterialData(material);
		this.cachedMaterialData.delete(material);
		// this.removeUsedByObjectFromPipeline(materialData.forwardPipeline, material);
	}

	// pipelines cannot be disposed by the webgpu spec at the moment,
	// leaving this code here just in case it is needed in the future

	// addUsedByObjectToPipeline(pipeline, usedBy){
	// 	let usedByList = this.pipelinesUsedByLists.get(pipeline);
	// 	if(!usedByList){
	// 		usedByList = new Set();
	// 		this.pipelinesUsedByLists.set(pipeline, usedByList);
	// 	}
	// 	usedByList.add(new WeakRef(usedBy));
	// }

	// removeUsedByObjectFromPipeline(pipeline, usedBy){
	// 	if(!pipeline) return;
	// 	const usedByList = this.pipelinesUsedByLists.get(pipeline);
	// 	if(usedByList){
	// 		for(const ref of usedByList){
	// 			const deref = ref.deref();
	// 			if(usedBy == deref || deref === undefined){
	// 				usedByList.delete(ref);
	// 			}
	// 		}
	// 	}

	// 	if(!usedByList || usedByList.size == 0){
	// 		this.disposePipeline(pipeline);
	// 		this.pipelinesUsedByLists.delete(pipeline);
	// 	}
	// }

	// disposePipeline(pipeline){
	// 	this.pipelinesUsedByLists.delete(pipeline);
	// }

	/**
	 * @param {Mesh} mesh
	 */
	getCachedMeshData(mesh) {
		let data = this.cachedMeshData.get(mesh);
		if (!data) {
			data = new CachedMeshData(mesh, this);
			this.cachedMeshData.set(mesh, data);
		}
		return data;
	}

	getCachedShaderModule(shaderSource, {
		clusteredLightsConfig = null,
	} = {}) {
		const keys = [shaderSource];
		if (ENABLE_WEBGPU_CLUSTERED_LIGHTS && clusteredLightsConfig) {
			keys.push(clusteredLightsConfig);
		}
		let data = this.cachedShaderModules.get(keys);
		if (!data) {
			let code;
			if (ENABLE_WEBGPU_CLUSTERED_LIGHTS && clusteredLightsConfig) {
				code = ShaderBuilder.fillShaderDefines(shaderSource.source, clusteredLightsConfig.getShaderDefines());
			} else {
				code = shaderSource.source;
			}
			data = this.device.createShaderModule({code});
			this.cachedShaderModules.set(keys, data);
		}
		return data;
	}

	/**
	 * Useful for debugging storage buffers but probably pretty slow.
	 * Buffer should have GPUBufferUsage.COPY_SRC at creation.
	 * @param {GPUBuffer} gpuBuffer
	 * @param {number} bufferSize
	 */
	async inspectBuffer(gpuBuffer, bufferSize) {
		const readBuffer = this.device.createBuffer({
			label: gpuBuffer.label + "-inspectorCopy",
			size: bufferSize,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
		const commandEncoder = this.device.createCommandEncoder({
			label: "inspectBufferCommandEncoder",
		});
		commandEncoder.copyBufferToBuffer(gpuBuffer, 0, readBuffer, 0, bufferSize);
		const gpuCommands = commandEncoder.finish();
		this.device.queue.submit([gpuCommands]);

		await readBuffer.mapAsync(GPUMapMode.READ);
		return readBuffer.getMappedRange();
	}
}