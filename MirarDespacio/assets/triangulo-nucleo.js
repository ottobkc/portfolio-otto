// Practica con el triángulo · núcleo del juego (datos, física, puntuación y generador de escenas).
// Lo usan el navegador (mirardespacio.es y la versión MD+ de ottokols.es) y la función del servidor
// que puntúa el reto del día de los miembros, para que todos calculen exactamente lo mismo.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.TrianguloNucleo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  // Velocidades: hasta 1 s en los retos normales (índice 12); los de trípode llegan a 30 s.
  const SH = [1/4000, 1/2000, 1/1000, 1/500, 1/250, 1/125, 1/60, 1/30, 1/15, 1/8, 1/4, 1/2, 1, 2, 4, 8, 15, 30];
  const SH_NORMAL = 12;
  const AP = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
  const ISO = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
  const fmtSh = t => t >= 1 ? `${t} s` : `1/${Math.round(1 / t)}`;

  /* ---------- retos fijos (abiertos) ---------- */
  const LEVELS = [
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
  const LOCKED = ["Concierto en sala", "Larga exposición", "Teatro sin flash"]; // en Mirar Despacio+

  /* ---------- escenas (las de MD+ se añaden con registrarEscena) ---------- */
  const SCENES_DEF = {
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
  const SUBJ_OF = {l1:"El muñeco",l2:"El perro",l3:"El peatón"};
  const AF_OF = {l1:[.64,.36],l2:[.5,.68],l3:[.42,.5]};
  const KREF = {l1:[85,14],l2:[200,10],l3:[35,8]};
  const kOf = (scene, focal) => KREF[scene][1] * Math.pow(focal / KREF[scene][0], 2);
  // Escenas nuevas (MD+): solo hace falta su sujeto, su punto de enfoque y su referencia de desenfoque
  function registrarEscena(id, o) { SUBJ_OF[id] = o.subj; AF_OF[id] = o.af; KREF[id] = o.kref; }

  /* ---------- utilidades ---------- */
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const pick = (r, a) => a[(r() * a.length) | 0];
  const shMax = L => L.shMax != null ? L.shMax : SH_NORMAL;

  /* ---------- física y puntuación ---------- */
  function calc(L,si,ai,ii){
    const t=SH[si],N=AP[ai],iso=ISO[ii];
    const camEV=Math.log2(N*N/t)-Math.log2(iso/100);
    const delta=L.ev-camEV;
    const motion=L.speed*t;
    // Con trípode no hay trepidación
    const shake=L.tripod?0:Math.min(18,Math.max(0,t*L.focal-1)*3);
    const bg=kOf(L.scene,L.focal)/N;
    const sigma=1.1*Math.pow(iso/100,.55);
    return {si,ai,ii,t,N,iso,delta,motion,shake,bg,sigma}
  }
  function score(L,p){
    const exp=Math.max(0,100-45*Math.max(0,Math.abs(p.delta)-.25));
    let sharp;
    if(L.wantBlur){
      // Larga exposición: lo que se mueve tiene que dibujar estelas (y nada debe temblar)
      const falta=Math.max(0,L.wantBlur-p.motion);
      sharp=Math.max(0,100-falta*.6-p.shake*9);
    }else{
      const blur=p.motion+p.shake;
      sharp=blur<=L.lim?100:Math.max(0,100-(blur-L.lim)*9);
    }
    const over=Math.log2(p.iso/L.isoTol);
    const noise=over<=0?100:Math.max(0,100-35*over);
    const dof=p.bg<L.dofMin?Math.max(0,100-(L.dofMin-p.bg)*18):p.bg>L.dofMax?Math.max(0,100-(p.bg-L.dofMax)*18):100;
    const total=Math.round(exp*.35+sharp*.3+noise*.15+dof*.2);
    return {exp,sharp,noise,dof,total}
  }
  const estrellas = total => total >= 85 ? 3 : total >= 65 ? 2 : total >= 40 ? 1 : 0;
  function solve(L){
    let best=null;
    for(let si=0;si<=shMax(L);si++)for(let ai=L.apMin;ai<AP.length;ai++)for(let ii=0;ii<=L.isoMax;ii++){
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

  // Reto del día: la clave es la fecha (AAAAMMDD) y la escena sale siempre igual para esa fecha
  const claveDia = (anio, mes, dia) => anio * 10000 + mes * 100 + dia;
  const retoDelDia = (clave, etiqueta) => generate(rng(clave * 7919), `Reto del ${etiqueta}`);

  return { SH, SH_NORMAL, AP, ISO, fmtSh, LEVELS, LOCKED, SCENES_DEF, SUBJ_OF, AF_OF, KREF, kOf, registrarEscena,
    rng, pick, shMax, calc, score, estrellas, solve, generate, claveDia, retoDelDia };
});
