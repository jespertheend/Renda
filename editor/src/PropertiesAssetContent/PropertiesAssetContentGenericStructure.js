import PropertiesAssetContent from "./PropertiesAssetContent.js";
import editor from "../editorInstance.js";

export default class PropertiesAssetContentGenericStructure extends PropertiesAssetContent{
	constructor(structure){
		super();

		this.structure = structure;

		this.assetTreeView = this.treeView.addCollapsable("Asset Values");
		this.assetTreeView.generateFromSerializableStructure(this.structure);
		this.assetTreeView.onChildValueChange(_ => {
			if(this.isUpdatingUi) return;
			this.saveAsset();
		});

		this.isUpdatingUi = false;
	}

	async selectionUpdated(selectedAssets){
		super.selectionUpdated(selectedAssets);
		await this.loadAsset();
	}

	async loadAsset(){
		//todo: handle multiple selected items or no selection

		const asset = this.currentSelection[0];
		const assetData = await asset.readAssetData();
		this.isUpdatingUi = true;

		await this.assetTreeView.fillSerializableStructureValues(assetData);

		this.isUpdatingUi = false;
	}

	saveAsset(){
		//todo: handle multiple selected items or no selection
		const assetData = this.assetTreeView.getSerializableStructureValues(this.structure, {convertEnumsToString: true});
		this.currentSelection[0].writeAssetData(assetData);
	}
}