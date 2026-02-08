// probe.js
const pkg = require("stagelinq");

// depending on how your build exports it, pick one:
const StageLinq = pkg.StageLinq ?? pkg.default;

const TIME_FILTER = /pos|position|time|elapsed|playhead|remain|remaining|dur|duration/i;
const SHOW_ALL = false;

StageLinq.devices.on("connected", (info) => {
  console.log("DEVICE CONNECTED:", info?.address, info?.software?.name || "");
});

StageLinq.devices.on("ready", () => {
  console.log("READY");
});

StageLinq.devices.on("stateChanged", (s) => {
  const key = (s.name || s.key || s.path || s.id || "").toString();
  if (SHOW_ALL || TIME_FILTER.test(key)) {
    console.log(`STATE: ${key} =`, s.value);
  }
});

StageLinq.devices.on("nowPlaying", (np) => {
  console.log("NOW PLAYING:", np?.title || "");
  console.log("Full nowPlaying data:", np);
});

StageLinq.devices.on("message", (info, data) => {
  // uncomment if you want raw traffic (noisy)
  console.log("MESSAGE:", info, data);
});

(async () => {
  console.log("Connecting…");
  await StageLinq.connect();
  console.log("Listening. Start playback on the Prime 4+.");
})();

// add this to probe.js
StageLinq.devices.on("beatMessage", (b) => {
  // b.timeline is seconds
  console.log(`BEAT deck=${b.deck} bpm=${b.bpm.toFixed(2)} timeline=${b.timeline.toFixed(3)}`);
});
