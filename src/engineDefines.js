//These are variables used across the engine
//Changing these defines will cause certain parts of code
//to get stripped, making the build size smaller



/* ==== Generic Defines ==== */

export const ENABLE_WEBGPU_CLUSTERED_LIGHTS = true;



/* ======== Editor Defines ======== */
//These are defines that are generally only needed for the
//editor. Most builds can set all of these to false.

//enables listening for asset changes for assets that are used by the engine
export const ENGINE_ASSETS_LIVE_UPDATES_SUPPORT = true;

//Support for storing default asset link uuids as metadata in entities.
//This is only needed in the editor since only the editor can handle default asset links.
export const DEFAULT_ASSET_LINKS_IN_ENTITY_JSON_EXPORT = true;

//Apply built-in default asset link uuids to the default values for components.
//These uuids are only available in the editor, asset bundles remove default asset links when bundling.
export const EDITOR_DEFAULTS_IN_COMPONENTS = true;