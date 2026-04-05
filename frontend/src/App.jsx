import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css'; 

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
// Socket inicializujeme mimo komponentu
const socket = io(backendUrl, { autoConnect: false });

function App() {
  const [isConnected, setIsConnected] = useState(false);
  
  // 1. Načtení dat z Local Storage
  const [nickname, setNickname] = useState(() => localStorage.getItem('qc_nickname') || '');
  const [color, setColor] = useState(() => localStorage.getItem('qc_color') || '#ffffff');
  const [cosmetics, setCosmetics] = useState(() => localStorage.getItem('qc_cosmetics') || 'none');
  
  // 2. Stavy pro samotnou hru
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentView, setCurrentView] = useState('menu'); // 'menu', 'lobby', 'game'

  // --- STAVY PRO LOBBY ---
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // Stav pro zobrazení hlášky "Zkopírováno"
  const [copied, setCopied] = useState(false);

  // --- STAVY PRO NASTAVENÍ HRY ---
  const [gameSettings, setGameSettings] = useState({
      gameMode: 'FFA',      // 'FFA' nebo 'TDM'
      maxRounds: 5,         // Výchozí počet kol
      gravityTwist: false   // Měnící se gravitace zap/vyp
  });

  // Automatické ukládání postavy do LocalStorage
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
      window.gameSocket = socket; 
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listenery pro Lobby
    socket.on('roomCreated', (data) => {
      setRoomCode(data.code);
      setIsHost(data.isHost);
      setCurrentView('lobby');
      // Reset nastavení při vytvoření nové hry
      setGameSettings({ gameMode: 'FFA', maxRounds: 5, gravityTwist: false });
    });

    socket.on('roomJoined', (data) => {
      setRoomCode(data.code);
      setIsHost(data.isHost);
      setCurrentView('lobby');
    });

    socket.on('lobbyUpdated', (data) => {
      setPlayers(data.players);
      if (data.players[socket.id]) {
          setIsReady(data.players[socket.id].isReady);
      }
    });

    // Listener pro aktualizaci nastavení od Hosta
    socket.on('settingsUpdated', (newSettings) => {
        setGameSettings(newSettings);
    });

    socket.on('errorMsg', (msg) => {
      setErrorMsg(msg);
      if (currentView === 'lobby') setCurrentView('menu');
    });

    socket.on('gameStateChanged', (data) => {
        if (data.state === 'PLAYING') {
            setCurrentView('game');
        } else if (data.state === 'LOBBY') {
            setCurrentView('lobby');
            setIsReady(false);
        }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('lobbyUpdated');
      socket.off('settingsUpdated');
      socket.off('errorMsg');
      socket.off('gameStateChanged');
    };
  }, [currentView]);

  // Handler pro Vytvoření hry
  const handleCreateRoom = () => {
    if (!nickname.trim()) {
      setErrorMsg('Prosím, zadej nejdřív svou přezdívku!');
      return;
    }
    setErrorMsg('');
    const playerData = { name: nickname, color, cosmetics };
    socket.emit('createRoom', playerData);
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
    const playerData = { name: nickname, color, cosmetics, code: roomCodeInput.toUpperCase() };
    socket.emit('joinRoom', playerData);
  };

  // Handler pro přepínání připravenosti
  const toggleReady = () => {
      const newStatus = !isReady;
      setIsReady(newStatus);
      socket.emit('toggleReady', newStatus);
  };

  // Handler pro změnu nastavení (pouze Host)
  const handleSettingChange = (key, value) => {
      if (!isHost) return; 
      
      const newSettings = { ...gameSettings, [key]: value };
      setGameSettings(newSettings); 
      socket.emit('updateSettings', newSettings);
  };

  // Handler pro zkopírování kódu
  const copyToClipboard = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
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
                type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} 
                placeholder="Napiš jméno..." maxLength="12" style={{ textAlign: 'center' }}
              />
            </div>

            <div className="input-group">
              <label>Základní barva postavy:</label>
              <input 
                type="color" value={color} onChange={(e) => setColor(e.target.value)} 
                style={{ cursor: 'pointer' }}
              />
            </div>

            <div className="input-group">
              <label>Kosmetika:</label>
              <select 
                value={cosmetics} onChange={(e) => setCosmetics(e.target.value)}
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
                  type="text" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} 
                  placeholder="Zadej kód (např. A7K9)" maxLength="4" 
                  style={{ textTransform: 'uppercase', textAlign: 'center', letterSpacing: '2px' }}
                />
              </div>
              <button onClick={handleJoinRoom} className="menu-btn action-join">Připojit</button>
            </div>

            {errorMsg && (
                <p style={{ color: 'var(--neon-pink)', marginTop: '15px', fontWeight: 'bold', minHeight: '20px' }}>
                {errorMsg}
                </p>
            )}
          </div>
        </div>
      )}

      {/* Lobby View */}
      {currentView === 'lobby' && (
        <div id="lobbyUI" className="overlay">
          <div className="panel" style={{ minWidth: '450px' }}>
            <h1 className="game-title" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Lobby</h1>
            
            <h2 style={{ color: 'white', letterSpacing: '2px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Kód: 
              <span 
                onClick={copyToClipboard}
                title="Klikni pro zkopírování do schránky"
                style={{ 
                  color: 'var(--neon-blue)', 
                  fontSize: '1.5em', 
                  marginLeft: '10px',
                  cursor: 'pointer',
                  borderBottom: '2px dashed var(--neon-blue)',
                  paddingBottom: '2px'
                }}
              >
                {roomCode}
              </span>
              {copied && (
                <span style={{ 
                  color: 'var(--neon-green)', 
                  fontSize: '0.6em', 
                  marginLeft: '15px'
                }}>
                  Zkopírováno! ✓
                </span>
              )}
            </h2>

            {/* PANEL NASTAVENÍ HRY */}
            <div className="settings-panel" style={{ background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'left' }}>
              <h3 style={{ color: 'var(--neon-blue)', marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                Nastavení hry {isHost ? '👑' : '🔒'}
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ color: 'white' }}>Herní mód:</label>
                  <select 
                      value={gameSettings.gameMode} 
                      onChange={(e) => handleSettingChange('gameMode', e.target.value)}
                      disabled={!isHost}
                      style={{ 
                        background: isHost ? '#222' : 'transparent', 
                        color: 'white', 
                        border: isHost ? '1px solid var(--neon-blue)' : 'none', 
                        padding: '5px',
                        cursor: isHost ? 'pointer' : 'default',
                        appearance: isHost ? 'auto' : 'none'
                      }}
                  >
                      <option value="FFA">⚔️ Všichni proti všem (FFA)</option>
                      <option value="TDM">🛡️ Týmový Deathmatch (TDM)</option>
                  </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ color: 'white' }}>Počet kol (Max):</label>
                  <input 
                      type="number" min="1" max="50" 
                      value={gameSettings.maxRounds} 
                      onChange={(e) => handleSettingChange('maxRounds', parseInt(e.target.value) || 1)}
                      disabled={!isHost}
                      style={{ 
                        background: isHost ? '#222' : 'transparent', 
                        color: 'white', 
                        border: isHost ? '1px solid var(--neon-blue)' : 'none', 
                        padding: '5px', 
                        width: '60px', 
                        textAlign: 'center',
                        fontWeight: 'bold'
                      }}
                  />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: 'white' }}>Twist: Změny gravitace</label>
                  <button 
                      onClick={() => handleSettingChange('gravityTwist', !gameSettings.gravityTwist)}
                      disabled={!isHost}
                      style={{ 
                          background: gameSettings.gravityTwist ? 'var(--neon-green)' : '#555', 
                          color: 'black', 
                          fontWeight: 'bold',
                          border: 'none', 
                          borderRadius: '5px', 
                          padding: '5px 15px',
                          cursor: isHost ? 'pointer' : 'default',
                          transition: 'all 0.3s ease'
                      }}
                  >
                      {gameSettings.gravityTwist ? 'ZAPNUTO' : 'VYPNUTO'}
                  </button>
              </div>

              {!isHost && (
                <p style={{ fontSize: '0.8rem', color: 'gray', marginTop: '15px', textAlign: 'center', fontStyle: 'italic' }}>
                  Pouze Host (zakladatel) může měnit nastavení.
                </p>
              )}
            </div>
            
            <div className="players-list" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--neon-green)', marginTop: 0 }}>Připojení hráči ({Object.keys(players).length}/6):</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {Object.values(players).map((player, index) => (
                  <li key={index} style={{ margin: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: player.color, textShadow: `0 0 5px ${player.color}`, marginRight: '10px', fontSize: '1.5em' }}>●</span> 
                        <span style={{ color: 'white', fontSize: '1.2em' }}>
                          {player.name} {player.isHost && '👑'}
                        </span>
                    </div>
                    <div>
                        <span style={{ color: player.isReady ? 'var(--neon-green)' : 'var(--neon-pink)', fontWeight: 'bold' }}>
                            {player.isReady ? 'PŘIPRAVEN' : 'ČEKÁ'}
                        </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <button 
                onClick={toggleReady} className="menu-btn" 
                style={{ backgroundColor: isReady ? 'var(--neon-pink)' : 'var(--neon-green)', marginBottom: '10px', width: '100%' }}
            >
                {isReady ? 'ZRUŠIT PŘIPRAVENOST' : 'JSEM PŘIPRAVEN!'}
            </button>

            <button 
                onClick={() => {
                    setCurrentView('menu');
                    setIsReady(false);
                    socket.disconnect();
                    setTimeout(() => socket.connect(), 500);
                }} 
                className="menu-btn" 
                style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid white' }}
            >
                Opustit Lobby
            </button>
          </div>
        </div>
      )}

      {currentView === 'game' && (
          <div style={{ color: 'white', textAlign: 'center', paddingTop: '20vh' }}>
              <h1>Hra probíhá!</h1>
              <p>Zde bude vykreslen tvůj Canvas...</p>
          </div>
      )}
    </div>
  );
}

export default App;