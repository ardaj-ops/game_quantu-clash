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
        setCurrentView('game'); 
        setIsCardSelection(true);
        setIsGameOver(false);
      } else if (data.state === 'SCOREBOARD' || data.state === 'GAMEOVER') {
        setCurrentView('game'); 
        setIsGameOver(true);
        setIsCardSelection(false);
      }
    };

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
    socket.on('showCards', onReceiveCards);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomCreated', onRoomCreated);
      socket.off('roomJoined', onRoomJoined);
      socket.off('lobbyUpdated', onLobbyUpdate);
      socket.off('settingsUpdated');
      socket.off('errorMsg');
      socket.off('gameStateChanged', onGameStateChange);
      socket.off('showCards', onReceiveCards);
    };
  }, []);

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

  const handleSelectCard = (cardId) => {
    socket.emit('selectCard', cardId);
    setIsCardSelection(false); 
  };

  return (
    <>
      {/* HERNÍ PLÁTNO - Fixnuté na pozadí */}
      <canvas id="game" style={{ position: 'fixed', top: 0, left: 0, zIndex: 0 }}></canvas>

      {/* REACT MENU - Vrstva nad plátnem */}
      {currentView !== 'game' && (
        <div className="App-container" style={{ position: 'relative', zIndex: 10, width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          
          {/* MENU VIEW */}
          {currentView === 'menu' && (
            <div id="mainMenuUI" className="overlay">
              <h1 className="title-blue">QUANTUM CLASH</h1>
              
              <div className="panel" style={{ position: 'relative' }}>
                <p style={{ fontWeight: 'bold', color: isConnected ? 'var(--neon-green, #2ecc71)' : 'var(--neon-pink, #e74c3c)', marginBottom: '15px', textAlign: 'center' }}>
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

                <button id="createBtn" onClick={handleCreateRoom} className="menu-btn" style={{ width: '100%', marginBottom: '20px' }}>
                  VYTVOŘIT HRU
                </button>

                <div className="join-box">
                  <h3 style={{ textAlign: 'center', margin: '0 0 10px 0' }}>Připojit se</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input id="roomCodeInput" type="text" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="KÓD MÍSTNOSTI" maxLength="4" style={{ flex: 1 }} />
                    <button id="joinSubmitBtn" onClick={handleJoinRoom} className="menu-btn" style={{ background: '#2ecc71' }}>PŘIPOJIT</button>
                  </div>
                </div>

                {errorMsg && <p id="errorMsg" style={{ color: '#e74c3c', textAlign: 'center', marginTop: '10px' }}>{errorMsg}</p>}
              </div>
            </div>
          )}

          {/* LOBBY VIEW */}
          {currentView === 'lobby' && (
            <div id="lobbyUI" className="overlay">
              <div className="panel lobby-panel" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', padding: '30px', position: 'relative' }}>
                
                {/* HLAVIČKA A NASTAVENÍ */}
                <div style={{ flexShrink: 0 }}>
                  <h2 className="title-blue" style={{ fontSize: '2.5rem', marginTop: 0, textAlign: 'center' }}>LOBBY</h2>
                  
                  <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                    <div className="room-code-title" style={{ fontSize: '14px', color: '#aaaaaa' }}>KÓD MÍSTNOSTI</div>
                    <div id="displayRoomCode" onClick={copyToClipboard} style={{ cursor: 'pointer', fontSize: '32px', letterSpacing: '5px', fontWeight: 'bold' }}>
                      {roomCode}
                    </div>
                    {copied && <div style={{ color: '#2ecc71', fontWeight: 'bold' }}>Zkopírováno!</div>}
                  </div>

                  <div className="settings-box" style={{ background: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '8px' }}>
                    <h3 style={{ color: '#45f3ff', marginTop: 0 }}>Nastavení {isHost ? '👑' : '🔒'}</h3>
                    <div className="input-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0 }}>Mód:</label>
                      <select disabled={!isHost} value={gameSettings.gameMode} onChange={(e) => handleSettingChange('gameMode', e.target.value)} style={{ width: 'auto' }}>
                        <option value="FFA">Všichni proti všem</option>
                        <option value="TDM">Týmy</option>
                      </select>
                    </div>
                    <div className="input-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                      <label style={{ margin: 0 }}>Kola:</label>
                      <input disabled={!isHost} type="number" value={gameSettings.maxRounds} onChange={(e) => handleSettingChange('maxRounds', e.target.value)} style={{ width: '60px' }} />
                    </div>
                  </div>
                </div>

                {/* SEZNAM HRÁČŮ */}
                <div className="settings-section seznam-hracu" style={{ textAlign: 'left', flexGrow: 1, overflowY: 'auto', paddingRight: '10px', marginTop: '20px', marginBottom: '20px' }}>
                  <h3 style={{ color: '#45f3ff', marginTop: 0 }}>Hráči ({Object.keys(players).length}/6)</h3>
                  {Object.values(players).map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }}></span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{p.name} {p.isHost ? '👑' : ''}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: p.isReady ? '#2ecc71' : '#f1c40f' }}>
                        {p.isReady ? 'PŘIPRAVEN' : 'ČEKÁ'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* SPODNÍ TLAČÍTKA */}
                <div style={{ flexShrink: 0 }}>
                  <button id="readyBtn" onClick={toggleReady} className={isReady ? 'active menu-btn' : 'menu-btn'} style={{ width: '100%', background: isReady ? '#e74c3c' : '#45f3ff' }}>
                    {isReady ? 'ZRUŠIT PŘIPRAVENOST' : 'PŘIPRAVIT SE!'}
                  </button>
                  
                  <button onClick={() => { setCurrentView('menu'); socket.emit('leaveRoom'); }} className="menu-btn" style={{ width: '100%', background: 'transparent', border: '1px solid #7f8c8d', color: '#aaaaaa', marginTop: '15px' }}>
                    Opustit místnost
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- VÝBĚR KARET --- */}
      {isCardSelection && (
        <div className="overlay" style={{ zIndex: 20 }}>
          <h1 className="title-blue" style={{ fontSize: '4rem', marginBottom: '20px' }}>VÝBĚR VYLEPŠENÍ</h1>
          <div className="cards-container">
            {cards.length > 0 ? cards.map((c, i) => {
              const rarityClass = c.rarity ? `card-${c.rarity.toLowerCase()}` : 'card-common';
              
              return (
                <div 
                  key={i} 
                  className={`card ${rarityClass}`}
                  onPointerDown={(e) => {
                    e.stopPropagation(); 
                    handleSelectCard(c.id);
                  }}
                >
                  {c.rarity && <div className="rarity-label">{c.rarity}</div>}
                  <h3>{c.name || 'Vylepšení'}</h3>
                  <p>{c.description || 'Popis chybí...'}</p>
                </div>
              );
            }) : (
              <h3 className="waiting-text">Čekám na balíček karet ze serveru...</h3>
            )}
          </div>
        </div>
      )}

      {/* --- GAME OVER OBRAZOVKA --- */}
      {isGameOver && (
        <div className="overlay" style={{ zIndex: 20 }}>
          <h1 id="winnerText">KONEC HRY</h1>
          <div>
            {isHost ? (
              <button 
                id="returnToLobbyBtn" className="menu-btn"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  socket.emit('returnToLobby');
                }} 
              >
                ZPĚT DO LOBBY
              </button>
            ) : (
              <p className="waiting-text">
                Čekáme na to, až Host vrátí hru do Lobby...
              </p>
            )}
          </div>
        </div>
      )}

      {/* HERNÍ HUD (Viditelný jen při hraní) */}
      <div 
        id="game-hud" 
        className={currentView === 'game' && !isCardSelection && !isGameOver ? '' : 'hidden'}
        style={{ position: 'absolute', bottom: '30px', right: '30px', zIndex: 10, textAlign: 'right' }}
      >
        <div id="ammoContainer">
          <h2 id="hpDisplay" style={{ color: '#ff4757', margin: '0 0 5px 0', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', fontSize: '32px' }}></h2>
          <h2 id="ammoDisplay" style={{ color: 'white', margin: '0 0 5px 0', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', fontSize: '32px' }}></h2>
          
          <div id="dash-progress" style={{ width: '150px', height: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid white', borderRadius: '6px', overflow: 'hidden', marginTop: '10px', float: 'right' }}>
            <div id="dash-progress-fill" style={{ width: '100%', height: '100%', background: '#45f3ff', transition: 'width 0.1s linear' }}></div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;