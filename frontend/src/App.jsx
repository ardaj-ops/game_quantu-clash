import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

// Připojení k backendu (při lokálním vývoji běží backend na portu 3000)
const socket = import.meta.env.DEV ? io('http://localhost:3000') : io();

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Připojeno k serveru:', socket.id);
      
      // Zde můžeš propojit socket s tvým starým game.js
      // Např. window.gameSocket = socket;
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const createRoom = () => {
    socket.emit('createRoom', { name: "Hráč 1", color: "#ff0000" });
  };

  return (
    <div className="App">
      <h1>Moje epická hra</h1>
      <p>Stav serveru: {isConnected ? '🟢 Online' : '🔴 Offline'}</p>
      
      <button onClick={createRoom}>Vytvořit místnost</button>
      
      {/* Tady časem přidáš input pro připojení pomocí kódu, výběr barev atd. */}
    </div>
  )
}

export default App