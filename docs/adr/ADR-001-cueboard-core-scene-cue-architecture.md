# ADR-001 — Cueboard Core Scene Cue Architecture

Status: Proposed  
Date: 2026-09-07  
Module: Cueboard  
Module ID: cueboard  
Target Foundry Version: v14  
Target Game Systems: System-agnostic

## Context

Cueboard is a GM-facing Foundry VTT module intended to reduce friction when preparing and changing Scenes during live play.

The core table workflow is:

1. The GM prepares a short ordered list of Scenes.
2. While play continues on the current Scene, the GM may request that another Scene be preloaded by connected clients.
3. Preloading does not change the active Scene.
4. When the GM chooses, they separately make the prepared Scene active.
5. Activation does not implicitly request a preload.

Cueboard must remain small, predictable, and suitable for public distribution.

The initial release is intended for Foundry VTT v14 and must remain system-agnostic.

The module is also expected to provide a stable architectural foundation for future consumers such as Foundry macros, Quickbar integrations, or Stream Deck workflows without requiring those consumers to duplicate Cueboard's scene-control behavior.

---

## Decision

Cueboard will use a small service-oriented architecture with separate ownership for:

- cue-list persistence and manipulation
- Scene preload behavior
- Scene activation behavior
- presentation through the Cueboard application
- client-specific presentation state

The floating Cueboard application is a presentation and coordination layer only.

It does not own Scene-control business logic.

---

## 1. Scene Actions Are Independent

Cueboard defines two separate conceptual actions:

- Preload Scene
- Activate Scene

These actions are deliberately independent.

The following rules are architectural requirements:

> `preloadScene()` never activates a Scene.

> `activateScene()` never preloads a Scene.

There is no automatic transition from preload to activation.

There is no timer that activates a Scene after preloading.

There is no hidden preload performed when the GM chooses Make Active.

The GM retains explicit control over both actions.

---

## 2. Authoritative Scene Service

Cueboard will have one authoritative Scene-control service.

Conceptually, it owns:

```text
preloadScene(sceneId)
activateScene(sceneId)
```

The service is responsible for:

- validating the requested Scene
- validating GM authority
- invoking the appropriate Foundry-native Scene behavior
- returning a clear success or failure result
- preventing UI layers from reimplementing Scene-control logic

The Scene Service will prefer Foundry-native Scene mechanisms rather than replacing them.

The Cueboard application, macros, future Quickbar integrations, and future external-control integrations must all call this same authority.

No alternate preload or activation implementation should exist elsewhere in the module.

---

## 3. Public API

Cueboard will expose a narrow public API.

The initial public contract is:

```js
game.cueboard.api.preloadScene(sceneId)
game.cueboard.api.activateScene(sceneId)
```

These methods represent the same authoritative actions used internally by the Cueboard UI.

The public API exists from v0.1.0 so that future integrations can extend Cueboard without modifying its internal implementation.

The API will not expose additional functionality merely for hypothetical future needs.

Cue-list editing APIs, readiness-tracking APIs, sequencing APIs, and transition APIs are excluded unless an immediate consumer later requires them.

---

## 4. Cue Store

Cueboard will have one authoritative Cue Store responsible for the prepared Scene list.

The Cue Store owns:

- reading the cue list
- adding a Scene
- removing a Scene
- reordering Scenes
- rejecting duplicate Scene entries
- validating stored Scene references
- exposing the ordered cue list to presentation layers

The Cueboard application must not manipulate persisted cue data directly.

---

## 5. Cue Persistence

The prepared Cueboard list is world-owned authored state.

It will be persisted using a module-owned world setting.

Conceptually:

```js
[
  { sceneId: "SCENE_ID_1" },
  { sceneId: "SCENE_ID_2" },
  { sceneId: "SCENE_ID_3" }
]
```

Cueboard should persist only the identity required to resolve the Scene.

It must not duplicate Scene facts such as:

- Scene name
- Scene image
- current active state
- navigation state
- thumbnail
- Scene configuration

Those values remain owned by the Foundry Scene document and are resolved when Cueboard presents the cue.

The array order is authoritative for Cueboard display order.

If a Scene is renamed, Cueboard should display the renamed Scene without requiring stored Cueboard data to be rewritten.

If a referenced Scene is deleted, Cueboard must not silently substitute another Scene.

---

## 6. Client Presentation State

Cueboard panel position and other purely local presentation state are client-owned.

They will not be stored in Scene flags or world-authored cue data.

The initial client-owned presentation state may include:

- panel position
- collapsed/expanded state if implemented

Client presentation state must not alter the shared Cueboard configuration seen by other GMs.

---

## 7. GM Authority

Cueboard v0.1.0 is GM-only.

The Cueboard application should not be exposed to players.

Cue-management operations are GM-only.

Scene preload and activation requests made through Cueboard's public API must validate appropriate GM authority.

Cueboard must not rely solely on downstream Foundry failures as its permission model.

No custom player-to-GM socket workflow is required for v0.1.0 because players do not initiate Cueboard actions.

---

## 8. Application Ownership

Cueboard will use a module-owned floating application.

For new application code, the preferred Foundry architecture is:

- ApplicationV2
- HandlebarsApplicationMixin

The application owns presentation and coordination only.

It may:

- display prepared cues
- display the active Scene
- collect GM actions
- invoke Cue Store operations
- invoke Scene Service operations
- display success/failure state

It must not:

- independently perform Scene activation
- independently perform Scene preloading
- directly rewrite persisted cue state outside the Cue Store
- implement a second permission model

---

## 9. Panel Lifecycle

Cueboard is opened through a GM-facing Foundry control.

Opening Cueboard creates or reveals the module-owned floating panel.

The panel should remain available while the GM changes or navigates Scenes.

Activating another Scene must not close Cueboard.

The application should behave as a persistent table tool during the current session.

Automatic opening on world load is not part of v0.1.0.

If an auto-open preference is later justified by actual use, it may be considered as a separate feature.

---

## 10. Active Scene Presentation

Cueboard will identify the currently active Scene using Foundry Scene state.

Active Scene status is derived presentation state.

It is not stored independently by Cueboard.

The cue corresponding to the currently active Scene should receive a clear visual treatment.

Its activation control should not imply that Cueboard owns the active-state fact.

---

## 11. Preload Status

Cueboard v0.1.0 distinguishes between:

- a preload request being issued
- connected clients actually completing preload

Cueboard may report that a preload request was sent.

Cueboard must not claim that all connected users are ready unless a future release implements and verifies an explicit acknowledgment mechanism.

Examples of acceptable v0.1.0 feedback include:

```text
Preload Requested
```

or an equivalent temporary visual state.

Examples not supported by v0.1.0 include:

```text
4 / 4 Players Ready
```

unless such readiness has actually been measured.

---

## 12. Scene Levels

Cueboard v0.1.0 cues target Foundry Scenes.

They do not target individual Scene Levels.

Where Foundry v14 provides default behavior for a Scene's initial or active Level, Cueboard will rely on Foundry's normal behavior rather than creating a second Level-selection model.

Level-specific cueing is outside v0.1.0.

If later justified, Level-aware cues must extend the authoritative Scene-control architecture rather than creating a parallel implementation.

---

## 13. Failure Behavior

Cueboard must fail safely and visibly.

If a stored Scene no longer exists:

- Cueboard must not throw uncontrolled errors
- Cueboard must not find another Scene by name
- Cueboard must not silently substitute another Scene
- the stale cue should be visibly identifiable
- the GM must be able to remove the stale cue

If preloading fails:

- no activation follows automatically

If activation fails:

- no preload follows automatically
- the currently active Scene should remain unchanged
- the GM receives clear feedback

Duplicate Scene cues should be rejected.

Duplicate rapid requests should be guarded where necessary to prevent accidental repeated execution.

---

## 14. Visual Design

Cueboard should belong visually to the same family as Gregg's other Foundry modules.

The application should preserve the established design language rather than inventing an unrelated generic Foundry window.

The intended shared traits include:

- warm fantasy-tool aesthetic
- restrained gold/warm accents
- dark or parchment-compatible surfaces as appropriate
- rounded compact controls
- readable typography hierarchy
- deliberate spacing
- clear hover, active, disabled, and selected states
- compact GM-facing information density
- Foundry-native window behavior

Cueboard must not introduce a speculative shared styling framework merely to achieve this consistency.

Actual styling should be based on inspection of the current canonical module files at implementation time.

---

## 15. External Integration Boundary

Cueboard is designed so its UI is not required in order to perform Scene-control actions.

Future integrations may include:

- Foundry macros
- Quickbar controls
- Stream Deck workflows
- other Foundry modules

Those integrations must call Cueboard's authoritative public API.

They must not reproduce Scene preload or activation logic.

Cueboard v0.1.0 does not include Stream Deck-specific code, Quickbar modification, or external REST control.

The architectural boundary merely preserves the ability to add such integrations later.

---

## 16. Public Distribution

Cueboard is intended to be a free public Foundry VTT module.

The source repository will be public from project inception.

The intended code license is MIT.

The project will maintain:

- `module.json`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- ADR documentation
- versioned releases

GitHub will be used for source control and public release distribution.

Release automation should remain minimal until repeated manual work provides a concrete reason to automate further.

---

## 17. v0.1.0 Scope

Cueboard v0.1.0 includes:

- Foundry VTT v14 support
- system-agnostic operation
- GM-only operation
- module-owned floating Cueboard panel
- ordered shared world cue list
- adding Scenes
- removing Scenes
- reordering Scenes
- independent Preload action
- independent Make Active action
- active Scene indication
- client-owned panel position
- narrow public Scene-control API
- safe stale-Scene handling
- public GitHub repository
- README
- MIT license
- CHANGELOG
- installable release package

---

## 18. Explicitly Out of Scope for v0.1.0

The following are not part of the first release:

- automatic activation after preload
- player preload-readiness tracking
- Quickbar integration
- Stream Deck-specific integration
- cinematic transitions
- playlists or audio cueing
- cue sequencing
- cue folders
- cue groups
- encounter integration
- player-facing Cueboard controls
- Scene Level-specific cues
- Compendium Scene workflows
- generic automation engines

These features may only be considered later when there is a concrete table need.

---

## Consequences

### Positive

- The GM has explicit control over preload timing and activation timing.
- Cueboard remains predictable during live play.
- Scene behavior has one authoritative implementation.
- UI and future integrations share the same API.
- World-authored cue data and client presentation data have clear ownership.
- The module remains system-agnostic.
- The v0.1.0 implementation can stay small.
- Future external integrations do not require redesigning the Scene-control core.

### Trade-offs

- Cueboard will not know whether every connected player's preload has completed.
- It will not automatically transition after preloading.
- The first release will not support Scene Level-specific cues.
- Public API stability becomes an intentional maintenance responsibility.
- Shared world cue configuration means multiple GMs do not have separate cue lists in v0.1.0.

These trade-offs are accepted because they preserve explicit GM control and keep the first release focused.

---

## Alternatives Considered

### Automatic Preload Then Activate

Rejected.

The GM must choose when the Scene becomes active.

Preload completion and narrative timing are separate concerns.

### Activation Automatically Performs Preload

Rejected.

This makes the Activate action less predictable and duplicates responsibility between the two conceptual commands.

### Cueboard Stored Entirely Per Client

Rejected.

The prepared cue list represents table/world preparation and should be shared world state.

Only presentation state belongs to the individual client.

### Modifying Foundry's Quickbar as the Primary UI

Rejected for v0.1.0.

Cueboard owns this workflow and should begin with a module-owned application.

A future Quickbar integration may call the public Cueboard API.

### Readiness Tracking in v0.1.0

Rejected.

It requires an acknowledgment architecture that is not necessary to solve the initial table problem.

### Large Generic Scene Automation Framework

Rejected.

Cueboard currently requires two Scene actions and a small persisted cue list.

A broader framework has no immediate justification.

---

## Rule of One

Cueboard recognizes the following authoritative ownership:

```text
Cue list manipulation
        ↓
Cue Store

Scene preload
        ↓
Scene Service

Scene activation
        ↓
Scene Service

UI / Macro / Future Integration
        ↓
Cueboard API
        ↓
Authoritative Service
```

No presentation layer or integration may create an alternate implementation of these conceptual actions.

---

## Decision Summary

Cueboard is a GM-owned scene cue tool.

A cue identifies a Foundry Scene.

Cueboard provides two explicit and independent operations:

```text
PRELOAD
ACTIVATE
```

The prepared cue list is shared world state.

Panel position is client state.

The Scene Service owns Scene-control behavior.

The Cue Store owns cue-list behavior.

The floating application presents and coordinates those authorities.

The public API exposes the same Scene-control path so future macros, Quickbar controls, Stream Deck workflows, and other integrations can extend Cueboard without modifying or duplicating its core logic.