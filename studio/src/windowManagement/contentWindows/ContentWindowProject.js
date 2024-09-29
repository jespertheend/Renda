import { ContentWindow } from "./ContentWindow.js";
import { TreeView } from "../../ui/TreeView.js";
import { Button } from "../../ui/Button.js";
import { handleDuplicateFileName, parseMimeType } from "../../util/util.js";
import { getProjectSelectorInstance } from "../../projectSelector/projectSelectorInstance.js";
import { ProjectFilesTreeView } from "../ProjectFilesTreeView.js";

/**
 * @typedef {object} DraggingProjectAssetData
 * @property {boolean} dataPopulated
 * @property {typeof import("../../assets/projectAssetTypes/ProjectAssetType.js").ProjectAssetType?} assetType Is null when data hasn't been populated yet.
 * @property {import("../../../../src/util/mod.js").UuidString?} assetUuid Is null when data hasn't been populated yet.
 */

export class ContentWindowProject extends ContentWindow {
	static contentWindowTypeId = /** @type {const} */ ("renda:project");
	static contentWindowUiName = "Project Files";
	static contentWindowUiIcon = "static/icons/folder.svg";

	/** @type {ProjectFilesTreeView?} */
	#treeView = null;

	/** @type {Set<import("../../assets/AssetManager.js").AssetManager>} */
	#registeredDismissedManagers = new Set();

	/**
	 * @param {ConstructorParameters<typeof ContentWindow>} args
	 */
	constructor(...args) {
		super(...args);

		const createButton = new Button({
			text: "+",
			tooltip: "Create Asset",
			onClick: () => {
				const menu = this.studioInstance.popoverManager.createContextMenu([
					{
						text: "New Folder",
						onClick: () => this.createNewDir(),
					},
					{
						text: "Materials",
						submenu: [
							{
								text: "New Material",
								onClick: () => this.createAsset("renda:material"),
							},
							{
								text: "New Material Map",
								onClick: () => this.createAsset("renda:materialMap"),
							},
							{
								text: "New WebGPU Pipeline Config",
								onClick: () => this.createAsset("renda:webGpuPipelineConfig"),
							},
						],
					},
					{
						text: "New Mesh",
						onClick: () => this.createAsset("renda:mesh"),
					},
					{
						text: "New Vertex State",
						onClick: () => this.createAsset("renda:vertexState"),
					},
					{
						text: "New Entity",
						onClick: () => this.createAsset("renda:entity"),
					},
					{
						text: "New Render Output Config",
						onClick: () => this.createAsset("renda:renderOutputConfig"),
					},
					{
						text: "New Render Clustered Lights Config",
						onClick: () => this.createAsset("renda:clusteredLightsConfig"),
					},
					{
						text: "New Sampler",
						onClick: () => this.createAsset("renda:sampler"),
					},
					{
						text: "New Task",
						submenu: () => {
							/** @type {import("../../ui/popoverMenus/ContextMenu.js").ContextMenuStructure} */
							const menu = [];
							for (const taskType of this.studioInstance.taskManager.getTaskTypes()) {
								menu.push({
									text: taskType.uiName,
									onClick: async () => {
										const asset = await this.createAsset("renda:task");
										/**
										 * @type {import("../../assets/projectAssetTypes/ProjectAssetTypeTask.js").TaskProjectAssetDiskData}
										 */
										const fileData = {
											taskType: taskType.type,
										};
										await asset.writeAssetData(fileData);
									},
								});
							}
							return menu;
						},
					},
				]);

				menu.setPos(createButton);
			},
		});
		this.addTopBarEl(createButton.el);

		const openProjectButton = new Button({
			text: "Open Project",
			onClick: () => {
				getProjectSelectorInstance().setVisibility(true);
			},
		});
		this.addTopBarEl(openProjectButton.el);

		this.contentEl.appendChild(this.treeView.el);

		/** @type {import("../../misc/SelectionGroup.js").SelectionGroup<import("../../assets/ProjectAsset.js").ProjectAssetAny>} */
		this.selectionGroup = this.studioInstance.selectionManager.createSelectionGroup();

		this.rootNameInit = false;
		this.treeViewInit = false;
		this.initCbsCalled = false;
		/** @type {Set<() => void>} */
		this.onInitCbs = new Set();

		const fs = this.studioInstance.projectManager.currentProjectFileSystem;
		if (fs) {
			this.initialUpdateTreeView();
			this.updateRootName();
			this.treeView.renameable = fs.rootNameSetSupported;
			fs.onRootNameChange((newName) => {
				this.treeView.name = newName;
			});
		}

		this.studioInstance.projectManager.onFileChange(this.#onFileChange);

		this.expandRootOnLoad();
		this.#init();
	}

	async #init() {
		const assetManager = await this.studioInstance.projectManager.getAssetManager();
		if (this.destructed) return;
		this.#treeView = new ProjectFilesTreeView(assetManager.projectAssetLibrary);
	}

	destructor() {
		super.destructor();

		if (this.#treeView) this.#treeView.destructor();
		this.selectionGroup.destructor();

		this.studioInstance.projectManager.removeOnFileChange(this.#onFileChange);

		for (const manager of this.#registeredDismissedManagers) {
			manager.removeOnPermissionPromptResult(this.#onUserDismissedPermission);
		}
	}

	get fileSystem() {
		const fs = this.studioInstance.projectManager.currentProjectFileSystem;
		if (!fs) {
			throw new Error("Operation failed, no active fileSystem.");
		}
		return fs;
	}

	async updateRootName() {
		const name = await this.fileSystem.getRootName();
		if (!this.treeView) return; // destructed
		this.treeView.name = name;
		this.rootNameInit = true;
		this.updateInit();
	}

	async initialUpdateTreeView() {
		await this.fileSystem.waitForPermission([], { writable: false });
		await this.updateTreeView();
		this.treeViewInit = true;
		this.updateInit();
	}

	get isInit() {
		return this.rootNameInit && this.treeViewInit;
	}

	async waitForInit() {
		if (this.isInit) return;
		/** @type {Promise<void>} */
		const promise = new Promise((r) => this.onInitCbs.add(r));
		await promise;
	}

	updateInit() {
		if (!this.isInit) return;
		if (this.initCbsCalled) return;
		this.initCbsCalled = true;
		this.onInitCbs.forEach((cb) => cb());
	}

	/**
	 * @param {TreeView} treeView
	 */
	setChildTreeViewProperties(treeView) {
		treeView.renameable = true;
		treeView.rearrangeableHierarchy = true;
		treeView.draggable = true;
	}

	/**
	 * @param {import("../../util/fileSystems/StudioFileSystem.js").FileSystemChangeEvent} e
	 */
	#onFileChange = async (e) => {
		const parentPath = e.path.slice(0, -1);
		await this.updateTreeView(parentPath);
	};

	/**
	 * @param {TreeView} treeView
	 */
	async getProjectAssetByTreeViewItem(treeView) {
		const path = this.pathFromTreeView(treeView);
		const assetManager = await this.studioInstance.projectManager.getAssetManager();
		const projectAsset = await assetManager.getProjectAssetFromPath(path);
		return projectAsset;
	}

	/**
	 * @param {Iterable<TreeView>} treeViews
	 */
	async mapTreeViewArrayToProjectAssets(treeViews) {
		const newArr = [];
		for (const treeView of treeViews) {
			const projectAsset = await this.getProjectAssetByTreeViewItem(treeView);
			if (!projectAsset) continue;
			newArr.push(projectAsset);
		}
		return newArr;
	}

	getSelectedParentPathForCreate() {
		let selectedPath = [];
		let { treeView } = this;
		for (const selectedItem of this.treeView.getSelectedItems()) {
			if (!selectedItem.alwaysShowArrow && selectedItem.parent) {
				treeView = selectedItem.parent;
			} else {
				treeView = selectedItem;
			}
			break;
		}
		const selectionPath = treeView.getNamesPath();
		selectedPath = selectionPath.slice(1, selectionPath.length);
		return selectedPath;
	}

	/**
	 * @param {string} assetType
	 */
	async createAsset(assetType) {
		const selectedPath = this.getSelectedParentPathForCreate();
		const assetManager = await this.studioInstance.projectManager.getAssetManager();
		const projectAsset = await assetManager.createNewAsset(selectedPath, assetType);
		return projectAsset;
	}

	async createNewDir() {
		const selectedPath = this.getSelectedParentPathForCreate();
		let folderName = "New Folder";
		if (await this.fileSystem.exists([...selectedPath, folderName])) {
			const existingFiles = await this.fileSystem.readDir(selectedPath);
			folderName = handleDuplicateFileName(existingFiles, folderName);
		}
		const newPath = [...selectedPath, folderName];
		await this.fileSystem.createDir(newPath);
		this.treeView.collapsed = false;
	}

	/**
	 * @param {import("../../ui/TreeView.js").TreeView} treeView
	 * @param {boolean} [removeLast]
	 * @returns {string[]}
	 */
	pathFromTreeView(treeView, removeLast = false) {
		const path = treeView.getNamesPath();
		path.shift(); // remove root
		if (removeLast) path.pop();
		return path;
	}

	/**
	 * If asset settings are loaded, this means we've already obtained read permission
	 * to the file system. In this case we will expand the root tree view as this
	 * is something the user will want to do anyway.
	 */
	async expandRootOnLoad() {
		const assetManager = await this.studioInstance.projectManager.getAssetManager();
		if (assetManager.assetSettingsLoaded) {
			this.treeView.collapsed = false;
		}
	}

	/**
	 * If asset settings are not yet loaded, this will load the asset settings and wait for them to load.
	 * A permission prompt might be shown, so this should only be called from a user gesture.
	 */
	loadAssetSettingsFromUserGesture() {
		const assetManager = this.studioInstance.projectManager.assertAssetManagerExists();
		for (const manager of this.#registeredDismissedManagers) {
			manager.removeOnPermissionPromptResult(this.#onUserDismissedPermission);
		}
		this.#registeredDismissedManagers.add(assetManager);
		assetManager.onPermissionPromptResult(this.#onUserDismissedPermission);
		assetManager.loadProjectAssetSettings(true);
	}

	/**
	 * @param {boolean} granted
	 */
	#onUserDismissedPermission = (granted) => {
		if (!granted) {
			this.treeView.collapsed = true;
			this.treeView.deselect();
		} else {
			this.treeView.collapsed = false;
		}
	}

	/** @override */
	activate() {
		this.treeView.focusIfNotFocused();
		this.selectionGroup.activate();
	}

	/**
	 * @param {string[]} path
	 */
	async highlightPath(path) {
		await this.updateTreeViewRange(path);
		const assetTreeView = this.treeView.findChildFromNamesPath(path);
		if (assetTreeView) {
			assetTreeView.expandWithParents();
			assetTreeView.highlight();
		}
	}
}
