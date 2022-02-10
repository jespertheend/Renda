import {assertEquals} from "asserts";
import {getContext, init} from "../../../shared/browser.js";
import {setupNewProject, waitForProjectOpen} from "../../shared/common.js";
import {waitFor} from "../../../shared/util.js";

await init();

Deno.test({
	name: "Rename a project and refresh the page, it should open the latest project",
	fn: async testContext => {
		const {page} = await getContext();

		const newProjectName = "New Project Name";
		const projectWindowSelector = "[data-content-window-type-id='project']";
		const rootNameTreeViewSelector = `${projectWindowSelector} .editorContentWindowContent > .treeViewItem`;

		await setupNewProject(page, testContext);

		await testContext.step("Rename the project root folder", async () => {
			const projectNameEl = await page.waitForSelector(rootNameTreeViewSelector);
			await projectNameEl.click();

			await page.keyboard.press("Enter");
			await page.keyboard.type(newProjectName);
			await page.keyboard.press("Enter");

			// todo: wait for new name to be saved to indexeddb
			await new Promise(resolve => setTimeout(resolve, 100));
		});

		await testContext.step("Reload the page", async testContext => {
			await page.reload();

			await waitForProjectOpen(page, testContext);
		});

		await testContext.step("Check if the project loaded with the changed name", async () => {
			const contentWindowProjectEl = await page.waitForSelector(projectWindowSelector);

			await contentWindowProjectEl.evaluate(async contentWindowProjectEl => {
				const contentWindowProject = editor.windowManager.getWindowByElement(contentWindowProjectEl);
				await contentWindowProject.waitForInit();
			});

			const projectNameEl = await page.waitForSelector(rootNameTreeViewSelector);
			const projectName = await projectNameEl.evaluate(projectNameEl => {
				return projectNameEl.textContent;
			});
			assertEquals(projectName, newProjectName);
		});
	},
	sanitizeOps: false,
	sanitizeResources: false,
});