import { useEffect, useState } from 'react';
import DeckCard from './DeckCard.jsx';

export default function App() {
  const [state, setState] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onmessage = (e) => setState(JSON.parse(e.data).payload);
    return () => ws.close();
  }, []);

  if (!state) return null;

  return (
    <div className="grid">
      {[1,2,3,4].map(n => (
        <DeckCard
          key={n}
          deck={n}
          data={state.decks[n]}
          faderSide={n === 1 || n === 3 ? 'right' : 'left'}
        />
      ))}
    </div>
  );
}
