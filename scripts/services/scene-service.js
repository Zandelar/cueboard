import { MODULE_TITLE } from "../constants.js";

const SERVICE_LABEL = `${MODULE_TITLE} | Scene Service`;

const preloadingSceneIds = new Set();
const activatingSceneIds = new Set();

/**
 * Require GM authority for Cueboard Scene-control operations.
 */
function requireGM() {
  if (!game.user?.isGM) {
    throw new Error(
      `${SERVICE_LABEL} | Only a GM can control Scenes through Cueboard.`
    );
  }
}

/**
 * Validate and normalize a Scene ID.
 *
 * @param {string} sceneId
 * @returns {string}
 */
function requireSceneId(sceneId) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    throw new TypeError(
      `${SERVICE_LABEL} | A valid Scene ID is required.`
    );
  }

  return sceneId.trim();
}

/**
 * Resolve a world Scene by ID.
 *
 * Cueboard v0.1.0 deliberately targets world Scenes only.
 *
 * @param {string} sceneId
 * @returns {Scene}
 */
function requireScene(sceneId) {
  const normalizedId = requireSceneId(sceneId);
  const scene = game.scenes.get(normalizedId);

  if (!scene) {
    throw new Error(
      `${SERVICE_LABEL} | Scene "${normalizedId}" does not exist in this world.`
    );
  }

  return scene;
}

/**
 * Wrap a native Foundry Scene-operation failure with Cueboard context while
 * preserving the original error as the cause.
 *
 * @param {string} action
 * @param {Scene} scene
 * @param {Error} error
 * @returns {Error}
 */
function sceneOperationError(action, scene, error) {
  console.error(
    `${SERVICE_LABEL} | Failed to ${action} Scene "${scene.name}".`,
    error
  );

  return new Error(
    `${SERVICE_LABEL} | Failed to ${action} Scene "${scene.name}".`,
    { cause: error }
  );
}

/**
 * Authoritative Scene-control service for Cueboard.
 *
 * Preloading and activation are intentionally independent operations.
 */
export class SceneService {
  /**
   * Request preload of a world Scene for this client and connected clients.
   *
   * This method never activates the Scene.
   *
   * @param {string} sceneId
   * @returns {Promise<Scene>}
   */
  static async preloadScene(sceneId) {
    requireGM();

    const scene = requireScene(sceneId);

    if (preloadingSceneIds.has(scene.id)) {
      throw new Error(
        `${SERVICE_LABEL} | Scene "${scene.name}" is already being preloaded.`
      );
    }

    preloadingSceneIds.add(scene.id);

    try {
      await game.scenes.preload(scene.id, {
        broadcast: true
      });

      return scene;
    } catch (error) {
      throw sceneOperationError("preload", scene, error);
    } finally {
      preloadingSceneIds.delete(scene.id);
    }
  }

  /**
   * Make a world Scene active using Foundry's native activation workflow.
   *
   * This method never requests a Cueboard preload.
   *
   * @param {string} sceneId
   * @returns {Promise<Scene>}
   */
  static async activateScene(sceneId) {
    requireGM();

    const scene = requireScene(sceneId);

    if (activatingSceneIds.has(scene.id)) {
      throw new Error(
        `${SERVICE_LABEL} | Scene "${scene.name}" is already being activated.`
      );
    }

    activatingSceneIds.add(scene.id);

    try {
      await scene.activate();

      return scene;
    } catch (error) {
      throw sceneOperationError("activate", scene, error);
    } finally {
      activatingSceneIds.delete(scene.id);
    }
  }
}