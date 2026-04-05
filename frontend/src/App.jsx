import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'
// Předpokládám, že tvůj hlavní CSS soubor s designem tlačítek (style.css) 
// je buď importovaný v main.jsx, nebo tady. 

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
// Socket inicializujeme mimo komponentu, aby se neresetoval při každém překreslení
const socket = io(backendUrl, { autoConnect: false });

function App() {
  const [isConnected, setIsConnected] = useState(false);
  
  // 1. Načtení dat z Local Storage (nebo výchozí hodnoty)
  const [nickname, setNickname] = useState(() => localStorage.getItem('qc_nickname') || '');
  const [color, setColor] = useState(() => localStorage.getItem('qc_color') || '#ffffff');
  const [cosmetics, setCosmetics] = useState(() => localStorage.getItem('qc_cosmetics') || 'none');
  
  // 2. Stavy pro samotnou hru
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentView, setCurrentView] = useState('menu'); // 'menu', 'lobby', 'game'

  // Automatické ukládání do LocalStorage při jakékoliv změně
  useEffect(() => {
    localStorage.setItem('qc_nickname', nickname);
    localStorage.setItem('qc_color', color);
    localStorage.setItem('qc_cosmetics', cosmetics);
  }, [nickname, color, cosmetics]);

  // Nastavení Socket.io po načtení aplikace
  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Připojeno k serveru:', socket.id);
      
      // Pokud potřebuješ přístup k socketu ze starých vanilla JS souborů (např. game.js)
      window.gameSocket = socket; 
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  // Handler pro Vytvoření hry
  const handleCreateRoom = () => {
    if (!nickname.trim()) {
      setErrorMsg('Prosím, zadej nejdřív svou přezdívku!');
      return;
    }
    setErrorMsg('');
    
    const playerData = { name: nickname, color, cosmetics };
    console.log('Vytvářím místnost s daty:', playerData);
    
    // Odeslání na server
    socket.emit('createRoom', playerData);
    
    // Přepnutí obrazovky na Lobby
    setCurrentView('lobby');
  };

  // Handler pro Připojení do hry
  const handleJoinRoom = () => {
    if (!nickname.trim()) {
      setErrorMsg('Prosím, zadej nejdřív svou přezdívku!');
      return;
    }
    if (!roomCodeInput.trim()) {
      setErrorMsg('Prosím, zadej kód místnosti!');
      return;
    }
    setErrorMsg('');

    const playerData = { 
      name: nickname, 
      color, 
      cosmetics, 
      roomCode: roomCodeInput.toUpperCase() 
    };
    console.log('Připojuji do místnosti:', playerData);
    
    // Odeslání na server
    socket.emit('joinRoom', playerData);
    
    // Přepnutí obrazovky na Lobby
    setCurrentView('lobby');
  };

  return (
    <div className="App">
      {/* Hlavní Menu */}
      {currentView === 'menu' && (
        <div id="mainMenuUI" className="overlay">
          <h1 className="game-title">Quantum Clash</h1>
          
          <div className="panel">
            <p style={{ color: isConnected ? '#4ade80' : '#f43f5e', fontWeight: 'bold', margin: '0 0 15px 0' }}>
              Stav serveru: {isConnected ? '🟢 Online' : '🔴 Offline'}
            </p>

            <div className="input-group">
              <label>Tvoje přezdívka:</label>
              <input 
                type="text" 
                value={nickname} 
                onChange={(e) => setNickname(e.target.value)} 
                placeholder="Napiš jméno..." 
                maxLength="12" 
                style={{ textAlign: 'center' }}
              />
            </div>

            <div className="input-group">
              <label>Základní barva postavy:</label>
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                style={{ cursor: 'pointer' }}
              />
            </div>

            <div className="input-group">
              <label>Kosmetika:</label>
              <select 
                value={cosmetics} 
                onChange={(e) => setCosmetics(e.target.value)}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <option value="none">Bez kosmetiky</option>
                <option value="crown">👑 Zlatá Koruna</option>
                <option value="halo">👼 Andělská svatozář</option>
                <option value="horns">👿 Démonské rohy</option>
                <option value="cat_ears">🐱 Kočičí uši</option>
                <option value="wizard_hat">🧙‍♂️ Čarodějův klobouk</option>
                <option value="sunglasses">🕶️ Sluneční brýle</option>
                <option value="ninja_headband">🥷 Ninja čelenka</option>
                <option value="top_hat">🎩 Elegantní cylindr</option>
                <option value="flower">🌸 Květina do vlasů</option>
                <option value="mohawk">🎸 Ohnivé číro</option>
              </select>
            </div>

            <button onClick={handleCreateRoom} className="menu-btn">Vytvořit novou hru</button>

            <div className="join-box" style={{ marginTop: '20px' }}>
              <div className="input-group" style={{ marginBottom: '10px' }}>
                <label style={{ textAlign: 'center', color: 'white', fontSize: '1.2rem' }}>Připojit se ke hře</label>
                <input 
                  type="text" 
                  value={roomCodeInput} 
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} 
                  placeholder="Zadej kód (např. A7K9)" 
                  maxLength="4" 
                  style={{ textTransform: 'uppercase', textAlign: 'center', letterSpacing: '2px' }}
                />
              </div>
              <button onClick={handleJoinRoom} className="menu-btn action-join">Připojit</button>
            </div>

            {/* Zobrazení chybové hlášky */}
            <p style={{ color: 'var(--neon-pink)', marginTop: '15px', fontWeight: 'bold', minHeight: '20px' }}>
              {errorMsg}
            </p>
          </div>
        </div>
      )}

      {/* Lobby - zatím jen příprava, později sem doděláme výběr týmů a nastavení hry */}
      {currentView === 'lobby' && (
        <div id="lobbyUI" className="overlay">
          <div className="panel" style={{ minWidth: '400px' }}>
            <h1 className="game-title" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Lobby</h1>
            <p style={{ color: 'white' }}>Zatím jsi v čekárně...</p>
            <button onClick={() => setCurrentView('menu')} className="menu-btn" style={{ marginTop: '20px' }}>Zpět do menu</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App