const fs = require("fs");
const pkg = require("@gree44/stagelinq");
const StageLinq = pkg.StageLinq ?? pkg.default;

const { LTCEncoder, LTC_USE_DATE } = require("libltc-wrapper");

const FPS = 30;
const SAMPLE_RATE = 48000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 8; // libltc-wrapper buffer is u8 PCM
const OUT_FILE = "prime_ltc_30fps_60s.wav";

// Which deck to follow (0..3). Your nowPlaying showed deck '1A' which is typically deck 0.
const FOLLOW_DECK = 1;

// Capture length in real seconds
const DURATION_SECONDS = 60;

// ---- WAV helper ----
function writeWavHeader(fd, dataBytes) {
  const byteRate = SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);

  fs.writeSync(fd, header, 0, header.length, 0);
}

function tcToString(tc) {
  const hh = String(tc.hours).padStart(2, "0");
  const mm = String(tc.minutes).padStart(2, "0");
  const ss = String(tc.seconds).padStart(2, "0");
  const ff = String(Math.floor(tc.frame)).padStart(2, "0");
  return `${hh}:${mm}:${ss}:${ff}`;
}

// Prime timeline seconds -> {hours,minutes,seconds,frame} at 30fps
function timelineSecToTC(tSec) {
  const clamped = Math.max(0, Number(tSec) || 0);
  const totalFrames = Math.floor(clamped * FPS);

  const frame = totalFrames % FPS;

  const totalSeconds = Math.floor(totalFrames / FPS);
  const seconds = totalSeconds % 60;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;

  const hours = Math.floor(totalMinutes / 60) % 24;

  return { hours, minutes, seconds, frame };
}

function waitForConnected(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      StageLinq.devices.off("connected", onConn);
      reject(new Error("Timeout waiting for device connected"));
    }, timeoutMs);

    const onConn = (info) => {
      clearTimeout(t);
      StageLinq.devices.off("connected", onConn);
      resolve(info);
    };

    StageLinq.devices.on("connected", onConn);
  });
}

// ---- StageLinq state we care about ----
let latestTimeline = 0;
let haveTimeline = false;

StageLinq.devices.on("beatMessage", (b) => {
  // BeatInfo messages include timeline seconds in this library
  if (b.deck !== FOLLOW_DECK) return;
  latestTimeline = b.timeline;
  haveTimeline = true;
});

StageLinq.devices.on("error", (e) => {
  console.error("StageLinq error:", e?.message || e);
});

// ---- Main ----
(async () => {
  console.log("Connecting…");

  const connectedPromise = waitForConnected(30000);
  await StageLinq.connect();

  console.log("Waiting for DEVICE CONNECTED…");
  const info = await connectedPromise;
  console.log("DEVICE CONNECTED:", info?.address, info?.software?.name || "");

  console.log(`Waiting for BeatInfo timeline on deck ${FOLLOW_DECK}… (press PLAY on that deck)`);
  const startWait = Date.now();
  while (!haveTimeline) {
    if (Date.now() - startWait > 15000) {
      throw new Error("No beatMessage timeline received (15s). Start playback and ensure correct FOLLOW_DECK.");
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  // libltc-wrapper outputs one audio buffer per LTC frame via encodeFrame/getBuffer.
  const samplesPerFrame = Math.floor(SAMPLE_RATE / FPS);
  const bytesPerFrame = samplesPerFrame * CHANNELS * (BITS_PER_SAMPLE / 8);

  const totalFramesToWrite = DURATION_SECONDS * FPS;
  const dataBytes = totalFramesToWrite * bytesPerFrame;

  const fd = fs.openSync(OUT_FILE, "w");
  writeWavHeader(fd, dataBytes);

  const enc = new LTCEncoder(SAMPLE_RATE, FPS, LTC_USE_DATE);
  enc.setVolume(-6);

  console.log(`Recording ${DURATION_SECONDS}s LTC (30fps) from Prime timeline -> ${OUT_FILE}`);
  console.log("Printing timecode once per second.\n");

  let offset = 44;
  let lastPrintedSecond = -1;

  // Real-time paced loop: 30 fps for 60 seconds wall-clock
  const t0 = process.hrtime.bigint();

  for (let n = 0; n < totalFramesToWrite; n++) {
    // target time for this frame
    const targetNs = t0 + BigInt(Math.round((n * 1e9) / FPS));

    // wait until it's time to emit this frame
    while (process.hrtime.bigint() < targetNs) {
      // short sleep to avoid busy-spinning
      await new Promise((r) => setTimeout(r, 0));
    }

    // Map Prime timeline -> timecode for this frame
    const tc = timelineSecToTC(latestTimeline);
    enc.setTimecode(tc);

    // encode this LTC frame's audio and write it
    enc.encodeFrame();
    const buf = enc.getBuffer();
    fs.writeSync(fd, buf, 0, buf.length, offset);
    offset += buf.length;

    // print once per second (based on Prime timeline seconds)
    const primeSec = Math.floor(latestTimeline);
    if (primeSec !== lastPrintedSecond) {
      lastPrintedSecond = primeSec;
      console.log(`${tcToString(tc)}  (prime timeline ~${latestTimeline.toFixed(3)}s)`);
    }
  }

  fs.closeSync(fd);
  console.log("\nDone. Wrote:", OUT_FILE);
  process.exit(0);
})().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
