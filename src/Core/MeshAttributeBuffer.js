import {Vec3} from "../index.js";

export default class MeshAttributeBuffer{
	constructor({
		arrayStride = 4,
		attributes = [{offset: 0, format: "float32", components: 1, attributeType: null}],
	} = {}){
		this.arrayStride = arrayStride;
		this.attributes = attributes;

		this.buffer = null;
		this._dataView = null;
	}

	destructor(){
	}

	getDataView(){
		if(!this._dataView){
			this._dataView = new DataView(this.buffer);
		}
		return this._dataView;
	}

	hasAttributeType(attributeType){
		return !!this.getAttributeSettings(attributeType);
	}

	getAttributeSettings(attributeType){
		for(const attribute of this.attributes){
			if(attribute.attributeType == attributeType){
				return attribute;
			}
		}
		return null;
	}

	setVertexCount(vertexCount){
		const length = vertexCount*this.arrayStride;
		const oldBuffer = this.buffer;
		this.buffer = new ArrayBuffer(length);
		if(oldBuffer){
			new Uint8Array(this.buffer).set(new Uint8Array(oldBuffer));
		}
	}

	setVertexData(attributeType, data){
		const attributeSettings = this.getAttributeSettings(attributeType);
		const dataView = this.getDataView();

		//todo: pick function based on attributeSettings.format
		let setFunction = dataView.setFloat32.bind(dataView);
		let valueByteSize = 4;

		if(data instanceof ArrayBuffer){
			//todo
		}else if(ArrayBuffer.isView(data)){
			data = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
			//todo
		}else if(Array.isArray(data)){
			if(data.length <= 0){
				return;
			}else if(typeof data[0] == "number"){
				let i=0;
				while(i<data.length){
					for(let j=0; j<attributeSettings.components; j++){
						setFunction(i*this.arrayStride + attributeSettings.offset + valueByteSize * j, data[i], true);
					}
					i++;
				}
			}else if(data[0] instanceof Vec3){
				if(attributeSettings.components != 3){
					throw new TypeError("Vec3 array expected");
				}
				for(const [i, pos] of data.entries()){
					setFunction(i*this.arrayStride + attributeSettings.offset + valueByteSize * 0, pos.x, true);
					setFunction(i*this.arrayStride + attributeSettings.offset + valueByteSize * 1, pos.y, true);
					setFunction(i*this.arrayStride + attributeSettings.offset + valueByteSize * 2, pos.z, true);
				}
			}
			//todo: support more vector types
		}else{
			throw new TypeError("invalid data type");
		}
	}
}
