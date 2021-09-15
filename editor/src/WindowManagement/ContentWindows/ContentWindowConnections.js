import editor from "../../editorInstance.js";
import EditorConnectionsManager from "../../Network/EditorConnectionsManager.js";
import PropertiesTreeView from "../../UI/PropertiesTreeView/PropertiesTreeView.js";
import ContentWindow from "./ContentWindow.js";

export default class ContentWindowConnections extends ContentWindow {
	static contentWindowTypeId = "connections";
	static contentWindowUiName = "Connections";

	/** @typedef {import("../../UI/PropertiesTreeView/PropertiesTreeView.js").PropertiesTreeViewStructure} PropertiesTreeViewStructure */

	constructor() {
		super();

		this.headerTreeView = new PropertiesTreeView();
		this.contentEl.appendChild(this.headerTreeView.el);

		this.discoveryServerEndpointField = this.headerTreeView.addItem({
			type: String,
			/** @type {import("../../UI/TextGui.js").TextGuiOptions} */
			guiOpts: {
				label: "Discovery Server",
				placeholder: EditorConnectionsManager.getDefaultEndPoint(),
			},
		});
		this.discoveryServerEndpointField.onValueChange(endPoint => {
			editor.projectManager.setEditorConnectionsDiscoveryEndpoint(endPoint);
		});
		this.discoveryServerStatusLabel = this.headerTreeView.addItem({
			type: "label",
			guiOpts: {
				label: "Status",
			},
		});

		this.editorHostConnectionTreeView = new PropertiesTreeView();
		this.contentEl.appendChild(this.editorHostConnectionTreeView.el);
		this.allowIncomingCheckbox = this.editorHostConnectionTreeView.addItem({
			type: Boolean,
			/** @type {import("../../UI/BooleanGui.js").BooleanGuiOptions} */
			guiOpts: {
				label: "Allow Incoming Connections",
			},
		});
		this.allowIncomingCheckbox.onValueChange(allowIncoming => {
			editor.projectManager.setEditorConnectionsAllowIncoming(allowIncoming);
		});

		this.editorClientConnectionTreeView = new PropertiesTreeView();
		this.contentEl.appendChild(this.editorClientConnectionTreeView.el);

		this.editorHostConnectionTreeView.visible = !editor.projectManager.currentProjectIsRemote;
		this.editorClientConnectionTreeView.visible = editor.projectManager.currentProjectIsRemote;
	}
}