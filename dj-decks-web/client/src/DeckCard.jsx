export default function DeckCard({ deck, data, faderSide }) {
  const fader = Math.round((data.fader ?? 0) * 100);

  return (
    <div className={`deck deck-${deck}`}>
      <h2>{data.title || '—'}</h2>
      <h3>{data.artist || '—'}</h3>
      <div>{data.elapsedSec?.toFixed(0)} / {data.durationSec ?? '--'} sec</div>
      <div>Key: {data.keyCamelot || '—'}</div>
      <div>BPM: {data.bpmAbs?.toFixed(2)} ({data.bpmRelPercent?.toFixed(1)}%)</div>
      <div className={`fader ${faderSide}`}>{fader}%</div>
      <div className="waveform">Waveform placeholder</div>
    </div>
  );
}
