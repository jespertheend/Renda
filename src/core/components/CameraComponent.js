import Component from "./Component.js"

export default class CameraComponent extends Component{
	constructor(opts){
		super(opts);
		opts = {...{
			autoManageRootRenderObjects: true,
		}, ...opts}
		this.autoManageRootRenderObjects = opts.autoManageRootRenderObjects;

		this.rootRenderObjects = [];
	}

	onAttachedToObject(){
		this.setRootRenderObjects();
	}

	onParentChanged(){
		this.setRootRenderObjects();
	}

	setRootRenderObjects(){
		if(this.autoManageRootRenderObjects){
			let lastParent = this.attachedObject;
			if(lastParent){
				while(true){
					if(lastParent.parent){
						lastParent = lastParent.parent;
					}else{
						break;
					}
				}
			}
			if(lastParent){
				this.rootRenderObjects = [lastParent];
			}else{
				this.rootRenderObjects = [];
			}
		}
	}
}
