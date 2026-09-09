import { MODULE_ID, SETTINGS } from "./constants.js";

/**
 * Register Cueboard's persistent settings.
 *
 * The cue list is shared world-authored state.
 * Panel position is local client presentation state.
 */
export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.CUES, {
    name: "Cueboard Cue List",
    hint: "Internal storage for Cueboard's ordered world Scene list.",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, SETTINGS.PANEL_POSITION, {
    name: "Cueboard Panel Position",
    hint: "Internal client storage for the Cueboard panel position.",
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
}