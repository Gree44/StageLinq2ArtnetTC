// dump_all.js
const pkg = require("stagelinq");
const StageLinq = pkg.StageLinq ?? pkg.default;

function safeJson(x) {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function previewValue(json) {
  if (json == null) return "null";

  // Most StateMap messages have a shape like { value: ... } or similar
  if (typeof json === "object") {
    if ("value" in json) return json.value;
    if ("state" in json) return json.state;
    if ("number" in json) return json.number;
    if ("string" in json) return json.string;
    if ("text" in json) return json.text;
    if ("bool" in json) return json.bool;
    if ("bpm" in json) return json.bpm;
    // fallback
    return json;
  }
  return json;
}

function stamp() {
  const d = new Date();
  return d.toISOString();
}

// High-level device lifecycle
StageLinq.devices.on("connected", (info) => {
  console.log(`[${stamp()}] DEVICE CONNECTED:`, info?.address, info?.software?.name || "");
});
StageLinq.devices.on("ready", () => console.log(`[${stamp()}] READY`));
StageLinq.devices.on("disconnected", (info) => {
  console.log(`[${stamp()}] DEVICE DISCONNECTED:`, info?.address, info?.software?.name || "");
});
StageLinq.devices.on("error", (e) => {
  console.log(`[${stamp()}] ERROR:`, e?.message || e);
});

// Player-level (what you already saw)
StageLinq.devices.on("nowPlaying", (np) => {
  console.log(`[${stamp()}] NOW PLAYING:`, np?.title || "");
  console.log(`[${stamp()}] nowPlaying full:`, safeJson(np));
});

// RAW message dump
let count = 0;
StageLinq.devices.on("message", (info, data) => {
  count++;

  // The exact payload structure varies a bit; handle common shapes.
  // In this repo, "data.message" is usually present for StateMap updates.
  const msg = data?.message ?? data;
  const name = msg?.name ?? msg?.path ?? msg?.key ?? "(no-name)";
  const json = msg?.json ?? msg?.value ?? msg;
  const val = previewValue(json);

  // Print an index so you can see if you're getting a lot
  console.log(`\n#${count} [${stamp()}] from ${info?.address || "?"}:${info?.port || "?"}`);
  console.log(`name: ${name}`);

  // Print a compact value preview first
  if (typeof val === "object") {
    console.log("value (preview):", safeJson(val).slice(0, 5000));
  } else {
    console.log("value (preview):", val);
  }

  // Then print the entire message object (can be huge)
  console.log("raw:", safeJson(data).slice(0, 10000));
});

(async () => {
  console.log("Connecting…");
  await StageLinq.connect();
  console.log("Dumping everything. Press Ctrl+C to stop.");
})();
