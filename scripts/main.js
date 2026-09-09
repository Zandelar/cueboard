import { cueboardApi } from "./api.js";
import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { registerSettings } from "./settings.js";
import { toggleCueboard } from "./ui/cueboard-app.js";

Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls.tokens;

  if (!tokenControls?.tools) {
    return;
  }

  tokenControls.tools.cueboard = {
    name: "cueboard",
    title: "Cueboard",
    icon: "fa-solid fa-clapperboard",
    order: Object.keys(tokenControls.tools).length,
    button: true,
    visible: Boolean(game.user?.isGM),
    onChange: () => {
      void toggleCueboard();
    }
  };
});

Hooks.once("init", () => {
  const module = game.modules.get(MODULE_ID);
  const version = module?.version ?? "unknown";

  console.info(
    `${MODULE_TITLE} | Initializing v${version}`
  );

  registerSettings();

  game.cueboard = {
    api: cueboardApi
  };
});