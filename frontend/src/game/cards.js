//cards.js
const CFG = (typeof window !== 'undefined' && window.CONFIG) ? window.CONFIG : {
    MAX_CAP_HP: 600, MIN_CAP_HP: 30, MAX_CAP_DAMAGE: 999, MIN_CAP_FIRE_RATE: 50,
    MAX_CAP_MOVE_SPEED: 3.5, MIN_CAP_MOVE_SPEED: 0.2, MAX_CAP_BULLET_SPEED: 80,
    MIN_CAP_BULLET_SPEED: 3, MAX_CAP_AMMO: 99, MAX_CAP_LIFESTEAL: 0.50,
    MAX_CAP_BOUNCES: 10, MAX_CAP_PIERCE: 15
};

constavailableCards=[
//=========================================================================
//COMMON
//=========================================================================
{name:"Gumovéprojektily",rarity:"common",description:"Kulkysejednouodrazí.-1Dmg.",apply:(p)=>{p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+1);p.damage=Math.max(1,p.damage-1);}},
{name:"Svačina",rarity:"common",description:"+20%MaxHP.Jsiomalinkopomalejší.",apply:(p)=>{p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.20));p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.02);}},
{name:"Těžkámunice",rarity:"common",description:"Většíkulky,+6Dmg,-2MaxAmmo",apply:(p)=>{p.bulletSize=(p.bulletSize||5)+3;p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+6);p.maxAmmo=Math.max(1,(p.maxAmmo||10)-2);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Kukátko",rarity:"common",description:"Oněcorychlejšíapřesnějšíkulky",apply:(p)=>{p.bulletSpeed=Math.min(CFG.MAX_CAP_BULLET_SPEED,p.bulletSpeed+3);}},
{name:"Běžeckéboty",rarity:"common",description:"Rychlejšípohyb.-10%MaxHP.",apply:(p)=>{p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.15);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.90));}},
{name:"Promazání",rarity:"common",description:"Rychlejšístřelba.Přebíjíšochlupdéle.",apply:(p)=>{p.fireRate=Math.max(CFG.MIN_CAP_FIRE_RATE,p.fireRate-30);p.reloadTime=(p.reloadTime||1500)+100;}},
{name:"Štítzpopelnice",rarity:"common",description:"+25%MaxHP.Jsiznatelněpomalejší.",apply:(p)=>{p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.25));p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.08);}},
{name:"Většíkapsy",rarity:"common",description:"+4Dmga+4MaxAmmo.-10%rychlostpohybu.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+4);p.maxAmmo=Math.min(CFG.MAX_CAP_AMMO,(p.maxAmmo||10)+4);p.ammo=Math.min(p.ammo,p.maxAmmo);p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.05);}},
{name:"Špičaténáboje",rarity:"common",description:"Kulkyprojdouskrz1nepřítele.-2Dmg.",apply:(p)=>{p.pierce=(p.pierce||0)+1;p.damage=Math.max(1,p.damage-2);}},
{name:"Káva",rarity:"common",description:"Rychlejšípohybistřelba.-2MaxAmmo.",apply:(p)=>{p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.1);p.fireRate=Math.max(CFG.MIN_CAP_FIRE_RATE,p.fireRate-15);p.maxAmmo=Math.max(1,(p.maxAmmo||10)-2);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Zpevněnáhlaveň",rarity:"common",description:"+5Dmg.Kulkylétajítrochupomaleji.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+5);p.bulletSpeed=Math.max(3,p.bulletSpeed-1);}},
{name:"Lehkáváha",rarity:"common",description:"Jsimenší.Mášo15%méněMaxHP.",apply:(p)=>{p.playerRadius=Math.max(8,(p.playerRadius||20)-3);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.85));}},
{name:"Lékárnička",rarity:"common",description:"Uzdraví30HPapřidá10%MaxHP.",apply:(p)=>{p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.10));p.hp+=30;}},
{name:"Odhodlání",rarity:"common",description:"+8Dmg,alekulkyletípomalejiapomalejistřílíš.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+8);p.bulletSpeed=Math.max(3,p.bulletSpeed-2);p.fireRate+=30;}},
{name:"Rozšířenýzásobník",rarity:"common",description:"+6MaxAmmo.Přebíjenítrváo0.3sdéle.",apply:(p)=>{p.maxAmmo=Math.min(CFG.MAX_CAP_AMMO,(p.maxAmmo||10)+6);p.ammo=Math.min(p.ammo,p.maxAmmo);p.reloadTime=(p.reloadTime||1500)+300;}},
{name:"Pružnýkrok",rarity:"common",description:"Jsilehčínanohou.+10%rychlostpohybu,-5%MaxHP.",apply:(p)=>{p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.1);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.95));}},
{name:"Plastovélahve",rarity:"common",description:"Kulkyletírychleji,alejsoumenšíadávají-2Dmg.",apply:(p)=>{p.bulletSpeed=Math.min(CFG.MAX_CAP_BULLET_SPEED,p.bulletSpeed+4);p.bulletSize=Math.max(2,(p.bulletSize||5)-2);p.damage=Math.max(1,p.damage-2);}},

//=========================================================================
//UNCOMMON
//=========================================================================
{name:"Brokovnice",rarity:"uncommon",description:"3kulkynaráz.-30%Dmg.Rychlévyprázdnění(-3Ammo).",apply:(p)=>{p.multishot=(p.multishot||1)+2;p.spread=0.1;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-3);p.ammo=Math.min(p.ammo,p.maxAmmo);p.damage=Math.max(2,p.damage*0.70);}},
{name:"Hřebíky",rarity:"uncommon",description:"Kulkyprojdouskrz2nepřátele.Střílíšpomaleji.",apply:(p)=>{p.pierce=(p.pierce||0)+2;p.fireRate+=50;}},
{name:"Flubber",rarity:"uncommon",description:"Kulkyseodrazí3x.Dmgsesnižujeo20%.",apply:(p)=>{p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+3);p.damage=Math.max(2,p.damage*0.80);}},
{name:"Záškodník",rarity:"uncommon",description:"Jsimenšíarychlejší.-25%MaxHP.",apply:(p)=>{p.playerRadius=Math.max(8,(p.playerRadius||20)-5);p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.1);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.75));}},
{name:"Odstřelovač",rarity:"uncommon",description:"Rychlékulky,+15Dmg.Pomalástřelbaa-4Ammo.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+15);p.bulletSpeed=Math.min(CFG.MAX_CAP_BULLET_SPEED,p.bulletSpeed+10);p.fireRate+=200;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-4);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Zdravotník",rarity:"uncommon",description:"+25%MaxHP,2%lifesteal.Jsivětšíterč.",apply:(p)=>{p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.25));p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.02);p.playerRadius=(p.playerRadius||20)+3;}},
{name:"Pružina",rarity:"uncommon",description:"Rychlejšípohyb,2odrazykulek.Tvékulkylétajímnohempomaleji.",apply:(p)=>{p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.2);p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+2);p.bulletSpeed=Math.max(3,p.bulletSpeed-3);}},
{name:"Širokáhlaveň",rarity:"uncommon",description:"Většíkulky,+10Dmg.Pomalejšípřebíjení(+0.4s).",apply:(p)=>{p.bulletSize=(p.bulletSize||5)+3;p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+10);p.reloadTime=(p.reloadTime||1500)+400;}},
{name:"Adrenalin",rarity:"uncommon",description:"+12Dmg,rychlejšípohyb.Stojíto20%MaxHPapřesnost.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+12);p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.2);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.80));p.spread=(p.spread||0)+0.05;}},
{name:"Lehkáspoušť",rarity:"uncommon",description:"Rychlejšístřelba.-3Dmg.",apply:(p)=>{p.fireRate=Math.max(CFG.MIN_CAP_FIRE_RATE,p.fireRate-50);p.damage=Math.max(1,p.damage-3);}},
{name:"Svižnéprsty",rarity:"uncommon",description:"Přebíjíšo30%rychleji.Kapacitazbraně-2Ammo.",apply:(p)=>{p.reloadTime=Math.max(300,(p.reloadTime||1500)*0.7);p.maxAmmo=Math.max(1,(p.maxAmmo||10)-2);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Ocelovýštít",rarity:"uncommon",description:"+35%MaxHP,alejsivýrazněvětšíterčavlečešse(-15%rychlost).",apply:(p)=>{p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.35));p.playerRadius=(p.playerRadius||20)+8;p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.15);}},
{name:"Recyklace",rarity:"uncommon",description:"+15%MaxHP.Tvézbranějsoutrochupřesnější(menšírozptyl).",apply:(p)=>{p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.15));p.spread=Math.max(0,(p.spread||0)-0.05);}},
{name:"Těžkáolovnice",rarity:"uncommon",description:"+8Dmg,kulkyjsouvětší,aleletímnohempomalejiatysevlečeš.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+8);p.bulletSize=(p.bulletSize||5)+4;p.bulletSpeed=Math.max(2,p.bulletSpeed-3);p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.1);}},

//=========================================================================
//RARE
//=========================================================================
{name:"Upír",rarity:"rare",description:"Sáníživotů(5%).Jsipomalejšíakřehčí(-15%MaxHP).",apply:(p)=>{p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.05);p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.05);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.85));}},
{name:"Ještěříkrev",rarity:"rare",description:"Extrémněpomaluregeneruješživoty(+1HP/s).-10%MaxHP.",apply:(p)=>{p.hpRegen=(p.hpRegen||0)+1;p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.90));}},
{name:"Dvojče",rarity:"rare",description:"Střílíš2kulkyvedlesebe.-20%Dmg,-4MaxAmmo.",apply:(p)=>{p.multishot=(p.multishot||1)+1;p.spread=0.05;p.damage=Math.max(2,p.damage*0.80);p.maxAmmo=Math.max(1,(p.maxAmmo||10)-4);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Nindža",rarity:"rare",description:"Jsimenšíarychlý.Extrémněkřehký(-40%MaxHP).",apply:(p)=>{p.playerRadius=Math.max(8,(p.playerRadius||20)-7);p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.25);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.60));}},
{name:"Kanón",rarity:"rare",description:"Obříkulky,+20Dmg.Pohybuješseo15%pomalejiapálíšpomalu.",apply:(p)=>{p.bulletSize=(p.bulletSize||5)+10;p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+20);p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.15);p.fireRate+=100;}},
{name:"Kevlarovýoblek",rarity:"rare",description:"+50%MaxHP,mírněpomalejší.Rychlostkulekistřelbyklesá.",apply:(p)=>{p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.50));p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.1);p.bulletSpeed=Math.max(3,p.bulletSpeed-1.5);p.fireRate+=40;}},
{name:"Trojitáhrozba",rarity:"rare",description:"3kulky,1odraz.-30%Dmg,Přebíjení+0.6s.",apply:(p)=>{p.multishot=(p.multishot||1)+2;p.spread=0.12;p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+1);p.damage=Math.max(2,p.damage*0.70);p.reloadTime=(p.reloadTime||1500)+600;}},
{name:"Chirurg",rarity:"rare",description:"+12Dmg,průrazskrz3.Tvékulkyjsoualemikroskopické(-3velikost)amáš-3Ammo.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+12);p.pierce=(p.pierce||0)+3;p.bulletSize=Math.max(2,(p.bulletSize||5)-3);p.maxAmmo=Math.max(1,(p.maxAmmo||10)-3);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Rychlopalba",rarity:"rare",description:"Rychlejšístřelba,menšíkulky.Rozptylsevýraznězhorší.",apply:(p)=>{p.fireRate=Math.max(CFG.MIN_CAP_FIRE_RATE,p.fireRate-80);p.bulletSize=Math.max(2,(p.bulletSize||5)-2);p.spread=(p.spread||0)+0.15;}},
{name:"Mutant",rarity:"rare",description:"+25%MaxHP,sáníživotů4%.Přebíjenízbranětrváo0.5sdéle.",apply:(p)=>{p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.25));p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.04);p.reloadTime=(p.reloadTime||1500)+500;}},
{name:"Absolutníoptika",rarity:"rare",description:"Laserovápřesnost(0rozptyl),rychlékulky,+15Dmg.Přebíjení+0.8s,-3Ammo.",apply:(p)=>{p.spread=0;p.bulletSpeed=Math.min(CFG.MAX_CAP_BULLET_SPEED,p.bulletSpeed+8);p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+15);p.reloadTime=(p.reloadTime||1500)+800;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-3);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Vysavačduší",rarity:"rare",description:"Lifesteal+4%.Přebíjenítrváo0.6sdéleaztrácíš-15%MaxHP.",apply:(p)=>{p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.04);p.reloadTime=(p.reloadTime||1500)+600;p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.85));}},
{name:"Trojitýprůraz",rarity:"rare",description:"Průrazskrz3cíle,+5Dmg.Ztrácíš3Ammozkapacityapálíšpomaleji.",apply:(p)=>{p.pierce=(p.pierce||0)+3;p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+5);p.maxAmmo=Math.max(1,(p.maxAmmo||10)-3);p.ammo=Math.min(p.ammo,p.maxAmmo);p.fireRate+=100;}},

//=========================================================================
//EPIC
//=========================================================================
{name:"StínovýDash",rarity:"epic",description:"Dashpřidáneviditelnost(zrušísevýstřelem).Trvaleztrácíš25%MaxHPa-2Ammo.",apply:(p)=>{p.invisOnDash=true;p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.75));p.maxAmmo=Math.max(1,(p.maxAmmo||10)-2);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"HolografickýKlon",rarity:"epic",description:"Dashzanecháklon.Rychlostpohybuistřelbyklesáo10%.",apply:(p)=>{p.cloneOnDash=true;p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.08);p.fireRate+=40;}},
{name:"Bumerang",rarity:"epic",description:"Kulkyseodrazí3x.Pomalástřelba,dlouhépřebíjení(+0.8s)a-20%Dmg.",apply:(p)=>{p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+3);p.fireRate+=50;p.reloadTime=(p.reloadTime||1500)+800;p.damage=Math.max(2,p.damage*0.80);}},
{name:"Krvavábrokovnice",rarity:"epic",description:"5kulek,3%lifesteal.Dmg-60%,pálíšpomalu,přebíjení+1s,-5Ammo.",apply:(p)=>{p.multishot=(p.multishot||1)+4;p.spread=0.2;p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.03);p.damage=Math.max(2,p.damage*0.4);p.fireRate+=150;p.reloadTime=(p.reloadTime||1500)+1000;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-5);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Juggernaut",rarity:"epic",description:"Obrovskýterč(+15velikost),+100%MaxHP.-20%Rychlostpohybu,střílíšhrozněpomalu.",apply:(p)=>{p.playerRadius=(p.playerRadius||20)+15;p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*2.00));p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.2);p.fireRate+=120;}},
{name:"Laserovývrtač",rarity:"epic",description:"Rychlékulky,průraz4.Výstřelyžerou-30%Dmgapřebíjíšmnohemdéle.",apply:(p)=>{p.pierce=(p.pierce||0)+4;p.bulletSpeed=Math.min(CFG.MAX_CAP_BULLET_SPEED,p.bulletSpeed+12);p.fireRate+=80;p.damage=Math.max(2,p.damage*0.70);p.reloadTime=(p.reloadTime||1500)+700;}},
{name:"Drtič",rarity:"epic",description:"+30Dmg.Obříkulky.Přebíjenítrváneskutečnědlouho(+1.5s)a-4Ammo.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+30);p.fireRate+=200;p.bulletSize=(p.bulletSize||5)+7;p.reloadTime=(p.reloadTime||1500)+1500;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-4);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Kofeinovýšok",rarity:"epic",description:"Rychlejšívšechno.Stojítěto40%MaxHP,-2Ammoarozptylkulek.",apply:(p)=>{p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.25);p.fireRate=Math.max(CFG.MIN_CAP_FIRE_RATE,p.fireRate-80);p.bulletSpeed=Math.min(CFG.MAX_CAP_BULLET_SPEED,p.bulletSpeed+5);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.60));p.maxAmmo=Math.max(1,(p.maxAmmo||10)-2);p.ammo=Math.min(p.ammo,p.maxAmmo);p.spread=(p.spread||0)+0.1;}},
{name:"Ocelovýježek",rarity:"epic",description:"4kulky,2odrazy,+50%MaxHP.-40%Dmg,dlouhépřebíjení,-5Ammo.",apply:(p)=>{p.multishot=(p.multishot||1)+3;p.spread=0.15;p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+2);p.maxHp=Math.min(CFG.MAX_CAP_HP,Math.floor(p.maxHp*1.50));p.damage=Math.max(2,p.damage*0.6);p.fireRate+=100;p.reloadTime=(p.reloadTime||1500)+900;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-5);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Bezednýpás",rarity:"epic",description:"+25MaxAmmo.Tvůjpohybjeo25%pomalejšíapřebíjení+1.2s.",apply:(p)=>{p.maxAmmo=Math.min(CFG.MAX_CAP_AMMO,(p.maxAmmo||10)+25);p.ammo=p.maxAmmo;p.reloadTime=(p.reloadTime||1500)+1200;p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.25);}},
{name:"Skleněnédělo",rarity:"epic",description:"Extrémnípoškození(+40Dmg)arychlost.TvéMaxHPjealesníženoo75%!",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+40);p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.2);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.25));}},
{name:"Brokovástěna",rarity:"epic",description:"8kulek.Hroznýrozptyl,-50%Dmg,pomalýpohybapřebíjení+1s.",apply:(p)=>{p.multishot=(p.multishot||1)+7;p.spread=0.3;p.damage=Math.max(1,p.damage*0.50);p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.15);p.reloadTime=(p.reloadTime||1500)+1000;}},
{name:"Krvaváoběť",rarity:"epic",description:"+40Dmg,obrovskézrychlení.Ztrácíš60%MaxHPajsivelkýterč.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+40);p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.3);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.40));p.playerRadius=(p.playerRadius||20)+10;}},

//=========================================================================
//LEGENDARY
//=========================================================================
{name:"Minigun",rarity:"legendary",description:"Extrémnírychlost,+40Ammo.Dmg-80%,hroznýrozptyl,rychlost-15%.",apply:(p)=>{p.fireRate=Math.max(CFG.MIN_CAP_FIRE_RATE,p.fireRate*0.2);p.spread=0.25;p.damage=Math.max(1,p.damage*0.20);p.bulletSize=Math.max(2,(p.bulletSize||5)-3);p.maxAmmo=Math.min(CFG.MAX_CAP_AMMO,(p.maxAmmo||10)+40);p.ammo=p.maxAmmo;p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.15);}},
{name:"Hromovárána",rarity:"legendary",description:"Obříkulka,+65Dmg.Pomalástřelba,Přebíjení+2s.Kapacita:Max3Ammo.",apply:(p)=>{p.bulletSize=(p.bulletSize||5)+15;p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+65);p.fireRate+=350;p.reloadTime=(p.reloadTime||1500)+2000;p.maxAmmo=Math.min(3,p.maxAmmo);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Stěnasmrti",rarity:"legendary",description:"7kulek(průraz5).Dmg-70%.Přebíjení+1.5s,-6Ammo.",apply:(p)=>{p.multishot=(p.multishot||1)+6;p.spread=0.15;p.pierce=(p.pierce||0)+5;p.fireRate+=300;p.reloadTime=(p.reloadTime||1500)+1500;p.damage=Math.max(1,p.damage*0.3);p.bulletSpeed=Math.max(3,p.bulletSpeed-5);p.maxAmmo=Math.max(1,(p.maxAmmo||10)-6);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Drakula",rarity:"legendary",description:"Sáníživotů+8%,+15Dmg.TvéMaxHPsesnížío60%.Ztratíš3Ammo.",apply:(p)=>{p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.08);p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+15);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.40));p.fireRate+=120;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-3);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Zrcadlovébludiště",rarity:"legendary",description:"5kulek,4odrazy.-60%Dmg,dlouhýcooldown,přebíjení+1.5s,-5Ammo.",apply:(p)=>{p.multishot=(p.multishot||1)+4;p.spread=0.2;p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+4);p.damage=Math.max(1,p.damage*0.4);p.fireRate+=200;p.reloadTime=(p.reloadTime||1500)+1500;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-5);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Hyper-jádro",rarity:"legendary",description:"Střílíšjakošílený,přebíjíštéměřokamžitě.Dmgklesáo70%,MaxHP-40%.",apply:(p)=>{p.fireRate=Math.max(CFG.MIN_CAP_FIRE_RATE,p.fireRate-200);p.reloadTime=Math.max(200,(p.reloadTime||1500)-1000);p.damage=Math.max(1,p.damage*0.30);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.60));}},

//=========================================================================
//MYTHIC
//=========================================================================
{name:"Matrix",rarity:"mythic",description:"Průraz5,extrémnírychlost,bleskovépřebíjení.-50%MaxHP,Dmg-40%.",apply:(p)=>{p.playerRadius=Math.max(8,(p.playerRadius||20)-8);p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.3);p.pierce=(p.pierce||0)+5;p.reloadTime=Math.max(300,(p.reloadTime||1500)-800);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.50));p.damage=Math.max(2,p.damage*0.6);}},
{name:"Bůhkrve",rarity:"mythic",description:"Lifesteal10%,rychlopalba,+10Dmg.-50%MaxHP,MaxAmmofixovánona3.",apply:(p)=>{p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+10);p.fireRate=Math.max(CFG.MIN_CAP_FIRE_RATE,p.fireRate-120);p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.10);p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.50));p.maxAmmo=Math.min(3,p.maxAmmo);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"Apokalypsa",rarity:"mythic",description:"6kulek,2odrazy.Obříterč,-65%Dmg,šílenépřebíjení(+2.5s),-7Ammo.",apply:(p)=>{p.multishot=(p.multishot||1)+5;p.spread=0.2;p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+2);p.damage=Math.max(1,p.damage*0.35);p.playerRadius=(p.playerRadius||20)+15;p.fireRate+=300;p.reloadTime=(p.reloadTime||1500)+2500;p.maxAmmo=Math.max(1,(p.maxAmmo||10)-7);p.ammo=Math.min(p.ammo,p.maxAmmo);}},
{name:"AbsolutníTicho",rarity:"mythic",description:"Průraz7,5odrazů,+20Dmg.Pohybuješsevmrákotách(-40%rychlost)amaxammoje2.",apply:(p)=>{p.pierce=(p.pierce||0)+7;p.bounces=Math.min(CFG.MAX_CAP_BOUNCES,(p.bounces||0)+5);p.damage=Math.min(CFG.MAX_CAP_DAMAGE,p.damage+20);p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.40);p.maxAmmo=Math.min(2,p.maxAmmo);p.ammo=Math.min(p.ammo,p.maxAmmo);}},

//=========================================================================
//EXOTIC
//=========================================================================
{name:"Zlatákulka",rarity:"exotic",description:`MaximálníDMG(${typeofCFG!=='undefined'?CFG.MAX_CAP_DAMAGE:999}).Průraz10.MášPOUZE1nábojapřebíjíš5vteřin.`,apply:(p)=>{p.damage=CFG.MAX_CAP_DAMAGE;p.bulletSize=Math.max(2,(p.bulletSize||5)-3);p.fireRate+=1000;p.pierce=(p.pierce||0)+10;p.maxAmmo=1;p.ammo=1;p.reloadTime=(p.reloadTime||1500)+5000;}},
{name:"Ruskáruleta",rarity:"exotic",description:"Máš6nábojů.5dělá1Dmg,1dávámasivních+150Dmg(Rozhoduještěstípřikaždémvýstřelu!)",apply:(p)=>{p.isRussianRoulette=true;p.maxAmmo=6;p.ammo=6;}},

//=========================================================================
//TRANSCENDED
//=========================================================================
{name:"Gambler",rarity:"transcended",description:"Rituál:Hazardsmrti.Vdoméněselosuje.Jackpotdávána4.11sabsolutnínesmrtelnostanekonečnomunice.",apply:(p)=>{p.domainType='GAMBLER';p.domainRadius=280;p.jackpotChance=0.15;p.jackpotDuration=4110;p.isJackpotActive=false;p.jackpotPity=0;}},
{name:"KvantovéVězení",rarity:"transcended",description:"Rituál:Zmrazíčas.Extrémnězpomalínepřátele,aletyjsio30%rychlejší.DMGklesneo20%.",apply:(p)=>{p.domainType='QUANTUM_PRISON';p.domainRadius=250;p.moveSpeed=Math.min(CFG.MAX_CAP_MOVE_SPEED,p.moveSpeed+0.3);p.damage=Math.max(1,p.damage*0.8);}},
{name:"ZávojŠílenství",rarity:"transcended",description:"Rituál:Paralyzujeaspalujemyslnepřátelvdosahu(5DMG/s).Stojítěto30%MaxHP.",apply:(p)=>{p.domainType='MADNESS_VEIL';p.domainRadius=250;p.domainDamage=5;p.maxHp=Math.max(CFG.MIN_CAP_HP,Math.floor(p.maxHp*0.7));}},
{name:"KrvavýOltář",rarity:"transcended",description:"Rituál:MasivněvysáváHPvšemuvokolí(10DMG/s)aléčítě.Skorosealenemůžešhýbat(-60%rychlost).",apply:(p)=>{p.domainType='BLOOD_ALTAR';p.domainRadius=220;p.domainDamage=10;p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.2);p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.6);}},
{name:"GravitačníKolaps",rarity:"transcended",description:"Rituál:Drtiváčernádíra.Silněvtahujeadrtínepřátele(15DMG/s).Přebíjíšo2sdéle.",apply:(p)=>{p.domainType='GRAVITY_COLLAPSE';p.domainRadius=300;p.gravityPull=5;p.domainDamage=15;p.reloadTime=(p.reloadTime||1500)+2000;}},
{name:"ZrcadlováSingularita",rarity:"transcended",description:"Rituál:Absolutníobrana.Odrážícizíkulkyzpěts+50%poškozením.Přijdešovšechnynáboje(nemůžešstřílet).",apply:(p)=>{p.domainType='MIRROR_SINGULARITY';p.domainRadius=180;p.reflectDamageMult=1.5;p.maxAmmo=0;p.ammo=0;}},
{name:"NekonečnýArzenál",rarity:"transcended",description:"Rituál:Doménastřílívšudekolemtebezatebe.Tvévlastnízbranědělají-80%DMG.",apply:(p)=>{p.domainType='INFINITE_ARSENAL';p.domainRadius=250;p.arsenalFireRate=50;p.arsenalDamage=10;p.damage=Math.max(1,p.damage*0.2);}},

//---VylepšeníRituálů(Upgradydomén)---
{name:"ProdlouženýRituál",rarity:"legendary",requiresDomain:true,description:"Tvádoménazůstaneaktivnío3vteřinydéle.",apply:(p)=>{p.domainDurationBonus=(p.domainDurationBonus||0)+3000;}},
{name:"MistrRituálů",rarity:"mythic",requiresDomain:true,description:"Zkracujecooldowndoményo20%.",apply:(p)=>{p.domainCooldownModifier=(p.domainCooldownModifier||1)*0.8;}},

//UpravenéSpecifickéUpgrady
{name:"ZmanipulovanáRuleta",rarity:"epic",requiresDomain:true,specificDomain:"GAMBLER",description:"VdoméněGamblersešancenaJackpotzvyšujerychleji(Pityx3).",apply:(p)=>{p.jackpotChance=(p.jackpotChance||0.15)*1.5;p.jackpotPityStep=0.15;}},
{name:"HorečkaJackpotu",rarity:"legendary",requiresDomain:true,specificDomain:"GAMBLER",description:"Jackpottrváo4vteřinydéleazískášběhemnějmasivnírychlostapoškození.",apply:(p)=>{p.jackpotDuration=(p.jackpotDuration||4110)+4000;p.jackpotSpeedBonus=0.5;p.jackpotDamageBonus=20;}},
{name:"KrvaváHostina",rarity:"epic",requiresDomain:true,specificDomain:"BLOOD_ALTAR",description:"Krvavýoltářdávádvojnásobnépoškozeníaléčíještěvíc.",apply:(p)=>{p.domainDamage=(p.domainDamage||10)*2;p.lifesteal=Math.min(CFG.MAX_CAP_LIFESTEAL,(p.lifesteal||0)+0.15);}},
{name:"HorizontUdálostí",rarity:"legendary",requiresDomain:true,specificDomain:"GRAVITY_COLLAPSE",description:"Gravitačníkolapsvtahujezmnohemvětšídálky(+50%dosah).",apply:(p)=>{p.domainRadius=(p.domainRadius||300)*1.5;p.gravityPull=(p.gravityPull||5)*1.3;}},
{name:"KvantovéZmrznutí",rarity:"epic",requiresDomain:true,specificDomain:"QUANTUM_PRISON",description:`Nepřátelévdoméněsepraktickyzastaví(${typeofCFG!=='undefined'?CFG.MIN_CAP_MOVE_SPEED:0.2}).`,apply:(p)=>{p.prisonSlowdown=CFG.MIN_CAP_MOVE_SPEED;}},
{name:"TovárnanaSmrt",rarity:"legendary",requiresDomain:true,specificDomain:"INFINITE_ARSENAL",description:"Nekonečnýarzenálstřílío50%rychlejisdvojnásobnýmDMG.",apply:(p)=>{p.arsenalFireRate=Math.max(10,Math.floor((p.arsenalFireRate||50)*0.66));p.arsenalDamage=(p.arsenalDamage||10)*2;}},
{name:"TříštivéZrcadlo",rarity:"legendary",requiresDomain:true,specificDomain:"MIRROR_SINGULARITY",description:"Odrážíkulkysbrutálním300%bonusemkpoškození,aleztratíš20%rychlosti.",apply:(p)=>{p.reflectDamageMult=(p.reflectDamageMult||1.5)+1.5;p.moveSpeed=Math.max(CFG.MIN_CAP_MOVE_SPEED,p.moveSpeed-0.2);}}
];

function getValidCardsForPlayer(player) {
    return availableCards.filter(card => {
        if (card.rarity === 'transcended' && !card.requiresDomain) {
            if (player.domainType) return false;
        }
        if (card.requiresDomain && !card.specificDomain) {
            if (!player.domainType) return false;
        }
        if (card.specificDomain) {
            if (player.domainType !== card.specificDomain) return false;
        }
        return true;
    });
}

// ÚPLNÝ KONEC SOUBORU cards.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { availableCards, getValidCardsForPlayer };
} else if (typeof window !== 'undefined') {
    window.availableCards = availableCards;
    window.getValidCardsForPlayer = getValidCardsForPlayer;
}