import {MeshAttributeBuffer, Mesh} from "../../../index.js";

export default class WebGpuVertexStateAttribute{
	constructor({
		components = 3,
		format = "float32",
		unsigned = false,
		normalized = false,
		shaderLocation = null, //null or undefined or "auto" for auto
		attributeType = null,
	} = {}){
		this.components = components;
		this.format = format;
		this.unsigned = unsigned;
		this.normalized = normalized;
		this.shaderLocation = shaderLocation;
		if(typeof attributeType == "string"){
			attributeType = Mesh.AttributeTypes[attributeType];
		}
		this.attributeType = attributeType;

		this.lastRequestedOffset = 0;
	}

	getDescriptor(vertexState, vertexBuffer){
		const format = this.getDescriptorFormat();
		const offset = this.lastRequestedOffset = vertexBuffer.requestAttributeOffset(this.byteSize);
		let shaderLocation = this.shaderLocation;
		if(shaderLocation == null || shaderLocation == "auto"){
			shaderLocation = vertexState.requestShaderLocationIndex();
		}
		return {format, offset, shaderLocation};
	}

	get byteSize(){
		return this.components * MeshAttributeBuffer.getByteLengthForFormat(this.format);
	}

	get minRequiredStrideBytes(){
		return this.lastRequestedOffset + this.components * MeshAttributeBuffer.getByteLengthForFormat(this.format);
	}

	getDescriptorFormat(){
		let str = "";
		if(this.format.startsWith("int")){
			str += this.unsigned ? "u" : "s";
		}
		if(this.normalized){
			str += "norm" + MeshAttributeBuffer.getBitLengthForFormat(this.format);
		}else{
			str += this.format;
		}
		if(this.components > 1){
			str += "x"+this.components;
		}
		return str;
	}
}
