import React from 'react';
import { DynamicIsland } from './components/DynamicIsland.tsx';

export function App() {
  return (
    <main className="w-full h-full flex flex-col items-center justify-start bg-transparent select-none">
      <DynamicIsland />
    </main>
  );
}

export default App;
