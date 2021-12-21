import {ContentWindow} from "./ContentWindow.js";
import {TreeView} from "../../UI/TreeView.js";
import {Button} from "../../UI/Button.js";
import {SelectionGroup} from "../../Managers/SelectionGroup.js";
import {handleDuplicateName} from "../../Util/Util.js";
import {getProjectSelectorInstance} from "../../ProjectSelector/projectSelectorInstance.js";

/**
 * @typedef {Object} DraggingProjectAssetData
 * @property {boolean} dataPopulated
 * @property {typeof import("../../Assets/ProjectAssetType/ProjectAssetType.js").ProjectAssetType} assetType
 * @property {import("../../Util/Util.js").UuidString} assetUuid
 */

export class ContentWindowProject extends ContentWindow {
	static contentWindowTypeId = "project";
	static contentWindowUiName = "Project Files";
	static contentWindowUiIcon = "icons/contentWindowTabs/project.svg";

	/**
	 * @param {ConstructorParameters<typeof ContentWindow>} args
	 */
	constructor(...args) {
		super(...args);

		const createButton = new Button({
			text: "+",
			onClick: () => {
				const menu = this.editorInstance.contextMenuManager.createContextMenu([
					{
						text: "New Folder",
						onClick: () => this.createNewDir(),
					},
					{
						text: "Materials",
						submenu: [
							{
								text: "New Material",
								onClick: () => this.createAsset("JJ:material"),
							},
							{
								text: "New Material Map",
								onClick: () => this.createAsset("JJ:materialMap"),
							},
							{
								text: "New WebGPU Pipeline Config",
								onClick: () => this.createAsset("JJ:webGpuPipelineConfig"),
							},
						],
					},
					{
						text: "New Mesh",
						onClick: () => this.createAsset("JJ:mesh"),
					},
					{
						text: "New Vertex State",
						onClick: () => this.createAsset("JJ:vertexState"),
					},
					{
						text: "New Entity",
						onClick: () => this.createAsset("JJ:entity"),
					},
					{
						text: "New Asset Bundle",
						onClick: () => this.createAsset("JJ:assetBundle"),
					},
					{
						text: "New Render Output Config",
						onClick: () => this.createAsset("JJ:renderOutputConfig"),
					},
					{
						text: "New Render Clustered Lights Config",
						onClick: () => this.createAsset("JJ:clusteredLightsSetup"),
					},
				]);

				menu.setPos({item: createButton});
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

		this.treeView = new TreeView();
		this.treeView.addEventListener("selectionchange", this.onTreeViewSelectionChange.bind(this));
		this.treeView.addEventListener("namechange", this.onTreeViewNameChange.bind(this));
		this.treeView.addEventListener("dragstart", this.onTreeViewDragStart.bind(this));
		this.treeView.addEventListener("validatedrag", this.onTreeViewValidateDrag.bind(this));
		this.treeView.addEventListener("drop", this.onTreeViewDrop.bind(this));
		this.treeView.addEventListener("rearrange", this.onTreeViewRearrange.bind(this));
		this.treeView.addEventListener("dblclick", this.onTreeViewDblClick.bind(this));
		this.treeView.addEventListener("contextmenu", this.onTreeViewContextMenu.bind(this));

		this.contentEl.appendChild(this.treeView.el);

		/** @type {SelectionGroup<import("../../Assets/ProjectAsset.js").ProjectAsset>} */
		this.selectionManager = this.editorInstance.selectionManager.createSelectionGroup();

		this.rootNameInit = false;
		this.treeViewInit = false;
		this.initCbsCalled = false;
		this.onInitCbs = new Set();

		if (this.fileSystem) {
			this.initialUpdateTreeView();
			this.updateRootName();
			this.treeView.renameable = this.fileSystem.rootNameSetSupported;
			this.fileSystem.onRootNameChange(newName => {
				this.treeView.name = newName;
			});
		}

		this.boundExternalChange = this.externalChange.bind(this);
		this.editorInstance.projectManager.onExternalChange(this.boundExternalChange);
	}

	destructor() {
		super.destructor();

		this.treeView.destructor();
		this.treeView = null;

		this.selectionManager.destructor();
		this.selectionManager = null;

		this.editorInstance.projectManager.removeOnExternalChange(this.boundExternalChange);
		this.boundExternalChange = null;
	}

	get fileSystem() {
		return this.editorInstance.projectManager.currentProjectFileSystem;
	}

	async updateRootName() {
		const name = await this.fileSystem.getRootName();
		if (!this.treeView) return; // destructed
		this.treeView.name = name;
		this.rootNameInit = true;
		this.updateInit();
	}

	async initialUpdateTreeView() {
		await this.fileSystem.waitForPermission([], {writable: false});
		await this.updateTreeView();
		this.treeViewInit = true;
		this.updateInit();
	}

	get isInit() {
		return this.rootNameInit && this.treeViewInit;
	}

	async waitForInit() {
		if (this.isInit) return;
		await new Promise(r => this.onInitCbs.add(r));
	}

	updateInit() {
		if (!this.isInit) return;
		if (this.initCbsCalled) return;
		this.initCbsCalled = true;
		this.onInitCbs.forEach(cb => cb());
	}

	/**
	 * Updates the path and its children recursively when expanded.
	 * @param {Array<string> | null} path Directory to update, updates the root TreeView when omitted.
	 */
	async updateTreeView(path = null) {
		let treeView = this.treeView;
		let updatePath = [];
		if (path) {
			treeView = this.treeView.findChildFromNamesPath(path);
			updatePath = path;
		}
		if (treeView) {
			await this.updateTreeViewRecursive(treeView, updatePath);
		}
	}

	/**
	 * Updates a full range of directories from start to end, useful right before expanding a specific directory.
	 * @param {Array<string>} end The directory to update, this path is relative to start.
	 * @param {?Array<string>} start The directory to start updating from, starts updating from the root when omitted.
	 * @param {boolean} collapsedOnly When this is true, expanded TreeViews won't be updated.
	 */
	async updateTreeViewRange(end, start = null, collapsedOnly = true) {
		let {treeView} = this;
		if (start) {
			treeView = this.treeView.findChildFromNamesPath(start);
		} else {
			start = [];
		}
		for (let i = 0; i < end.length; i++) {
			const name = end[i];
			treeView = treeView.getChildByName(name);
			if (!collapsedOnly || treeView.collapsed) {
				const path = end.slice(0, i + 1);
				if (!treeView.alwaysShowArrow) return; // if the TreeView is not a directory
				await this.updateTreeViewRecursive(treeView, [...start, ...path]);
			}
		}
	}

	/**
	 * Utility function for {@link ContentWindowProject.updateTreeView} that updates
	 * a TreeView and all expanded children recursively.
	 * @param {TreeView} treeView The TreeView to update.
	 * @param {Array<string>} path The path this TreeView belongs to.
	 */
	async updateTreeViewRecursive(treeView, path) {
		if (this.destructed) return;
		if (treeView.collapsed) return;
		const hasPermissions = await this.fileSystem.getPermission(path, {writable: false});
		if (!hasPermissions) return;
		const fileTree = await this.fileSystem.readDir(path);
		if (this.destructed) return;
		for (const dir of fileTree.directories) {
			if (!treeView.includes(dir)) {
				const newTreeView = treeView.addChild();
				this.setChildTreeViewProperties(newTreeView);
				newTreeView.alwaysShowArrow = true;
				newTreeView.onCollapsedChange(() => {
					if (!newTreeView.collapsed) {
						const newPath = [...path, dir];
						this.updateTreeViewRecursive(newTreeView, newPath);
					}
				});
				newTreeView.name = dir;
				newTreeView.collapsed = true;
			}
		}
		for (const file of fileTree.files) {
			if (!treeView.includes(file)) {
				const newTreeView = treeView.addChild();
				this.setChildTreeViewProperties(newTreeView);
				newTreeView.name = file;
			}
		}
		for (const child of [...treeView.children]) {
			if (!fileTree.directories.includes(child.name) && !fileTree.files.includes(child.name)) {
				treeView.removeChild(child);
			} else if (child.alwaysShowArrow) { // if the TreeView is a directory
				const newPath = [...path, child.name];
				this.updateTreeViewRecursive(child, newPath);
			}
		}
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
	 * @param {import("../../Util/FileSystems/EditorFileSystem.js").FileSystemExternalChangeEvent} e
	 */
	async externalChange(e) {
		if (e.type == "created" || e.type == "deleted") {
			const parentPath = e.path.slice(0, -1);
			await this.updateTreeView(parentPath);
		}
	}

	async getProjectAssetByTreeViewItem(treeView) {
		const path = this.pathFromTreeView(treeView);
		const projectAsset = await this.editorInstance.projectManager.assetManager.getProjectAssetFromPath(path);
		return projectAsset;
	}

	/**
	 * @param {Iterable<TreeView>} treeViews
	 */
	async mapTreeViewArrayToProjectAssets(treeViews) {
		const newArr = [];
		for (const treeView of treeViews) {
			newArr.push(await this.getProjectAssetByTreeViewItem(treeView));
		}
		return newArr;
	}

	getSelectedParentPathForCreate() {
		let selectedPath = [];
		let {treeView} = this;
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

	async createAsset(assetType) {
		const selectedPath = this.getSelectedParentPathForCreate();
		await this.editorInstance.projectManager.assetManager.createNewAsset(selectedPath, assetType);
		await this.updateTreeView(selectedPath);
	}

	async createNewDir() {
		const selectedPath = this.getSelectedParentPathForCreate();
		let folderName = "New Folder";
		if (this.fileSystem.exists([...selectedPath, folderName])) {
			const existingFiles = await this.fileSystem.readDir(selectedPath);
			folderName = handleDuplicateName(existingFiles, folderName);
		}
		const newPath = [...selectedPath, folderName];
		await this.fileSystem.createDir(newPath);
		await this.updateTreeView(selectedPath);
		this.treeView.collapsed = false;
	}

	/**
	 * @param {import("../../UI/TreeView").TreeView} treeView
	 * @param {boolean} [removeLast]
	 * @returns {Array<string>}
	 */
	pathFromTreeView(treeView, removeLast = false) {
		const path = treeView.getNamesPath();
		path.shift(); // remove root
		if (removeLast) path.pop();
		return path;
	}

	/**
	 * @param {import("../../UI/TreeView.js").TreeViewSelectionChangeEvent} treeViewChanges
	 */
	async onTreeViewSelectionChange(treeViewChanges) {
		/** @type {import("../../Managers/SelectionGroup.js").SelectionGroupChangeData<import("../../Assets/ProjectAsset.js").ProjectAsset>} */
		const changes = {};
		changes.reset = treeViewChanges.reset;
		changes.added = await this.mapTreeViewArrayToProjectAssets(treeViewChanges.added);
		changes.removed = await this.mapTreeViewArrayToProjectAssets(treeViewChanges.removed);
		this.selectionManager.changeSelection(changes);
	}

	/**
	 * @param {import("../../UI/TreeView.js").TreeViewNameChangeEvent} e
	 */
	async onTreeViewNameChange(e) {
		if (e.oldName == e.newName) return;
		if (e.target == this.treeView) {
			if (!e.newName) {
				e.target.name = e.oldName;
				return;
			}
			await this.fileSystem.setRootName(e.newName);
			return;
		}
		const path = this.pathFromTreeView(e.target);
		const oldPath = path.slice();
		const newPath = path.slice();
		oldPath.pop();
		newPath.pop();
		oldPath.push(e.oldName);
		newPath.push(e.newName);
		try {
			await this.fileSystem.move(oldPath, newPath);
		} catch (err) {
			e.target.name = e.oldName;
			throw err;
		}
		await this.editorInstance.projectManager.assetManager.assetMoved(oldPath, newPath);
	}

	/**
	 * @param {import("../../UI/TreeView.js").TreeViewDragEvent} e
	 */
	async onTreeViewDragStart(e) {
		/** @type {DraggingProjectAssetData} */
		const draggingData = {
			dataPopulated: false,
			assetType: null,
			assetUuid: null,
		};
		const draggingDataUuid = this.editorInstance.dragManager.registerDraggingData(draggingData);
		e.rawEvent.dataTransfer.setData(`text/jj; dragtype=projectasset; draggingdata=${draggingDataUuid}`, "");
		e.rawEvent.dataTransfer.effectAllowed = "all";

		const assetData = await this.getProjectAssetByTreeViewItem(e.target);
		draggingData.assetType = this.editorInstance.projectAssetTypeManager.getAssetType(assetData.assetType);
		draggingData.assetUuid = assetData.uuid;
		draggingData.dataPopulated = true;
	}

	/**
	 * @param {import("../../UI/TreeView.js").TreeViewValidateDragEvent} e
	 */
	async onTreeViewValidateDrag(e) {
		if (e.isSameTreeView) {
			// Only allow dropping on folders.
			if (!e.target.alwaysShowArrow) {
				e.reject();
			}
		} else if (e.kind == "file") {
			e.accept();
		}
	}

	/**
	 * @param {import("../../UI/TreeView.js").TreeViewDragEvent} e
	 */
	async onTreeViewDrop(e) {
		const path = this.pathFromTreeView(e.target);
		for (const file of e.rawEvent.dataTransfer.files) {
			const filePath = [...path, file.name];
			await this.fileSystem.writeFile(filePath, file);
		}
	}

	/**
	 * @param {import("../../UI/TreeView.js").TreeViewRearrangeEvent} e
	 */
	async onTreeViewRearrange(e) {
		for (const movedItem of e.movedItems) {
			const oldPath = movedItem.oldTreeViewsPath.map(t => t.name).slice(1);
			const newPath = movedItem.newTreeViewsPath.map(t => t.name).slice(1);
			await this.fileSystem.move(oldPath, newPath);
			await this.editorInstance.projectManager.assetManager.assetMoved(oldPath, newPath);
		}
	}

	/**
	 * @param {import("../../UI/TreeView.js").TreeViewEvent} e
	 */
	async onTreeViewDblClick(e) {
		const path = this.pathFromTreeView(e.target);
		const projectAsset = await this.editorInstance.projectManager.assetManager.getProjectAssetFromPath(path);
		projectAsset.open();
	}

	/**
	 * @param {import("../../UI/TreeView.js").TreeViewContextMenuEvent} e
	 */
	onTreeViewContextMenu(e) {
		const menu = e.showContextMenu();
		menu.createStructure([
			{
				text: "Copy asset UUID", onClick: async () => {
					const path = this.pathFromTreeView(e.target);
					const uuid = await this.editorInstance.projectManager.assetManager.getAssetUuidFromPath(path);
					await navigator.clipboard.writeText(uuid);
				},
			},
			{
				text: "Delete", onClick: async () => {
					const path = this.pathFromTreeView(e.target);
					await this.editorInstance.projectManager.assetManager.deleteAsset(path);
					const parentPath = path.slice(0, path.length - 1);
					await this.updateTreeView(parentPath);
				},
			},
		]);
	}

	async highlightPath(path) {
		await this.updateTreeViewRange(path);
		const assetTreeView = this.treeView.findChildFromNamesPath(path);
		if (assetTreeView) {
			assetTreeView.expandWithParents();
			assetTreeView.highlight();
		}
	}
}