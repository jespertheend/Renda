import {Vec3, Quaternion} from "../index.js";

export default class OrbitControls{
	constructor(cameraEntity, eventElement){
		this.camera = cameraEntity;

		this.camTransformDirty = true;
		this.lookPos = new Vec3();
		this.lookRot = new Quaternion();
		this.lookDist = 3;

		this.boundOnWheel = this.onWheel.bind(this);
		this.addedEventElements = [];
		if(eventElement) this.addEventElement(eventElement);
	}

	destructor(){
		for(const elem of this.addedEventElements){
			elem.removeEventListener("wheel", this.boundOnWheel);
		}
		this.boundOnWheel = null;
	}

	addEventElement(elem){
		this.addedEventElements.push(elem);
		elem.addEventListener("wheel", this.boundOnWheel);
	}

	onWheel(e){
		e.preventDefault();
		const dx = e.deltaX;
		const dy = e.deltaY;
		if(dx != 0 || dy != 0){
			this.camTransformDirty = true;
		}
		if(e.ctrlKey){
			this.lookDist += e.deltaY*0.01;
		}else if(e.shiftKey){
			let xDir = this.lookRot.rotateVector(Vec3.right).multiply(dx*0.01);
			let yDir = this.lookRot.rotateVector(Vec3.up).multiply(-dy*0.01);
			this.lookPos.add(xDir).add(yDir);
		}else{
			this.lookRot.rotateAxisAngle(new Vec3(0,1,0), dx*0.01);
			let pitchAxis = this.lookRot.rotateVector(Vec3.right);
			this.lookRot.rotateAxisAngle(pitchAxis, e.deltaY*0.01);
		}
	}

	loop(){
		if(this.camTransformDirty){
			this.updateCamPos();
			this.camTransformDirty = false;
			return true;
		}
		return false;
	}

	updateCamPos(){
		let lookDir = this.lookRot.rotateVector(Vec3.back);
		this.camera.pos = lookDir.clone().multiply(Math.pow(2,this.lookDist)).add(this.lookPos);
		this.camera.rot = this.lookRot.clone().invert();
	}
}