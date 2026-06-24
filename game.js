/* ============================================================
   BURGER READY!  —  original idle burger-shop game
   v3 — kid-friendly: bold cartoon art, guiding hand,
   glowing tap cues, title screen + gentle tutorial.
   Vanilla JS + HTML5 Canvas. All graphics drawn in code.
   ============================================================ */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  const OUTLINE = "#3a241a";      // cartoon outline color

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    layoutCustomers();
  }
  window.addEventListener("resize", resize);

  // ---------- Save state ----------
  const SAVE_KEY = "burgerReadySave_v3";
  const defaultState = {
    money: 0, level: 1, served: 0,
    trayMax: 3, cookSpeedLvl: 0, priceLvl: 0,
    cooks: 0, cashiers: 0, seats: 2,
    upgrades: {}, tutDone: false, lastSeen: Date.now(),
  };
  let S = loadGame();
  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return structuredClone(defaultState);
      return Object.assign(structuredClone(defaultState), JSON.parse(raw));
    } catch { return structuredClone(defaultState); }
  }
  let saveTimer = 0;
  function saveGame() {
    S.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {}
  }

  // ---------- Upgrades ----------
  const UPGRADES = [
    { id:"price", icon:"💲", name:"Tastier Recipe", desc:"More coins per burger.", baseCost:25, growth:1.55, max:50, apply:l=>{S.priceLvl=l;} },
    { id:"tray", icon:"🍔", name:"Bigger Counter", desc:"Hold more burgers ready.", baseCost:40, growth:1.7, max:12, apply:l=>{S.trayMax=3+l;} },
    { id:"cookspeed", icon:"⚡", name:"Faster Grill", desc:"Cooks work faster.", baseCost:60, growth:1.6, max:30, apply:l=>{S.cookSpeedLvl=l;} },
    { id:"cooks", icon:"👨‍🍳", name:"Hire Cook", desc:"Makes burgers for you!", baseCost:120, growth:1.9, max:6, apply:l=>{S.cooks=l;} },
    { id:"cashiers", icon:"🧑‍🍳", name:"Hire Helper", desc:"Serves customers for you!", baseCost:200, growth:2.0, max:4, apply:l=>{S.cashiers=l;} },
    { id:"seats", icon:"🪑", name:"More Space", desc:"Room for more customers.", baseCost:90, growth:1.75, max:6, apply:l=>{S.seats=2+l;} },
  ];
  const upgLevel = id => S.upgrades[id] || 0;
  const upgCost = u => Math.floor(u.baseCost * Math.pow(u.growth, upgLevel(u.id)));
  const burgerPrice = () => 5 + S.priceLvl * 3;
  const cookInterval = () => Math.max(380, 1500 - S.cookSpeedLvl * 45);
  function applyAllUpgrades(){ for (const u of UPGRADES) u.apply(upgLevel(u.id)); }
  applyAllUpgrades();

  // ---------- Runtime ----------
  let trayCount = 0;
  const customers = [];
  let spawnTimer = 0, cookAutoTimer = 0, cashierTimer = 0;
  let time = 0, custId = 0;
  let started = false;            // becomes true after PLAY
  let tut = S.tutDone ? "done" : "cook";   // tutorial step: cook -> serve -> done

  // tutorial hand DOM element
  const hand = document.createElement("div");
  hand.id = "tut-hand"; hand.textContent = "👇"; hand.className = "tut-hand hidden";
  document.getElementById("game-wrap").appendChild(hand);
  function showHandAt(x, y) {
    hand.style.left = x + "px"; hand.style.top = y + "px";
    hand.classList.remove("hidden");
  }
  function hideHand(){ hand.classList.add("hidden"); }

  const hintEl = document.getElementById("hint");
  const hintText = document.getElementById("hint-text");
  function setHint(msg){ if(msg){ hintText.textContent = msg; hintEl.classList.remove("hidden"); } else hintEl.classList.add("hidden"); }

  function makeCustomer() {
    const want = 1 + Math.floor(Math.random() * Math.min(3, 1 + Math.floor(S.level/3)));
    const palette = [12, 200, 280, 145, 32, 330, 50, 175];
    return {
      id:++custId, want, got:0,
      x: W + 70, targetX: 0, state:"walkin",
      bodyHue: palette[Math.floor(Math.random()*palette.length)],
      skin: ["#ffd0a3","#f0b884","#d6a06a","#b9824e"][Math.floor(Math.random()*4)],
      hair: ["#3a2a1a","#5b3a1f","#1c1c22","#7a4a22","#c79a3a","#d65a3a"][Math.floor(Math.random()*6)],
      bounce: Math.random()*Math.PI*2, blink:Math.random()*3, blinkT:0,
      eat:0, happy:0, scale:0, walkPhase:Math.random()*Math.PI*2,
    };
  }
  function customerSlots() {
    const n = S.seats, slots = [];
    // Keep customers inside a centered band so they never sit behind the
    // SHOP button (right) or run off the edges on wide screens.
    const band = Math.min(W * 0.72, 520);
    const left = (W - band) / 2;
    for (let i=0;i<n;i++){ const t = n===1?0.5:i/(n-1); slots.push(left + band * t); }
    return slots;
  }
  function layoutCustomers() {
    if (!W) return;
    const slots = customerSlots();
    customers.forEach((c,i)=>{ c.targetX = i<slots.length?slots[i]:W+90; });
  }

  // ---------- Actions ----------
  function cookOneBurger() {
    if (trayCount >= S.trayMax) { floatText("Counter full!", W/2, counterY()-150, "#ff6b6b"); return false; }
    trayCount++;
    spawnSteam(W/2, chefStationY()+40);
    sizzlePop(W/2, counterY()-26);
    if (tut === "cook") { tut = "serve"; }   // first burger cooked
    return true;
  }
  const tapCook = () => { if(started) cookOneBurger(); };

  function serveCustomer(c) {
    if (trayCount <= 0 || c.state !== "waiting") return false;
    const give = Math.min(c.want - c.got, trayCount);
    if (give <= 0) return false;
    trayCount -= give; c.got += give; c.eat = 1; c.happy = 1;
    for (let i=0;i<give;i++) flyBurger(W/2, counterY()-26, c.targetX, custYPos()-10, i*80);
    if (c.got >= c.want) {
      const pay = c.want * burgerPrice();
      setTimeout(()=>gainMoney(pay, c.targetX, custYPos()-40), 250);
      c.state = "leaving"; S.served += c.want; maybeLevelUp();
      confetti(c.targetX, custYPos()-30);
      if (tut === "serve") { tut = "done"; S.tutDone = true; saveGame(); }
    }
    return true;
  }
  function gainMoney(amount, x, y) {
    S.money += amount;
    flyCoins(x, y, 3 + Math.min(6, Math.floor(amount/10)));
    floatText("+"+format(amount), x, y-12, "#ffe14d", true);
    updateHUD();
  }
  function maybeLevelUp() {
    if (S.served >= S.level * 8) {
      S.level++;
      floatText("LEVEL "+S.level+"! ⭐", W/2, H*0.4, "#7be36a");
      bigConfetti(); updateHUD(); renderShop();
    }
  }

  // ---------- Effects ----------
  const floatLayer = document.getElementById("float-layer");
  function floatText(txt,x,y,color,coin){
    const el=document.createElement("div");
    el.className="float-txt"+(coin?" coin":"");
    el.textContent=txt; el.style.left=x+"px"; el.style.top=y+"px";
    if(color) el.style.color=color;
    floatLayer.appendChild(el); setTimeout(()=>el.remove(),1000);
  }
  const particles = [];
  function sizzlePop(x,y){ for(let i=0;i<8;i++) particles.push({type:"spark",x,y,vx:(Math.random()-0.5)*3,vy:-Math.random()*3-1,life:1,size:2+Math.random()*3,hue:40+Math.random()*20}); }
  function spawnSteam(x,y){ for(let i=0;i<3;i++) particles.push({type:"steam",x:x+(Math.random()-0.5)*20,y,vy:-0.5-Math.random()*0.6,life:1,r:6+Math.random()*8,drift:(Math.random()-0.5)*0.4}); }
  function flyBurger(x,y,tx,ty,delay){ particles.push({type:"flyburger",x,y,sx:x,sy:y,tx,ty,t:0,delay,life:1}); }
  function flyCoins(x,y,n){ for(let i=0;i<n;i++) particles.push({type:"coin",x,y,vx:(Math.random()-0.5)*4,vy:-3-Math.random()*3,g:0.22,life:1,spin:Math.random()*Math.PI}); }
  function confetti(x,y){ for(let i=0;i<16;i++) particles.push({type:"confetti",x,y,vx:(Math.random()-0.5)*6,vy:-Math.random()*5-2,g:0.18,life:1,hue:Math.random()*360,rot:Math.random()*6,vr:(Math.random()-0.5)*0.4,w:5+Math.random()*4,h:7+Math.random()*5}); }
  function bigConfetti(){ for(let k=0;k<6;k++) confetti(W*(0.15+0.14*k), H*0.3); }

  // ---------- Layout ----------
  const counterY = () => Math.round(H * 0.62);
  const chefStationY = () => counterY() - 110;
  const custYPos = () => counterY() + Math.min(96, (H - counterY()) * 0.42);
  // global kitchen art scale so nothing is oversized on small/large screens
  const kScale = () => Math.max(0.55, Math.min(1.05, Math.min(W, H) / 560));

  function roundRect(x,y,w,h,r){
    if (typeof r === "number") r = {tl:r,tr:r,br:r,bl:r};
    ctx.beginPath();
    ctx.moveTo(x+r.tl,y);
    ctx.lineTo(x+w-r.tr,y); ctx.arcTo(x+w,y,x+w,y+r.tr,r.tr);
    ctx.lineTo(x+w,y+h-r.br); ctx.arcTo(x+w,y+h,x+w-r.br,y+h,r.br);
    ctx.lineTo(x+r.bl,y+h); ctx.arcTo(x,y+h,x,y+h-r.bl,r.bl);
    ctx.lineTo(x,y+r.tl); ctx.arcTo(x,y,x+r.tl,y,r.tl);
    ctx.closePath();
  }
  function outline(w){ ctx.lineWidth = w||3; ctx.strokeStyle = OUTLINE; ctx.stroke(); }

  // ============================================================
  //  RENDERING
  // ============================================================
  function drawBackground() {
    const wallH = counterY();
    let g = ctx.createLinearGradient(0,0,0,wallH);
    g.addColorStop(0,"#ffe9ad"); g.addColorStop(0.6,"#ffd277"); g.addColorStop(1,"#ffc35e");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,wallH);

    const rg = ctx.createRadialGradient(W/2, wallH*0.1, 20, W/2, wallH*0.1, W*0.85);
    rg.addColorStop(0,"rgba(255,255,255,0.4)"); rg.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,wallH);

    drawStringLights();
    const ks = kScale();
    drawPoster(W*0.13, wallH*0.34, 56*ks+24, 76*ks+24, "🍟");
    drawPoster(W*0.87, wallH*0.34, 56*ks+24, 76*ks+24, "🥤");
    drawPlant(W*0.06, wallH);
    drawPlant(W*0.94, wallH);
    drawMenuBoard(W*0.5, Math.max(96, H*0.13), ks);

    g = ctx.createLinearGradient(0,wallH,0,H);
    g.addColorStop(0,"#d98a4f"); g.addColorStop(1,"#9a5a30");
    ctx.fillStyle=g; ctx.fillRect(0,wallH,W,H-wallH);
    ctx.strokeStyle="rgba(0,0,0,0.10)"; ctx.lineWidth=2;
    for(let i=-H;i<W+H;i+=58){ ctx.beginPath(); ctx.moveTo(i,wallH); ctx.lineTo(i+(H-wallH)*0.45,H); ctx.stroke(); }
  }

  function drawStringLights(){
    const y0=14, sag=24, span=W/8;
    ctx.strokeStyle="rgba(80,50,20,0.45)"; ctx.lineWidth=2;
    ctx.beginPath();
    for(let i=0;i<=W;i+=4) ctx.lineTo(i, y0 + Math.sin((i%span)/span*Math.PI)*sag);
    ctx.stroke();
    const colors=["#ff6b6b","#ffd166","#6bcB77","#4dabf7","#b197fc"];
    for(let i=span/2;i<W;i+=span){
      const yy=y0+Math.sin((i%span)/span*Math.PI)*sag+6;
      const c=colors[Math.floor(i/span)%colors.length], glow=0.5+0.5*Math.sin(time*3+i);
      ctx.fillStyle=c; ctx.globalAlpha=0.6+0.4*glow; ctx.beginPath(); ctx.arc(i,yy,6,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.25*glow; ctx.beginPath(); ctx.arc(i,yy,14,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    }
  }
  function drawPoster(cx,cy,w,h,emoji){
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(-0.04);
    roundRect(-w/2,-h/2,w,h,8); ctx.fillStyle="#fff7e6"; ctx.fill(); outline(3);
    ctx.font=`${h*0.42}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(emoji,0,-h*0.12);
    ctx.fillStyle="#c4561c"; ctx.font="800 12px 'Baloo 2',sans-serif"; ctx.fillText("YUM!",0,h*0.28);
    ctx.restore();
  }
  function drawPlant(x,baseY){
    ctx.save(); ctx.translate(x,baseY);
    roundRect(-18,-6,36,26,{tl:4,tr:4,br:8,bl:8}); ctx.fillStyle="#c25a2e"; ctx.fill(); outline(3);
    ctx.fillStyle="#3f9d4a";
    for(let i=-2;i<=2;i++){ ctx.save(); ctx.rotate(i*0.32 + Math.sin(time*1.5+i)*0.05); roundRect(-7,-58,14,40,7); ctx.fill(); outline(3); ctx.restore(); }
    ctx.restore();
  }
  function drawMenuBoard(cx,cy,s){
    ctx.save(); ctx.translate(cx,cy); ctx.scale(s,s);
    roundRect(-140,-42,280,92,14); ctx.fillStyle="#2e2016"; ctx.fill(); outline(4);
    ctx.fillStyle="#ffd95a"; ctx.font="800 24px 'Baloo 2',sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("🍔 BURGER MENU 🍔",0,-16);
    ctx.font="700 14px 'Baloo 2',sans-serif"; ctx.fillStyle="#fff"; ctx.fillText("Classic • Double • Deluxe",0,12);
    ctx.fillStyle="#9be36a"; ctx.font="800 14px 'Baloo 2',sans-serif"; ctx.fillText("$"+burgerPrice()+" each",0,32);
    ctx.restore();
  }

  function drawCounter() {
    const y = counterY();
    let g=ctx.createLinearGradient(0,y-18,0,y); g.addColorStop(0,"#c08a58"); g.addColorStop(1,"#996a42");
    ctx.fillStyle=g; ctx.fillRect(0,y-18,W,18);
    ctx.fillStyle="rgba(255,255,255,0.28)"; ctx.fillRect(0,y-18,W,4);
    g=ctx.createLinearGradient(0,y,0,y+80); g.addColorStop(0,"#f7f7fc"); g.addColorStop(1,"#cfcfdd");
    ctx.fillStyle=g; ctx.fillRect(0,y,W,80);
    ctx.strokeStyle="rgba(0,0,0,0.08)"; ctx.lineWidth=2;
    for(let i=70;i<W;i+=110){ ctx.beginPath(); ctx.moveTo(i,y+6); ctx.lineTo(i,y+74); ctx.stroke(); }
    drawTray(W/2, y-18);
  }
  function drawTray(cx, topY){
    const max=S.trayMax;
    const slotW=Math.min(W*0.17, (W-60)/Math.max(max,1));
    const totalW=slotW*max;
    roundRect(cx-totalW/2-10, topY-24, totalW+20, 24, 9);
    let g=ctx.createLinearGradient(0,topY-24,0,topY); g.addColorStop(0,"#dfe2ee"); g.addColorStop(1,"#a8adc2");
    ctx.fillStyle=g; ctx.fill(); outline(3);
    const startX=cx-totalW/2+slotW/2;
    for(let i=0;i<max;i++){
      const x=startX+i*slotW;
      if(i<trayCount) drawBurger(x, topY-12, slotW*0.4);
      else { ctx.save(); ctx.globalAlpha=0.16; ctx.fillStyle="#5a4a3a"; ctx.beginPath(); ctx.ellipse(x,topY-8,slotW*0.28,4,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    }
  }

  // ---- Burger with bold outlines (clear & cute) ----
  function drawBurger(cx,cy,r){
    ctx.save(); ctx.translate(cx,cy);
    ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(0,r*0.85,r*1.05,r*0.3,0,0,Math.PI*2); ctx.fill();
    // bottom bun
    let g=ctx.createLinearGradient(0,r*0.2,0,r*0.95); g.addColorStop(0,"#f6bd6a"); g.addColorStop(1,"#dd9140");
    ctx.fillStyle=g; roundRect(-r*0.98, r*0.18, r*1.96, r*0.62, {tl:r*0.2,tr:r*0.2,br:r*0.45,bl:r*0.45}); ctx.fill(); outline(Math.max(2,r*0.1));
    // patty
    ctx.fillStyle="#5e3414"; roundRect(-r*1.0, r*-0.02, r*2.0, r*0.5, r*0.24); ctx.fill(); outline(Math.max(2,r*0.1));
    // cheese
    ctx.fillStyle="#ffc83d"; ctx.beginPath();
    ctx.moveTo(-r*0.98,r*0.02); ctx.lineTo(r*0.98,r*0.02);
    ctx.lineTo(r*0.7,r*0.34); ctx.lineTo(r*0.42,r*0.12);
    ctx.lineTo(r*0.12,r*0.4); ctx.lineTo(-r*0.2,r*0.12);
    ctx.lineTo(-r*0.5,r*0.36); ctx.lineTo(-r*0.78,r*0.1); ctx.closePath(); ctx.fill(); outline(Math.max(1.5,r*0.07));
    // lettuce
    ctx.fillStyle="#84cf4b"; for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.arc(i*r*0.42, r*-0.06, r*0.34, Math.PI, 0); ctx.fill(); }
    // top bun
    g=ctx.createRadialGradient(-r*0.3,r*-0.65,r*0.1,0,r*-0.2,r*1.2);
    g.addColorStop(0,"#ffd591"); g.addColorStop(0.6,"#f4ab53"); g.addColorStop(1,"#e0913c");
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,r*-0.18,r,r*0.78,0,Math.PI,0); ctx.lineTo(r,r*-0.04); ctx.lineTo(-r,r*-0.04); ctx.closePath(); ctx.fill(); outline(Math.max(2,r*0.1));
    ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.ellipse(-r*0.32,r*-0.5,r*0.32,r*0.15,-0.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff7e2";
    for(const [sx,sy] of [[-0.45,-0.4],[-0.1,-0.55],[0.28,-0.45],[0.5,-0.2],[-0.62,-0.16],[0.06,-0.28]]){ ctx.save(); ctx.translate(sx*r,sy*r); ctx.rotate(sx); ctx.beginPath(); ctx.ellipse(0,0,r*0.07,r*0.12,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }

  // ---- Chef ----
  function drawChef(cx,baseY,s){
    ctx.save();
    const bob=Math.sin(time*3)*3, arm=Math.sin(time*6)*0.5;
    ctx.translate(cx, baseY+bob); ctx.scale(s,s);
    ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(0,66,40,9,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#3a3a3a"; roundRect(-46,42,92,16,5); ctx.fill();
    ctx.fillStyle="#555"; for(let i=-40;i<40;i+=10) ctx.fillRect(i,44,3,12);
    // body
    let g=ctx.createLinearGradient(0,0,0,56); g.addColorStop(0,"#fff"); g.addColorStop(1,"#eef0f5");
    ctx.fillStyle=g; roundRect(-30,2,60,54,16); ctx.fill(); outline(3);
    ctx.fillStyle="#ff5a2a"; roundRect(-20,20,40,36,{tl:6,tr:6,br:10,bl:10}); ctx.fill(); outline(3);
    // arms
    ctx.strokeStyle="#fff"; ctx.lineWidth=11; ctx.beginPath(); ctx.moveTo(-22,18); ctx.lineTo(-34,30+arm*8); ctx.stroke();
    ctx.strokeStyle=OUTLINE; ctx.lineWidth=14; ctx.beginPath(); ctx.moveTo(22,18); ctx.lineTo(34,30-arm*8); ctx.stroke();
    ctx.strokeStyle="#fff"; ctx.lineWidth=11; ctx.beginPath(); ctx.moveTo(22,18); ctx.lineTo(34,30-arm*8); ctx.stroke();
    ctx.save(); ctx.translate(34,30-arm*8); drawBurger(0,0,9); ctx.restore();
    // head
    ctx.fillStyle="#ffd0a3"; ctx.beginPath(); ctx.arc(0,-12,19,0,Math.PI*2); ctx.fill(); outline(3);
    // hat
    ctx.fillStyle="#fff"; roundRect(-17,-36,34,14,5); ctx.fill(); outline(3);
    ctx.beginPath(); ctx.arc(-11,-38,10,0,Math.PI*2); ctx.arc(0,-43,12,0,Math.PI*2); ctx.arc(11,-38,10,0,Math.PI*2); ctx.fill(); outline(3);
    // eyes
    const open=(Math.sin(time*1.7)>-0.9)?1:0.14;
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(-6,-13,4,5*open,0,0,Math.PI*2); ctx.ellipse(6,-13,4,5*open,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=OUTLINE; ctx.beginPath(); ctx.arc(-5,-13,2.1,0,Math.PI*2); ctx.arc(7,-13,2.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,120,90,0.4)"; ctx.beginPath(); ctx.arc(-10,-7,3.5,0,Math.PI*2); ctx.arc(10,-7,3.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=OUTLINE; ctx.lineWidth=2.4; ctx.beginPath(); ctx.arc(0,-7,6,0.12*Math.PI,0.88*Math.PI); ctx.stroke();
    if(S.cooks>0){ ctx.fillStyle="rgba(0,0,0,0.22)"; roundRect(-30,60,60,7,4); ctx.fill(); ctx.fillStyle="#ffce4a"; const p=Math.min(1,cookAutoTimer/(cookInterval()/Math.max(1,S.cooks))); roundRect(-30,60,60*p,7,4); ctx.fill(); }
    ctx.restore();
  }

  // ---- Customer ----
  function drawCustomer(c){
    const y = custYPos(), sc = c.scale * kScale();
    const bob=Math.sin(c.bounce)*4*(c.state==="waiting"?1:0.4);
    const walk = c.state!=="waiting" ? Math.sin(c.walkPhase)*3 : 0;

    // glowing "tap me" ring under waiting customers (after tutorial too)
    if(c.state==="waiting" && c.got<c.want){
      const pulse=0.5+0.5*Math.sin(time*4+c.id);
      ctx.save(); ctx.globalAlpha=0.35+0.25*pulse; ctx.strokeStyle="#fff36b"; ctx.lineWidth=4+pulse*3;
      ctx.beginPath(); ctx.ellipse(c.x, y+50, 30*sc, 10*sc, 0, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }

    ctx.save(); ctx.translate(c.x, y+bob); ctx.scale(sc, sc);
    ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(0,50,26,7,0,0,Math.PI*2); ctx.fill();
    // legs
    ctx.strokeStyle=OUTLINE; ctx.lineWidth=11; ctx.beginPath(); ctx.moveTo(-8,40); ctx.lineTo(-8+walk,52); ctx.moveTo(8,40); ctx.lineTo(8-walk,52); ctx.stroke();
    ctx.strokeStyle=`hsl(${c.bodyHue},45%,32%)`; ctx.lineWidth=7; ctx.beginPath(); ctx.moveTo(-8,40); ctx.lineTo(-8+walk,52); ctx.moveTo(8,40); ctx.lineTo(8-walk,52); ctx.stroke();
    // body
    let g=ctx.createLinearGradient(0,-6,0,46); g.addColorStop(0,`hsl(${c.bodyHue},75%,64%)`); g.addColorStop(1,`hsl(${c.bodyHue},68%,50%)`);
    ctx.fillStyle=g; roundRect(-24,-6,48,50,16); ctx.fill(); outline(3);
    // arms
    ctx.strokeStyle=OUTLINE; ctx.lineWidth=11; ctx.beginPath(); ctx.moveTo(-22,6); ctx.lineTo(-30,24+Math.sin(c.bounce)*3); ctx.moveTo(22,6); ctx.lineTo(30,24-Math.sin(c.bounce)*3); ctx.stroke();
    ctx.strokeStyle=`hsl(${c.bodyHue},68%,56%)`; ctx.lineWidth=7; ctx.beginPath(); ctx.moveTo(-22,6); ctx.lineTo(-30,24+Math.sin(c.bounce)*3); ctx.moveTo(22,6); ctx.lineTo(30,24-Math.sin(c.bounce)*3); ctx.stroke();
    // head
    ctx.fillStyle=c.skin; ctx.beginPath(); ctx.arc(0,-18,16,0,Math.PI*2); ctx.fill(); outline(3);
    // hair
    ctx.fillStyle=c.hair; ctx.beginPath(); ctx.arc(0,-22,16,Math.PI*1.02,Math.PI*-0.02); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-13,-20,5,8,0,0,Math.PI*2); ctx.ellipse(13,-20,5,8,0,0,Math.PI*2); ctx.fill();
    // eyes
    const open=c.blinkT>0?0.14:1;
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(-5,-18,3.6,4.8*open,0,0,Math.PI*2); ctx.ellipse(5,-18,3.6,4.8*open,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=OUTLINE; ctx.beginPath(); ctx.arc(-4.5,-18,2,0,Math.PI*2); ctx.arc(5.5,-18,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,120,90,0.4)"; ctx.beginPath(); ctx.arc(-9,-12,3,0,Math.PI*2); ctx.arc(9,-12,3,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=OUTLINE; ctx.lineWidth=2.2; ctx.beginPath();
    if(c.eat>0) ctx.arc(0,-10,4.5,0,Math.PI*2);
    else if(c.happy>0) ctx.arc(0,-12,5,0.05*Math.PI,0.95*Math.PI);
    else ctx.arc(0,-11,4,0.1*Math.PI,0.9*Math.PI);
    ctx.stroke();
    ctx.restore();

    if(c.state==="waiting") drawOrderBubble(c, y+bob);
    if(c.happy>0) drawHearts(c, y+bob);
  }
  function drawOrderBubble(c,y){
    const remaining=c.want-c.got, pulse=1+Math.sin(time*4)*0.05, s=c.scale*kScale()*pulse;
    ctx.save(); ctx.translate(c.x, y-58*c.scale*kScale()); ctx.scale(s, s);
    roundRect(-40,-25,80,40,13); ctx.fillStyle="#ffffff"; ctx.fill(); outline(3);
    ctx.beginPath(); ctx.moveTo(-8,14); ctx.lineTo(8,14); ctx.lineTo(0,26); ctx.closePath(); ctx.fillStyle="#fff"; ctx.fill();
    drawBurger(-12,-5,12);
    ctx.fillStyle=OUTLINE; ctx.font="800 22px 'Baloo 2',sans-serif"; ctx.textAlign="left"; ctx.textBaseline="middle";
    ctx.fillText("×"+remaining, 6, -4);
    ctx.restore();
  }
  function drawHearts(c,y){
    ctx.save(); ctx.globalAlpha=c.happy; ctx.font="20px serif"; ctx.textAlign="center";
    ctx.fillText("❤", c.x-14, y-66-(1-c.happy)*20); ctx.fillText("❤", c.x+14, y-72-(1-c.happy)*26);
    ctx.restore();
  }

  function drawParticles(){
    for(const p of particles){
      if(p.type==="spark"){ ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=`hsl(${p.hue},100%,60%)`; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
      else if(p.type==="steam"){ ctx.globalAlpha=Math.max(0,p.life)*0.4; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }
      else if(p.type==="coin"){ ctx.globalAlpha=Math.max(0,p.life); ctx.save(); ctx.translate(p.x,p.y); ctx.scale(Math.cos(p.spin)*0.6+0.6,1);
        ctx.fillStyle="#ffd23f"; ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle="#c98a1b"; ctx.stroke(); ctx.restore(); }
      else if(p.type==="confetti"){ ctx.globalAlpha=Math.max(0,p.life); ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=`hsl(${p.hue},85%,60%)`; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore(); }
      else if(p.type==="flyburger"){ ctx.globalAlpha=1; const e=easeInOut(Math.min(1,p.t)); const x=p.sx+(p.tx-p.sx)*e; const y=p.sy+(p.ty-p.sy)*e - Math.sin(e*Math.PI)*70; drawBurger(x,y,14); }
    }
    ctx.globalAlpha=1;
  }
  function easeInOut(t){ return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; }

  // ============================================================
  //  TUTORIAL guidance
  // ============================================================
  function updateTutorial(){
    if(!started){ hideHand(); setHint(""); return; }
    if(tut==="cook"){
      setHint("👇 Tap the COOK button to grill a burger!");
      const bx = W/2, by = H - 200;     // just above the cook button
      showHandAt(bx, by);
    } else if(tut==="serve"){
      const c = customers.find(x=>x.state==="waiting");
      if(c){ setHint("👆 Great! Now tap the customer to serve!"); showHandAt(c.x, custYPos()-92); }
      else { setHint("A customer is coming..."); hideHand(); }
    } else {
      setHint(""); hideHand();
    }
  }

  // ============================================================
  //  UPDATE / RENDER
  // ============================================================
  let last=performance.now();
  function update(now){
    const dtMs=Math.min(50, now-last); last=now; const dt=dtMs/1000;
    time+=dt;

    if(started){
      spawnTimer-=dtMs;
      // during tutorial "cook" step, hold spawning until a burger exists so the
      // order of lessons is clear; otherwise spawn normally.
      const canSpawn = customers.length<S.seats && !(tut==="cook" && trayCount===0);
      if(spawnTimer<=0 && canSpawn){ customers.push(makeCustomer()); layoutCustomers(); spawnTimer=1300+Math.random()*1100; }
    }

    for(let i=customers.length-1;i>=0;i--){
      const c=customers[i];
      c.bounce+=dt*3; c.walkPhase+=dt*12;
      if(c.scale<1) c.scale=Math.min(1,c.scale+dt*4);
      if(c.eat>0) c.eat-=dt*1.2;
      if(c.happy>0) c.happy-=dt*0.8;
      c.blink-=dt; if(c.blink<=0){ c.blinkT=0.12; c.blink=2+Math.random()*3; } if(c.blinkT>0) c.blinkT-=dt;
      if(c.state==="walkin"){ c.x+=(c.targetX-c.x)*0.12; if(Math.abs(c.x-c.targetX)<2){ c.x=c.targetX; c.state="waiting"; } }
      else if(c.state==="leaving"){ c.x-=dtMs*0.5; c.scale=Math.max(0,c.scale-dt*0.4); if(c.x<-90||c.scale<=0){ customers.splice(i,1); layoutCustomers(); } }
    }

    if(started && S.cooks>0){ cookAutoTimer+=dtMs; const interval=cookInterval()/Math.max(1,S.cooks); if(cookAutoTimer>=interval){ cookAutoTimer=0; if(trayCount<S.trayMax) cookOneBurger(); } }
    if(started && S.cashiers>0){ cashierTimer+=dtMs; const interval=Math.max(350,1100-S.cashiers*150); if(cashierTimer>=interval){ cashierTimer=0; const w=customers.find(c=>c.state==="waiting"); if(w&&trayCount>0) serveCustomer(w); } }

    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      if(p.type==="spark"){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.life-=dt*2; }
      else if(p.type==="steam"){ p.y+=p.vy*dtMs*0.06; p.x+=p.drift; p.r+=dt*6; p.life-=dt*0.8; }
      else if(p.type==="coin"){ p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.spin+=0.25; p.life-=dt*0.9; }
      else if(p.type==="confetti"){ p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.rot+=p.vr; p.life-=dt*0.6; }
      else if(p.type==="flyburger"){ if(p.delay>0){ p.delay-=dtMs; } else { p.t+=dt*2.2; if(p.t>=1) p.life=0; } }
      if(p.life<=0) particles.splice(i,1);
    }

    updateTutorial();
    saveTimer+=dtMs; if(saveTimer>3000){ saveTimer=0; saveGame(); }
  }

  function render(){
    ctx.clearRect(0,0,W,H);
    drawBackground();
    customers.forEach(drawCustomer);
    const ks = kScale();
    // place chef so its base sits just above the counter top
    drawChef(W/2, counterY() - 6 - 66*ks, ks);
    drawCounter();
    drawParticles();
  }
  function loop(now){ update(now); render(); requestAnimationFrame(loop); }

  // ---------- Input ----------
  canvas.addEventListener("pointerdown",(e)=>{
    if(!started) return;
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const hit=customers.find(c=>c.state==="waiting" && Math.abs(c.x-x)<46 && Math.abs(custYPos()-y)<100);
    if(hit){ serveCustomer(hit); return; }
    if(y>counterY()-150) tapCook();
  });
  document.getElementById("cook-btn").addEventListener("click", tapCook);

  // ---------- HUD + Shop ----------
  const moneyEl=document.getElementById("money"), levelEl=document.getElementById("level");
  function updateHUD(){ moneyEl.textContent=format(S.money); levelEl.textContent=S.level; }
  function format(n){ n=Math.floor(n); if(n<1000)return""+n; if(n<1e6)return(n/1e3).toFixed(n<1e4?1:0)+"K"; if(n<1e9)return(n/1e6).toFixed(1)+"M"; return(n/1e9).toFixed(1)+"B"; }

  const shopList=document.getElementById("shop-list"), shopPanel=document.getElementById("shop-panel");
  function renderShop(){
    shopList.innerHTML="";
    for(const u of UPGRADES){
      const lvl=upgLevel(u.id), maxed=lvl>=u.max, cost=upgCost(u), afford=S.money>=cost;
      const row=document.createElement("div"); row.className="upgrade";
      row.innerHTML=`<div class="icon">${u.icon}</div><div class="info"><div class="name">${u.name}</div><div class="desc">${u.desc}</div><div class="lvl">Level ${lvl}${u.max<99?" / "+u.max:""}</div></div>`;
      const btn=document.createElement("button");
      btn.className="buy-btn"+(maxed?" maxed":afford?"":" locked");
      btn.textContent=maxed?"MAX":"🪙 "+format(cost);
      btn.onclick=()=>buyUpgrade(u);
      row.appendChild(btn); shopList.appendChild(row);
    }
  }
  function buyUpgrade(u){
    const lvl=upgLevel(u.id); if(lvl>=u.max) return;
    const cost=upgCost(u);
    if(S.money<cost){ floatText("Need more 🪙", W/2, H*0.5, "#ff6b6b"); return; }
    S.money-=cost; S.upgrades[u.id]=lvl+1; u.apply(lvl+1);
    layoutCustomers(); updateHUD(); renderShop(); saveGame();
  }
  document.getElementById("shop-toggle").onclick=()=>{ shopPanel.classList.add("open"); renderShop(); };
  document.getElementById("shop-close").onclick=()=>shopPanel.classList.remove("open");
  setInterval(()=>{ if(shopPanel.classList.contains("open")) renderShop(); },600);

  // ---------- Offline ----------
  function computeOfflineEarnings(){
    const away=Date.now()-(S.lastSeen||Date.now());
    if(away<60000||S.cooks===0||S.cashiers===0) return 0;
    const perSec=(S.cashiers*0.8)*burgerPrice()*0.5;
    return Math.floor(perSec*Math.min(away/1000, 8*3600));
  }
  function showModal(title,body,btn){
    document.getElementById("modal-title").textContent=title;
    document.getElementById("modal-body").textContent=body;
    document.getElementById("modal-btn").textContent=btn;
    document.getElementById("modal").classList.remove("hidden");
  }
  document.getElementById("modal-btn").onclick=()=>document.getElementById("modal").classList.add("hidden");

  // ---------- Title screen ----------
  const titleScreen=document.getElementById("title-screen");
  function startGame(){
    started=true;
    titleScreen.classList.add("hidden");
    const offline=computeOfflineEarnings();
    if(offline>0){ S.money+=offline; updateHUD(); showModal("Welcome back! 🍔", `Your shop earned ${format(offline)} coins while you were away!`, "COLLECT"); }
  }
  document.getElementById("play-btn").onclick=startGame;
  document.getElementById("reset-btn").onclick=()=>{
    try{ localStorage.removeItem(SAVE_KEY); }catch{}
    location.reload();
  };

  // ---------- Boot ----------
  function boot(){
    resize(); layoutCustomers(); updateHUD(); renderShop();
    document.getElementById("modal").classList.add("hidden");
    window.addEventListener("beforeunload", saveGame);
    document.addEventListener("visibilitychange",()=>{ if(document.hidden) saveGame(); });
    requestAnimationFrame((t)=>{ last=t; loop(t); });
  }
  boot();

  if("serviceWorker" in navigator){ window.addEventListener("load",()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }); }
})();
