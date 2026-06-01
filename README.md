# AoE4 Fight Simulator

Node.js + Express + WebSocket simulator for Age of Empires 4 fights.

## Features

- Simplified 2D fight simulation engine (melee/ranged, range, cooldown, chaos).
- Strategies:
  - `straight`
  - `kiting` (ranged only)
  - `focus_fire` (target class priority)
- Environments:
  - `open`
  - `natural` (obstacles)
  - `tower`, `castle`, `tc` (garrisoned structures that fire)
- Data from `aoe4data` (`github:aoe4world/data`) with runtime refresh.
- Dark UI with:
  - Live 2D battlefield (unit icons + HP bars)
  - Live team legend (icon + name + alive)
  - Real-time resource chart
  - Monte Carlo mode with win rate and trade ratio charts
- Automatic default preset, fully editable.

## Requirements

- Node.js 20+
- npm 10+

## Installation

```bash
npm install
npm install github:aoe4world/data
```

## Start

```bash
npm run dev
```

Server default: `http://localhost:3000`

## UI Usage

1. Choose civilization and age for Team A and Team B.
2. Add units from the selector (it only shows units valid for the selected civ/age).
3. Choose formation, strategy, and environment.
4. Click `Start Simulation` for a single live fight via WebSocket.
5. Click `Run Monte Carlo` for aggregated N runs (`Monte Carlo Runs` field).
6. `Load Preset` loads a quick default setup that you can freely modify.

## Note On Civ-Specific Units

Units are filtered by civilization/age; base units may be replaced by civ-specific variants (classic example: English with `longbowman` instead of the base archer). For this reason, the UI picker is always the correct reference.

## API

### Data

- `GET /api/data/health`
- `GET /api/data/civilizations`
- `GET /api/data/units?civ=en&age=2`
- `GET /api/data/buildings?civ=en&age=4`
- `GET /api/data/technologies?civ=en&age=3`
- `POST /api/data/refresh`

### Simulation

- `POST /api/simulation/start`
- `POST /api/simulation/stop`
- `GET /api/simulation/state`
- `GET /api/simulation/result`
- `POST /api/simulation/monte-carlo`

## Example Start Payload

```json
{
  "teamA": {
    "civ": "en",
    "age": 2,
    "formation": "normal",
    "strategy": { "type": "straight", "priorityClass": null },
    "units": [
      { "unitId": "longbowman", "count": 14 },
      { "unitId": "spearman", "count": 10 }
    ]
  },
  "teamB": {
    "civ": "fr",
    "age": 2,
    "formation": "line",
    "strategy": { "type": "focus_fire", "priorityClass": "ranged" },
    "units": [
      { "unitId": "archer", "count": 14 },
      { "unitId": "horseman", "count": 10 }
    ]
  },
  "environment": "open",
  "monteCarloRuns": 30
}
```

## WebSocket

Endpoint: `ws://localhost:3000/ws`

Server events:

- `ws:ready`
- `sim:start`
- `sim:tick`
- `sim:end`
- `sim:error`

## Config

Main parameters in `config.js`:

- `tickDelta`
- `maxTicks`
- `wsBatchSize`
- `chaosFactor`
- `mapWidth` / `mapHeight`

## Troubleshooting

- If the simulation does not start: check that both teams have at least one valid unit.
- If icons are missing: verify static route `/data/images/units/*` and `node_modules/aoe4data/images/units` exists.
- After data updates: use `POST /api/data/refresh`.
