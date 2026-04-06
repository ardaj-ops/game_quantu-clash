import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
// Socket inicializujeme hned, aby byl dostupný pro game.js skrze window
const socket = io(backendUrl, { autoConnect: false });
window.gameSocket = socket; 

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
    socket.connect();

    const onConnect = () => {
      setIsConnected(true);
      console.log('Propojeno se serverem:', socket.id);
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
      // Neodpojujeme socket úplně, aby game.js mohl dál komunikovat
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

  // --- RENDER ---
  return (
    <div className={`App-container ${currentView === 'game' ? 'hidden' : ''}`}>
      
      {/* MENU VIEW */}
      {currentView === 'menu' && (
        <div id="mainMenuUI" className="overlay">
          <h1 className="title-blue">QUANTUM CLASH</h1>
          
          <div className="panel">
            <p className="status-text" style={{ color: isConnected ? 'var(--neon-green)' : 'var(--neon-pink)' }}>
              {isConnected ? '● ONLINE' : '● OFFLINE'}
            </p>

            <div className="input-group">
              <label>Přezdívka</label>
              <input 
                type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} 
                placeholder="Tvé jméno..." maxLength="12"
              />
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

            <button onClick={handleCreateRoom} className="menu-btn" id="createBtn">Vytvořit hru</button>

            <div className="join-box">
              <input 
                type="text" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} 
                placeholder="KÓD" maxLength="4" id="roomCodeInput"
              />
              <button onClick={handleJoinRoom} className="menu-btn" id="joinSubmitBtn">Připojit se</button>
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
            
            <div className="room-info">
              <span className="room-code-label">KÓD MÍSTNOSTI</span>
              <div id="displayRoomCode" onClick={copyToClipboard}>
                {roomCode} {copied && <span className="copy-badge">Zkopírováno!</span>}
              </div>
            </div>

            <div className="settings-box">
              <h3 className="section-title">Nastavení {isHost ? '👑' : '🔒'}</h3>
              <div className="setting-row">
                <label>Mód:</label>
                <select disabled={!isHost} value={gameSettings.gameMode} onChange={(e) => handleSettingChange('gameMode', e.target.value)}>
                  <option value="FFA">Všichni proti všem</option>
                  <option value="TDM">Týmy</option>
                </select>
              </div>
              <div className="setting-row">
                <label>Kola:</label>
                <input disabled={!isHost} type="number" value={gameSettings.maxRounds} onChange={(e) => handleSettingChange('maxRounds', e.target.value)} />
              </div>
            </div>

            <div className="players-list">
              <h3 className="section-title">Hráči ({Object.keys(players).length}/6)</h3>
              {Object.values(players).map((p, i) => (
                <div key={i} className="player-entry">
                  <span className="player-dot" style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }}></span>
                  <span className="player-name">{p.name} {p.isHost ? '👑' : ''}</span>
                  <span className={`player-status ${p.isReady ? 'ready' : 'waiting'}`}>
                    {p.isReady ? 'PŘIPRAVEN' : 'ČEKÁ'}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={toggleReady} id="readyBtn" className={isReady ? 'active' : ''}>
              {isReady ? 'ZRUŠIT PŘIPRAVENOST' : 'PŘIPRAVIT SE!'}
            </button>
            
            <button onClick={() => { setCurrentView('menu'); socket.emit('leaveRoom'); }} className="leave-btn">
              Opustit
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;