export default [
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
];