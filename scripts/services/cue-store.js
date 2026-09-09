import { MODULE_ID, MODULE_TITLE, SETTINGS } from "../constants.js";

const STORE_LABEL = `${MODULE_TITLE} | Cue Store`;

/**
 * Validate that the current user has GM authority to modify
 * the shared world Cueboard configuration.
 */
function requireGM() {
  if (!game.user?.isGM) {
    throw new Error(`${STORE_LABEL} | Only a GM can modify the cue list.`);
  }
}

/**
 * Validate and normalize a Scene ID supplied to the Cue Store.
 *
 * @param {string} sceneId
 * @returns {string}
 */
function requireSceneId(sceneId) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    throw new TypeError(`${STORE_LABEL} | A valid Scene ID is required.`);
  }

  return sceneId.trim();
}

/**
 * Authoritative persistence service for Cueboard's ordered Scene list.
 *
 * Cueboard stores only Scene IDs.
 * Scene names, active state, images, and other Scene facts remain owned
 * by the Foundry Scene documents themselves.
 */
export class CueStore {
  /**
   * Get the persisted ordered cue list.
   *
   * A fresh array is returned so callers cannot accidentally mutate
   * the setting value in memory.
   *
   * @returns {{sceneId: string}[]}
   */
  static getCues() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.CUES);

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.map((cue) => ({
      sceneId: cue.sceneId
    }));
  }

  /**
   * Get the ordered cue list with each Scene reference resolved.
   *
   * Deleted Scenes remain represented as stale entries so the GM can
   * see and remove them rather than Cueboard silently discarding them.
   *
   * @returns {{sceneId: string, index: number, scene: Scene|null, stale: boolean}[]}
   */
  static getEntries() {
    return this.getCues().map((cue, index) => {
      const scene = game.scenes.get(cue.sceneId) ?? null;

      return {
        sceneId: cue.sceneId,
        index,
        scene,
        stale: scene === null
      };
    });
  }

  /**
   * Add a world Scene to the end of Cueboard.
   *
   * @param {string} sceneId
   * @returns {Promise<{sceneId: string}[]>}
   */
  static async addScene(sceneId) {
    requireGM();

    const normalizedId = requireSceneId(sceneId);
    const scene = game.scenes.get(normalizedId);

    if (!scene) {
      throw new Error(
        `${STORE_LABEL} | Scene "${normalizedId}" does not exist in this world.`
      );
    }

    const cues = this.getCues();

    if (cues.some((cue) => cue.sceneId === normalizedId)) {
      throw new Error(
        `${STORE_LABEL} | Scene "${scene.name}" is already on Cueboard.`
      );
    }

    const nextCues = [
      ...cues,
      { sceneId: normalizedId }
    ];

    await game.settings.set(MODULE_ID, SETTINGS.CUES, nextCues);

    return this.getCues();
  }

  /**
   * Remove a Scene reference from Cueboard.
   *
   * Scene existence is deliberately not required here. This allows
   * stale references to deleted Scenes to be removed safely.
   *
   * @param {string} sceneId
   * @returns {Promise<{sceneId: string}[]>}
   */
  static async removeScene(sceneId) {
    requireGM();

    const normalizedId = requireSceneId(sceneId);
    const cues = this.getCues();
    const index = cues.findIndex((cue) => cue.sceneId === normalizedId);

    if (index === -1) {
      throw new Error(
        `${STORE_LABEL} | Scene "${normalizedId}" is not on Cueboard.`
      );
    }

    const nextCues = cues.filter((cue) => cue.sceneId !== normalizedId);

    await game.settings.set(MODULE_ID, SETTINGS.CUES, nextCues);

    return this.getCues();
  }

  /**
   * Move an existing Cueboard Scene to a new zero-based index.
   *
   * The Cue Store owns the reordering operation. Presentation layers
   * only specify which Scene should move and where it should go.
   *
   * @param {string} sceneId
   * @param {number} toIndex
   * @returns {Promise<{sceneId: string}[]>}
   */
  static async moveScene(sceneId, toIndex) {
    requireGM();

    const normalizedId = requireSceneId(sceneId);
    const cues = this.getCues();

    if (!Number.isInteger(toIndex)) {
      throw new TypeError(
        `${STORE_LABEL} | Cue destination index must be an integer.`
      );
    }

    if (toIndex < 0 || toIndex >= cues.length) {
      throw new RangeError(
        `${STORE_LABEL} | Cue destination index ${toIndex} is out of range.`
      );
    }

    const fromIndex = cues.findIndex(
      (cue) => cue.sceneId === normalizedId
    );

    if (fromIndex === -1) {
      throw new Error(
        `${STORE_LABEL} | Scene "${normalizedId}" is not on Cueboard.`
      );
    }

    if (fromIndex === toIndex) {
      return cues;
    }

    const nextCues = [...cues];
    const [movedCue] = nextCues.splice(fromIndex, 1);

    nextCues.splice(toIndex, 0, movedCue);

    await game.settings.set(MODULE_ID, SETTINGS.CUES, nextCues);

    return this.getCues();
  }
}