import ContentWindow from "./ContentWindow.js";
import Button from "../../UI/Button.js";
import editor from "../../editorInstance.js";

export default class ContentWindowProperties extends ContentWindow{

	static contentWindowTypeId = "properties";
	static contentWindowUiName = "Properties";

	constructor(){
		super(...arguments);

		this.activeSelectionManager = null;
		this.activeContent = null;
	}

	destructor(){
		super.destructor();
		this.activeSelectionManager = null;
		if(this.activeContent) this.activeContent.destructor();
		this.activeContent = null;
	}

	onContentTypeRegistered(constructor){
		this.updateCurrentContentType();
	}

	onSelectionChanged(selectionManager){
		this.activeSelectionManager = selectionManager;
		this.updateCurrentContentType();
	}

	updateCurrentContentType(){
		if(!this.activeSelectionManager) return;
		let selectedObjects = this.activeSelectionManager.currentSelectedObjects;

		let PropertiesWindowContent = editor.propertiesWindowContentManager.getContentTypeForObjects(selectedObjects);
		if(!this.activeContent || this.activeContent.constructor != PropertiesWindowContent){
			if(this.activeContent) this.activeContent.destructor();
			this.activeContent = new PropertiesWindowContent();
			this.contentEl.appendChild(this.activeContent.el);
		}

		this.activeContent.selectionChanged(selectedObjects);
	}
}
