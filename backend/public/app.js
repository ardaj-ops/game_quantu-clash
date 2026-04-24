import{initGameEngine}from'./game/main.js';

constsocket=io();
window.gameSocket=socket;

constscreens={
menu:document.getElementById('menu-screen'),
lobby:document.getElementById('lobby-screen'),
game:document.getElementById('game-screen'),
cards:document.getElementById('card-screen'),
gameover:document.getElementById('gameover-screen')
};

//---LOGIKALOCALSTORAGE(Ukládánínastavení)---
constnameInput=document.getElementById('player-name');
constcolorInput=document.getElementById('player-color');

//Načtenípřistartu
window.addEventListener('load',()=>{
constsavedName=localStorage.getItem('qc_player_name');
constsavedColor=localStorage.getItem('qc_player_color');
if(savedName&&nameInput)nameInput.value=savedName;
if(savedColor&&colorInput)colorInput.value=savedColor;
});

//Ukládánípřikaždézměně(oninput)
nameInput?.addEventListener('input',()=>localStorage.setItem('qc_player_name',nameInput.value));
colorInput?.addEventListener('input',()=>localStorage.setItem('qc_player_color',colorInput.value));

functionshowScreen(screenName)
{
Object.values(screens).forEach(s=>{if(s)s.style.display='none';});
if(screens[screenName]){
screens[screenName].style.display=(screenName==='game')?'block':'flex';
}
}

//---AKCEVMENU---
document.getElementById('btn-create-room')?.addEventListener('click',()=>{
socket.emit('createRoom',{
name:nameInput.value||'Hráč',
color:colorInput.value,
cosmetics:'none'
});
});

document.getElementById('btn-join-room')?.addEventListener('click',()=>{
constcode=document.getElementById('room-code').value.toUpperCase();
if(code){
socket.emit('joinRoom',{
roomId:code,
name:nameInput.value||'Hráč',
color:colorInput.value
});
}else{
alert("Zadejkódmístnosti!");
}
});

document.getElementById('btn-ready')?.addEventListener('click',()=>{
socket.emit('playerReady');
});

//---LOBBYEVENTY---
socket.on('roomCreated',(data)=>{
constroomId=data.roomId||data.id;//Pojistkaproobanázvy
document.getElementById('lobby-title').innerText=`MÍSTNOST:${roomId}`;
showScreen('lobby');
});

socket.on('roomJoined',(data)=>{
constroomId=data.roomId||data.id;
document.getElementById('lobby-title').innerText=`MÍSTNOST:${roomId}`;
showScreen('lobby');
});

socket.on('updatePlayerList',(players)=>{
constlistContainer=document.getElementById('player-list');
if(!listContainer)return;

listContainer.innerHTML=players.map(p=>`
<divstyle="background:rgba(255,255,255,0.1);padding:10px15px;border-left:5pxsolid${p.color};display:flex;justify-content:space-between;border-radius:5px;">
<spanstyle="color:white;font-weight:bold;">${p.name}${p.id===socket.id?'(TY)':''}</span>
<spanstyle="color:${p.isReady?'#2ecc71':'#ff4757'};">${p.isReady?'✔READY':'⏳ČEKÁ'}</span>
</div>
`).join('');
});

//---OSTATNÍEVENTY---
socket.on('errorMsg',(msg)=>alert(msg));

socket.on('gameStateChanged',(data)=>{
if(data.state==='PLAYING'){
showScreen('game');
initGameEngine();
}
});

//HUDUpdate
socket.on('gameUpdate',(data)=>{
constme=data.players[socket.id];
if(me){
consthudAmmo=document.getElementById('hud-ammo');
consthudHp=document.getElementById('hud-hp');

if(hudAmmo)hudAmmo.innerText=`${me.ammo}/${me.maxAmmo}`;
if(hudHp)hudHp.innerText=`${Math.round(me.hp)}/${me.maxHp}`;
}
});


//---KOPÍROVÁNÍKÓDUMÍSTNOSTIPOKLIKNUTÍ---
constlobbyTitle=document.getElementById('lobby-title');

if(lobbyTitle){
lobbyTitle.style.cursor='pointer';
lobbyTitle.title='Kliknutímzkopíruješkódmístnosti';

lobbyTitle.addEventListener('click',()=>{
consttext=lobbyTitle.innerText;
//Odstranímeslovo"MÍSTNOST:"anechámejenkód
constcode=text.replace('MÍSTNOST:','').trim();

if(code&&code!=='----'&&!text.includes('Zkopírováno')){
navigator.clipboard.writeText(code).then(()=>{
constoriginalText=lobbyTitle.innerText;
lobbyTitle.innerText='Zkopírováno!✅';
lobbyTitle.style.color='#2ed573';

setTimeout(()=>{
lobbyTitle.innerText=originalText;
lobbyTitle.style.color='#45f3ff';
},1500);
}).catch(err=>{
console.error('Nepodařilosezkopírovatkód:',err);
});
}
});
}