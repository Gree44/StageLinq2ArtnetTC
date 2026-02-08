const pkg = require("stagelinq");
const StageLinq = pkg.StageLinq ?? pkg.default;

const sampleRateByDeckNum = new Map(); // key: 1..4 (Deck1..Deck4)

function fmt(n, digits = 3) {
  if (!Number.isFinite(n)) return "NaN";
  return n.toFixed(digits);
}

StageLinq.devices.on("message", (_info, data) => {
  const msg = data?.message;
  if (!msg?.name || !msg?.json) return;

  if (/^\/Engine\/Deck\d\/Track\/SampleRate$/.test(msg.name)) {
    const deckNum = parseInt(msg.name.split("/")[2].replace("Deck", ""), 10); // 1..4
    const sr = Number(msg.json.value);
    if (Number.isFinite(sr) && sr > 0) {
      sampleRateByDeckNum.set(deckNum, sr);
      console.log(`SampleRate Deck${deckNum} = ${sr} Hz`);
    } else {
      console.log(`SampleRate Deck${deckNum} =`, msg.json);
    }
  }
});

StageLinq.devices.on("beatMessage", (_info, beat) => {
  // BeatInfo: deckIdx 0..3
  const deckIdx = 0; // follow deck 0 as you requested
  const d = beat?.decks?.[deckIdx];
  if (!d || typeof d.samples !== "number") return;

  const deckNum = deckIdx + 1; // map BeatInfo deckIdx -> Engine Deck#
  const sr = sampleRateByDeckNum.get(deckNum);

  // If we don't know sample rate yet, still print raw samples
  if (!sr) {
    console.log(
      `BeatInfo deckIdx=${deckIdx} bpm=${fmt(d.bpm, 2)} samples=${Math.round(d.samples)} (no SampleRate for Deck${deckNum} yet)`
    );
    return;
  }

  const seconds = d.samples / sr;
  const ms = seconds * 1000;

  console.log(
    `BeatInfo deckIdx=${deckIdx} (Deck${deckNum}) bpm=${fmt(d.bpm, 2)} samples=${d.samples}` +
      ` -> t=${fmt(seconds, 3)}s (${fmt(ms, 1)}ms) @ ${sr}Hz`
  );
});

StageLinq.devices.on("connected", (info) => {
  console.log("DEVICE CONNECTED:", info?.address, info?.software?.name || "");
});

StageLinq.devices.on("ready", () => console.log("READY"));

StageLinq.devices.on("error", (e) => {
  console.error("StageLinq error:", e?.message || e);
});

(async () => {
  console.log("Connecting…");
  await StageLinq.connect();
  console.log("Listening… press PLAY on deck A (deckIdx 0).");
})();
