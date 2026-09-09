# Changelog

All notable changes to Cueboard will be documented in this file.

## [0.1.0] - 2026-09-09

### Added

### Changed

- Completed v0.1.0 release hardening across Cueboard's Scene operations, permissions, persistence, stale-reference handling, folder filtering, public API boundary, multi-GM shared state, and ApplicationV2 lifecycle behavior.
- Added GM Scene-management controls for adding, removing, and reordering Cueboard entries through the authoritative Cue Store, including duplicate-free Scene selection and safe removal of stale Scene references.
- Added the GM-only Cueboard ApplicationV2 panel with a Foundry Scene Control launcher, Cue Store-backed Scene presentation, independent public-API preload and activation controls, active Scene indication, and client-persisted panel position.
- Added Cueboard-specific parchment, dark-header, gold-accent styling aligned with the established visual language of the other Zandelar Foundry modules.
- Added Cueboard's narrow public Scene-control API at `game.cueboard.api`, exposing the authoritative preload and activation operations for future UI, macro, Quickbar, and external-control integrations without duplicating Scene logic.
- Added the authoritative Scene Service for GM-validated, independent Scene preloading and activation using Foundry v14 native Scene APIs, with runtime duplicate-request protection.
- Added the authoritative Cue Store for reading, adding, removing, and reordering the shared world Scene cue list, including duplicate protection and safe identification/removal of stale Scene references.
- Established the initial Foundry v14 Cueboard module foundation, including manifest metadata, ES-module initialization, and hidden world/client persistence settings.
- Added the initial public-project documentation, MIT license, changelog structure, and ADR-based repository foundation.