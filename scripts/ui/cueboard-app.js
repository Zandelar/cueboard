import { MODULE_ID, MODULE_TITLE, SETTINGS } from "../constants.js";
import { CueStore } from "../services/cue-store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const APP_ID = "cueboard-panel";
const POSITION_SAVE_DELAY_MS = 150;

const FOLDER_FILTER_ALL = "all";
const FOLDER_FILTER_UNFILED = "unfiled";
const FOLDER_FILTER_PREFIX = "folder:";

/**
 * Resolve the folder ID represented by a Scene's folder field.
 *
 * Foundry owns this relationship. Cueboard only reads it for filtering.
 *
 * @param {Scene} scene
 * @returns {string|null}
 */
function getSceneFolderId(scene) {
  if (!scene?.folder) {
    return null;
  }

  if (typeof scene.folder === "string") {
    return scene.folder;
  }

  return scene.folder.id ?? null;
}

/**
 * Get a Scene Folder's root-to-leaf name path.
 *
 * The path is used only for sorting. Cueboard does not persist
 * Foundry folder information.
 *
 * @param {Folder} folder
 * @returns {string[]}
 */
function getFolderPath(folder) {
  const ancestors = [
    ...(folder.ancestors ?? [])
  ]
    .reverse()
    .map((ancestor) => ancestor.name);

  return [
    ...ancestors,
    folder.name
  ];
}

/**
 * Build a compact tree-style display label for a Scene Folder.
 *
 * Example:
 * Blackwood
 *   ↳ Ruins
 *     ↳ Lower Vault
 *
 * Non-breaking spaces are used so native select controls preserve
 * the visual indentation.
 *
 * @param {Folder} folder
 * @returns {string}
 */
function getFolderLabel(folder) {
  const depth = folder.ancestors?.length ?? 0;

  if (depth === 0) {
    return folder.name;
  }

  const indent = "\u00A0\u00A0".repeat(depth);

  return `${indent}↳ ${folder.name}`;
}

/**
 * Read the locally persisted Cueboard panel coordinates.
 *
 * Only valid numeric coordinates are returned. Width and height remain
 * owned by the application's DEFAULT_OPTIONS.
 *
 * @returns {{left?: number, top?: number}}
 */
function readStoredPosition() {
  const stored = game.settings.get(
    MODULE_ID,
    SETTINGS.PANEL_POSITION
  );

  const position = {};

  if (Number.isFinite(stored?.left)) {
    position.left = stored.left;
  }

  if (Number.isFinite(stored?.top)) {
    position.top = stored.top;
  }

  return position;
}

/**
 * GM-facing persistent Cueboard application.
 *
 * The application presents Cue Store data and coordinates Cueboard's
 * public Scene-control API. It does not own Scene-control or cue-storage
 * business logic.
 */
export class CueboardApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: APP_ID,
    classes: ["cueboard-app"],
    tag: "section",
    window: {
      title: "Cueboard",
      icon: "fa-solid fa-clapperboard",
      resizable: false
    },
    position: {
      width: 560,
      height: "auto"
    },
    actions: {
      preloadScene: this.#onPreloadScene,
      activateScene: this.#onActivateScene,
      addScene: this.#onAddScene,
      removeScene: this.#onRemoveScene,
      moveSceneUp: this.#onMoveSceneUp,
      moveSceneDown: this.#onMoveSceneDown
    }
  };

  static PARTS = {
    main: {
      template: "modules/cueboard/templates/cueboard.hbs"
    }
  };

  constructor(options = {}) {
    super(options);

    this._preloadRequestedSceneIds = new Set();
    this._hookCallbacks = [];
    this._positionSaveTimer = null;
    this._cueMutationPending = false;
    this._sceneFolderFilter = FOLDER_FILTER_ALL;

    this.#registerLiveRefreshHooks();
  }

  /**
   * Prepare the Scene rows and available Scene choices displayed by Cueboard.
   *
   * Scene facts remain owned by the Foundry Scene documents.
   */
  async _prepareContext(options) {
  const activeSceneId = game.scenes.active?.id ?? null;
  const entries = CueStore.getEntries();

  const cueSceneIds = new Set(
    entries.map((entry) => entry.sceneId)
  );

  const cues = entries.map((entry, index) => ({
    sceneId: entry.sceneId,
    name: entry.scene?.name ?? "Missing Scene",
    thumbnail: entry.scene?.thumbnail ?? null,
    stale: entry.stale,
    isActive: entry.scene?.id === activeSceneId,
    preloadRequested: this._preloadRequestedSceneIds.has(
      entry.sceneId
    ),
    canMoveUp: index > 0,
    canMoveDown: index < entries.length - 1
  }));

  const sceneFolders = Array.from(
    game.scenes.folders.values()
  );

  const validFolderKeys = new Set(
    sceneFolders.map(
      (folder) =>
        `${FOLDER_FILTER_PREFIX}${folder.id}`
    )
  );

  if (
    this._sceneFolderFilter !== FOLDER_FILTER_ALL &&
    this._sceneFolderFilter !== FOLDER_FILTER_UNFILED &&
    !validFolderKeys.has(this._sceneFolderFilter)
  ) {
    this._sceneFolderFilter = FOLDER_FILTER_ALL;
  }

  const sortedFolderOptions = sceneFolders
  .map((folder) => {
    const path = getFolderPath(folder);

    return {
      value:
        `${FOLDER_FILTER_PREFIX}${folder.id}`,
      label: getFolderLabel(folder),
      sortPath: path,
      selected:
        this._sceneFolderFilter ===
        `${FOLDER_FILTER_PREFIX}${folder.id}`
    };
  })
  .sort((a, b) => {
    const maxDepth = Math.max(
      a.sortPath.length,
      b.sortPath.length
    );

    for (let index = 0; index < maxDepth; index += 1) {
      const aPart = a.sortPath[index];
      const bPart = b.sortPath[index];

      if (aPart === undefined) {
        return -1;
      }

      if (bPart === undefined) {
        return 1;
      }

      const comparison = aPart.localeCompare(
        bPart,
        undefined,
        {
          numeric: true,
          sensitivity: "base"
        }
      );

      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  })
  .map(({ sortPath, ...option }) => option);

const folderOptions = [
  {
    value: FOLDER_FILTER_ALL,
    label: "All Scenes",
    selected:
      this._sceneFolderFilter === FOLDER_FILTER_ALL
  },
  {
    value: FOLDER_FILTER_UNFILED,
    label: "Unfiled Scenes",
    selected:
      this._sceneFolderFilter === FOLDER_FILTER_UNFILED
  },
  ...sortedFolderOptions
];

  const uncuedScenes = game.scenes.contents.filter(
    (scene) => !cueSceneIds.has(scene.id)
  );

  let availableScenes;

  if (
    this._sceneFolderFilter ===
    FOLDER_FILTER_UNFILED
  ) {
    availableScenes = uncuedScenes.filter(
      (scene) => getSceneFolderId(scene) === null
    );
  } else if (
    this._sceneFolderFilter.startsWith(
      FOLDER_FILTER_PREFIX
    )
  ) {
    const selectedFolderId =
      this._sceneFolderFilter.slice(
        FOLDER_FILTER_PREFIX.length
      );

    availableScenes = uncuedScenes.filter(
      (scene) =>
        getSceneFolderId(scene) === selectedFolderId
    );
  } else {
    availableScenes = uncuedScenes;
  }

  availableScenes = availableScenes
    .map((scene) => ({
      sceneId: scene.id,
      name: scene.name
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    );

  let sceneSelectPlaceholder =
    "Choose a Scene...";

  if (!availableScenes.length) {
    if (
      this._sceneFolderFilter ===
      FOLDER_FILTER_ALL
    ) {
      sceneSelectPlaceholder =
        "All world Scenes are already added";
    } else if (
      this._sceneFolderFilter ===
      FOLDER_FILTER_UNFILED
    ) {
      sceneSelectPlaceholder =
        "No available unfiled Scenes";
    } else {
      sceneSelectPlaceholder =
        "No available Scenes in this folder";
    }
  }

  return {
    cues,
    hasCues: cues.length > 0,
    cueCountLabel: `${cues.length} ${
      cues.length === 1 ? "Cue" : "Cues"
    }`,
    activeSceneName:
      game.scenes.active?.name ?? "No Active Scene",
    folderOptions,
    availableScenes,
    hasAvailableScenes:
      availableScenes.length > 0,
    sceneSelectPlaceholder
  };
}

/**
 * Attach transient application listeners after each render.
 */
async _onRender(context, options) {
  await super._onRender(context, options);

  const folderSelect =
    this.element?.querySelector(
      "[data-cueboard-folder-select]"
    );

  folderSelect?.addEventListener(
    "change",
    (event) => {
      void this.#onFolderFilterChange(event);
    }
  );
}

  /**
   * Persist the local panel position after Foundry repositions the window.
   */
  _onPosition(position) {
    super._onPosition(position);

    if (!this.rendered) {
      return;
    }

    const left = position.left;
    const top = position.top;

    if (
      !Number.isFinite(left) ||
      !Number.isFinite(top)
    ) {
      return;
    }

    clearTimeout(this._positionSaveTimer);

    this._positionSaveTimer = setTimeout(() => {
      this._positionSaveTimer = null;

      void game.settings
        .set(
          MODULE_ID,
          SETTINGS.PANEL_POSITION,
          { left, top }
        )
        .catch((error) => {
          console.warn(
            `${MODULE_TITLE} | Failed to save Cueboard panel position.`,
            error
          );
        });
    }, POSITION_SAVE_DELAY_MS);
  }

  /**
   * Clean up application-specific hooks and flush the final panel position.
   */
  _onClose(options) {
    if (this._positionSaveTimer) {
      clearTimeout(this._positionSaveTimer);
      this._positionSaveTimer = null;
    }

    const left = this.position?.left;
    const top = this.position?.top;

    if (
      Number.isFinite(left) &&
      Number.isFinite(top)
    ) {
      void game.settings
        .set(
          MODULE_ID,
          SETTINGS.PANEL_POSITION,
          { left, top }
        )
        .catch((error) => {
          console.warn(
            `${MODULE_TITLE} | Failed to save Cueboard panel position.`,
            error
          );
        });
    }

    for (const [hookName, hookId] of this._hookCallbacks) {
      Hooks.off(hookName, hookId);
    }

    this._hookCallbacks = [];

    super._onClose(options);
  }

  /**
   * Refresh Cueboard when Scene facts relevant to its presentation change.
   *
   * Hooks belong to this application instance and are removed on close.
   */
  #registerLiveRefreshHooks() {
  const refresh = () => {
    if (this.rendered) {
      void this.render({ force: true });
    }
  };

  const updateSettingHook = Hooks.on(
  "updateSetting",
  (setting, changed, options, userId) => {
    if (
      setting.key !==
      `${MODULE_ID}.${SETTINGS.CUES}`
    ) {
      return;
    }

    /*
     * Local Cueboard mutations already rerender explicitly after
     * CueStore resolves. This hook supplies the missing refresh
     * for changes authored by another connected GM.
     */
    if (userId === game.user.id) {
      return;
    }

    refresh();
  }
);

  const createSceneHook = Hooks.on(
    "createScene",
    refresh
  );

  const updateSceneHook = Hooks.on(
    "updateScene",
    refresh
  );

  const deleteSceneHook = Hooks.on(
    "deleteScene",
    refresh
  );

  const createFolderHook = Hooks.on(
    "createFolder",
    (folder) => {
      if (folder.type === "Scene") {
        refresh();
      }
    }
  );

  const updateFolderHook = Hooks.on(
    "updateFolder",
    (folder) => {
      if (folder.type === "Scene") {
        refresh();
      }
    }
  );

  const deleteFolderHook = Hooks.on(
    "deleteFolder",
    (folder) => {
      if (folder.type === "Scene") {
        refresh();
      }
    }
  );

  this._hookCallbacks.push(
  ["updateSetting", updateSettingHook],
  ["createScene", createSceneHook],
  ["updateScene", updateSceneHook],
  ["deleteScene", deleteSceneHook],
  ["createFolder", createFolderHook],
  ["updateFolder", updateFolderHook],
  ["deleteFolder", deleteFolderHook]
);
}

    /**
   * Update the temporary Scene-folder filter and refresh the picker.
   *
   * @param {Event} event
   */
  async #onFolderFilterChange(event) {
    const value = event.currentTarget?.value;

    if (!value) {
      return;
    }

    this._sceneFolderFilter = value;

    if (this.rendered) {
      await this.render({ force: true });
    }
  }

  /**
   * @this {CueboardApp}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onPreloadScene(event, target) {
    event.preventDefault();
    event.stopPropagation();

    await this.#runSceneAction(
      "preloadScene",
      target
    );
  }

  /**
   * @this {CueboardApp}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onActivateScene(event, target) {
    event.preventDefault();
    event.stopPropagation();

    await this.#runSceneAction(
      "activateScene",
      target
    );
  }

  /**
   * @this {CueboardApp}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onAddScene(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const select = this.element?.querySelector(
      "[data-cueboard-scene-select]"
    );

    const sceneId = select?.value;

    if (!sceneId) {
      ui.notifications.warn(
        `${MODULE_TITLE} | Choose a Scene to add.`
      );

      return;
    }

    const scene = game.scenes.get(sceneId);

    await this.#runCueMutation(
      () => CueStore.addScene(sceneId),
      `Added "${scene?.name ?? sceneId}" to Cueboard.`
    );
  }

  /**
   * @this {CueboardApp}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onRemoveScene(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const sceneId = target.dataset.sceneId;

    if (!sceneId) {
      return;
    }

    const scene = game.scenes.get(sceneId);
    const label = scene?.name ?? sceneId;

    await this.#runCueMutation(
      () => CueStore.removeScene(sceneId),
      `Removed "${label}" from Cueboard.`
    );
  }

  /**
   * @this {CueboardApp}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onMoveSceneUp(event, target) {
    event.preventDefault();
    event.stopPropagation();

    await this.#moveScene(target, -1);
  }

  /**
   * @this {CueboardApp}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onMoveSceneDown(event, target) {
    event.preventDefault();
    event.stopPropagation();

    await this.#moveScene(target, 1);
  }

  /**
   * Coordinate one Scene action through Cueboard's public API.
   *
   * No Scene-control behavior is implemented locally here.
   *
   * @param {"preloadScene"|"activateScene"} action
   * @param {HTMLElement} target
   */
  async #runSceneAction(action, target) {
    const sceneId = target.dataset.sceneId;

    if (!sceneId) {
      return;
    }

    target.disabled = true;
    target.classList.add("is-pending");

    try {
      const scene =
        await game.cueboard.api[action](sceneId);

      if (action === "preloadScene") {
        this._preloadRequestedSceneIds.add(scene.id);

        ui.notifications.info(
          `${MODULE_TITLE} | Preload requested for "${scene.name}".`
        );
      } else {
        ui.notifications.info(
          `${MODULE_TITLE} | "${scene.name}" is now active.`
        );
      }

      if (this.rendered) {
        await this.render({ force: true });
      }
    } catch (error) {
      console.error(
        `${MODULE_TITLE} | Cueboard Scene action failed.`,
        error
      );

      ui.notifications.error(
        error?.message ??
          `${MODULE_TITLE} | Scene action failed.`
      );

      if (target.isConnected) {
        target.disabled = false;
        target.classList.remove("is-pending");
      }
    }
  }

  /**
   * Move one cue relative to its current authoritative position.
   *
   * @param {HTMLElement} target
   * @param {-1|1} direction
   */
  async #moveScene(target, direction) {
    const sceneId = target.dataset.sceneId;

    if (!sceneId) {
      return;
    }

    const cues = CueStore.getCues();

    const fromIndex = cues.findIndex(
      (cue) => cue.sceneId === sceneId
    );

    if (fromIndex === -1) {
      ui.notifications.error(
        `${MODULE_TITLE} | That cue is no longer available.`
      );

      if (this.rendered) {
        await this.render({ force: true });
      }

      return;
    }

    const toIndex = fromIndex + direction;

    if (
      toIndex < 0 ||
      toIndex >= cues.length
    ) {
      return;
    }

    const scene = game.scenes.get(sceneId);
    const label = scene?.name ?? sceneId;

    await this.#runCueMutation(
      () => CueStore.moveScene(sceneId, toIndex),
      `Moved "${label}" ${
        direction < 0 ? "up" : "down"
      }.`
    );
  }

  /**
   * Coordinate one Cue Store mutation.
   *
   * Management controls are temporarily disabled while the authoritative
   * world-setting write is in flight so one GM cannot accidentally overlap
   * multiple UI mutations.
   *
   * @param {() => Promise<unknown>} operation
   * @param {string} successMessage
   */
  async #runCueMutation(operation, successMessage) {
    if (this._cueMutationPending) {
      return;
    }

    this._cueMutationPending = true;

    const controls = Array.from(
      this.element?.querySelectorAll(
        "[data-cue-management]"
      ) ?? []
    );

    const originalStates = controls.map(
      (control) => [control, control.disabled]
    );

    for (const control of controls) {
      control.disabled = true;
    }

    try {
      await operation();

      ui.notifications.info(
        `${MODULE_TITLE} | ${successMessage}`
      );

      if (this.rendered) {
        await this.render({ force: true });
      }
    } catch (error) {
      console.error(
        `${MODULE_TITLE} | Cue list update failed.`,
        error
      );

      ui.notifications.error(
        error?.message ??
          `${MODULE_TITLE} | Cue list update failed.`
      );
    } finally {
      this._cueMutationPending = false;

      for (const [control, wasDisabled] of originalStates) {
        if (control.isConnected) {
          control.disabled = wasDisabled;
        }
      }
    }
  }
}

/**
 * Get the currently rendered Cueboard instance, if one exists.
 *
 * @returns {CueboardApp|null}
 */
export function getCueboardApp() {
  return (
    foundry.applications.instances.get(APP_ID) ??
    null
  );
}

/**
 * Open or foreground Cueboard for the current GM.
 *
 * @returns {Promise<CueboardApp|null>}
 */
export async function openCueboard() {
  if (!game.user?.isGM) {
    ui.notifications.warn(
      `${MODULE_TITLE} | Only a GM can open Cueboard.`
    );

    return null;
  }

  const existing = getCueboardApp();

  if (existing) {
    await existing.render({ force: true });
    existing.bringToFront();

    return existing;
  }

  const app = new CueboardApp({
    position: readStoredPosition()
  });

  await app.render({ force: true });

  return app;
}

/**
 * Toggle the single Cueboard application instance.
 *
 * @returns {Promise<CueboardApp|null>}
 */
export async function toggleCueboard() {
  const existing = getCueboardApp();

  if (existing) {
    await existing.close();
    return null;
  }

  return openCueboard();
}