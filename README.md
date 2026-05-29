# AoE4 Fight Simulator

Node.js + Express + WebSocket simulator per fight di Age of Empires 4.

## Features

- Engine di simulazione fight 2D semplificata (melee/ranged, range, cooldown, chaos).
- Strategie:
  - `straight`
  - `kiting` (solo ranged)
  - `focus_fire` (target class priority)
- Ambienti:
  - `open`
  - `natural` (ostacoli)
  - `tower`, `castle`, `tc` (strutture garrisonate che sparano)
- Dati da `aoe4data` (`github:aoe4world/data`) con refresh runtime.
- UI dark con:
  - Battlefield 2D live (icone unità + HP bars)
  - Legenda live per team (icona + nome + vivi)
  - Grafico risorse in tempo reale
  - Monte Carlo mode con grafici winrate e trade ratio
- Preset iniziale automatico e modificabile.

## Requisiti

- Node.js 20+
- npm 10+

## Installazione

```bash
npm install
npm install github:aoe4world/data
```

## Avvio

```bash
npm run dev
```

Server default: `http://localhost:3000`

## Utilizzo UI

1. Scegli civiltà e età per Team A e Team B.
2. Aggiungi unità dal selector (il selector mostra solo unità valide per la civ/età scelte).
3. Scegli formazione, strategia e ambiente.
4. Click `Start Simulation` per singolo fight live via WebSocket.
5. Click `Run Monte Carlo` per N run aggregate (campo `Monte Carlo Runs`).
6. `Load Preset` ricarica un setup iniziale veloce, poi puoi modificarlo liberamente.

## Nota su unità civ-specifiche

Le unità sono filtrate per civiltà/età; unità base possono essere sostituite da varianti civ-specifiche (esempio classico: English con `longbowman` al posto dell'arciere base). Per questo il picker UI è sempre il riferimento corretto.

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

## Esempio payload start

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

Eventi server:

- `ws:ready`
- `sim:start`
- `sim:tick`
- `sim:end`
- `sim:error`

## Config

Parametri principali in `config.js`:

- `tickDelta`
- `maxTicks`
- `wsBatchSize`
- `chaosFactor`
- `mapWidth` / `mapHeight`

## Troubleshooting

- Se la simulazione non parte: controlla che entrambi i team abbiano almeno una unità valida.
- Se mancano icone: verifica route statica `/data/images/units/*` e presenza `node_modules/aoe4data/images/units`.
- Dopo update dati: usa `POST /api/data/refresh`.
