// App.jsx
import React, { useState, useEffect } from 'react';
import './App.css'; 

import { socket } from './game/network.js'; 
import { initGameEngine } from './game/main.js';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  
  // --- DATA HRÁČE (Local Storage) ---
  const [nickname, setNickname] = useState(() => localStorage.getItem('qc_nickname') || '');
  const [color, setColor] = useState(() => localStorage.getItem('qc_color') || '#45f3ff');
  const [cosmetics, setCosmetics] = useState(() => localStorage.getItem('qc_cosmetics') || 'none');
  
  // --- STAVY APLIKACE ---
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentView, setCurrentView] = useState('menu'); // 'menu', 'lobby', 'game'

  // --- NOVÉ STAVY PRO KARTY A KONEC HRY ---
  const [isCardSelection, setIsCardSelection] = useState(false);
  const [cards, setCards] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);

  // --- STAVY LOBBY ---
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // --- NASTAVENÍ HRY ---
  const [gameSettings, setGameSettings] = useState({
      gameMode: 'FFA',
      maxRounds: 5,
      gravityTwist: false
  });

  useEffect(() => {
    localStorage.setItem('qc_nickname', nickname);
    localStorage.setItem('qc_color', color);
    localStorage.setItem('qc_cosmetics', cosmetics);
  }, [nickname, color, cosmetics]);

  useEffect(() => {
    initGameEngine();
  }, []);

  useEffect(() => {
    if (!socket) {
        console.error("❌ Socket chybí! Zkontroluj network.js.");
        return;
    }

    const onConnect = () => {
      setIsConnected(true);
      console.log('✅ UI Propojeno se serverem:', socket.id);
    };

    const onDisconnect = () => setIsConnected(false);

    const onRoomCreated = (data) => {
      setRoomCode(data.code);
      setIsHost(true);
      setCurrentView('lobby');
      setErrorMsg('');
    };

    const onRoomJoined = (data) => {
      setRoomCode(data.code);
      setIsHost(data.isHost);
      setCurrentView('lobby');
      setErrorMsg('');
    };

    const onLobbyUpdate = (data) => {
      setPlayers(data.players);
      if (data.players[socket.id]) {
        setIsReady(data.players[socket.id].isReady);
      }
    };

    // --- OPRAVENÝ LISTENER STAVŮ HRY ---
    const onGameStateChange = (data) => {
      if (data.state === 'PLAYING') {
        setCurrentView('game'); 
        setIsCardSelection(false);
        setIsGameOver(false);
      } else if (data.state === 'LOBBY') {
        setCurrentView('lobby');
        setIsReady(false);
        setIsCardSelection(false);
        setIsGameOver(false);
      } else if (data.state === 'CARD_SELECTION' || data.state === 'UPGRADE') {
        setCurrentView('game'); // Necháme běžet hru v pozadí
        setIsCardSelection(true);
        setIsGameOver(false);
      } else if (data.state === 'SCOREBOARD' || data.state === 'GAMEOVER') {
        setCurrentView('game'); // Necháme běžet hru v pozadí (černá obrazovka s textem z Canvasu)
        setIsGameOver(true);
        setIsCardSelection(false);
      }
    };

    // --- PŘIJETÍ KARET ZE SERVERU ---
    const onReceiveCards = (availableCards) => {
      setCards(availableCards);
      setIsCardSelection(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomCreated', onRoomCreated);
    socket.on('roomJoined', onRoomJoined);
    socket.on('lobbyUpdated', onLobbyUpdate);
    socket.on('settingsUpdated', (settings) => setGameSettings(settings));
    socket.on('errorMsg', (msg) => setErrorMsg(msg));
    socket.on('gameStateChanged', onGameStateChange);
    socket.on('showCards', onReceiveCards); // Nasloucháme na event karet

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomCreated', onRoomCreated);
      socket.off('roomJoined', onRoomJoined);
      socket.off('lobbyUpdated', onLobbyUpdate);
      socket.off('gameStateChanged', onGameStateChange);
      socket.off('showCards', onReceiveCards);
    };
  }, []);

  // --- HANDLERY ---
  const handleCreateRoom = () => {
    if (!nickname.trim()) return setErrorMsg('Zadej přezdívku!');
    socket.emit('createRoom', { name: nickname, color, cosmetics });
  };

  const handleJoinRoom = () => {
    if (!nickname.trim()) return setErrorMsg('Zadej přezdívku!');
    if (!roomCodeInput.trim()) return setErrorMsg('Zadej kód!');
    socket.emit('joinRoom', { name: nickname, color, cosmetics, code: roomCodeInput.toUpperCase() });
  };

  const toggleReady = () => {
    socket.emit('toggleReady', !isReady);
  };

  const handleSettingChange = (key, value) => {
    if (!isHost) return;
    const newSettings = { ...gameSettings, [key]: value };
    setGameSettings(newSettings);
    socket.emit('updateSettings', newSettings);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- NOVÝ HANDLER PRO VÝBĚR KARTY ---
  const handleSelectCard = (cardId) => {
    socket.emit('selectCard', cardId);
    setIsCardSelection(false); // Okamžitě skryjeme, aby hráč neklikal dvakrát
  };

  return (
    <>
      <canvas 
        id="game"
        style={{
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          backgroundColor: '#0b0c10'
        }}
      ></canvas>

      {currentView !== 'game' && (
        <div className="App-container">
          
          {/* MENU VIEW */}
          {currentView === 'menu' && (
            <div id="mainMenuUI" className="overlay">
              <h1 className="title-blue">QUANTUM CLASH</h1>
              
              <div className="panel">
                <p className="status-text" style={{ fontWeight: 'bold', color: isConnected ? '#2ecc71' : '#e74c3c' }}>
                  {isConnected ? '● ONLINE' : '● OFFLINE'}
                </p>

                <div className="input-group">
                  <label>Přezdívka</label>
                  <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Tvé jméno..." maxLength="12" />
                </div>

                <div className="input-group">
                  <label>Barva</label>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                </div>

                <div className="input-group">
                  <label>Kosmetika</label>
                  <select value={cosmetics} onChange={(e) => setCosmetics(e.target.value)}>
                    <option value="none">Žádná</option>
                    <option value="crown">👑 Koruna</option>
                    <option value="horns">👿 Rohy</option>
                    <option value="wizard_hat">🧙‍♂️ Klobouk</option>
                    <option value="mohawk">🎸 Číro</option>
                  </select>
                </div>

                <button onClick={handleCreateRoom} className="menu-btn" style={{ width: '100%' }}>VYTVOŘIT HRU</button>

                <div className="join-box">
                  <input type="text" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="KÓD MÍSTNOSTI" maxLength="4" style={{ width: 'calc(100% - 140px)', marginRight: '10px' }} />
                  <button onClick={handleJoinRoom} className="menu-btn" style={{ background: '#2ecc71', width: '130px', margin: '0' }}>PŘIPOJIT</button>
                </div>

                {errorMsg && <p id="errorMsg">{errorMsg}</p>}
              </div>
            </div>
          )}

          {/* LOBBY VIEW */}
          {currentView === 'lobby' && (
            <div id="lobbyUI" className="overlay">
              <div className="panel lobby-panel">
                <h2 className="title-blue">LOBBY</h2>
                
                <div className="room-info" style={{ marginBottom: '20px' }}>
                  <span className="room-code-label">KÓD MÍSTNOSTI: </span>
                  <strong style={{ cursor: 'pointer', fontSize: '24px', color: '#45f3ff' }} onClick={copyToClipboard}>
                    {roomCode}
                  </strong>
                  {copied && <span style={{ marginLeft: '10px', color: '#2ecc71' }}>Zkopírováno!</span>}
                </div>

                <div className="settings-box">
                  <h3 className="section-title">Nastavení {isHost ? '👑' : '🔒'}</h3>
                  <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <label>Mód:</label>
                    <select disabled={!isHost} value={gameSettings.gameMode} onChange={(e) => handleSettingChange('gameMode', e.target.value)}>
                      <option value="FFA">Všichni proti všem</option>
                      <option value="TDM">Týmy</option>
                    </select>
                  </div>
                  <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label>Kola:</label>
                    <input disabled={!isHost} type="number" value={gameSettings.maxRounds} onChange={(e) => handleSettingChange('maxRounds', e.target.value)} style={{ width: '60px' }} />
                  </div>
                </div>

                <div className="players-list" style={{ marginTop: '20px', textAlign: 'left' }}>
                  <h3 className="section-title">Hráči ({Object.keys(players).length}/6)</h3>
                  {Object.values(players).map((p, i) => (
                    <div key={i} className="player-entry" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ width: '15px', height: '15px', borderRadius: '50%', backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }}></span>
                      <span className="player-name">{p.name} {p.isHost ? '👑' : ''}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: p.isReady ? '#2ecc71' : '#f1c40f' }}>
                        {p.isReady ? 'PŘIPRAVEN' : 'ČEKÁ'}
                      </span>
                    </div>
                  ))}
                </div>

                <button onClick={toggleReady} className="menu-btn" style={{ width: '100%', marginTop: '20px', background: isReady ? '#e74c3c' : '#45f3ff' }}>
                  {isReady ? 'ZRUŠIT PŘIPRAVENOST' : 'PŘIPRAVIT SE!'}
                </button>
                
                <button onClick={() => { setCurrentView('menu'); socket.emit('leaveRoom'); }} className="leave-btn" style={{ width: '100%', marginTop: '10px', background: 'transparent', border: '1px solid #7f8c8d', color: 'white', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                  Opustit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- VÝBĚR KARET (Kreslí se přes hru) --- */}
      {isCardSelection && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 100, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <h1 style={{ color: '#45f3ff', textShadow: '0 0 15px #45f3ff', marginBottom: '40px', fontSize: '40px' }}>VÝBĚR VYLEPŠENÍ</h1>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {cards.length > 0 ? cards.map((c, i) => (
              <div 
                key={i} 
                onClick={() => handleSelectCard(c.id)}
                style={{
                  background: '#1a1a2e', border: '2px solid #45f3ff', borderRadius: '10px',
                  padding: '20px', width: '220px', textAlign: 'center', cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(69, 243, 255, 0.3)', transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <h3 style={{ color: 'white', borderBottom: '1px solid #45f3ff', paddingBottom: '10px' }}>{c.name || 'Vylepšení'}</h3>
                <p style={{ color: '#ccc', marginTop: '15px' }}>{c.description || 'Popis vylepšení chybí...'}</p>
              </div>
            )) : (
              <h3 style={{ color: 'white' }}>Čekám na balíček karet ze serveru...</h3>
            )}
          </div>
        </div>
      )}

      {/* --- GAME OVER OBRAZOVKA (Kreslí se přes hru) --- */}
      {isGameOver && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'transparent', zIndex: 100, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Kreslíme jen UI komponenty, "KOLO SKONČILO" už kreslí Canvas */}
          <div style={{ marginTop: '200px' }}>
            {isHost ? (
              <button 
                onClick={() => socket.emit('returnToLobby')} 
                className="menu-btn" 
                style={{ padding: '15px 40px', fontSize: '20px', backgroundColor: '#e74c3c' }}
              >
                ZPĚT DO LOBBY
              </button>
            ) : (
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', textShadow: '2px 2px 4px black' }}>
                Čekáme na to, až Host vrátí hru do Lobby...
              </p>
            )}
          </div>
        </div>
      )}

      {/* HERNÍ HUD (Skóre, Životy, atd.) */}
      <div 
        id="game-hud" 
        style={{ 
          display: currentView === 'game' && !isCardSelection ? 'block' : 'none', 
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10,
          pointerEvents: 'none' // Aby šlo klikat skrz HUD do hry
        }}
      >
        <h2 id="hpDisplay" style={{ color: '#ff4444', margin: '5px 0', textShadow: '2px 2px 2px black' }}>HP: 100</h2>
        <h2 id="ammoDisplay" style={{ color: 'white', margin: '5px 0', textShadow: '2px 2px 2px black' }}>AMMO: ∞</h2>
        <div id="dash-progress" style={{ width: '150px', height: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid white', borderRadius: '6px', overflow: 'hidden', marginTop: '10px' }}>
          <div id="dash-progress-fill" style={{ width: '100%', height: '100%', background: '#45f3ff', transition: 'width 0.1s linear' }}></div>
        </div>
      </div>
    </>
  );
}

export default App;