# Cueboard

A lightweight GM scene cue board for Foundry Virtual Tabletop.

Cueboard is designed to let a Game Master prepare a small ordered set of Scenes for live play, preload upcoming Scenes for connected players, and activate those Scenes only when the GM chooses.

## Status

Cueboard v0.1.0 is currently under development.

There is not yet a public release.

## Foundry Compatibility

- Foundry Virtual Tabletop v14
- System-agnostic
- GM-facing

## Core Design

Cueboard treats Scene preloading and Scene activation as two separate actions.

**Preload does not activate a Scene.**

**Activate does not automatically preload a Scene.**

The GM retains explicit control over when each action occurs.

## Planned v0.1.0 Features

- Persistent floating Cueboard panel
- Shared ordered Scene cue list
- Add, remove, and reorder Scene cues
- Independent Preload action
- Independent Make Active action
- Active Scene indication
- Client-persisted panel position
- Public Scene-control API
- Safe handling of deleted Scene references

## Architecture

Important architecture decisions are recorded in:

```text
docs/adr/
```

The initial architecture is defined by:

```text
ADR-001-cueboard-core-scene-cue-architecture.md
```

Cueboard follows the Rule of One: Scene-control behavior has one authoritative implementation, while UI and future integrations coordinate that implementation rather than recreating it.

## Future Integration

The Scene-control API is intended to allow future integrations such as:

- Foundry macros
- Quickbar controls
- Stream Deck workflows
- other Foundry modules

Those integrations are not part of v0.1.0 unless explicitly added through a later release design review.

## Development Installation

Place or link the repository at:

```text
{Foundry User Data}/Data/modules/cueboard/
```

Restart Foundry VTT, enable **Cueboard** under Manage Modules, and reload the world.

## License

Cueboard is released under the MIT License.

See `LICENSE`.