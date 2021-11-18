/** @type {import("./ShortcutCommand.js").ShortcutCommandOptions[]} */
const autoRegisterShortcutCommands = [
	{
		command: "treeView.selection.up",
		defaultKeys: "up",
		conditions: "treeViewSelected",
	},
	{
		command: "treeView.selection.down",
		defaultKeys: "down",
		conditions: "treeViewSelected",
	},
	{
		command: "treeView.expandSelected",
		defaultKeys: "right",
		conditions: "treeViewSelected",
	},
	{
		command: "treeView.collapseSelected",
		defaultKeys: "left",
		conditions: "treeViewSelected",
	},
	{
		command: "treeView.toggleRename",
		defaultKeys: ["enter", "f2"],
		conditions: "treeViewSelected",
	},
	{
		command: "treeView.cancelRename",
		defaultKeys: "escape",
		conditions: "treeViewRenaming",
	},
];
export {autoRegisterShortcutCommands};