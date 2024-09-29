import { TreeView } from "../ui/TreeView.js";

/**
 * @typedef TreeViewData
 * @property {string[]} path
 * @property {boolean} isDir
 */

export class ProjectFilesTreeView {
	#treeView = new TreeView();
	get treeView() {
		return this.#treeView;
	}

	/** @type {Map<TreeView, import("../../../src/mod.js").UuidString>} */
	#draggingAssetUuids = new Map();

	/**
	 * A weakmap of data for each TreeView. Each data item is used for storing
	 * certain properties related to the file or directory that the TreeView represents.
	 * Data for a TreeView can be obtained using `#getTreeViewData`.
	 * @type {WeakMap<TreeView, TreeViewData>}
	 */
	#treeViewDatas = new WeakMap();

	/** @type {Set<symbol>} */
	#updatingTreeViewSyms = new Set();
	/** @type {Set<() => void>} */
	#updatingTreeViewCbs = new Set();

	/**
	 *
	 * @param {import("../assets/assetLibrary/AssetLibrary.js").AssetLibrary} assetLibrary
	 */
	constructor(assetLibrary) {
		this.#treeView.alwaysShowArrow = true;
		this.#treeView.collapsed = true;
		this.#treeView.addEventListener("selectionchange", this.#onTreeViewSelectionChange);
		this.#treeView.addEventListener("collapsedchange", this.#onTreeViewCollapsedChange);
		this.#treeView.addEventListener("namechange", this.#onTreeViewNameChange);
		this.#treeView.addEventListener("dragstart", this.#onTreeViewDragStart.bind(this));
		this.#treeView.addEventListener("dragend", this.#onTreeViewDragEnd.bind(this));
		this.#treeView.addEventListener("validatedrag", this.#onTreeViewValidateDrag);
		this.#treeView.addEventListener("drop", this.#onTreeViewDrop);
		this.#treeView.addEventListener("rearrange", this.#onTreeViewRearrange.bind(this));
		this.#treeView.addEventListener("dblclick", this.#onTreeViewDblClick.bind(this));
		this.#treeView.addEventListener("contextmenu", this.#onTreeViewContextMenu.bind(this));

		this.#treeViewDatas.set(this.treeView, {
			isDir: true,
			path: [],
		});
	}

	destructor() {
		this.#treeView.destructor();
	}

	/**
	 * @param {import("../ui/TreeView.js").TreeViewSelectionChangeEvent} treeViewChanges
	 */
	#onTreeViewSelectionChange = async (treeViewChanges) => {
		this.loadAssetSettingsFromUserGesture();
		/** @type {import("../misc/SelectionGroup.js").SelectionGroupChangeData<import("../../assets/ProjectAsset.js").ProjectAssetAny>} */
		const changes = {};
		changes.reset = treeViewChanges.reset;
		changes.added = await this.mapTreeViewArrayToProjectAssets(treeViewChanges.added);
		changes.removed = await this.mapTreeViewArrayToProjectAssets(treeViewChanges.removed);
		this.selectionGroup.changeSelection(changes);
	}

	/**
	 * @param {import("../ui/TreeView.js").TreeViewCollapseEvent} e
	 */
	#onTreeViewCollapsedChange = async (e) => {
		if (e.target == this.treeView && this.treeView.expanded) {
			this.loadAssetSettingsFromUserGesture();
		}

		if (!e.target.collapsed) {
			const treeViewData = this.#getTreeViewData(e.target);
			this.updateTreeViewRecursive(e.target, treeViewData.path);
		}
	}

	/**
	 * @param {import("../ui/TreeView.js").TreeViewNameChangeEvent} e
	 */
	#onTreeViewNameChange = async (e) => {
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
		const assetManager = await this.studioInstance.projectManager.getAssetManager();
		await assetManager.assetMoved(oldPath, newPath);
	}

	/**
	 * @param {import("../ui/TreeView.js").TreeViewDragEvent} e
	 */
	#onTreeViewDragStart = async (e) => {
		/** @type {DraggingProjectAssetData} */
		const draggingData = {
			dataPopulated: false,
			assetType: null,
			assetUuid: null,
		};
		const draggingDataUuid = this.studioInstance.dragManager.registerDraggingData(draggingData);
		this.#draggingAssetUuids.set(e.target, draggingDataUuid);
		if (!e.rawEvent.dataTransfer) return;
		e.rawEvent.dataTransfer.setData(`text/renda; dragtype=projectasset; draggingdata=${draggingDataUuid}`, "");
		e.rawEvent.dataTransfer.effectAllowed = "all";

		const assetData = await this.getProjectAssetByTreeViewItem(e.target);
		if (!assetData) return;
		if (assetData.assetType) {
			draggingData.assetType = this.studioInstance.projectAssetTypeManager.getAssetType(assetData.assetType);
		}
		draggingData.assetUuid = assetData.uuid;
		draggingData.dataPopulated = true;
	}

	/**
	 * @param {import("../ui/TreeView.js").TreeViewDragEvent} e
	 */
	#onTreeViewDragEnd = (e) =>{
		const uuid = this.#draggingAssetUuids.get(e.target);
		if (uuid) {
			this.studioInstance.dragManager.unregisterDraggingData(uuid);
		}
	}

	/**
	 * @param {import("../ui/TreeView.js").TreeViewValidateDragEvent} e
	 */
	#onTreeViewValidateDrag = async (e) => {
		// Only allow dropping on folders.
		if (!e.target.alwaysShowArrow) {
			e.reject();
			return;
		}
		if (e.kind == "file") {
			// Allow dragging external files,
			// they will be added to the project when dropped.
			e.accept();
		} else if (e.kind == "string") {
			const draggingData = this.#validateDragMimeType(e.mimeType);
			if (draggingData) {
				e.accept();
			}
		}
	};

	/**
	 * @param {import("../ui/TreeView.js").TreeViewDragEvent} e
	 */
	#onTreeViewDrop = async (e) => {
		if (!e.rawEvent.dataTransfer) return;
		const path = this.pathFromTreeView(e.target);
		for (const file of e.rawEvent.dataTransfer.files) {
			const filePath = [...path, file.name];
			await this.fileSystem.writeFile(filePath, file);
		}
		for (const item of e.rawEvent.dataTransfer.items) {
			const mimeType = parseMimeType(item.type);
			if (!mimeType) continue;
			const droppedEntity = this.#validateDragMimeType(mimeType);
			if (droppedEntity) {
				const assetManager = await this.studioInstance.projectManager.getAssetManager();
				const projectAsset = await assetManager.createNewAsset(path, "renda:entity");
				await assetManager.makeAssetUuidPersistent(projectAsset);
				this.studioInstance.projectManager.assetManager?.entityAssetManager.replaceTrackedEntity(projectAsset.uuid, droppedEntity);
			}
		}
	};

	/**
	 * @param {import("../util/util.js").ParsedMimeType} mimeType
	 */
	#validateDragMimeType(mimeType) {
		if (mimeType.type == "text" &&
			mimeType.subType == "renda" &&
			mimeType.parameters.dragtype == "outlinertreeview"
		) {
			const dragData = /** @type {import("../../../../src/core/Entity.js").Entity} */ (this.studioInstance.dragManager.getDraggingData(mimeType.parameters.draggingdata));
			const uuid = this.studioInstance.projectManager.assetManager?.entityAssetManager.getLinkedAssetUuid(dragData);
			// If the dragged entity already is an entity asset, it's not clear what should happen in this case:
			// - Create a duplicate of the entity asset and leave all references pointing to the old one
			// - Create a duplicate and point all references to the new one
			// - Move the entity asset from one location in the project to the dropped location
			// - Something else?
			// Because of this, we just won't allow dropping at all, removing any ambiguity.
			if (uuid) return null;
			return dragData;
		}
		return null;
	}

	/**
	 * @param {import("../../ui/TreeView.js").TreeViewRearrangeEvent} e
	 */
	#onTreeViewRearrange = async (e) => {
		for (const movedItem of e.movedItems) {
			const oldPath = movedItem.oldTreeViewsPath.map((t) => t.name).slice(1);
			const newPath = movedItem.newTreeViewsPath.map((t) => t.name).slice(1);
			await this.fileSystem.move(oldPath, newPath);
			const assetManager = await this.studioInstance.projectManager.getAssetManager();
			await assetManager.assetMoved(oldPath, newPath);
		}
	}

	/**
	 * @param {import("../ui/TreeView.js").TreeViewEvent} e
	 */
	#onTreeViewDblClick = async (e) => {
		const path = this.pathFromTreeView(e.target);
		const assetManager = await this.studioInstance.projectManager.getAssetManager();
		const projectAsset = await assetManager.getProjectAssetFromPath(path);
		if (projectAsset) {
			projectAsset.open(this.windowManager);
		}
	}

	/**
	 * @param {import("../ui/TreeView.js").TreeViewContextMenuEvent} e
	 */
	#onTreeViewContextMenu = async (e) => {
		const menu = await e.showContextMenu();
		menu.createStructure([
			{
				text: "Copy Asset UUID", onClick: async () => {
					const path = this.pathFromTreeView(e.target);
					const assetManager = await this.studioInstance.projectManager.getAssetManager();
					const projectAsset = await assetManager.getProjectAssetFromPath(path);
					if (!projectAsset) return;
					await navigator.clipboard.writeText(projectAsset.uuid);
					await assetManager.makeAssetUuidPersistent(projectAsset);
				},
			},
			{
				text: "Delete", onClick: async () => {
					const path = this.pathFromTreeView(e.target);
					const assetManager = await this.studioInstance.projectManager.getAssetManager();
					await assetManager.deleteAsset(path);
				},
			},
		]);
	}

	/**
	 * Utility function for {@link ContentWindowProject.updateTreeView} that updates
	 * a TreeView and all expanded children recursively.
	 * @param {TreeView} treeView The TreeView to update.
	 * @param {string[]} path The path this TreeView belongs to.
	 */
	async updateTreeViewRecursive(treeView, path) {
		if (this.destructed) return;
		if (treeView.collapsed) return;
		const hasPermissions = await this.fileSystem.getPermission(path, { writable: false });
		if (!hasPermissions) return;
		const fileTree = await this.fileSystem.readDir(path);
		if (this.destructed) return;

		// Determine the order of the files and directories.
		const sortedFiles = [...fileTree.files];
		sortedFiles.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
		const sortedDirectories = [...fileTree.directories];
		sortedDirectories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
		const childOrder = [...sortedDirectories, ...sortedFiles];

		for (const dir of sortedDirectories) {
			if (!treeView.includes(dir)) {
				const insertionIndex = childOrder.indexOf(dir);
				const newTreeView = treeView.addChildAtIndex(null, insertionIndex);
				this.setChildTreeViewProperties(newTreeView);
				newTreeView.alwaysShowArrow = true;
				this.#treeViewDatas.set(newTreeView, {
					path: [...path, dir],
					isDir: true,
				});
				newTreeView.name = dir;
				newTreeView.collapsed = true;
			}
		}
		for (const file of sortedFiles) {
			if (!treeView.includes(file)) {
				const insertionIndex = childOrder.indexOf(file);
				const newTreeView = treeView.addChildAtIndex(null, insertionIndex);
				this.#treeViewDatas.set(newTreeView, {
					path: [...path, file],
					isDir: false,
				});
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

	async waitForTreeViewUpdate() {
		if (this.#updatingTreeViewSyms.size == 0) return;
		/** @type {Promise<void>} */
		const promise = new Promise((r) => {
			this.#updatingTreeViewCbs.add(r);
		});
		await promise;
	}

	/**
	 * Updates the path and its children recursively when expanded.
	 * @param {string[] | null} path Directory to update, updates the root TreeView when omitted.
	 */
	async updateTreeView(path = null) {
		/** @type {TreeView?} */
		let treeView = this.treeView;
		/** @type {string[]} */
		let updatePath = [];
		if (path) {
			treeView = this.treeView.findChildFromNamesPath(path);
			updatePath = path;
		}
		if (treeView) {
			const updatingSym = Symbol("updateTreeView()");
			this.#updatingTreeViewSyms.add(updatingSym);
			try {
				await this.updateTreeViewRecursive(treeView, updatePath);
			} finally {
				this.#updatingTreeViewSyms.delete(updatingSym);
				this.#fireTreeViewUpdateWhenDone();
			}
		}
	}

	/**
	 * Updates a full range of directories from start to end, useful right before expanding a specific directory.
	 * @param {string[]} end The directory to update, this path is relative to start.
	 * @param {string[] | null} start The directory to start updating from, starts updating from the root when omitted.
	 * @param {boolean} updateAll When this is false, expanded TreeViews won't be updated. Expanded TreeViews
	 * should already be updated so you generally won't need to use this.
	 */
	async updateTreeViewRange(end, start = null, updateAll = false) {
		let { treeView } = this;
		if (start) {
			const childTreeView = this.treeView.findChildFromNamesPath(start);
			if (!childTreeView) {
				throw new Error("Could not find start path in treeView.");
			}
			treeView = childTreeView;
		} else {
			start = [];
		}
		for (let i = 0; i < end.length; i++) {
			const name = end[i];
			const childTreeView = treeView.getChildByName(name);
			if (!childTreeView) {
				throw new Error("Assertion failed, could not find childTreeView.");
			}
			treeView = childTreeView;
			if (updateAll || treeView.collapsed) {
				const path = end.slice(0, i + 1);
				const treeViewData = this.#getTreeViewData(treeView);
				if (!treeViewData.isDir) return;
				const updatingSym = Symbol("updateTreeViewRange()");
				this.#updatingTreeViewSyms.add(updatingSym);
				try {
					await this.updateTreeViewRecursive(treeView, [...start, ...path]);
				} finally {
					this.#updatingTreeViewSyms.delete(updatingSym);
					this.#fireTreeViewUpdateWhenDone();
				}
			}
		}
	}

	#fireTreeViewUpdateWhenDone() {
		if (this.#updatingTreeViewSyms.size > 0) return;
		this.#updatingTreeViewCbs.forEach((cb) => cb());
		this.#updatingTreeViewCbs.clear();
	}

	/**
	 * Gets data related to the file or directory for the TreeView.
	 * If the data does not exist, an error is thrown.
	 * @param {TreeView} treeView
	 */
	#getTreeViewData(treeView) {
		const data = this.#treeViewDatas.get(treeView);
		if (!data) throw new Error("Assertion failed, TreeViewData is not available.");
		return data;
	}
}
