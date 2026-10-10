// Practica con el triángulo · mirardespacio.es/juegos/triangulo/
// Simulador del triángulo de exposición: ISO, velocidad y diafragma. Todo se calcula en el navegador.
(function(){
const SH=[1/4000,1/2000,1/1000,1/500,1/250,1/125,1/60,1/30,1/15,1/8,1/4,1/2,1];
const AP=[1.4,2,2.8,4,5.6,8,11,16];
const ISO=[100,200,400,800,1600,3200,6400,12800];
const fmtSh=t=>t>=1?`${t} s`:`1/${Math.round(1/t)}`;
const W=720,H=450;

/* ---------- retos fijos ---------- */
const LEVELS=[
 {scene:"l1",kick:"Reto 1 · Interior",title:"Retrato junto a la ventana",
  text:"Tarde de octubre en un piso de Lavapiés. El muñeco de estudio está quieto junto a la ventana y quieres que la estantería del fondo se funda en manchas suaves.",
  goals:["85 mm a pulso","Fondo separado","Poca luz"],
  ev:7,focal:85,speed:20,lim:4,isoTol:1600,dofMin:6,dofMax:99,apMin:0,isoMax:7,
  note:"Aquí lo que manda es el diafragma. Ábrelo primero y luego ajusta las otras dos.",start:[5,3,1]},
 {scene:"l2",kick:"Reto 2 · Movimiento",title:"Perro a la carrera",
  text:"Últimas luces en el Retiro. Un golden cruza el camino a toda velocidad y lo sigues con el tele. Quieres al perro congelado, con cada pelo nítido.",
  goals:["200 mm","Sujeto muy rápido","Buena luz"],
  ev:13,focal:200,speed:2200,lim:4,isoTol:1600,dofMin:1.5,dofMax:99,apMin:0,isoMax:7,
  note:"Con un perro corriendo empieza por la velocidad: 1/1000 como mínimo. Lo demás se adapta.",start:[5,4,0]},
 {scene:"l3",kick:"Reto 3 · Noche",title:"Gran Vía, 22:40",
  text:"Calle de noche, cámara en mano, sin trípode. Un peatón cruza bajo los neones. Quieres al peatón definido y que se lea la calle de fondo.",
  goals:["35 mm a pulso","Muy poca luz","Que se lea la calle"],
  ev:4,focal:35,speed:260,lim:5,isoTol:3200,dofMin:0,dofMax:5,apMin:0,isoMax:7,
  note:"De noche toca negociar: algo de ruido es aceptable, una foto movida no.",start:[4,5,2]},
];
const LOCKED=["Concierto en sala","Larga exposición","Teatro sin flash"]; // llegarán con Mirar Despacio+

/* ---------- definición de escenas para el generador ---------- */
const SCENES_DEF={
 l1:{kick:"Interior",subj:"El muñeco",af:[.64,.36],fRef:85,kRef:14,lim:4,
   evR:[5,9],focals:[35,50,85,135],isoTols:[1600,3200],
   title:ev=>ev<=5?"Retrato con la última luz":ev<=7?"Retrato junto a la ventana":"Retrato a pleno día",
   light:ev=>ev<=5?"Casi de noche: solo entra un resto de luz azul por la ventana.":ev<=7?"Tarde nublada, luz suave de ventana.":"Mediodía, con el sol rebotando en la pared.",
   speed:r=>r()<.65?[8+r()*15,"El muñeco está quieto en su peana."]:[40+r()*50,"El muñeco gira despacio sobre una peana giratoria."],
   dof:{min:"Quieres que la estantería se funda en manchas.",max:"Quieres que se reconozca la habitación entera."},
   chip:{min:"Fondo separado",max:"Habitación nítida"},minR:[5,8],maxR:[2.5,3.5]},
 l2:{kick:"Movimiento",subj:"El perro",af:[.5,.68],fRef:200,kRef:10,lim:4,
   evR:[10,15],focals:[85,135,200,300],isoTols:[1600,3200],
   title:ev=>ev<=11?"Perro al anochecer":ev<=13?"Perro a la carrera":"Perro a mediodía",
   light:ev=>ev<=11?"El sol ya se ha puesto en el Retiro.":ev<=13?"Últimas luces de la tarde en el Retiro.":"Sol de mediodía en el Retiro, sin una nube.",
   speed:r=>r()<.6?[1700+r()*1300,"Un golden cruza el camino a toda velocidad."]:[600+r()*500,"Un perro trota tranquilo por el camino."],
   dof:{min:"Quieres al perro despegado del fondo.",max:"Quieres el parque entero nítido, árboles incluidos."},
   chip:{min:"Fondo separado",max:"Todo nítido"},minR:[1.5,4],maxR:[1.5,2.2]},
 l3:{kick:"Noche",subj:"El peatón",af:[.42,.5],fRef:35,kRef:8,lim:5,
   evR:[2,6],focals:[24,35,50],isoTols:[3200,6400],
   title:ev=>ev<=3?"Callejón con una farola":ev<=5?"Gran Vía de noche":"Callao con las pantallas",
   light:ev=>ev<=3?"Callejón con una sola farola, cámara en mano.":ev<=5?"Gran Vía con los neones encendidos, cámara en mano.":"Plaza del Callao con las pantallas a tope, cámara en mano.",
   speed:r=>r()<.5?[280+r()*150,"Alguien cruza con prisa."]:[120+r()*80,"Un peatón pasea sin prisa."],
   dof:{min:"Quieres los neones convertidos en bolas de luz.",max:"Quieres que se lea la calle de fondo."},
   chip:{min:"Neones en bokeh",max:"Que se lea la calle"},minR:[5,8],maxR:[3,6]},
};
const SUBJ_OF={l1:"El muñeco",l2:"El perro",l3:"El peatón"};
const AF_OF={l1:[.64,.36],l2:[.5,.68],l3:[.42,.5]};
const KREF={l1:[85,14],l2:[200,10],l3:[35,8]};
const kOf=(scene,focal)=>KREF[scene][1]*Math.pow(focal/KREF[scene][0],2);

/* ---------- utilidades ---------- */
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const pick=(r,a)=>a[(r()*a.length)|0];
function mk(w=W,h=H){const c=document.createElement("canvas");c.width=w;c.height=h;return c}
const testCtx=mk(2,2).getContext("2d");
const hasFilter=(()=>{try{testCtx.filter="blur(2px)";return testCtx.filter==="blur(2px)"}catch(e){return false}})();
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* ---------- escenas ---------- */
function bgInterior(c){
  const x=c.getContext("2d"),r=rng(7);
  let g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,"#7a5640");g.addColorStop(1,"#3e2b20");x.fillStyle=g;x.fillRect(0,0,W,H);
  g=x.createLinearGradient(40,0,230,0);g.addColorStop(0,"#fbf4e4");g.addColorStop(1,"#e9dcc2");x.fillStyle=g;x.fillRect(40,40,190,300);
  x.fillStyle="#5b4030";x.fillRect(132,40,8,300);x.fillRect(40,186,190,8);x.strokeStyle="#5b4030";x.lineWidth=10;x.strokeRect(40,40,190,300);
  g=x.createRadialGradient(140,200,20,140,200,320);g.addColorStop(0,"rgba(255,230,190,.35)");g.addColorStop(1,"rgba(255,230,190,0)");x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle="#4a3426";x.fillRect(300,30,400,360);
  const cols=["#b0493a","#d8a24a","#3f6d6a","#e7d8bf","#6b4f8a","#2e4a6b","#c96f3c","#8f9b5a"];
  for(let s=0;s<4;s++){const y=48+s*86;x.fillStyle="#2c1f17";x.fillRect(300,y+70,400,8);
    let bx=310;while(bx<690){const bw=10+r()*18,bh=42+r()*26;x.fillStyle=cols[(r()*cols.length)|0];x.fillRect(bx,y+70-bh,bw,bh);bx+=bw+2+(r()<.15?18:0)}}
  for(let i=0;i<16;i++){const lx=300+i*26,ly=26+Math.sin(i*.7)*10;const gg=x.createRadialGradient(lx,ly,0,lx,ly,9);gg.addColorStop(0,"#fff6d8");gg.addColorStop(.4,"#ffc96b");gg.addColorStop(1,"rgba(255,180,80,0)");x.fillStyle=gg;x.beginPath();x.arc(lx,ly,9,0,7);x.fill()}
  x.fillStyle="#2f4a2c";for(let i=0;i<9;i++){x.beginPath();x.ellipse(250+r()*40,300+r()*60,10,34,r()*2-1,0,7);x.fill()}
  x.fillStyle="#6b4a35";x.fillRect(240,370,60,80);
}
// muñeco de estudio calvo, iluminado desde la ventana (izquierda)
function subjMannequin(c){
  const x=c.getContext("2d"),cx=482;
  // busto
  let g=x.createLinearGradient(380,0,600,0);g.addColorStop(0,"#ecdcc4");g.addColorStop(.55,"#c9ad8a");g.addColorStop(1,"#8d7255");
  x.fillStyle=g;x.beginPath();
  x.moveTo(cx-120,450);x.bezierCurveTo(cx-122,370,cx-104,318,cx-46,300);
  x.quadraticCurveTo(cx-22,292,cx-18,272);x.lineTo(cx+18,272);x.quadraticCurveTo(cx+22,292,cx+46,300);
  x.bezierCurveTo(cx+104,318,cx+122,370,cx+120,450);x.closePath();x.fill();
  // cuello
  g=x.createLinearGradient(cx-22,0,cx+22,0);g.addColorStop(0,"#efe0c9");g.addColorStop(1,"#a88a68");
  x.fillStyle=g;x.fillRect(cx-20,226,40,60);
  x.strokeStyle="rgba(90,64,40,.45)";x.lineWidth=2;x.beginPath();x.ellipse(cx,266,21,5,0,0,Math.PI);x.stroke();
  // sombra del mentón en el cuello
  x.fillStyle="rgba(70,48,30,.28)";x.beginPath();x.ellipse(cx+4,232,22,9,0,0,7);x.fill();
  // cabeza calva (huevo), girada levemente hacia la ventana
  g=x.createRadialGradient(cx-24,150,8,cx+6,180,78);g.addColorStop(0,"#fbf1e1");g.addColorStop(.5,"#dcc5a6");g.addColorStop(1,"#93775a");
  x.fillStyle=g;x.beginPath();x.ellipse(cx,178,48,62,-.06,0,7);x.fill();
  // brillo en la calva
  g=x.createRadialGradient(cx-20,138,0,cx-20,138,26);g.addColorStop(0,"rgba(255,255,255,.55)");g.addColorStop(1,"rgba(255,255,255,0)");
  x.fillStyle=g;x.beginPath();x.arc(cx-20,138,26,0,7);x.fill();
  // oreja (lado en sombra)
  x.fillStyle="#a98b6a";x.beginPath();x.ellipse(cx+44,184,8,15,.15,0,7);x.fill();
  // insinuación de facciones: arco de la ceja y nariz
  x.strokeStyle="rgba(110,82,56,.5)";x.lineWidth=2.2;x.lineCap="round";
  x.beginPath();x.moveTo(cx-34,168);x.quadraticCurveTo(cx-22,160,cx-8,166);x.stroke();
  x.beginPath();x.moveTo(cx-14,172);x.quadraticCurveTo(cx-26,196,cx-18,202);x.stroke();
  x.fillStyle="rgba(90,64,40,.2)";x.beginPath();x.ellipse(cx-4,198,9,5,0,0,7);x.fill();
  x.strokeStyle="rgba(110,70,56,.4)";x.beginPath();x.moveTo(cx-22,216);x.quadraticCurveTo(cx-12,220,cx-2,216);x.stroke();
}
function bgPark(c){
  const x=c.getContext("2d"),r=rng(21);
  let g=x.createLinearGradient(0,0,0,240);g.addColorStop(0,"#9cc2d8");g.addColorStop(1,"#f1d6a8");x.fillStyle=g;x.fillRect(0,0,W,H);
  for(let i=0;i<26;i++){const tx=r()*W,ty=120+r()*80,rr=40+r()*50;x.fillStyle=["#4f7a3a","#3d6630","#6a8f42","#2f5228"][(r()*4)|0];x.beginPath();x.arc(tx,ty,rr,0,7);x.fill()}
  for(let i=0;i<8;i++){x.fillStyle="#4a3424";x.fillRect(40+i*95+r()*30,170,8,110)}
  g=x.createLinearGradient(0,250,0,H);g.addColorStop(0,"#7da24f");g.addColorStop(1,"#557a34");x.fillStyle=g;x.fillRect(0,250,W,200);
  x.fillStyle="#d9c29a";x.beginPath();x.moveTo(0,330);x.lineTo(W,300);x.lineTo(W,400);x.lineTo(0,430);x.closePath();x.fill();
  x.fillStyle="#6b4a2e";x.fillRect(560,262,110,10);x.fillRect(570,272,6,26);x.fillRect(655,272,6,26);
}
function subjDog(c){
  const x=c.getContext("2d"),cx=360,cy=300;
  x.strokeStyle="#c8913f";x.lineCap="round";x.lineWidth=11;
  [[-36,18,-70,56],[-20,20,-10,62],[30,18,64,52],[42,16,80,44]].forEach(l=>{x.beginPath();x.moveTo(cx+l[0],cy+l[1]);x.lineTo(cx+l[2],cy+l[3]);x.stroke()});
  x.lineWidth=12;x.beginPath();x.moveTo(cx-58,cy-8);x.quadraticCurveTo(cx-96,cy-34,cx-118,cy-22);x.stroke();
  const g=x.createLinearGradient(0,cy-40,0,cy+30);g.addColorStop(0,"#f0c77c");g.addColorStop(1,"#c8913f");x.fillStyle=g;
  x.beginPath();x.ellipse(cx,cy,68,32,-.05,0,7);x.fill();
  x.beginPath();x.ellipse(cx+66,cy-28,30,26,0,0,7);x.fill();
  x.beginPath();x.ellipse(cx+94,cy-18,20,12,0,0,7);x.fill();
  x.fillStyle="#a8722e";x.beginPath();x.ellipse(cx+56,cy-20,12,22,.4,0,7);x.fill();
  x.fillStyle="#1d1410";x.beginPath();x.arc(cx+112,cy-20,5,0,7);x.arc(cx+76,cy-36,3.5,0,7);x.fill();
  x.fillStyle="#d9566a";x.beginPath();x.ellipse(cx+102,cy-4,8,5,.3,0,7);x.fill();
}
function bgNight(c){
  const x=c.getContext("2d"),r=rng(99);
  let g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,"#11142a");g.addColorStop(1,"#272444");x.fillStyle=g;x.fillRect(0,0,W,H);
  let bx=0;while(bx<W){const bw=70+r()*90,bh=180+r()*170;x.fillStyle=["#221f2e","#2a2535","#1d1b28"][(r()*3)|0];x.fillRect(bx,H-110-bh,bw,bh);
    for(let wy=H-100-bh;wy<H-130;wy+=22)for(let wx=bx+8;wx<bx+bw-12;wx+=18){if(r()<.45){x.fillStyle=r()<.5?"#ffd78a":"#f7b75e";x.fillRect(wx,wy,9,12)}}
    bx+=bw+4}
  const neon=(nx,ny,w,h,col)=>{x.save();x.shadowColor=col;x.shadowBlur=26;x.fillStyle=col;x.fillRect(nx,ny,w,h);x.restore()};
  neon(70,120,110,26,"#ff4f9a");neon(470,90,80,40,"#ffa53a");neon(600,170,26,90,"#66d6ff");neon(250,160,90,20,"#ff7a4a");
  g=x.createLinearGradient(0,H-110,0,H);g.addColorStop(0,"#2b2733");g.addColorStop(1,"#151319");x.fillStyle=g;x.fillRect(0,H-110,W,110);
  [[120,"#ff4f9a"],[500,"#ffa53a"],[612,"#66d6ff"]].forEach(([rx,col])=>{x.globalAlpha=.35;x.fillStyle=col;x.fillRect(rx-20,H-100,40+r()*20,90);x.globalAlpha=1});
  [[200,200],[660,210]].forEach(([lx,ly])=>{x.fillStyle="#3a3644";x.fillRect(lx-2,ly,4,H-110-ly);const gg=x.createRadialGradient(lx,ly,0,lx,ly,40);gg.addColorStop(0,"#fff1c9");gg.addColorStop(.25,"rgba(255,210,140,.6)");gg.addColorStop(1,"rgba(255,200,120,0)");x.fillStyle=gg;x.beginPath();x.arc(lx,ly,40,0,7);x.fill()});
}
function subjWalker(c){
  const x=c.getContext("2d"),cx=300,fy=410;
  x.strokeStyle="#1f1a22";x.lineCap="round";x.lineWidth=13;
  x.beginPath();x.moveTo(cx-4,fy-110);x.lineTo(cx-34,fy);x.moveTo(cx+4,fy-110);x.lineTo(cx+30,fy-4);x.stroke();
  const g=x.createLinearGradient(cx-40,0,cx+40,0);g.addColorStop(0,"#a03c3c");g.addColorStop(1,"#6c2428");x.fillStyle=g;
  x.beginPath();x.moveTo(cx-30,fy-220);x.lineTo(cx+30,fy-220);x.lineTo(cx+40,fy-100);x.lineTo(cx-40,fy-100);x.closePath();x.fill();
  x.fillStyle="#d9a684";x.beginPath();x.arc(cx,fy-246,22,0,7);x.fill();
  x.fillStyle="#2b1d18";x.beginPath();x.arc(cx,fy-254,22,Math.PI,0);x.fill();
  x.strokeStyle="#6c2428";x.lineWidth=11;x.beginPath();x.moveTo(cx+26,fy-210);x.lineTo(cx+44,fy-140);x.moveTo(cx-26,fy-210);x.lineTo(cx-48,fy-150);x.stroke();
}
const SCENES={l1:[bgInterior,subjMannequin],l2:[bgPark,subjDog],l3:[bgNight,subjWalker]};
const cache={};
function layers(id){if(!cache[id]){const b=mk(),s=mk();SCENES[id][0](b);SCENES[id][1](s);cache[id]={b,s}}return cache[id]}

/* ---------- desenfoque ---------- */
const small=mk();
function blurred(src,r){
  r=Math.min(r,30);
  const o=mk(),x=o.getContext("2d");
  if(r<.6){x.drawImage(src,0,0);return o}
  const z=1+r*2.6/W*2;
  if(hasFilter){x.filter=`blur(${r}px)`;x.drawImage(src,-(W*z-W)/2,-(H*z-H)/2,W*z,H*z);x.filter="none";return o}
  const s=Math.max(1,r/1.4),sw=Math.max(8,W/s|0),sh=Math.max(5,H/s|0),sx=small.getContext("2d");
  sx.clearRect(0,0,W,H);sx.imageSmoothingQuality="high";sx.drawImage(src,0,0,sw,sh);
  x.imageSmoothingQuality="high";x.drawImage(small,0,0,sw,sh,0,0,W,H);return o
}

/* ---------- física y puntuación ---------- */
function calc(L,si,ai,ii){
  const t=SH[si],N=AP[ai],iso=ISO[ii];
  const camEV=Math.log2(N*N/t)-Math.log2(iso/100);
  const delta=L.ev-camEV;
  const motion=L.speed*t;
  const shake=Math.min(18,Math.max(0,t*L.focal-1)*3);
  const bg=kOf(L.scene,L.focal)/N;
  const sigma=1.1*Math.pow(iso/100,.55);
  return {si,ai,ii,t,N,iso,delta,motion,shake,bg,sigma}
}
function score(L,p){
  const exp=Math.max(0,100-45*Math.max(0,Math.abs(p.delta)-.25));
  const blur=p.motion+p.shake;
  const sharp=blur<=L.lim?100:Math.max(0,100-(blur-L.lim)*9);
  const over=Math.log2(p.iso/L.isoTol);
  const noise=over<=0?100:Math.max(0,100-35*over);
  const dof=p.bg<L.dofMin?Math.max(0,100-(L.dofMin-p.bg)*18):p.bg>L.dofMax?Math.max(0,100-(p.bg-L.dofMax)*18):100;
  const total=Math.round(exp*.35+sharp*.3+noise*.15+dof*.2);
  return {exp,sharp,noise,dof,total}
}
function solve(L){
  let best=null;
  for(let si=0;si<SH.length;si++)for(let ai=L.apMin;ai<AP.length;ai++)for(let ii=0;ii<=L.isoMax;ii++){
    const p=calc(L,si,ai,ii),s=score(L,p);
    // a igualdad de puntos, prefiere ISO bajo
    if(!best||s.total>best.s.total||(s.total===best.s.total&&ii<best.p.ii))best={p,s};
  }
  return best
}

/* ---------- generador de escenas ---------- */
function generate(r,kickPrefix){
  for(let tries=0;tries<80;tries++){
    const scene=pick(r,["l1","l2","l3"]),D=SCENES_DEF[scene];
    const ev=D.evR[0]+((r()*(D.evR[1]-D.evR[0]+1))|0);
    const focal=pick(r,D.focals);
    const [speed,subjLine]=D.speed(r);
    const dofType=r()<.6?"min":"max";
    const dofMin=dofType==="min"?D.minR[0]+r()*(D.minR[1]-D.minR[0]):0;
    const dofMax=dofType==="max"?D.maxR[0]+r()*(D.maxR[1]-D.maxR[0]):99;
    let apMin=0,isoMax=7,rule=null;
    const rr=r();
    if(rr<.25){isoMax=3+((r()*3)|0);rule=`Tu cámara no pasa de ISO ${ISO[isoMax]}`}
    else if(rr<.5){apMin=2+((r()*2)|0);rule=`Tu objetivo más luminoso es f/${AP[apMin]}`}
    const isoTol=pick(r,D.isoTols);
    const L={scene,kick:`${kickPrefix} · ${D.kick}`,title:D.title(ev),
      text:`${D.light(ev)} ${subjLine} ${D.dof[dofType]}`,
      goals:[`${focal} mm a pulso`,D.chip[dofType]],rule,
      ev,focal,speed,lim:D.lim,isoTol,dofMin,dofMax,apMin,isoMax};
    const sol=solve(L);
    if(sol.s.total<85)continue;
    // no queremos retos triviales: la posición inicial no debe ser ya buena
    L.start=[5,Math.max(apMin,3),Math.min(isoMax,2)];
    if(score(L,calc(L,...L.start)).total>=70){L.start=[pick(r,[2,8]),Math.max(apMin,pick(r,[1,6])),Math.min(isoMax,pick(r,[0,5]))]}
    const lowLight=ev<=(scene==="l3"?3:scene==="l1"?5:11);
    L.note=speed>1000?"Con un sujeto tan rápido, la velocidad no se negocia. Fíjala primero y busca la luz en las otras dos.":
      dofType==="min"?"Empieza por el diafragma, que es lo que decide el fondo. Luego cuadra la luz con velocidad e ISO.":
      lowLight?"Con tan poca luz toca repartir el sacrificio: un poco de ruido antes que una foto movida.":
      "Cuando quieres todo nítido, cierra el diafragma y compensa la luz con la velocidad mientras puedas.";
    L.solution=sol;
    return L;
  }
  return Object.assign({},LEVELS[0]);
}

/* ---------- render ---------- */
const cv=document.getElementById("cv"),ctx=cv.getContext("2d",{willReadFrequently:true});
const frame=mk(),acc=mk();
function render(L,p){
  const {b,s}=layers(L.scene);
  const bgB=blurred(b,p.bg);
  const fx=frame.getContext("2d"),ax=acc.getContext("2d");
  const n=Math.min(28,Math.max(1,Math.ceil(p.motion/1.6)));
  ax.globalAlpha=1;ax.clearRect(0,0,W,H);
  for(let i=0;i<n;i++){
    const dx=n===1?0:(i/(n-1)-.5)*Math.min(p.motion,220);
    fx.clearRect(0,0,W,H);fx.drawImage(bgB,0,0);fx.drawImage(s,dx,0);
    ax.globalAlpha=1/(i+1);ax.drawImage(frame,0,0);
  }
  ctx.globalAlpha=1;ctx.clearRect(0,0,W,H);
  const m=Math.min(14,Math.max(1,Math.ceil(p.shake/1.5)));
  for(let i=0;i<m;i++){
    const k=m===1?0:i/(m-1),a=k*2.4;
    ctx.globalAlpha=1/(i+1);ctx.drawImage(acc,Math.cos(a)*p.shake*.5*k,Math.sin(a*1.3)*p.shake*.35*k);
  }
  ctx.globalAlpha=1;
  const g=Math.pow(2,p.delta),lut=new Uint8ClampedArray(256);
  for(let v=0;v<256;v++)lut[v]=255*Math.pow(Math.min(1,Math.pow(v/255,2.2)*g),1/2.2);
  const im=ctx.getImageData(0,0,W,H),d=im.data,sg=p.sigma;
  for(let i=0;i<d.length;i+=4){
    const n0=(Math.random()+Math.random()+Math.random()-1.5)*2*sg;
    d[i]=lut[d[i]]+n0+(Math.random()-.5)*sg*.8;
    d[i+1]=lut[d[i+1]]+n0+(Math.random()-.5)*sg*.8;
    d[i+2]=lut[d[i+2]]+n0+(Math.random()-.5)*sg*.8;
  }
  ctx.putImageData(im,0,0);
}

/* ---------- interfaz ---------- */
const $=id=>document.getElementById(id);
const dSh=$("d-sh"),dAp=$("d-ap"),dIso=$("d-iso");
let mode="retos",cur=0,L=null,raf=0,lastShot=null;
let best=store.get("triangulo",{});

(function(){const sc=$("scale");for(let v=-3;v<=3;v+=1/3){const i=document.createElement("i");const maj=Math.abs(v-Math.round(v))<.01;if(maj)i.className="maj";i.style.left=((v+3)/6*100)+"%";sc.appendChild(i);
  if(maj){const l=document.createElement("em");l.className="lbl";l.textContent=Math.round(v)===0?"0":(v>0?"+":"")+Math.round(v);l.style.left=((v+3)/6*100)+"%";sc.appendChild(l)}}})();

function setTicks(el,labels){el.innerHTML=labels.map(t=>`<span>${t}</span>`).join("")}
function applyLimits(){
  dSh.min=0;dSh.max=SH.length-1;setTicks($("t-sh"),["1/4000","1/250","1/15","1 s"]);
  dAp.min=L.apMin;dAp.max=AP.length-1;
  const apL=[L.apMin,Math.round((L.apMin+7)/2),7].map(i=>"f/"+AP[i]);setTicks($("t-ap"),apL);
  dIso.min=0;dIso.max=L.isoMax;
  const isoL=[0,Math.round(L.isoMax/2),L.isoMax].map(i=>ISO[i]);setTicks($("t-iso"),isoL);
}

/* reto del día */
const today=new Date();
const dayKey=today.getFullYear()*10000+(today.getMonth()+1)*100+today.getDate();
const dayLabel=today.toLocaleDateString("es-ES",{day:"numeric",month:"long"});
function dailyDone(){const d=store.get("triangulo-dia",null);return d&&d.key===dayKey?d:null}
function countdown(){const n=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);const ms=n-new Date();const h=Math.floor(ms/3.6e6),m=Math.floor(ms%3.6e6/6e4);return `${h} h ${m} min`}
$("dia-badge").hidden=!!dailyDone();

function drawLevels(){
  const nav=$("levels");nav.innerHTML="";nav.hidden=mode!=="retos";
  if(mode!=="retos")return;
  LEVELS.forEach((lv,i)=>{const b=document.createElement("button");b.className="lvl";b.setAttribute("aria-pressed",i===cur);
    const st=best["l"+i]?"★".repeat(best["l"+i]):"";
    b.innerHTML=`${i+1}. ${lv.title}${st?` <span class="st">${st}</span>`:""}`;b.onclick=()=>loadLevel(i);nav.appendChild(b)});
  LOCKED.forEach((t,i)=>{const b=document.createElement("button");b.className="lvl locked";b.disabled=true;b.innerHTML=`${LEVELS.length+i+1}. ${t} <span class="tag">Pronto en MD+</span>`;nav.appendChild(b)});
}
function setMode(m){
  mode=m;
  document.querySelectorAll(".mode").forEach(b=>b.setAttribute("aria-selected",b.dataset.mode===m));
  $("reroll").hidden=m!=="azar";
  const info=$("modeinfo");
  if(m==="azar"){info.hidden=false;info.innerHTML="Escenas sorteadas: cambia la luz, el objetivo, el sujeto y a veces tu equipo. <b>Siempre hay al menos una combinación de tres estrellas.</b>";loadRandom()}
  else if(m==="dia"){info.hidden=false;info.innerHTML=`Reto del ${dayLabel}. <b>El mismo para todos y un solo disparo.</b> Piénsalo antes de apretar.`;loadDaily()}
  else{info.hidden=true;loadLevel(cur)}
  drawLevels();
}
function showBrief(){
  $("b-kick").textContent=L.kick;$("b-title").textContent=L.title;$("b-text").textContent=L.text;
  $("b-goals").innerHTML=L.goals.map(g=>`<li>${g}</li>`).join("")+(L.rule?`<li class="rule">${L.rule}</li>`:"");
  const af=$("af"),a=AF_OF[L.scene];af.style.left=a[0]*100+"%";af.style.top=a[1]*100+"%";
}
function prepare(lv){
  L=lv;if(!L.solution)L.solution=solve(L);
  applyLimits();showBrief();
  [dSh.value,dAp.value,dIso.value]=L.start;
  $("result").hidden=true;lockControls(false);update();
}
function loadLevel(i){cur=i;prepare(Object.assign({},LEVELS[i],{key:"l"+i}));drawLevels()}
function loadRandom(){prepare(generate(rng((Math.random()*2**31)|0),"Aleatorio"))}
function loadDaily(){
  prepare(generate(rng(dayKey*7919),`Reto del ${dayLabel}`));
  const d=dailyDone();
  if(d){[dSh.value,dAp.value,dIso.value]=d.settings;update();shoot(true)}
}
function lockControls(on){[dSh,dAp,dIso].forEach(e=>e.disabled=on);$("shoot").disabled=on;$("shoot-txt").textContent=on?"Ya has disparado hoy":"Disparar"}

function update(){
  const p=calc(L,+dSh.value,+dAp.value,+dIso.value);
  $("v-sh").textContent=fmtSh(p.t);$("v-ap").textContent="f/"+p.N;$("v-iso").textContent=p.iso;
  $("sv-sh").innerHTML=`<b>${fmtSh(p.t)}</b>`;$("sv-ap").innerHTML=`<b>f/${p.N}</b>`;$("sv-iso").innerHTML=`ISO <b>${p.iso}</b>`;$("sv-fl").textContent=L.focal+" mm";
  const d=Math.max(-3,Math.min(3,p.delta));$("needle").style.left=((d+3)/6*100)+"%";
  const r=Math.round(p.delta*3)/3;$("evtxt").textContent=Math.abs(r)<.05?"±0":(r>0?"+":"−")+Math.abs(r).toFixed(1).replace(".0","");
  cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>render(L,p));
  return p;
}
function stopsTxt(x){const a=Math.round(Math.abs(x));return a===1?"un paso":`${a} pasos`}
const DOF_LOW={l1:"El fondo compite con el muñeco. Abre el diafragma para que la estantería se convierta en manchas.",l2:"El perro se pierde entre los árboles. Abre el diafragma para despegarlo del fondo.",l3:"Los neones siguen siendo letreros. Abre el diafragma para convertirlos en bolas de luz."};
const DOF_HIGH={l1:"La habitación se ha deshecho en manchas. Cierra el diafragma para que se reconozca.",l2:"El parque se ha difuminado. Cierra el diafragma para dejarlo nítido.",l3:"La calle se ha deshecho y pierdes el contexto. Cierra el diafragma un paso o dos."};
const squares=v=>v>=85?"🟩":v>=55?"🟨":"🟥";

function shoot(fromStore){
  const p=update(),s=score(L,p);
  if(!fromStore){const f=$("flash");f.classList.remove("go");void f.offsetWidth;f.classList.add("go")}
  const stars=s.total>=85?3:s.total>=65?2:s.total>=40?1:0;
  if(mode==="retos"&&stars>(best[L.key]||0)){best[L.key]=stars;store.set("triangulo",best)}
  $("r-score").innerHTML=`${s.total}<small> / 100</small>`;
  $("r-stars").innerHTML=[0,1,2].map(i=>`<span class="${i<stars?"":"off"}">★</span>`).join("");
  const col=v=>v>=85?"var(--ok)":v>=55?"var(--warn)":"var(--bad)";
  const parts=[["Exposición",s.exp],["Nitidez",s.sharp],["Ruido",s.noise],["Fondo",s.dof]];
  $("r-bars").innerHTML=parts.map(([n,v])=>`<span>${n}</span><div class="bar"><span style="width:${Math.round(v)}%;background:${col(v)}"></span></div><span class="n">${Math.round(v)}</span>`).join("");
  const msgs=[],subj=SUBJ_OF[L.scene];
  if(Math.abs(p.delta)>=.5)msgs.push(p.delta>0?`Sale ${stopsTxt(p.delta)} sobreexpuesta. Sobra luz: velocidad más rápida, diafragma más cerrado o ISO más bajo.`:`Sale ${stopsTxt(p.delta)} subexpuesta. Falta luz: abre el diafragma, alarga la velocidad o sube el ISO.`);
  if(p.motion>L.lim){const need=SH.filter(t=>L.speed*t<=L.lim).pop();msgs.push(`${subj} sale movido (${Math.round(p.motion)} px de barrido). Necesitas ${fmtSh(need)} o más rápido.`)}
  if(p.shake>1.2)msgs.push(`Toda la foto tiembla. Con ${L.focal} mm a pulso, no bajes de 1/${L.focal}.`);
  if(p.iso>L.isoTol)msgs.push(`ISO ${p.iso} deja demasiado ruido para esta escena. Busca la luz en las otras dos ruedas.`);
  if(p.bg<L.dofMin)msgs.push(DOF_LOW[L.scene]);
  if(p.bg>L.dofMax)msgs.push(DOF_HIGH[L.scene]);
  if(!msgs.length)msgs.push("Foto limpia. Así se resuelve esta escena.");
  $("r-verdict").innerHTML=msgs.map(m=>`<li>${m}</li>`).join("");
  const sp=L.solution.p;
  $("r-sol").innerHTML=s.total>=L.solution.s.total?"Has dado con una de las mejores combinaciones posibles.":`Una solución de ${L.solution.s.total} puntos: <b>${fmtSh(sp.t)} · f/${sp.N} · ISO ${sp.iso}</b>`;
  $("r-note").textContent=L.note;
  // botones según modo
  const next=$("next");
  if(mode==="retos"){next.hidden=cur>=LEVELS.length-1;next.textContent="Siguiente reto →"}
  else if(mode==="azar"){next.hidden=false;next.textContent="Otra escena →"}
  else next.hidden=true;
  $("share").hidden=mode!=="dia";$("r-sharebox").hidden=true;$("r-daily").hidden=mode!=="dia";
  if(mode==="dia"){
    if(!fromStore){store.set("triangulo-dia",{key:dayKey,settings:[p.si,p.ai,p.ii],total:s.total});$("dia-badge").hidden=true}
    lockControls(true);
    $("r-daily").innerHTML=`Nuevo reto en <b>${countdown()}</b>.`;
    lastShot=`Practica con el triángulo · Reto del ${dayLabel}\n${s.total}/100 ${"★".repeat(stars)}${"☆".repeat(3-stars)}\n${parts.map(([,v])=>squares(v)).join("")}\nmirardespacio.es/juegos/triangulo/`;
  }
  $("result").hidden=false;drawLevels();
}
[dSh,dAp,dIso].forEach(e=>e.addEventListener("input",()=>{$("result").hidden=true;update()}));
$("shoot").onclick=()=>shoot(false);
$("reroll").onclick=loadRandom;
$("next").onclick=()=>{if(mode==="azar")loadRandom();else loadLevel(Math.min(LEVELS.length-1,cur+1))};
$("share").onclick=()=>{
  const box=$("r-sharebox");
  const showBox=()=>{box.textContent=lastShot;box.hidden=false;const r=document.createRange();r.selectNodeContents(box);const s=getSelection();s.removeAllRanges();s.addRange(r)};
  try{navigator.clipboard.writeText(lastShot).then(()=>{$("share").textContent="Copiado"},showBox)}catch(e){showBox()}
};
document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
setMode("retos");
})();
