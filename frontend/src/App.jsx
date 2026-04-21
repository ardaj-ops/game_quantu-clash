import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const socket = io(backendUrl, { autoConnect: false });
window.gameSocket = socket;

function App() {
  const [isConnected, setIsConnected] = useState(false);

  const [nickname, setNickname] = useState(() => localStorage.getItem('qc_nickname') || '');
  const [color, setColor] = useState(() => localStorage.getItem('qc_color') || '#45f3ff');
  const [cosmetics, setCosmetics] = useState(() => localStorage.getItem('qc_cosmetics') || 'none');

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentView, setCurrentView] = useState('menu');

  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const [gameSettings, setGameSettings] = useState({
    gameMode: 'FFA',
    maxRounds: 5,
    gravityTwist: false
  });

  // OPRAVA ammo glitch: ammo v React state místo přímého DOM.innerText
  const [ammo, setAmmo] = useState({ current: 0, max: 0 });

  // OPRAVA card phase: stav pro výběr karet po kole
  const [upgradeData, setUpgradeData] = useState(null); // { loserId, cards[] }

  useEffect(() => {
    localStorage.setItem('qc_nickname', nickname);
    localStorage.setItem('qc_color', color);
    localStorage.setItem('qc_cosmetics', cosmetics);
  }, [nickname, color, cosmetics]);

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
        setUpgradeData(null);
        import('./game/main.js').then(({ initGameEngine }) => {
          initGameEngine();
          // OPRAVA ammo: Po startu enginu napojíme callback z render.js na React state
          import('./game/render.js').then(({ onAmmoUpdate: setter }) => {
            // onAmmoUpdate je exportovaná let proměnná — nastavíme ji
            import('./game/render.js').then((renderModule) => {
              renderModule.onAmmoUpdate = (cur, max) => setAmmo({ current: cur, max });
            });
          });
        });
      } else if (data.state === 'UPGRADE') {
        // OPRAVA: UPGRADE stav nebyl nikdy zpracován — karta fáze se vůbec nezobrazila!
        setUpgradeData({ loserId: data.loserId, cards: data.cards || [] });
        setCurrentView('upgrade');
      } else if (data.state === 'LOBBY') {
        setCurrentView('lobby');
        setIsReady(false);
        setUpgradeData(null);
      } else if (data.state === 'GAMEOVER') {
        setCurrentView('gameover');
        setUpgradeData(null);
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
      socket.off('settingsUpdated');
      socket.off('errorMsg');
      socket.off('gameStateChanged', onGameStateChange);
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

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#0f141e'
    }}>

      {/* CANVAS — vždy v DOMu, ale skryté mimo hru. zIndex: 0 aby nepřekrývalo UI */}
      <canvas
        id="game"
        style={{
          display: (currentView === 'game' || currentView === 'upgrade') ? 'block' : 'none',
          position: 'fixed',
          top: 0, left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000',
          zIndex: 0
        }}
      />

      {/* HUD — zobrazí se jen ve hře, nad canvasem */}
      {currentView === 'game' && (
        <div id="game-hud" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          pointerEvents: 'none', zIndex: 10
        }}>
          <div style={{
            position: 'absolute', bottom: '30px', right: '30px',
            color: 'white', fontFamily: 'Arial, sans-serif', textAlign: 'right',
            pointerEvents: 'none'
          }}>
            {/* OPRAVA: ammo z React state, ne DOM.innerText (způsobovalo glitch) */}
            <h2 id="ammo-text" style={{ fontSize: '32px', margin: '0 0 10px 0', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
              {ammo.current} / {ammo.max}
            </h2>
            <div id="dash-progress" style={{ width: '150px', height: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid white', borderRadius: '6px', overflow: 'hidden', float: 'right' }}>
              <div id="dash-progress-fill" style={{ width: '100%', height: '100%', background: '#45f3ff', transition: 'width 0.1s linear' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* OPRAVA: Výběr karet po konci kola — dříve VŮBEC neexistoval v App.jsx! */}
      {currentView === 'upgrade' && upgradeData && (
        <div className="overlay" style={{ zIndex: 30, flexDirection: 'column' }}>
          {upgradeData.loserId === socket.id ? (
            <>
              <h2 style={{ fontSize: '3rem', color: '#f43f5e', textTransform: 'uppercase', marginBottom: '10px' }}>
                Prohrál jsi kolo!
              </h2>
              <p style={{ color: 'white', fontSize: '1.2rem', marginBottom: '30px' }}>
                Vyber si vylepšení:
              </p>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '900px' }}>
                {upgradeData.cards.map((card, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      socket.emit('pickCard', card.globalIndex ?? i);
                      setUpgradeData(null);
                      setCurrentView('game');
                    }}
                    className={`card card-${(card.rarity || 'common').toLowerCase()}`}
                    style={{ cursor: 'pointer', minWidth: '180px' }}
                  >
                    <div className="rarity-label">{card.rarity || 'Common'}</div>
                    <h3>{card.icon || ''} {card.name}</h3>
                    <p>{card.desc}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '3rem', color: '#4ade80', textTransform: 'uppercase' }}>Kolo skončilo!</h2>
              <p style={{ color: '#aaa', fontSize: '1.2rem', marginTop: '20px' }}>⏳ Čekej na ostatní hráče...</p>
            </div>
          )}
        </div>
      )}

      {/* GAME OVER */}
      {currentView === 'gameover' && (
        <div className="overlay" style={{ zIndex: 20, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
          <h1 style={{ fontSize: '6rem', margin: 0, color: '#f43f5e' }}>🏆 KONEC HRY 🏆</h1>
          <h2 id="winnerText" style={{ fontSize: '3rem', color: 'white', marginBottom: '50px', textTransform: 'uppercase' }}>Konec hry!</h2>
          <button className="menu-btn" onClick={() => { setCurrentView('menu'); socket.emit('leaveRoom'); }} style={{ padding: '15px 30px', fontSize: '1.2rem' }}>
            Zpět do Menu
          </button>
        </div>
      )}

      {/* MENU + LOBBY — skryté ve hře */}
      {currentView !== 'game' && currentView !== 'gameover' && currentView !== 'upgrade' && (
        <div className="App-container" style={{ width: '100%', maxWidth: '600px', position: 'relative', zIndex: 20 }}>

          {currentView === 'menu' && (
            <div id="mainMenuUI" className="overlay">
              <h1 className="title-blue" style={{ textAlign: 'center' }}>QUANTUM CLASH</h1>

              <div className="panel" style={{ margin: '0 auto', position: 'relative' }}>
                <p className="status-text" style={{ textAlign: 'center', fontWeight: 'bold', color: isConnected ? '#2ecc71' : '#e74c3c' }}>
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

                <button onClick={handleCreateRoom} className="menu-btn" style={{ width: '100%', marginTop: '15px' }}>VYTVOŘIT HRU</button>

                <div className="join-box" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <input
                    type="text" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="KÓD MÍSTNOSTI" maxLength="4" style={{ flex: 1 }}
                  />
                  <button onClick={handleJoinRoom} className="menu-btn" style={{ background: '#2ecc71' }}>PŘIPOJIT SE</button>
                </div>

                {errorMsg && <p id="errorMsg" style={{ color: '#e74c3c', textAlign: 'center', marginTop: '10px' }}>{errorMsg}</p>}
              </div>
            </div>
          )}

          {currentView === 'lobby' && (
            <div id="lobbyUI" className="overlay">
              <div className="panel lobby-panel" style={{ margin: '0 auto', position: 'relative' }}>
                <h2 className="title-blue" style={{ textAlign: 'center' }}>LOBBY</h2>

                <div className="room-info" style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <span className="room-code-label">KÓD MÍSTNOSTI</span>
                  <div style={{ cursor: 'pointer', fontSize: '24px', fontWeight: 'bold', color: 'white', background: '#111', padding: '10px 20px', borderRadius: '8px', display: 'inline-block', marginTop: '8px', letterSpacing: '4px' }} onClick={copyToClipboard}>
                    {roomCode}
                  </div>
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
                  <div style={{ maxHeight: '160px', overflowY: 'auto', paddingRight: '10px' }}>
                    {Object.values(players).map((p, i) => (
                      <div key={i} className="player-entry" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ width: '15px', height: '15px', borderRadius: '50%', backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}`, flexShrink: 0 }}></span>
                        <span className="player-name">{p.name} {p.isHost ? '👑' : ''}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: p.isReady ? '#2ecc71' : '#f1c40f' }}>
                          {p.isReady ? 'PŘIPRAVEN' : 'ČEKÁ'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={toggleReady} className="menu-btn" style={{ width: '100%', marginTop: '20px', background: isReady ? '#e74c3c' : '#45f3ff' }}>
                  {isReady ? 'ZRUŠIT PŘIPRAVENOST' : 'PŘIPRAVIT SE!'}
                </button>

                <button onClick={() => { setCurrentView('menu'); socket.emit('leaveRoom'); }} className="leave-btn" style={{ width: '100%', marginTop: '10px', background: 'transparent', border: '1px solid #7f8c8d', color: 'white', padding: '10px', cursor: 'pointer' }}>
                  Opustit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;