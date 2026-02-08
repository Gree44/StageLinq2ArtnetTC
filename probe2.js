// probe_statemap_position.js
const pkg = require("stagelinq");
const StageLinq = pkg.StageLinq ?? pkg.default;

// Things that often contain playhead/position info
const POS_FILTER = /pos|position|play|elapsed|time|tick|beat|sample|frame/i;

StageLinq.devices.on("connected", (info) => {
  console.log("DEVICE CONNECTED:", info?.address, info?.software?.name || "");
});

StageLinq.devices.on("ready", () => console.log("READY"));

StageLinq.devices.on("message", (info, data) => {
  const m = data?.message;
  if (!m?.name || !m?.json) return;

  const name = m.name;

  // Narrow to Engine Deck states (skip mixer/ui noise)
  if (!/^\/Engine\/Deck\d\//.test(name)) return;
  if (!POS_FILTER.test(name)) return;

  // m.json varies by state type; print a compact value
  const j = m.json;
  const v =
    j.value ?? j.state ?? j.string ?? j.color ?? j.number ?? j;

  console.log(name, "=>", v);
});

(async () => {
  console.log("Connecting…");
  await StageLinq.connect();
  console.log("Listening. Start playback and SEEK a bit.");
})();
