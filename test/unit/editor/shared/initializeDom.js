// @ts-nocheck
import {JSDOM} from "https://esm.sh/jsdom@19.0.0?no-check";

export function initializeDom() {
	const jsdom = new JSDOM();
	globalThis.document = jsdom.window.document;
	return jsdom.window;
}