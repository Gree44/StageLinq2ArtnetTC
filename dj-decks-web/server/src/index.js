const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const pkg = require('@gree44/stagelinq');
const StageLinq = pkg.StageLinq ?? pkg.default;

const PORT = 8090;
const WS_PATH = '/ws';

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: WS_PATH });

function emptyDeck(id) {
  return {
    id,
    title: '',
    artist: '',
    keyCamelot: '',
    bpmTrack: null,
    bpmAbs: null,
    bpmRelPercent: null,
    elapsedSec: 0,
    durationSec: null,
    fader: null
  };
}

const state = {
  connected: false,
  decks: {
    1: emptyDeck(1),
    2: emptyDeck(2),
    3: emptyDeck(3),
    4: emptyDeck(4)
  }
};

function broadcast() {
  const msg = JSON.stringify({ type: 'tick', payload: state });
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  }
}

setInterval(broadcast, 1000 / 30);

// ---- StageLinq ----
StageLinq.devices.on('ready', () => {
  console.log('StageLinq ready');
  state.connected = true;
});

StageLinq.devices.on('nowPlaying', (s) => {
  const d = state.decks[s.deck];
  if (!d) return;
  d.title = s.title ?? '';
  d.artist = s.artist ?? '';
  d.keyCamelot = s.key ?? '';
  d.bpmTrack = typeof s.bpm === 'number' ? s.bpm : d.bpmTrack;
  d.durationSec = typeof s.duration === 'number' ? s.duration : d.durationSec;
});

StageLinq.devices.on('beatMessage', (_, beat) => {
  beat.decks.forEach((b, i) => {
    const d = state.decks[i + 1];
    if (!d) return;
    d.bpmAbs = b.bpm;
    d.elapsedSec = b.timeline;
    if (d.bpmAbs && d.bpmTrack) {
      d.bpmRelPercent = ((d.bpmAbs - d.bpmTrack) / d.bpmTrack) * 100;
    }
  });
});

// Channel faders
[1, 2, 3, 4].forEach((n) => {
  StageLinq.devices.on(`/Engine/Deck${n}/ExternalMixerVolume`, (v) => {
    state.decks[n].fader = Math.max(0, Math.min(1, Number(v)));
  });
});

app.get('/api/state', (_, res) => res.json(state));

server.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  await StageLinq.connect();
});
