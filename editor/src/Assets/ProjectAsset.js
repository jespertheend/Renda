import editor from "../editorInstance.js";
import {SingleInstancePromise, AssetLoaderTypeGenericStructure, BinaryComposer} from "../../../src/index.js";
import {getNameAndExtension} from "../Util/FileSystems/PathUtil.js";

export default class ProjectAsset{
	constructor({
		uuid = null,
		path = [],
		assetSettings = {},
		assetType = null,
		forceAssetType = false,
		isBuiltIn = false,
	} = {}){
		this.uuid = uuid;
		this.path = path;
		this.assetSettings = assetSettings;
		this.assetType = assetType;
		this.forceAssetType = forceAssetType;
		this.needsConsistentUuid = false;
		this.isBuiltIn = isBuiltIn;

		this._projectAssetType = null;
		this.isGettingLiveAssetData = false;
		this.currentGettingLiveAssetSymbol = null;
		this.onLiveAssetDataGetCbs = new Set();
		this.liveAsset = null;
		this.editorData = null;

		this.initInstance = new SingleInstancePromise(async _=> await this.init());
		this.initInstance.run();

		this.onNewLiveAssetInstanceCbs = new Set();

		this.destructed = false;
	}

	destructor(){
		this.destructed = true;

		this.destroyLiveAssetData();
		this.assetSettings = null;
		this._projectAssetType = null;
	}

	async init(){
		if(!this.assetType){
			if(this.isBuiltIn){
				this.assetType = await ProjectAsset.guessAssetTypeFromPath(this.path);
			}else{
				this.assetType = await ProjectAsset.guessAssetTypeFromFile(this.path);
			}
		}
		if(this.destructed) return;

		const AssetTypeConstructor = editor.projectAssetTypeManager.getAssetType(this.assetType);
		if(AssetTypeConstructor){
			this._projectAssetType = new AssetTypeConstructor(this);
		}
	}

	async waitForInit(){
		await this.initInstance.run();
	}

	async getProjectAssetType(){
		await this.waitForInit();
		return this._projectAssetType;
	}

	static async fromJsonData(uuid, assetData){
		if(!assetData.assetType){
			assetData.assetType = this.guessAssetTypeFromPath(assetData.path);
			assetData.forceAssetType = false;
		};
		const projectAsset = new ProjectAsset({uuid,...assetData});
		return projectAsset;
	}

	static guessAssetTypeFromPath(path = []){
		if(!path || path.length <= 0) return null;
		const fileName = path[path.length - 1];
		const {extension} = getNameAndExtension(fileName);
		if(extension == "json") return null;
		for(const assetType of editor.projectAssetTypeManager.getAssetTypesForExtension(extension)){
			return assetType.type;
		}
		return null;
	}

	static async guessAssetTypeFromFile(path = []){
		const assetType = this.guessAssetTypeFromPath(path);
		if(assetType) return assetType;

		const json = await editor.projectManager.currentProjectFileSystem.readJson(path);
		return json?.assetType || null;
	}

	get name(){
		return this.path[this.path.length - 1];
	}

	//call AssetManager.makeAssetUuidConsistent() to also save
	//the uuid to asset settings file immediately
	makeUuidConsistent(){
		this.needsConsistentUuid = true;
	}

	get needsAssetSettingsSave(){
		if(this.forceAssetType) return true;
		if(this.needsConsistentUuid) return true;

		//if asset settings contains at least one key it needs to be saved
		for(const key of Object.keys(this.assetSettings)){
			return true;
		}

		return false;
	}

	makeBuiltIn(){
		this.isBuiltIn = true;
	}

	assetMoved(newPath){
		this.path = newPath;
	}

	toJson(){
		const assetData = {
			path: this.path,
		}
		if(this.forceAssetType){
			assetData.assetType = this.assetType;
		}
		if(Object.keys(this.assetSettings).length > 0){
			assetData.assetSettings = this.assetSettings;
		}
		return assetData;
	}

	async open(){
		await this.waitForInit();
		await this._projectAssetType.open();
	}

	async createNewLiveAssetData(){
		await this.waitForInit();
		const {liveAsset, editorData} = await this._projectAssetType.createNewLiveAssetData();
		const assetData = await this._projectAssetType.saveLiveAssetData(liveAsset, editorData);
		await this.writeAssetData(assetData);
	}

	async getLiveAssetData(){
		if(this.liveAsset || this.editorData){
			return {
				liveAsset: this.liveAsset,
				editorData: this.editorData,
			}
		}

		if(this.isGettingLiveAssetData){
			return await new Promise(r => this.onLiveAssetDataGetCbs.add(r));
		}

		this.isGettingLiveAssetData = true;
		const getLiveAssetSymbol = Symbol("get liveAsset");
		this.currentGettingLiveAssetSymbol = getLiveAssetSymbol;
		await this.waitForInit();
		let fileData = null;
		let readFailed = false;
		try{
			fileData = await this.readAssetData();
		}catch(e){
			//todo: implement a way to detect if the file has been deleted
			//and if that's the case give the user an option to remove the uuid
			//from assetSettings.json
			readFailed = true;
		}

		//if destroyLiveAssetData has been called before this Promise was finished
		if(getLiveAssetSymbol != this.currentGettingLiveAssetSymbol) return {liveAsset: null, editorData: null};

		if(readFailed){
			console.warn("error getting live asset for "+this.path.join("/"));
			this.fireOnLiveAssetDataGetCbs({liveAsset: null, editorData: null});
			return {liveAsset: null, editorData: null};
		}

		const {liveAsset, editorData} = await this._projectAssetType.getLiveAssetData(fileData);

		//if destroyLiveAssetData has been called before this Promise was finished
		if(getLiveAssetSymbol != this.currentGettingLiveAssetSymbol){
			if((liveAsset || editorData) && this._projectAssetType){
				this._projectAssetType.destroyLiveAssetData(liveAsset, editorData);
			}
			this.fireOnLiveAssetDataGetCbs({liveAsset: null, editorData: null});
			return {liveAsset: null, editorData: null};
		}

		this.liveAsset = liveAsset || null;
		this.editorData = editorData || null;
		this.fireOnLiveAssetDataGetCbs({
			liveAsset: this.liveAsset,
			editorData: this.editorData,
		});
		return {
			liveAsset: this.liveAsset,
			editorData: this.editorData,
		}
	}

	async getLiveAsset(){
		const {liveAsset} = await this.getLiveAssetData();
		return liveAsset;
	}

	async getEditorData(){
		const {editorData} = await this.getLiveAssetData();
		return editorData;
	}

	//returns the currently loaded live asset synchronously
	//returns null if the liveAsset isn't init yet
	getLiveAssetImmediate(){
		return this.liveAsset;
	}

	onNewLiveAssetInstance(cb){
		this.onNewLiveAssetInstanceCbs.add(cb);
	}

	removeOnNewLiveAssetInstance(cb){
		this.onNewLiveAssetInstanceCbs.delete(cb);
	}

	liveAssetNeedsReplacement(){
		this.destroyLiveAssetData();
		for(const cb of this.onNewLiveAssetInstanceCbs){
			cb();
		}
	}

	fireOnLiveAssetDataGetCbs(liveAssetData){
		for(const cb of this.onLiveAssetDataGetCbs){
			cb(liveAssetData);
		}
		this.onLiveAssetDataGetCbs.clear();
		this.isGettingLiveAssetData = false;
	}

	destroyLiveAssetData(){
		if(this.isGettingLiveAssetData){
			this.fireOnLiveAssetDataGetCbs({liveAsset: null, editorData: null});
			this.currentGettingLiveAssetSymbol = null;
		}else if((this.liveAsset || this.editorData) && this._projectAssetType){
			this._projectAssetType.destroyLiveAssetData(this.liveAsset, this.editorData);
			this.liveAsset = null;
		}
	}

	async saveLiveAssetData(){
		await this.waitForInit();
		const liveAsset = await this.getLiveAsset();
		const editorData = await this.getEditorData();
		const assetData = await this._projectAssetType.saveLiveAssetData(liveAsset, editorData);
		await this.writeAssetData(assetData);
	}

	async getPropertiesAssetContentConstructor(){
		await this.waitForInit();
		if(!this._projectAssetType) return null;
		return this._projectAssetType.constructor.propertiesAssetContentConstructor;
	}

	async getPropertiesAssetContentStructure(){
		await this.waitForInit();
		if(!this._projectAssetType) return null;
		return this._projectAssetType.constructor.propertiesAssetContentStructure;
	}

	async getPropertiesAssetSettingsStructure(){
		await this.waitForInit();
		if(!this._projectAssetType) return null;
		return this._projectAssetType.constructor.assetSettingsStructure;
	}

	async readAssetData(){
		await this.waitForInit();

		let format = "binary";
		if(this._projectAssetType.constructor.storeInProjectAsJson){
			format = "json";
		}else if(this._projectAssetType.constructor.storeInProjectAsText){
			format = "text";
		}

		let fileData = null;
		if(this.isBuiltIn){
			fileData = await editor.builtInAssetManager.fetchAsset(this.path, format);
		}else{
			if(format == "json"){
				fileData = await editor.projectManager.currentProjectFileSystem.readJson(this.path);
			}else if(format == "text"){
				fileData = await editor.projectManager.currentProjectFileSystem.readText(this.path);
			}else{
				fileData = await editor.projectManager.currentProjectFileSystem.readFile(this.path);
			}
		}

		if(format == "json" && this._projectAssetType.constructor.wrapProjectJsonWithEditorMetaData){
			fileData = fileData.asset || null;
		}
		return fileData;
	}

	async writeAssetData(fileData){
		await this.waitForInit();
		if(this._projectAssetType.constructor.storeInProjectAsJson){
			let json = null;
			if(this._projectAssetType.constructor.wrapProjectJsonWithEditorMetaData){
				json = {
					assetType: this._projectAssetType.constructor.type,
					asset: fileData,
				}
			}else{
				json = fileData;
			}
			await editor.projectManager.currentProjectFileSystem.writeJson(this.path, json);
		}else if(this._projectAssetType.constructor.storeInProjectAsText){
			await editor.projectManager.currentProjectFileSystem.writeText(this.path, fileData);
		}else{
			await editor.projectManager.currentProjectFileSystem.writeBinary(this.path, fileData);
		}
	}

	async getAssetTypeUuid(){
		await this.waitForInit();
		return this._projectAssetType.constructor.typeUuid;
	}

	async getBundledAssetData(assetSettingOverrides){
		await this.waitForInit();
		let binaryData = await this._projectAssetType.createBundledAssetData(assetSettingOverrides);
		if(!binaryData){
			const usedAssetLoaderType = this._projectAssetType.constructor.usedAssetLoaderType;
			if(usedAssetLoaderType && usedAssetLoaderType.prototype instanceof AssetLoaderTypeGenericStructure){
				const assetData = await this.readAssetData();

				if(this._projectAssetType.constructor.propertiesAssetContentStructure){
					this.remapAssetDataEnums(assetData, this._projectAssetType.constructor.propertiesAssetContentStructure);
				}

				binaryData = BinaryComposer.objectToBinary(assetData, usedAssetLoaderType.binaryComposerOpts);
			}
		}
		if(!binaryData){
			if(this.isBuiltIn){
				binaryData = await editor.builtInAssetManager.fetchAsset(this.path, "binary");
			}else{
				binaryData = await editor.projectManager.currentProjectFileSystem.readFile(this.path);
			}
		}
		return binaryData;
	}

	remapAssetDataEnums(assetData, propertiesStructure){
		if(typeof assetData == "object" && assetData != null){
			if(Array.isArray(assetData)){
				if(propertiesStructure.type != Array) return assetData;
				for(let i=0; i<assetData.length; i++){
					assetData[i] = this.remapAssetDataEnums(assetData[i], propertiesStructure.arrayOpts.type);
				}
			}else{
				for(const [key, value] of Object.entries(assetData)){
					const structure = propertiesStructure[key];
					assetData[key] = this.remapAssetDataEnums(value, structure);
				}
			}
		}else if(typeof assetData == "string"){
			if(Array.isArray(propertiesStructure.type) && propertiesStructure.guiOpts?.enumObject){
				assetData = propertiesStructure.guiOpts.enumObject[assetData];
			}
		}
		return assetData;
	}

	async *getReferencedAssetUuids(){
		await this.waitForInit();
		const usedAssetLoaderType = this._projectAssetType.constructor.usedAssetLoaderType;
		if(usedAssetLoaderType && usedAssetLoaderType.prototype instanceof AssetLoaderTypeGenericStructure){
			const assetData = await this.readAssetData();

			const referencedUuids = [];
			BinaryComposer.objectToBinary(assetData, {
				...usedAssetLoaderType.binaryComposerOpts,
				transformValueHook: args => {
					let {value, type} = args;
					if(usedAssetLoaderType.binaryComposerOpts.transformValueHook){
						value = transformValueHook(args);
					}

					if(type == BinaryComposer.StructureTypes.ASSET_UUID){
						referencedUuids.push(value);
					}
					return value;
				},
			});
			for(const uuid of referencedUuids){
				yield uuid;
			}
		}

		for await(const uuid of this._projectAssetType.getReferencedAssetUuids()){
			yield uuid;
		}
	}

	async fileChangedExternally(){
		await this.waitForInit();
		if(!this._projectAssetType) return;
		await this._projectAssetType.fileChangedExternally();
	}
}
