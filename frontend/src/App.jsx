import React, { useState, useEffect } from 'react';
import './App.css'; 

// --- KLÍČOVÉ ZMĚNY ---
// 1. Odebíráme jediný sdílený socket přímo z tvého herního kódu!
import { socket } from 'src/game/network.js'; 
// 2. Musíme Reactu říct, ať vůbec spustí tvůj herní engine (main.js)
import 'src/game/main.js'; 

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

  // Automatické ukládání do LocalStorage
  useEffect(() => {
    localStorage.setItem('qc_nickname', nickname);
    localStorage.setItem('qc_color', color);
    localStorage.setItem('qc_cosmetics', cosmetics);
  }, [nickname, color, cosmetics]);

  // Hlavní Socket.io logika
  useEffect(() => {
    if (!socket) {
        console.error("❌ Socket chybí! Podívej se na instrukce k network.js níže.");
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

    const onGameStateChange = (data) => {
      if (data.state === 'PLAYING') {
        setCurrentView('game'); 
      } else if (data.state === 'LOBBY') {
        setCurrentView('lobby');
        setIsReady(false);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomCreated', onRoomCreated);
    socket.on('roomJoined', onRoomJoined);
    socket.on('lobbyUpdated', onLobbyUpdate);
    socket.on('settingsUpdated', (settings) => setGameSettings(settings));
    socket.on('errorMsg', (msg) => setErrorMsg(msg));
    socket.on('gameStateChanged', onGameStateChange);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomCreated', onRoomCreated);
      socket.off('roomJoined', onRoomJoined);
      socket.off('lobbyUpdated', onLobbyUpdate);
      socket.off('gameStateChanged', onGameStateChange);
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

  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      minHeight: '100vh', width: '100vw', backgroundColor: '#0f141e' 
    }}>
      
      {/* OPONA (Menu / Lobby) */}
      {currentView !== 'game' && (
        <div className="App-container" style={{ width: '100%', maxWidth: '600px' }}>
          
          {/* MENU VIEW */}
          {currentView === 'menu' && (
            <div id="mainMenuUI" className="overlay">
              <h1 className="title-blue" style={{ textAlign: 'center' }}>QUANTUM CLASH</h1>
              
              <div className="panel" style={{ margin: '0 auto' }}>
                <p className="status-text" style={{ textAlign: 'center', fontWeight: 'bold', color: isConnected ? '#2ecc71' : '#e74c3c' }}>
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

                <button onClick={handleCreateRoom} className="menu-btn" style={{ width: '100%', marginTop: '15px' }}>VYTVOŘIT HRU</button>

                <div className="join-box" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <input type="text" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="KÓD MÍSTNOSTI" maxLength="4" style={{ flex: 1 }} />
                  <button onClick={handleJoinRoom} className="menu-btn" style={{ background: '#2ecc71' }}>PŘIPOJIT SE</button>
                </div>

                {errorMsg && <p id="errorMsg" style={{ color: '#e74c3c', textAlign: 'center', marginTop: '10px' }}>{errorMsg}</p>}
              </div>
            </div>
          )}

          {/* LOBBY VIEW */}
          {currentView === 'lobby' && (
            <div id="lobbyUI" className="overlay">
              <div className="panel lobby-panel" style={{ margin: '0 auto' }}>
                <h2 className="title-blue" style={{ textAlign: 'center' }}>LOBBY</h2>
                
                <div className="room-info" style={{ textAlign: 'center', marginBottom: '20px' }}>
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

                <div className="players-list" style={{ marginTop: '20px' }}>
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
                
                <button onClick={() => { setCurrentView('menu'); socket.emit('leaveRoom'); }} className="leave-btn" style={{ width: '100%', marginTop: '10px', background: 'transparent', border: '1px solid #7f8c8d', color: 'white', padding: '10px' }}>
                  Opustit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HERNÍ PLÁTNO */}
      <canvas 
        id="game" 
        style={{ 
          display: currentView === 'game' ? 'block' : 'none', 
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1 
        }}
      ></canvas>

      {/* HUD (Head-Up Display) - Upravená IDčka aby si to povídalo s render.js */}
      {currentView === 'game' && (
        <div id="game-hud" style={{
          position: 'absolute', bottom: '30px', right: '30px', zIndex: 10,
          color: 'white', fontFamily: 'Arial, sans-serif', textAlign: 'right'
        }}>
          <h2 id="hpDisplay" style={{ fontSize: '24px', margin: '0 0 5px 0', color: '#ff4444' }}>HP: 100</h2>
          <h2 id="ammoDisplay" style={{ fontSize: '32px', margin: '0 0 10px 0' }}>AMMO: ∞</h2>
          <div id="dash-progress" style={{ width: '150px', height: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid white', borderRadius: '6px', overflow: 'hidden', float: 'right' }}>
            <div id="dash-progress-fill" style={{ width: '100%', height: '100%', background: '#45f3ff', transition: 'width 0.1s linear' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;