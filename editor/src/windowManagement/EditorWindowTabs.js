import {EditorWindow} from "./EditorWindow.js";
import {generateUuid, getElemSize, parseMimeType} from "../Util/Util.js";
import {iLerp} from "../../../src/util/mod.js";
import {getEditorInstance} from "../editorInstance.js";
import {Button} from "../UI/Button.js";
import {ButtonGroup} from "../UI/ButtonGroup.js";
import {EditorWindowSplit} from "./EditorWindowSplit.js";
import {ContentWindow} from "./contentWindows/ContentWindow.js";

export class EditorWindowTabs extends EditorWindow {
	/** @type {Array<string>} */
	#intendedTabTypes = [];
	/** @type {import("../Util/Util.js").UuidString[]} */
	#intendedTabUuids = [];

	constructor() {
		super();

		this.el.classList.add("editorWindowTabs");

		/** @type {Array<import("./contentWindows/ContentWindow.js").ContentWindow>} */
		this.tabs = [];
		this.activeTabIndex = -1;
		/** @type {Set<() => void>} */
		this.onTabChangeCbs = new Set();

		this.tabsSelectorGroup = new ButtonGroup();
		this.tabsSelectorGroup.el.classList.add("editorWindowTabButtonGroup");
		this.el.appendChild(this.tabsSelectorGroup.el);

		this.boundOnTabsContextMenu = this.onTabsContextMenu.bind(this);
		this.tabsSelectorGroup.onContextMenu(this.boundOnTabsContextMenu);

		this.tabsEl = document.createElement("div");
		this.tabsEl.classList.add("editorWindowTabsList");
		this.el.appendChild(this.tabsEl);

		this.tabDragOverlayEl = document.createElement("div");
		this.tabDragOverlayEl.classList.add("editorWindowTabDragOverlay");
		this.el.appendChild(this.tabDragOverlayEl);

		this.lastTabDragOverlayBoundingRect = null;

		this.boundOnTabDragOver = this.onTabDragOver.bind(this);
		this.tabDragOverlayEl.addEventListener("dragover", this.boundOnTabDragOver);
		this.boundOnTabDrop = this.onTabDrop.bind(this);
		this.tabDragOverlayEl.addEventListener("drop", this.boundOnTabDrop);

		this.isInit = false;

		this.setTabDragOverlayEnabled(false);
	}

	init() {
		this.isInit = true;

		for (const contentWindow of this.tabs) {
			this.initContentWindow(contentWindow);
		}
	}

	destructor() {
		this.#intendedTabTypes = null;
		const tabs = this.tabs;
		this.tabs = null;
		for (const tab of tabs) {
			this.destructContentWindow(tab);
		}
		this.tabsSelectorGroup.destructor();
		this.tabsSelectorGroup = null;
		this.tabsEl = null;
		super.destructor();
	}

	updateEls() {
		this.updateTabSelectorSpacer();
	}

	/**
	 * @param {number} index
	 * @param {string} tabType
	 * @param {import("../Util/Util.js").UuidString} uuid
	 * @returns {?import("./contentWindows/ContentWindow.js").ContentWindow}
	 */
	setTabType(index, tabType, uuid) {
		this.#intendedTabTypes[index] = tabType;
		this.#intendedTabUuids[index] = uuid;
		const constructor = getEditorInstance().windowManager.getContentWindowConstructorByType(tabType);
		if (constructor) {
			return this.loadContentWindow(index, constructor, uuid);
		}
		return null;
	}

	/**
	 * @param {string} tabType The id of the tab type to create.
	 * @param {boolean} activate Whether to set the tab as active.
	 * @returns {?import("./contentWindows/ContentWindow.js").ContentWindow}
	 */
	addTabType(tabType, activate = false) {
		const index = this.#intendedTabTypes.length;
		const contentWindow = this.setTabType(index, tabType, generateUuid());
		if (activate) {
			this.setActiveTabIndex(index);
		}
		this.fireWorkspaceChangeCbs();
		return contentWindow;
	}

	/**
	 * @param {number} tabIndex
	 */
	closeTab(tabIndex) {
		const contentWindow = this.tabs[tabIndex];
		this.tabsEl.removeChild(contentWindow.el);
		this.tabs.splice(tabIndex, 1);
		this.#intendedTabTypes.splice(tabIndex, 1);
		this.updateTabSelector();
		this.destructContentWindow(contentWindow);
		this.fireWorkspaceChangeCbs();
	}

	/**
	 * @param {typeof import("./contentWindows/ContentWindow.js").ContentWindow} constructor
	 */
	onContentWindowRegistered(constructor) {
		for (let i = 0; i < this.#intendedTabTypes.length; i++) {
			if (this.#intendedTabTypes[i] == constructor.contentWindowTypeId) {
				let uuid = this.#intendedTabUuids[i];
				if (!uuid) uuid = generateUuid();
				this.loadContentWindow(i, constructor, uuid);
			}
		}
	}

	/**
	 * @template {import("./contentWindows/ContentWindow.js").ContentWindow} T
	 * @param {number} index
	 * @param {new (...args: ConstructorParameters<typeof import("./contentWindows/ContentWindow.js").ContentWindow>) => T} constructor
	 * @param {import("../Util/Util.js").UuidString} uuid
	 * @returns {T}
	 */
	loadContentWindow(index, constructor, uuid) {
		const contentWindow = new constructor(getEditorInstance(), this.windowManager);
		contentWindow.uuid = uuid;
		contentWindow.windowManager = this.windowManager;
		contentWindow.persistentData.setWindowManager(this.windowManager);
		this.setExistingContentWindow(index, contentWindow);
		if (this.isInit) {
			this.initContentWindow(contentWindow);
			contentWindow.fireOnWindowResize();
		}
		return contentWindow;
	}

	/**
	 * @param {ContentWindow} contentWindow
	 */
	initContentWindow(contentWindow) {
		contentWindow.init();
		const castConstructor = /** @type {typeof ContentWindow} */ (contentWindow.constructor);
		this.windowManager.contentWindowAddedHandler.fireEvent(castConstructor, {
			target: contentWindow,
		});
	}

	/**
	 * @param {ContentWindow} contentWindow
	 */
	destructContentWindow(contentWindow) {
		contentWindow.destructor();
		const castConstructor = /** @type {typeof ContentWindow} */ (contentWindow.constructor);
		this.windowManager.contentWindowRemovedHandler.fireEvent(castConstructor, {
			target: contentWindow,
		});
	}

	/**
	 * @param {number} index
	 * @param {import("./contentWindows/ContentWindow.js").ContentWindow} contentWindow
	 */
	setExistingContentWindow(index, contentWindow) {
		if (this.tabs[index]) throw new Error("nyi");
		contentWindow.detachParentEditorWindow();
		contentWindow.attachParentEditorWindow(this);
		this.tabs[index] = contentWindow;
		const castConstructor = /** @type {typeof import("./contentWindows/ContentWindow.js").ContentWindow} */ (contentWindow.constructor);
		this.#intendedTabTypes[index] = castConstructor.contentWindowTypeId;
		this.tabsEl.appendChild(contentWindow.el);
		this.updateTabSelector();
	}

	/**
	 * @param {import("./contentWindows/ContentWindow.js").ContentWindow} contentWindow
	 * @param {boolean} [activate]
	 */
	addExistingContentWindow(contentWindow, activate = true) {
		const index = this.#intendedTabTypes.length;
		this.setExistingContentWindow(index, contentWindow);
		if (activate) {
			this.setActiveTabIndex(index);
		}
		this.fireWorkspaceChangeCbs();
	}

	/**
	 * @param {import("./contentWindows/ContentWindow.js").ContentWindow} contentWindow
	 */
	contentWindowDetached(contentWindow) {
		const index = this.tabs.indexOf(contentWindow);
		if (index >= 0) {
			this.tabs.splice(index, 1);
			this.#intendedTabTypes.splice(index, 1);
			this.updateTabSelector();
			if (this.#intendedTabTypes.length == 0) {
				this.unsplitParent();
			}
			this.fireWorkspaceChangeCbs();
		}
	}

	updateTabSelector() {
		const prevTabCount = this.tabsSelectorGroup.buttons.length;
		const deltaCount = this.tabs.length - prevTabCount;
		if (deltaCount > 0) {
			for (let i = 0; i < deltaCount; i++) {
				const tabIndex = prevTabCount + i;
				const contentWindow = this.tabs[tabIndex];
				const newButton = new Button({
					colorizerFilterManager: getEditorInstance().colorizerFilterManager,
					onClick: () => {
						this.setActiveTabIndex(tabIndex);
					},
					draggable: true,
					onDragStart: e => {
						getEditorInstance().windowManager.setTabDragEnabled(true);
						e.dataTransfer.effectAllowed = "move";
						e.dataTransfer.setData("text/jj; dragtype=editorwindowtab", contentWindow.uuid);
					},
					onDragEnd: () => {
						getEditorInstance().windowManager.setTabDragEnabled(false);
					},
				});
				this.tabsSelectorGroup.addButton(newButton);
			}
		} else if (deltaCount < 0) {
			for (let i = this.tabsSelectorGroup.buttons.length - 1; i >= this.tabs.length; i--) {
				this.tabsSelectorGroup.removeButton(i);
			}
		}
		if (deltaCount != 0) {
			this.updateTabSelectorSpacer();
		}

		if (this.activeTabIndex >= this.tabs.length) {
			this.setActiveTabIndex(this.tabs.length - 1);
		}

		for (let i = 0; i < this.tabs.length; i++) {
			const contentWindowType = /** @type {typeof import("./contentWindows/ContentWindow.js").ContentWindow} */ (this.tabs[i].constructor);
			this.tabsSelectorGroup.buttons[i].setIcon(contentWindowType.contentWindowUiIcon);
		}
	}

	updateTabSelectorSpacer() {
		const [w, h] = getElemSize(this.tabsSelectorGroup.el);
		for (const tab of this.tabs) {
			tab.updateTabSelectorSpacer(w, h);
		}
	}

	setActiveTabIndex(index) {
		this.activeTabIndex = index;
		for (let i = 0; i < this.tabs.length; i++) {
			const active = i == index;
			this.tabsSelectorGroup.buttons[i].setSelectedHighlight(active);
			this.tabs[i].setVisible(active);
		}
		this.fireActiveTabChange();
		this.fireWorkspaceChangeCbs();
	}

	/**
	 * @param {import("./contentWindows/ContentWindow.js").ContentWindow} contentWindow
	 */
	setActiveContentWindow(contentWindow) {
		const index = this.tabs.indexOf(contentWindow);
		this.setActiveTabIndex(index);
	}

	get activeTab() {
		return this.tabs[this.activeTabIndex];
	}

	/**
	 * @param {boolean} enabled
	 */
	setTabDragOverlayEnabled(enabled) {
		this.tabDragOverlayEl.style.display = enabled ? null : "none";
		if (enabled) {
			this.lastTabDragOverlayBoundingRect = this.tabDragOverlayEl.getBoundingClientRect();
		}
	}

	onResized() {
		for (const tab of this.tabs) {
			tab.fireOnWindowResize();
		}
	}

	onTabsContextMenu(button, e) {
		e.preventDefault();

		/** @type {import("../UI/ContextMenus/ContextMenu.js").ContextMenuStructure} */
		const addTabSubmenu = [];
		for (const [id, contentWindow] of getEditorInstance().windowManager.registeredContentWindows) {
			let text = "<ContentWindow>";
			let icon = null;
			if (contentWindow.contentWindowUiName) {
				text = contentWindow.contentWindowUiName;
				icon = contentWindow.contentWindowUiIcon;
			} else if (contentWindow.contentWindowTypeId) {
				text = "<" + contentWindow.contentWindowTypeId + ">";
			}
			addTabSubmenu.push({
				text, icon,
				onClick: () => {
					this.addTabType(id, true);
				},
			});
		}

		/** @type {import("../UI/ContextMenus/ContextMenu.js").ContextMenuStructure} */
		const contextMenuStructure = [
			{
				text: "Close Tab",
				disabled: this.tabs.length <= 1 && this.isRoot,
				onClick: () => {
					const index = this.tabsSelectorGroup.buttons.indexOf(button);
					this.closeTab(index);
					if (this.tabs.length == 0) {
						this.unsplitParent();
					}
				},
			},
			{
				text: "Add Tab",
				submenu: addTabSubmenu,
			},
			{
				text: "Workspaces",
				submenu: async () => {
					/** @type {import("../UI/ContextMenus/ContextMenu.js").ContextMenuStructure} */
					const workspacesSubmenu = [];

					const currentWorkspace = await getEditorInstance().windowManager.workspaceManager.getCurrentWorkspaceId();

					const workspaces = await getEditorInstance().windowManager.workspaceManager.getWorkspacesList();
					for (const workspaceId of workspaces) {
						workspacesSubmenu.push({
							text: workspaceId,
							reserveIconSpace: true,
							showBullet: workspaceId == currentWorkspace,
							onClick: () => {
								getEditorInstance().windowManager.workspaceManager.setCurrentWorkspaceId(workspaceId);
							},
						});
					}

					let autoSaveValue = await getEditorInstance().windowManager.workspaceManager.getAutoSaveValue();

					workspacesSubmenu.push(
						{
							horizontalLine: true,
						},
						{
							text: "Add New Workspace",
							onClick: () => {
								const name = prompt("Enter Workspace Name", `Copy of ${currentWorkspace}`);
								if (name && !workspaces.includes(name)) {
									getEditorInstance().windowManager.workspaceManager.addNewWorkspace(name);
								}
							},
						},
						{
							text: `Save '${currentWorkspace}'`,
							onClick: () => {
								getEditorInstance().windowManager.saveWorkspace();
							},
						},
						{
							text: `Autosave '${currentWorkspace}'`,
							reserveIconSpace: true,
							showCheckmark: autoSaveValue,
							onClick: e => {
								e.preventMenuClose();
								autoSaveValue = !autoSaveValue;
								e.item.showCheckmark = autoSaveValue;
								getEditorInstance().windowManager.workspaceManager.setAutoSaveValue(autoSaveValue);
							},
						},
						{
							text: `Delete '${currentWorkspace}'`,
							disabled: workspaces.length <= 1,
							onClick: () => {
								getEditorInstance().windowManager.workspaceManager.deleteCurrentWorkspace();
							},
						}
					);

					return workspacesSubmenu;
				},
			},
		];

		const menu = getEditorInstance().contextMenuManager.createContextMenu(contextMenuStructure);
		menu.setPos({x: e.pageX, y: e.pageY});
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @returns {"center" | "left" | "right" | "top" | "bottom"}
	 */
	getTabDragPosition(x, y) {
		const rect = this.lastTabDragOverlayBoundingRect;
		const percentX = iLerp(rect.left, rect.right, x);
		const percentY = iLerp(rect.top, rect.bottom, y);

		if (percentX > 0.25 && percentX < 0.75 && percentY > 0.25 && percentY < 0.75) {
			return "center";
		}
		/** @type {"left" | "right" | "top" | "bottom"} */
		let closestEdge = null;
		/** @type {Array<{edge: "left" | "right" | "top" | "bottom", dist: number}>} */
		const edges = [
			{
				edge: "left",
				dist: percentX,
			},
			{
				edge: "right",
				dist: 1 - percentX,
			},
			{
				edge: "top",
				dist: percentY,
			},
			{
				edge: "bottom",
				dist: 1 - percentY,
			},
		];

		let closestEdgeDist = 1;
		for (const edge of edges) {
			if (edge.dist < closestEdgeDist) {
				closestEdgeDist = edge.dist;
				closestEdge = edge.edge;
			}
		}
		return closestEdge;
	}

	/**
	 * @param {DragEvent} e
	 */
	onTabDragOver(e) {
		if (!e.dataTransfer.types.some(mimeType => this.validateTabDragMimeType(mimeType))) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		const dragPosition = this.getTabDragPosition(e.pageX, e.pageY);
		let {left, top, width, height} = this.lastTabDragOverlayBoundingRect;
		if (dragPosition == "left") {
			width /= 2;
		} else if (dragPosition == "right") {
			width /= 2;
			left += width;
		} else if (dragPosition == "top") {
			height /= 2;
		} else if (dragPosition == "bottom") {
			height /= 2;
			top += height;
		}
		getEditorInstance().windowManager.setTabDragFeedbackRect(left, top, width, height);
	}

	/**
	 * @param {string} mimeType
	 * @returns {boolean}
	 */
	validateTabDragMimeType(mimeType) {
		const parsed = parseMimeType(mimeType);
		if (!parsed) return false;
		const {type, subType, parameters} = parsed;
		if (type != "text" || subType != "jj" || parameters.dragtype != "editorwindowtab") return false;
		return true;
	}

	/**
	 * @param {Array<string>} uuids
	 * @param {boolean} [fromOtherTabsOnly]
	 */
	*uuidsToContentWindows(uuids, fromOtherTabsOnly = false) {
		for (const uuid of uuids) {
			if (fromOtherTabsOnly && this.tabs.some(tab => tab.uuid == uuid)) continue;
			const contentWindow = getEditorInstance().windowManager.getContentWindowByUuid(uuid);
			if (contentWindow) {
				yield contentWindow;
			}
		}
	}

	/**
	 * @param {DragEvent} e
	 */
	async onTabDrop(e) {
		const dragPosition = this.getTabDragPosition(e.pageX, e.pageY);
		const tabUuidPromisess = Array.from(e.dataTransfer.items).filter(item => {
			if (item.kind != "string") return false;
			return this.validateTabDragMimeType(item.type);
		}).map(item => {
			return new Promise(r => item.getAsString(r));
		});
		const tabUuids = await Promise.all(tabUuidPromisess);
		if (dragPosition == "center") {
			for (const contentWindow of this.uuidsToContentWindows(tabUuids, true)) {
				this.addExistingContentWindow(contentWindow);
			}
		} else {
			const splitHorizontal = dragPosition == "top" || dragPosition == "bottom";
			const createdTabWindow = this.splitWindow(dragPosition, splitHorizontal);
			for (const contentWindow of this.uuidsToContentWindows(tabUuids)) {
				createdTabWindow.addExistingContentWindow(contentWindow);
			}
		}
	}

	/**
	 * @param {"left" | "right" | "top" | "bottom"} emptySide
	 * @param {boolean} splitHorizontal
	 */
	splitWindow(emptySide, splitHorizontal) {
		const newSplitWindow = new EditorWindowSplit();
		newSplitWindow.splitHorizontal = splitHorizontal;

		const newTabWindow = new EditorWindowTabs();
		const oldParent = this.parent;
		if (emptySide == "left" || emptySide == "top") {
			newSplitWindow.setWindows(newTabWindow, this);
		} else if (emptySide == "right" || emptySide == "bottom") {
			newSplitWindow.setWindows(this, newTabWindow);
		} else {
			throw new Error("Invalid emptySide value");
		}

		if (this.isRoot) {
			getEditorInstance().windowManager.replaceRootWindow(newSplitWindow, false);
		} else if (oldParent && oldParent instanceof EditorWindowSplit) {
			oldParent.replaceWindow(this, newSplitWindow);
		}
		return newTabWindow;
	}

	unsplitParent() {
		if (this.parent && this.parent instanceof EditorWindowSplit) {
			this.parent.unsplitWindow(this);
		}
	}

	/**
	 * @param {() => void} cb
	 */
	onTabChange(cb) {
		this.onTabChangeCbs.add(cb);
	}

	fireActiveTabChange() {
		for (const cb of this.onTabChangeCbs) {
			cb();
		}
	}
}