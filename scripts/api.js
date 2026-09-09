import { SceneService } from "./services/scene-service.js";

/**
 * Cueboard's public integration API.
 *
 * This layer exposes authoritative Cueboard behavior without owning
 * or reimplementing Scene-control logic.
 */
export const cueboardApi = Object.freeze({
  /**
   * Request preload of a world Scene for the GM and connected clients.
   *
   * This never activates the Scene.
   *
   * @param {string} sceneId
   * @returns {Promise<Scene>}
   */
  preloadScene(sceneId) {
    return SceneService.preloadScene(sceneId);
  },

  /**
   * Make a world Scene active.
   *
   * This never requests a Cueboard preload.
   *
   * @param {string} sceneId
   * @returns {Promise<Scene>}
   */
  activateScene(sceneId) {
    return SceneService.activateScene(sceneId);
  }
});