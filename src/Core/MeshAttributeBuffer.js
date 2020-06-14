import {Vector3} from "../index.js";

export default class MeshAttributeBuffer{
	constructor(data, {
		componentCount = 1, //amount of components per attribute e.g. 3 for vec3
	} = {}){
		if(!ArrayBuffer.isView(data)){
			if(!Array.isArray(data)){
				throw new Error("invalid data type");
			}
			if(data.length <= 0){
				data = new Uint8Array();
			}else if(typeof data[0] == "number"){
				componentCount = 1;
				data = new Uint16Array(data);
			}else if(data[0] instanceof Vector3){
				componentCount = 3;
				const newData = new Float32Array(data.length * 3);
				let i=0;
				for(const pos of data){
					newData[i++] = pos.x;
					newData[i++] = pos.y;
					newData[i++] = pos.z;
				}
				data = newData;
			}
		}

		this.componentCount = componentCount;
		this.dataView = data;
		this.glBuffer = null;
	}

	destructor(){
		if(this.glBuffer){
			//todo
			//gl.deleteBuffer(this.glBuffer);
			this.glBuffer = null;
		}
		this.dataView = null;
	}

	uploadToWebGl(gl, bufferType = null){
		if(!this.glBuffer){
			this.glBuffer = gl.createBuffer();
		}
		//todo: only upload when data is dirty
		if(bufferType == null) bufferType = gl.ARRAY_BUFFER;
		gl.bindBuffer(bufferType, this.glBuffer);
		gl.bufferData(bufferType, this.dataView, gl.STATIC_DRAW);
	}
}
