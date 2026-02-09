# DJ Decks Monitor (Prime 4+ / StageLinq)

Local web UI that visualizes everything happening on the DJ decks.

## Features
- 4 decks (2×2 layout)
- Title + artist
- Elapsed / total time
- Camelot key
- BPM (absolute + relative %)
- Channel fader (volume)
- 30 Hz updates via WebSocket
- Runs entirely on local network

## Requirements
- Node.js 18+
- Prime 4+ in standalone mode
- Same LAN

## Run (development)
```bash
npm install
npm run dev
```

- Backend: http://localhost:8090/
- Frontend: http://localhost:5173/

## Production (single server)

```bash
npm install
npm run build
npm start
```

Open: http://<pc-ip>:8090

