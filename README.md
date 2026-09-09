# Cueboard

Cueboard is a lightweight GM scene cue board for Foundry Virtual Tabletop.

It gives the Game Master a persistent ordered list of Scenes that can be prepared during play, preloaded for connected clients, and activated only when the GM chooses.

## Current Release

**Cueboard v0.1.0**

- Foundry Virtual Tabletop v14
- Verified on Foundry v14.367
- System-agnostic
- GM-facing
- MIT licensed

## Core Workflow

Cueboard deliberately treats Scene preloading and Scene activation as two independent actions.

**Preload does not activate a Scene.**

**Make Active does not automatically preload a Scene.**

This allows a GM to preload an upcoming Scene while play continues elsewhere and switch only when the table is ready.

## Features

- Persistent floating Cueboard panel
- Shared ordered world Scene cue list
- Folder-aware Foundry Scene picker
- All Scenes and Unfiled Scenes filters
- Nested Scene-folder navigation
- Add, remove, and reorder Scene cues
- Independent Preload and Make Active controls
- Active Scene indication
- Safe handling of deleted Scene references
- Client-persisted panel position
- GM-only Scene management
- Multi-GM live cue-list synchronization
- Public Scene-control API

## Installation

### Manifest URL

In Foundry VTT:

1. Open **Add-on Modules**.
2. Choose **Install Module**.
3. Paste the Cueboard manifest URL:

```text
https://github.com/Zandelar/cueboard/releases/latest/download/module.json
```

4. Install Cueboard.
5. Enable **Cueboard** in the desired world.

### Manual Installation

Download the release ZIP and extract Cueboard into:

```text
{Foundry User Data}/Data/modules/cueboard/
```

Restart Foundry and enable Cueboard under **Manage Modules**.

## Using Cueboard

As a GM, open Cueboard from the Foundry Scene Controls.

Use the folder and Scene selectors to add world Scenes to the cue list.

Each valid cue provides two independent table actions:

- **Preload** — requests Foundry's native Scene preload for connected clients without activating the Scene.
- **Make Active** — activates the Scene through Foundry's native Scene workflow without automatically preloading it.

The **Preload Sent** presentation means only that Cueboard successfully issued the preload request. Cueboard v0.1.0 does not claim that every connected client has finished loading.

## Scene Organization

Cueboard reads Foundry's existing Scene folders directly.

Folder information is used only to prepare the Scene picker. Cueboard does not copy folder names or folder IDs into its cue data.

Stored cues contain only Scene identity:

```js
[
  { sceneId: "SCENE_ID" }
]
```

Renaming or reorganizing a Scene therefore does not duplicate or invalidate those Scene facts inside Cueboard.

If a cued Scene is deleted, Cueboard safely displays the stale reference so a GM can remove it.

## Public API

Cueboard exposes its authoritative Scene-control operations at:

```js
game.cueboard.api
```

### Preload a Scene

```js
await game.cueboard.api.preloadScene(sceneId);
```

### Activate a Scene

```js
await game.cueboard.api.activateScene(sceneId);
```

These operations are GM-authorized and intentionally independent.

The public API is suitable for future Foundry macros, Quickbar workflows, Stream Deck integrations, or other modules without requiring those consumers to recreate Cueboard's Scene-control logic.

## Architecture

Important design decisions are recorded under:

```text
docs/adr/
```

The initial architecture is defined by:

```text
ADR-001-cueboard-core-scene-cue-architecture.md
```

Cueboard follows the Rule of One: each conceptual action has one authoritative implementation, while applications and integrations coordinate those implementations rather than recreating them.

## Source and Issues

Source:

```text
https://github.com/Zandelar/cueboard
```

Issue tracker:

```text
https://github.com/Zandelar/cueboard/issues
```

## License

Cueboard is released under the MIT License.

See `LICENSE`.