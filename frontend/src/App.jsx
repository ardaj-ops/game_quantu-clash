import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
// Socket inicializujeme mimo komponentu, připojí se až v useEffect
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

  // Nastavení Socket.io po načtení aplikace (Spouští se jen JEDNOU)
  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Připojeno k serveru:', socket.id);
      window.gameSocket = socket; // Exponování socketu pro game.js
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listenery pro Lobby
    socket.on('roomCreated', (data) => {
      setRoomCode(data.code);
      setIsHost(data.isHost);
      setCurrentView('lobby');
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

    socket.on('settingsUpdated', (newSettings) => {
        setGameSettings(newSettings);
    });

    socket.on('errorMsg', (msg) => {
      setErrorMsg(msg);
      setCurrentView(prev => prev === 'lobby' ? 'menu' : prev);
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
      socket.removeAllListeners();
      socket.disconnect();
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

  // Handler opuštění lobby
  const handleLeaveLobby = () => {
      setCurrentView('menu');
      setIsReady(false);
      socket.emit('leaveRoom'); 
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

  // Pokud je currentView 'game', React skryje celý svůj hlavní div a ukáže se HTML pod ním.
  return (
    <div className={`App ${currentView === 'game' ? 'hidden' : ''}`} style={{ display: currentView === 'game' ? 'none' : 'block' }}>
      
      {/* Hlavní Menu */}
      {currentView === 'menu' && (
        <div id="mainMenuUI" className="overlay">
          <h1 className="title-blue">Quantum Clash</h1>
          
          <div className="panel">
            <p style={{ color: isConnected ? 'var(--neon-green)' : 'var(--neon-pink)', fontWeight: 'bold', margin: '0 0 15px 0', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
              Stav serveru: {isConnected ? '🟢 Online' : '🔴 Offline'}
            </p>

            <div className="input-group">
              <label>Přezdívka:</label>
              <input 
                type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} 
                placeholder="Napiš jméno..." maxLength="12" style={{ textAlign: 'center' }}
              />
            </div>

            <div className="input-group">
              <label>Barva postavy:</label>
              <input 
                type="color" value={color} onChange={(e) => setColor(e.target.value)} 
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

            <button onClick={handleCreateRoom} id="createBtn" className="menu-btn">Vytvořit novou hru</button>

            <div className="settings-section join-box">
              <div className="input-group" style={{ marginBottom: '10px' }}>
                <label style={{ textAlign: 'center', color: 'white', width: '100%', marginBottom: '10px' }}>Připojit se ke hře</label>
                <input 
                  type="text" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} 
                  placeholder="Kód místnosti..." maxLength="4" 
                  id="roomCodeInput"
                />
              </div>
              <button onClick={handleJoinRoom} id="joinSubmitBtn" className="menu-btn">Připojit</button>
            </div>

            {errorMsg && <p id="errorMsg">{errorMsg}</p>}
          </div>
        </div>
      )}

      {/* Lobby View */}
      {currentView === 'lobby' && (
        <div id="lobbyUI" className="overlay">
          <div className="panel" style={{ minWidth: '450px' }}>
            <h1 className="title-blue" style={{ fontSize: '2.5rem', marginBottom: '10px', animation: 'none' }}>Válečná místnost</h1>
            
            <div style={{ textAlign: 'center' }}>
              <h2 className="room-code-title">Kód místnosti</h2>
              <div id="displayRoomCode" onClick={copyToClipboard} title="Klikni pro zkopírování do schránky">
                {roomCode}
              </div>
              {copied && (
                <div style={{ color: 'var(--neon-green)', fontSize: '0.9rem', marginTop: '-10px', marginBottom: '10px', fontWeight: 'bold' }}>
                  Zkopírováno! ✓
                </div>
              )}
            </div>

            {/* PANEL NASTAVENÍ HRY */}
            <div className="settings-box">
              <h3 style={{ color: 'var(--neon-blue)', marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                Nastavení hry {isHost ? '👑' : '🔒'}
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <label style={{ color: 'var(--text-main)', width: 'auto' }}>Herní mód:</label>
                  <select 
                      value={gameSettings.gameMode} 
                      onChange={(e) => handleSettingChange('gameMode', e.target.value)}
                      disabled={!isHost}
                      style={{ width: '220px', cursor: isHost ? 'pointer' : 'not-allowed', opacity: isHost ? 1 : 0.7 }}
                  >
                      <option value="FFA">⚔️ Všichni proti všem</option>
                      <option value="TDM">🛡️ Týmový Deathmatch</option>
                  </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <label style={{ color: 'var(--text-main)', width: 'auto' }}>Počet kol (Max):</label>
                  <input 
                      type="number" min="1" max="50" 
                      value={gameSettings.maxRounds} 
                      onChange={(e) => handleSettingChange('maxRounds', parseInt(e.target.value) || 1)}
                      disabled={!isHost}
                      style={{ width: '80px', textAlign: 'center', cursor: isHost ? 'auto' : 'not-allowed', opacity: isHost ? 1 : 0.7 }}
                  />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: 'var(--text-main)', width: 'auto' }}>Twist: Změny gravitace</label>
                  <button 
                      onClick={() => handleSettingChange('gravityTwist', !gameSettings.gravityTwist)}
                      disabled={!isHost}
                      style={{ 
                          background: gameSettings.gravityTwist ? 'var(--neon-green)' : '#444', 
                          color: gameSettings.gravityTwist ? 'black' : 'white', 
                          fontWeight: 'bold', border: 'none', borderRadius: '5px', padding: '10px 15px',
                          cursor: isHost ? 'pointer' : 'not-allowed', transition: 'all 0.3s ease', opacity: isHost ? 1 : 0.7
                      }}
                  >
                      {gameSettings.gravityTwist ? 'ZAPNUTO' : 'VYPNUTO'}
                  </button>
              </div>

              {!isHost && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '20px', textAlign: 'center', fontStyle: 'italic' }}>
                  Pouze Host (zakladatel) může měnit nastavení.
                </p>
              )}
            </div>
            
            <div className="settings-box">
              <h3 className="text-green">Připojení hráči ({Object.keys(players).length}/6)</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {Object.values(players).map((player, index) => (
                  <li key={index} style={{ margin: '15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: player.color, textShadow: `0 0 10px ${player.color}`, marginRight: '15px', fontSize: '1.5rem' }}>●</span> 
                        <span style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>
                          {player.name} {player.isHost && '👑'}
                        </span>
                    </div>
                    <div>
                        <span style={{ 
                          color: player.isReady ? 'var(--neon-green)' : 'var(--neon-pink)', 
                          fontWeight: '900', letterSpacing: '1px', textShadow: player.isReady ? '0 0 10px rgba(46, 213, 115, 0.4)' : 'none' 
                        }}>
                            {player.isReady ? 'PŘIPRAVEN' : 'ČEKÁ'}
                        </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <button 
                onClick={toggleReady} id="readyBtn" 
                style={{ 
                  backgroundColor: isReady ? 'var(--neon-pink)' : 'transparent',
                  color: isReady ? 'white' : 'var(--neon-pink)',
                  borderColor: 'var(--neon-pink)',
                  width: '100%', marginBottom: '15px'
                }}
            >
                {isReady ? 'ZRUŠIT PŘIPRAVENOST' : 'JSEM PŘIPRAVEN!'}
            </button>

            <button 
                onClick={handleLeaveLobby} 
                className="menu-btn" 
                style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)' }}
            >
                Opustit Lobby
            </button>
          </div>
        </div>
      )}

      {/* KDYŽ SE HRAJE, REACT SE SCHOVÁ A ODHALÍ HTML CANVAS */}
      {currentView === 'game' && null}
    </div>
  );
}

export default App;