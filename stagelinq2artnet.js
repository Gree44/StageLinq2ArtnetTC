/**
 * StageLinq (Prime 4+) Deck 1 -> Art-Net Timecode (ArtTimeCode / OpCode 0x9700)
 * FPS: 30 (SMPTE 30)
 *
 * Prereqs:
 *   - Your stagelinq build must emit `beatMessage` (BeatInfo connected)
 *   - Your StateMap subscription must include /Engine/Deck1/Track/SampleRate
 *
 * Install:
 *   npm i stagelinq
 *
 * Run:
 *   node deck1_to_artnet_timecode.js
 */

const dgram = require("dgram");
const pkg = require("@gree44/stagelinq");
const StageLinq = pkg.StageLinq ?? pkg.default;

const ARTNET_PORT = 6454;
const TARGET_IP = "255.255.255.255"; // broadcast; set to specific node IP if preferred

const FPS = 30;
const FPS_TYPE = 0x03; // 0x00=24, 0x01=25, 0x02=29.97, 0x03=30

// Deck selection:
// Engine Deck1 == BeatInfo deckIdx 0 (most common mapping)
const ENGINE_DECK_NUM = 1;        // 1..4
const BEAT_DECK_IDX = ENGINE_DECK_NUM - 1; // 0..3

// Send policy
const SEND_EVERY_FRAME = true; // true = send each frame; false = only when timecode changes
const MAX_JUMP_FRAMES = 60;    // if the deck jumps (seek), allow jump, but avoid spam loops

// ---- Art-Net socket ----
const socket = dgram.createSocket("udp4");
socket.bind(() => {
  socket.setBroadcast(true);
  console.log(`Art-Net Timecode: broadcasting to ${TARGET_IP}:${ARTNET_PORT} @ ${FPS}fps (Deck${ENGINE_DECK_NUM})`);
});

// ---- ArtTimeCode packet builder ----
function buildArtNetTimecode(hours, minutes, seconds, frames) {
  const buffer = Buffer.alloc(19);
  buffer.write("Art-Net\0", 0, 8, "ascii"); // ID
  buffer.writeUInt16LE(0x9700, 8);          // OpCode ArtTimeCode
  buffer.writeUInt16BE(14, 10);             // ProtVer (hi, lo) = 14

  // Note ordering per ArtTimeCode definition:
  buffer[14] = frames & 0xff;
  buffer[15] = seconds & 0xff;
  buffer[16] = minutes & 0xff;
  buffer[17] = hours & 0xff;
  buffer[18] = FPS_TYPE & 0xff;

  return buffer;
}

function framesToHMSF(totalFrames) {
  const frames = ((totalFrames % FPS) + FPS) % FPS;

  const totalSeconds = Math.floor(totalFrames / FPS);
  const seconds = ((totalSeconds % 60) + 60) % 60;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = ((totalMinutes % 60) + 60) % 60;

  const hours = ((Math.floor(totalMinutes / 60) % 24) + 24) % 24;

  return { hours, minutes, seconds, frames };
}

function tcString(tc) {
  return (
    String(tc.hours).padStart(2, "0") + ":" +
    String(tc.minutes).padStart(2, "0") + ":" +
    String(tc.seconds).padStart(2, "0") + ":" +
    String(tc.frames).padStart(2, "0")
  );
}

// ---- StageLinq state ----
let sampleRateHz = null;      // for Deck1
let latestSamples = null;     // from BeatInfo for deckIdx
let latestBpm = null;

let lastSentFrame = null;     // integer totalFrames
let lastLoggedSec = -1;

// SampleRate (StateMap)
StageLinq.devices.on("message", (_info, data) => {
  const msg = data?.message;
  if (!msg?.name || !msg?.json) return;

  // Only Deck1 (Engine Deck1/Track/SampleRate)
  const expected = `/Engine/Deck${ENGINE_DECK_NUM}/Track/SampleRate`;
  if (msg.name !== expected) return;

  const sr = Number(msg.json.value);
  if (Number.isFinite(sr) && sr > 0) {
    sampleRateHz = sr;
    console.log(`SampleRate Deck${ENGINE_DECK_NUM}: ${sampleRateHz} Hz`);
  }
});

// BeatInfo (after you patch stagelinq to connect BeatInfo + re-emit beatMessage)
StageLinq.devices.on("beatMessage", (_info, beat) => {
  const d = beat?.decks?.[BEAT_DECK_IDX];
  if (!d) return;

  if (typeof d.samples === "number") latestSamples = d.samples;
  if (typeof d.bpm === "number") latestBpm = d.bpm;
});

// Lifecycle / logging
StageLinq.devices.on("connected", (info) => {
  console.log("DEVICE CONNECTED:", info?.address, info?.software?.name || "");
});
StageLinq.devices.on("ready", () => console.log("READY"));
StageLinq.devices.on("error", (e) => console.error("StageLinq error:", e?.message || e));

// ---- Timecode send loop (paced to 30fps) ----
const FRAME_NS = BigInt(Math.round(1e9 / FPS));
let startNs = process.hrtime.bigint();

function sendLoop() {
  const now = process.hrtime.bigint();

  // Align to a 30fps ticker so we don't spam UDP
  const elapsedFrames = Number((now - startNs) / FRAME_NS);
  const nextTickNs = startNs + BigInt(elapsedFrames + 1) * FRAME_NS;

  if (latestSamples != null && sampleRateHz != null) {
    const seconds = latestSamples / sampleRateHz;
    const totalFrames = Math.floor(seconds * FPS);

    const jump = lastSentFrame == null ? 0 : Math.abs(totalFrames - lastSentFrame);
    const shouldSend =
      SEND_EVERY_FRAME
        ? (lastSentFrame == null || totalFrames !== lastSentFrame)
        : (lastSentFrame == null || totalFrames !== lastSentFrame);

    if (shouldSend) {
      // Basic jump guard (seeks are fine; this just avoids pathological loops)
      if (jump <= MAX_JUMP_FRAMES || lastSentFrame == null) {
        const tc = framesToHMSF(totalFrames);

        // Log once per second based on deck time
        const deckSec = Math.floor(seconds);
        if (deckSec !== lastLoggedSec) {
          lastLoggedSec = deckSec;
          const bpmStr = (latestBpm != null) ? latestBpm.toFixed(2) : "n/a";
          console.log(`${tcString(tc)}  (deck=${seconds.toFixed(3)}s, bpm=${bpmStr})`);
        }

        const pkt = buildArtNetTimecode(tc.hours, tc.minutes, tc.seconds, tc.frames);
        socket.send(pkt, 0, pkt.length, ARTNET_PORT, TARGET_IP);
        lastSentFrame = totalFrames;
      } else {
        // If jump is huge (e.g., you loaded a new track), just accept new position
        lastSentFrame = totalFrames;
      }
    }
  }

  // Schedule next frame tick
  const delayMs = Number((nextTickNs - process.hrtime.bigint()) / 1000000n);
  setTimeout(sendLoop, Math.max(0, delayMs));
}

// ---- Start ----
(async () => {
  console.log("Connecting StageLinq…");
  await StageLinq.connect();

  console.log("Waiting for samples + sampleRate… (press PLAY on Deck 1)");
  sendLoop();
})().catch((e) => {
  console.error("Fatal:", e?.message || e);
  process.exit(1);
});

// Clean exit
process.on("SIGINT", () => {
  console.log("\nStopping…");
  try { socket.close(); } catch {}
  process.exit(0);
});
