/* ============================================================
   BURGER READY!  —  an original idle burger-shop game
   Vanilla JS + HTML5 Canvas. All graphics drawn in code.
   v2 — polished visuals: lighting, shadows, animated cute
   characters, juicy layered burgers, smoke, coins & confetti.
   ============================================================ */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layoutCustomers();
  }
  window.addEventListener("resize", resize);

  // ---------- Persistent game state ----------
  const SAVE_KEY = "burgerReadySave_v2";
  const defaultState = {
    money: 0, level: 1, served: 0,
    trayMax: 3, cookSpeedLvl: 0, priceLvl: 0,
    cooks: 0, cashiers: 0, seats: 2,
    upgrades: {}, lastSeen: Date.now(),
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
    { id:"price", icon:"💲", name:"Tastier Recipe", desc:"Earn more coins per burger.", baseCost:25, growth:1.55, max:50, apply:l=>{S.priceLvl=l;} },
    { id:"tray", icon:"🍔", name:"Bigger Counter", desc:"Hold more ready burgers.", baseCost:40, growth:1.7, max:12, apply:l=>{S.trayMax=3+l;} },
    { id:"cookspeed", icon:"⚡", name:"Faster Grill", desc:"Cooks make burgers faster.", baseCost:60, growth:1.6, max:30, apply:l=>{S.cookSpeedLvl=l;} },
    { id:"cooks", icon:"👨‍🍳", name:"Hire Cook", desc:"Auto-cooks burgers for you.", baseCost:120, growth:1.9, max:6, apply:l=>{S.cooks=l;} },
    { id:"cashiers", icon:"🧑‍💼", name:"Hire Cashier", desc:"Auto-serves waiting customers.", baseCost:200, growth:2.0, max:4, apply:l=>{S.cashiers=l;} },
    { id:"seats", icon:"🪑", name:"More Space", desc:"Room for more customers.", baseCost:90, growth:1.75, max:6, apply:l=>{S.seats=2+l;} },
  ];
  const upgLevel = id => S.upgrades[id] || 0;
  const upgCost = u => Math.floor(u.baseCost * Math.pow(u.growth, upgLevel(u.id)));
  const burgerPrice = () => 5 + S.priceLvl * 3;
  const cookInterval = () => Math.max(380, 1500 - S.cookSpeedLvl * 45);
  function applyAllUpgrades(){ for (const u of UPGRADES) u.apply(upgLevel(u.id)); }
  applyAllUpgrades();

  // ---------- Runtime state ----------
  let trayCount = 0;
  const customers = [];
  let spawnTimer = 0, cookAutoTimer = 0, cashierTimer = 0;
  let time = 0;            // global animation clock (seconds)
  let custId = 0;

  function makeCustomer() {
    const want = 1 + Math.floor(Math.random() * Math.min(3, 1 + Math.floor(S.level/3)));
    const palette = [12, 200, 280, 145, 32, 330, 50];
    return {
      id:++custId, want, got:0,
      x: W + 70, targetX: 0, state:"walkin",
      bodyHue: palette[Math.floor(Math.random()*palette.length)],
      skin: ["#f3c79a","#e8b888","#d6a06a","#c98a52"][Math.floor(Math.random()*4)],
      hair: ["#3a2a1a","#5b3a1f","#1c1c22","#7a4a22","#aa8855"][Math.floor(Math.random()*5)],
      bounce: Math.random()*Math.PI*2, blink:Math.random()*3, blinkT:0,
      eat:0, happy:0, scale:0, walkPhase:Math.random()*Math.PI*2,
    };
  }

  function customerSlots() {
    const slots = [], n = S.seats, margin = 56;
    const usable = W - margin*2;
    for (let i=0;i<n;i++){ const t = n===1?0.5:i/(n-1); slots.push(margin+usable*t); }
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
    return true;
  }
  const tapCook = () => cookOneBurger();

  function serveCustomer(c) {
    if (trayCount <= 0 || c.state !== "waiting") return false;
    const need = c.want - c.got;
    const give = Math.min(need, trayCount);
    if (give <= 0) return false;
    trayCount -= give; c.got += give; c.eat = 1; c.happy = 1;
    // burger flies from counter to customer
    for (let i=0;i<give;i++) flyBurger(W/2, counterY()-26, c.targetX, custYPos()-10, i*80);
    if (c.got >= c.want) {
      const pay = c.want * burgerPrice();
      setTimeout(()=>gainMoney(pay, c.targetX, custYPos()-40), 250);
      c.state = "leaving"; S.served += c.want; maybeLevelUp();
      confetti(c.targetX, custYPos()-30);
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
    const need = S.level * 8;
    if (S.served >= need) {
      S.level++;
      floatText("LEVEL "+S.level+"!", W/2, H*0.4, "#7be36a");
      bigConfetti();
      updateHUD(); renderShop();
    }
  }

  // ---------- Effects: floating text / particles ----------
  const floatLayer = document.getElementById("float-layer");
  function floatText(txt,x,y,color,coin){
    const el=document.createElement("div");
    el.className="float-txt"+(coin?" coin":"");
    el.textContent=txt; el.style.left=x+"px"; el.style.top=y+"px";
    if(color) el.style.color=color;
    floatLayer.appendChild(el);
    setTimeout(()=>el.remove(),1000);
  }

  const particles = [];   // generic particles {type,...}
  function sizzlePop(x,y){
    for(let i=0;i<8;i++) particles.push({type:"spark",x,y,vx:(Math.random()-0.5)*3,vy:-Math.random()*3-1,life:1,size:2+Math.random()*3,hue:40+Math.random()*20});
  }
  function spawnSteam(x,y){
    for(let i=0;i<3;i++) particles.push({type:"steam",x:x+(Math.random()-0.5)*20,y,vy:-0.5-Math.random()*0.6,life:1,r:6+Math.random()*8,drift:(Math.random()-0.5)*0.4});
  }
  function flyBurger(x,y,tx,ty,delay){
    particles.push({type:"flyburger",x,y,sx:x,sy:y,tx,ty,t:0,delay,life:1});
  }
  function flyCoins(x,y,n){
    for(let i=0;i<n;i++) particles.push({type:"coin",x,y,vx:(Math.random()-0.5)*4,vy:-3-Math.random()*3,g:0.22,life:1,spin:Math.random()*Math.PI,rot:(Math.random()-0.5)*0.3});
  }
  function confetti(x,y){
    for(let i=0;i<14;i++) particles.push({type:"confetti",x,y,vx:(Math.random()-0.5)*6,vy:-Math.random()*5-2,g:0.18,life:1,hue:Math.random()*360,rot:Math.random()*6,vr:(Math.random()-0.5)*0.4,w:4+Math.random()*4,h:6+Math.random()*5});
  }
  function bigConfetti(){ for(let k=0;k<5;k++) confetti(W*(0.2+0.15*k), H*0.3); }

  let screenFlash = 0;

  // ---------- Layout helpers ----------
  const counterY = () => Math.round(H * 0.66);
  const chefStationY = () => counterY() - 110;
  const custYPos = () => counterY() + 92;

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

  // ============================================================
  //  RENDERING
  // ============================================================
  function drawBackground() {
    const wallH = counterY();
    // warm wall gradient
    let g = ctx.createLinearGradient(0,0,0,wallH);
    g.addColorStop(0,"#ffe7a6"); g.addColorStop(0.6,"#ffd071"); g.addColorStop(1,"#ffbf5c");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,wallH);

    // soft vignette glow top center
    const rg = ctx.createRadialGradient(W/2, wallH*0.1, 20, W/2, wallH*0.1, W*0.8);
    rg.addColorStop(0,"rgba(255,255,255,0.35)"); rg.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,wallH);

    // subtle diagonal wall stripes
    ctx.save(); ctx.globalAlpha=0.06; ctx.fillStyle="#7a4a12";
    for(let i=-wallH;i<W;i+=64){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+wallH*0.4,wallH); ctx.lineTo(i+wallH*0.4+30,wallH); ctx.lineTo(i+30,0); ctx.closePath(); ctx.fill(); }
    ctx.restore();

    // hanging string lights
    drawStringLights(wallH);

    // decorative posters / plant
    drawPoster(W*0.13, wallH*0.34, 64, 84, "🍟");
    drawPoster(W*0.87, wallH*0.34, 64, 84, "🥤");
    drawPlant(W*0.07, wallH);
    drawPlant(W*0.93, wallH);

    // big menu board
    drawMenuBoard(W*0.5, Math.max(64, wallH*0.18));

    // floor
    g = ctx.createLinearGradient(0,wallH,0,H);
    g.addColorStop(0,"#c97d45"); g.addColorStop(1,"#8a4e28");
    ctx.fillStyle=g; ctx.fillRect(0,wallH,W,H-wallH);
    // floor perspective tiles
    ctx.strokeStyle="rgba(0,0,0,0.12)"; ctx.lineWidth=2;
    for(let i=-H;i<W+H;i+=58){ ctx.beginPath(); ctx.moveTo(i,wallH); ctx.lineTo(i+(H-wallH)*0.45,H); ctx.stroke(); }
    ctx.strokeStyle="rgba(255,255,255,0.06)"; 
    for(let y=wallH+30;y<H;y+=30){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  }

  function drawStringLights(wallH){
    ctx.save();
    ctx.strokeStyle="rgba(80,50,20,0.5)"; ctx.lineWidth=2;
    const y0=14, sag=26, span=W/8;
    ctx.beginPath();
    for(let i=0;i<=W;i+=4){ const yy=y0+Math.sin(i/span*Math.PI)*0; const drop=Math.abs(Math.sin(i/(span)) )*sag; ctx.lineTo(i, y0+Math.sin((i/W)*Math.PI*8)*0+ ((i%span)/span)*0 + sagCurve(i,span,sag)); }
    ctx.stroke();
    const colors=["#ff6b6b","#ffd166","#6bcB77","#4dabf7","#b197fc"];
    for(let i=span/2;i<W;i+=span){ const yy=y0+sagCurve(i,span,sag)+6; const c=colors[Math.floor(i/span)%colors.length]; const glow=0.5+0.5*Math.sin(time*3+i); 
      ctx.fillStyle=c; ctx.globalAlpha=0.5+0.5*glow; ctx.beginPath(); ctx.arc(i,yy,6,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.25*glow; ctx.beginPath(); ctx.arc(i,yy,13,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    }
    ctx.restore();
  }
  function sagCurve(i,span,sag){ const p=(i%span)/span; return Math.sin(p*Math.PI)*sag; }

  function drawPoster(cx,cy,w,h,emoji){
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(-0.04);
    ctx.shadowColor="rgba(0,0,0,0.2)"; ctx.shadowBlur=8; ctx.shadowOffsetY=4;
    roundRect(-w/2,-h/2,w,h,8); ctx.fillStyle="#fff7e6"; ctx.fill();
    ctx.shadowColor="transparent";
    ctx.lineWidth=3; ctx.strokeStyle="#e8a33d"; roundRect(-w/2,-h/2,w,h,8); ctx.stroke();
    ctx.font=`${h*0.42}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(emoji,0,-h*0.12);
    ctx.fillStyle="#c4561c"; ctx.font="900 12px 'Trebuchet MS',sans-serif"; ctx.fillText("YUM!",0,h*0.28);
    ctx.restore();
  }

  function drawPlant(x,baseY){
    ctx.save(); ctx.translate(x,baseY);
    // pot
    roundRect(-18,-6,36,26,{tl:4,tr:4,br:8,bl:8}); ctx.fillStyle="#b5532b"; ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.15)"; roundRect(-18,-6,36,6,4); ctx.fill();
    // leaves
    ctx.fillStyle="#3f9d4a";
    for(let i=-2;i<=2;i++){ ctx.save(); ctx.rotate(i*0.32 + Math.sin(time*1.5+i)*0.04); ctx.beginPath(); ctx.ellipse(0,-34,9,26,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    ctx.fillStyle="#54c163"; ctx.beginPath(); ctx.ellipse(0,-30,8,22,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawMenuBoard(cx,cy){
    ctx.save(); ctx.translate(cx,cy);
    ctx.shadowColor="rgba(0,0,0,0.3)"; ctx.shadowBlur=14; ctx.shadowOffsetY=6;
    roundRect(-140,-42,280,92,14); ctx.fillStyle="#2e2016"; ctx.fill();
    ctx.shadowColor="transparent";
    ctx.lineWidth=5; ctx.strokeStyle="#d9a441"; roundRect(-140,-42,280,92,14); ctx.stroke();
    ctx.lineWidth=2; ctx.strokeStyle="rgba(255,255,255,0.12)"; roundRect(-132,-34,264,76,10); ctx.stroke();
    ctx.fillStyle="#ffd95a"; ctx.font="900 24px 'Trebuchet MS',sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("🍔 BURGER MENU 🍔",0,-16);
    ctx.font="700 14px 'Trebuchet MS',sans-serif"; ctx.fillStyle="#fff";
    ctx.fillText("Classic  •  Double  •  Deluxe",0,12);
    ctx.fillStyle="#9be36a"; ctx.font="800 13px 'Trebuchet MS',sans-serif";
    ctx.fillText("$"+burgerPrice()+" each",0,32);
    ctx.restore();
  }

  // ---- Counter + tray + chef ----
  function drawCounter() {
    const y = counterY();
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,0.25)"; ctx.shadowBlur=12; ctx.shadowOffsetY=-3;
    // counter top (wood)
    let g=ctx.createLinearGradient(0,y-18,0,y); g.addColorStop(0,"#b07a4e"); g.addColorStop(1,"#8a5e38");
    ctx.fillStyle=g; ctx.fillRect(0,y-18,W,18);
    ctx.fillStyle="rgba(255,255,255,0.25)"; ctx.fillRect(0,y-18,W,4);
    // counter front panel
    g=ctx.createLinearGradient(0,y,0,y+80); g.addColorStop(0,"#f3f3f8"); g.addColorStop(1,"#c2c2d2");
    ctx.fillStyle=g; ctx.fillRect(0,y,W,80);
    // panel lines
    ctx.strokeStyle="rgba(0,0,0,0.08)"; ctx.lineWidth=2;
    for(let i=70;i<W;i+=110){ ctx.beginPath(); ctx.moveTo(i,y+6); ctx.lineTo(i,y+74); ctx.stroke(); }
    ctx.restore();

    drawTray(W/2, y-18);
  }

  function drawTray(cx, topY){
    const max=S.trayMax;
    const slotW=Math.min(48,(W-90)/Math.max(max,1));
    const totalW=slotW*max;
    // metal tray
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,0.25)"; ctx.shadowBlur=8; ctx.shadowOffsetY=3;
    roundRect(cx-totalW/2-12, topY-26, totalW+24, 26, 9);
    let g=ctx.createLinearGradient(0,topY-26,0,topY); g.addColorStop(0,"#d7dae6"); g.addColorStop(1,"#a3a8bd");
    ctx.fillStyle=g; ctx.fill(); ctx.shadowColor="transparent";
    ctx.fillStyle="rgba(255,255,255,0.4)"; roundRect(cx-totalW/2-12, topY-26, totalW+24, 5, 4); ctx.fill();
    ctx.restore();
    const startX=cx-totalW/2+slotW/2;
    for(let i=0;i<max;i++){
      const x=startX+i*slotW;
      if(i<trayCount){ const pop = (i===trayCount-1)?(1+0.12*Math.max(0,1-(time*4%6))):1; drawBurger(x, topY-13, slotW*0.44); }
      else { ctx.save(); ctx.globalAlpha=0.16; ctx.fillStyle="#5a4a3a"; ctx.beginPath(); ctx.ellipse(x,topY-8,slotW*0.32,5,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    }
  }

  // ---- The signature juicy burger ----
  function drawBurger(cx,cy,r){
    ctx.save(); ctx.translate(cx,cy);
    // shadow
    ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(0,r*0.85,r*1.05,r*0.3,0,0,Math.PI*2); ctx.fill();
    // bottom bun
    let g=ctx.createLinearGradient(0,r*0.2,0,r*0.95);
    g.addColorStop(0,"#f0b863"); g.addColorStop(1,"#d98e3f");
    ctx.fillStyle=g; roundRect(-r*0.98, r*0.18, r*1.96, r*0.62, {tl:r*0.2,tr:r*0.2,br:r*0.45,bl:r*0.45}); ctx.fill();
    // patty
    g=ctx.createLinearGradient(0,r*0,0,r*0.5); g.addColorStop(0,"#7a4a26"); g.addColorStop(1,"#542f15");
    ctx.fillStyle=g; roundRect(-r*1.0, r*-0.02, r*2.0, r*0.5, r*0.24); ctx.fill();
    // cheese drips
    ctx.fillStyle="#ffc83d";
    ctx.beginPath();
    ctx.moveTo(-r*0.98,r*0.02);
    ctx.lineTo(r*0.98,r*0.02);
    ctx.lineTo(r*0.7,r*0.34); ctx.lineTo(r*0.42,r*0.12);
    ctx.lineTo(r*0.12,r*0.4); ctx.lineTo(-r*0.2,r*0.12);
    ctx.lineTo(-r*0.5,r*0.36); ctx.lineTo(-r*0.78,r*0.1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.25)"; roundRect(-r*0.95,r*-0.02,r*1.9,r*0.08,4); ctx.fill();
    // lettuce frill
    ctx.fillStyle="#7bc043";
    for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.arc(i*r*0.42, r*-0.06, r*0.34, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle="#8fd154";
    for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.arc(i*r*0.42+ r*0.18, r*-0.04, r*0.22, Math.PI, 0); ctx.fill(); }
    // tomato
    ctx.fillStyle="#e9533b"; roundRect(-r*0.7,r*-0.16,r*1.4,r*0.12,5); ctx.fill();
    // top bun (domed, glossy)
    g=ctx.createRadialGradient(-r*0.3,r*-0.65,r*0.1,0,r*-0.2,r*1.2);
    g.addColorStop(0,"#ffcf85"); g.addColorStop(0.6,"#f2ab53"); g.addColorStop(1,"#dd8e39");
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,r*-0.18,r,r*0.78,0,Math.PI,0); ctx.fill();
    roundRect(-r,r*-0.18,r*2,r*0.14,0); ctx.fill();
    // bun gloss highlight
    ctx.fillStyle="rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(-r*0.32,r*-0.5,r*0.34,r*0.16,-0.5,0,Math.PI*2); ctx.fill();
    // sesame seeds
    ctx.fillStyle="#fff7e2";
    const seeds=[[-0.45,-0.4],[-0.1,-0.55],[0.28,-0.45],[0.5,-0.2],[-0.65,-0.15],[0.08,-0.28],[-0.28,-0.18]];
    for(const [sx,sy] of seeds){ ctx.save(); ctx.translate(sx*r,sy*r); ctx.rotate(sx); ctx.beginPath(); ctx.ellipse(0,0,r*0.07,r*0.12,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }

  // ---- Chef ----
  function drawChef(cx,baseY){
    ctx.save();
    const bob=Math.sin(time*3)*3;
    const arm=Math.sin(time*6)*0.5;
    ctx.translate(cx, baseY+bob);
    // shadow
    ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(0,66,40,9,0,0,Math.PI*2); ctx.fill();
    // grill behind
    ctx.fillStyle="#333"; roundRect(-46,42,92,16,5); ctx.fill();
    ctx.fillStyle="#555"; for(let i=-40;i<40;i+=10){ ctx.fillRect(i,44,3,12); }
    // body apron
    let g=ctx.createLinearGradient(0,0,0,56); g.addColorStop(0,"#ffffff"); g.addColorStop(1,"#eef0f5");
    ctx.fillStyle=g; roundRect(-30,2,60,54,16); ctx.fill();
    g=ctx.createLinearGradient(0,20,0,56); g.addColorStop(0,"#ff6b3d"); g.addColorStop(1,"#e8431f");
    ctx.fillStyle=g; roundRect(-20,20,40,36,{tl:6,tr:6,br:10,bl:10}); ctx.fill();
    ctx.strokeStyle="rgba(0,0,0,0.12)"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,20); ctx.lineTo(0,52); ctx.stroke();
    // arms (flipping)
    ctx.strokeStyle="#fff"; ctx.lineWidth=10; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-22,18); ctx.lineTo(-34,30+arm*8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22,18); ctx.lineTo(34,30-arm*8); ctx.stroke();
    // mini burger in hand
    ctx.save(); ctx.translate(34,30-arm*8); drawBurger(0,0,9); ctx.restore();
    // head
    g=ctx.createRadialGradient(-4,-16,3,0,-12,22); g.addColorStop(0,"#ffdcb0"); g.addColorStop(1,"#f0bd86");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,-12,19,0,Math.PI*2); ctx.fill();
    // chef hat
    ctx.fillStyle="#fff"; roundRect(-17,-36,34,14,5); ctx.fill();
    ctx.beginPath(); ctx.arc(-11,-38,10,0,Math.PI*2); ctx.arc(0,-43,12,0,Math.PI*2); ctx.arc(11,-38,10,0,Math.PI*2); ctx.fill();
    // eyes + blink
    const open = (Math.sin(time*1.7)>-0.9)?1:0.12;
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(-6,-13,4,5*open,0,0,Math.PI*2); ctx.ellipse(6,-13,4,5*open,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#3a2a1a"; ctx.beginPath(); ctx.arc(-5,-13,2.1,0,Math.PI*2); ctx.arc(7,-13,2.1,0,Math.PI*2); ctx.fill();
    // cheeks
    ctx.fillStyle="rgba(255,120,90,0.4)"; ctx.beginPath(); ctx.arc(-10,-7,3.5,0,Math.PI*2); ctx.arc(10,-7,3.5,0,Math.PI*2); ctx.fill();
    // smile
    ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=2.2; ctx.beginPath(); ctx.arc(0,-7,6,0.12*Math.PI,0.88*Math.PI); ctx.stroke();
    // cook progress
    if(S.cooks>0){ ctx.fillStyle="rgba(0,0,0,0.25)"; roundRect(-30,60,60,7,4); ctx.fill(); ctx.fillStyle="#ffce4a"; const p=Math.min(1,cookAutoTimer/(cookInterval()/Math.max(1,S.cooks))); roundRect(-30,60,60*p,7,4); ctx.fill(); }
    ctx.restore();
  }

  // ---- Customer ----
  function drawCustomer(c){
    const y = custYPos();
    const sc = c.scale;
    const bob=Math.sin(c.bounce)*4 * (c.state==="waiting"?1:0.4);
    const walk = c.state!=="waiting" ? Math.sin(c.walkPhase)*3 : 0;
    ctx.save();
    ctx.translate(c.x, y+bob);
    ctx.scale(sc, sc);
    // shadow
    ctx.fillStyle="rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0,50,26,7,0,0,Math.PI*2); ctx.fill();
    // legs
    ctx.strokeStyle=`hsl(${c.bodyHue},45%,30%)`; ctx.lineWidth=8; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-8,40); ctx.lineTo(-8+walk,52); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8,40); ctx.lineTo(8-walk,52); ctx.stroke();
    // body
    let g=ctx.createLinearGradient(0,-6,0,46);
    g.addColorStop(0,`hsl(${c.bodyHue},70%,62%)`); g.addColorStop(1,`hsl(${c.bodyHue},65%,50%)`);
    ctx.fillStyle=g; roundRect(-24,-6,48,50,16); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.18)"; roundRect(-24,-6,48,12,{tl:16,tr:16,br:0,bl:0}); ctx.fill();
    // arms
    ctx.strokeStyle=`hsl(${c.bodyHue},65%,55%)`; ctx.lineWidth=8;
    ctx.beginPath(); ctx.moveTo(-22,6); ctx.lineTo(-30,24+Math.sin(c.bounce)*3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22,6); ctx.lineTo(30,24-Math.sin(c.bounce)*3); ctx.stroke();
    // head
    g=ctx.createRadialGradient(-4,-22,2,0,-18,18); g.addColorStop(0,"#fff"); g.addColorStop(0.15,c.skin); g.addColorStop(1,c.skin);
    ctx.fillStyle=c.skin; ctx.beginPath(); ctx.arc(0,-18,16,0,Math.PI*2); ctx.fill();
    // hair
    ctx.fillStyle=c.hair; ctx.beginPath(); ctx.arc(0,-22,16,Math.PI*1.02,Math.PI*-0.02); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-13,-20,5,8,0,0,Math.PI*2); ctx.ellipse(13,-20,5,8,0,0,Math.PI*2); ctx.fill();
    // eyes (with blink)
    const open = c.blinkT>0 ? 0.12 : 1;
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(-5,-18,3.4,4.6*open,0,0,Math.PI*2); ctx.ellipse(5,-18,3.4,4.6*open,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#2a1c12"; ctx.beginPath(); ctx.arc(-4.5,-18,1.9,0,Math.PI*2); ctx.arc(5.5,-18,1.9,0,Math.PI*2); ctx.fill();
    // cheeks
    ctx.fillStyle="rgba(255,120,90,0.35)"; ctx.beginPath(); ctx.arc(-9,-12,3,0,Math.PI*2); ctx.arc(9,-12,3,0,Math.PI*2); ctx.fill();
    // mouth
    ctx.strokeStyle="#2a1c12"; ctx.lineWidth=2;
    ctx.beginPath();
    if(c.eat>0) ctx.arc(0,-10,4.5,0,Math.PI*2);
    else if(c.happy>0) ctx.arc(0,-12,5,0.05*Math.PI,0.95*Math.PI);
    else ctx.arc(0,-11,4,0.1*Math.PI,0.9*Math.PI);
    ctx.stroke();
    ctx.restore();

    if(c.state==="waiting") drawOrderBubble(c, y+bob);
    if(c.happy>0) drawHearts(c, y+bob);
  }

  function drawOrderBubble(c,y){
    const remaining=c.want-c.got;
    const pulse=1+Math.sin(time*4)*0.04;
    ctx.save(); ctx.translate(c.x, y-58); ctx.scale(c.scale*pulse, c.scale*pulse);
    ctx.shadowColor="rgba(0,0,0,0.18)"; ctx.shadowBlur=8; ctx.shadowOffsetY=3;
    roundRect(-38,-24,76,38,12); ctx.fillStyle="#ffffff"; ctx.fill();
    ctx.shadowColor="transparent";
    ctx.beginPath(); ctx.moveTo(-7,13); ctx.lineTo(7,13); ctx.lineTo(0,24); ctx.closePath(); ctx.fillStyle="#fff"; ctx.fill();
    drawBurger(-12,-4,11);
    ctx.fillStyle="#2a1c12"; ctx.font="900 20px 'Trebuchet MS',sans-serif"; ctx.textAlign="left"; ctx.textBaseline="middle";
    ctx.fillText("×"+remaining, 7, -3);
    ctx.restore();
  }

  function drawHearts(c,y){
    ctx.save(); ctx.globalAlpha=c.happy;
    ctx.fillStyle="#ff5d7a"; ctx.font="18px serif"; ctx.textAlign="center";
    ctx.fillText("❤", c.x-14, y-66-(1-c.happy)*20);
    ctx.fillText("❤", c.x+14, y-72-(1-c.happy)*26);
    ctx.restore();
  }

  // ---- Particles ----
  function drawParticles(){
    for(const p of particles){
      if(p.type==="spark"){ ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=`hsl(${p.hue},100%,60%)`; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
      else if(p.type==="steam"){ ctx.globalAlpha=Math.max(0,p.life)*0.4; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }
      else if(p.type==="coin"){ ctx.globalAlpha=Math.max(0,p.life); ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.spin); ctx.scale(Math.cos(p.spin)*0.6+0.6,1); 
        ctx.fillStyle="#ffd23f"; ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#e0a91b"; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill(); ctx.restore(); }
      else if(p.type==="confetti"){ ctx.globalAlpha=Math.max(0,p.life); ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=`hsl(${p.hue},85%,60%)`; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore(); }
      else if(p.type==="flyburger"){ ctx.globalAlpha=1; const e=easeInOut(Math.min(1,p.t)); const x=p.sx+(p.tx-p.sx)*e; const y=p.sy+(p.ty-p.sy)*e - Math.sin(e*Math.PI)*70; drawBurger(x,y,14); }
    }
    ctx.globalAlpha=1;
  }
  function easeInOut(t){ return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; }

  // ============================================================
  //  UPDATE
  // ============================================================
  let last=performance.now();
  function update(now){
    const dtMs=Math.min(50, now-last); last=now; const dt=dtMs/1000;
    time+=dt;

    spawnTimer-=dtMs;
    if(spawnTimer<=0 && customers.length<S.seats){
      const c=makeCustomer(); customers.push(c); layoutCustomers();
      spawnTimer=1300+Math.random()*1100;
    }

    for(let i=customers.length-1;i>=0;i--){
      const c=customers[i];
      c.bounce+=dt*3; c.walkPhase+=dt*12;
      if(c.scale<1) c.scale=Math.min(1,c.scale+dt*4);
      if(c.eat>0) c.eat-=dt*1.2;
      if(c.happy>0) c.happy-=dt*0.8;
      // blink timer
      c.blink-=dt; if(c.blink<=0){ c.blinkT=0.12; c.blink=2+Math.random()*3; } if(c.blinkT>0) c.blinkT-=dt;

      if(c.state==="walkin"){ c.x+=(c.targetX-c.x)*0.12; if(Math.abs(c.x-c.targetX)<2){ c.x=c.targetX; c.state="waiting"; } }
      else if(c.state==="leaving"){ c.x-=dtMs*0.5; c.scale=Math.max(0,c.scale-dt*0.4); if(c.x<-90||c.scale<=0){ customers.splice(i,1); layoutCustomers(); } }
    }

    if(S.cooks>0){ cookAutoTimer+=dtMs; const interval=cookInterval()/Math.max(1,S.cooks); if(cookAutoTimer>=interval){ cookAutoTimer=0; if(trayCount<S.trayMax) cookOneBurger(); } }
    if(S.cashiers>0){ cashierTimer+=dtMs; const interval=Math.max(350,1100-S.cashiers*150); if(cashierTimer>=interval){ cashierTimer=0; const w=customers.find(c=>c.state==="waiting"); if(w&&trayCount>0) serveCustomer(w); } }

    // particles
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      if(p.type==="spark"){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.life-=dt*2; }
      else if(p.type==="steam"){ p.y+=p.vy*dtMs*0.06; p.x+=p.drift; p.r+=dt*6; p.life-=dt*0.8; }
      else if(p.type==="coin"){ p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.spin+=0.25; p.life-=dt*0.9; }
      else if(p.type==="confetti"){ p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.rot+=p.vr; p.life-=dt*0.6; }
      else if(p.type==="flyburger"){ if(p.delay>0){ p.delay-=dtMs; } else { p.t+=dt*2.2; if(p.t>=1) p.life=0; } }
      if(p.life<=0) particles.splice(i,1);
    }

    if(screenFlash>0) screenFlash-=dt;

    saveTimer+=dtMs; if(saveTimer>3000){ saveTimer=0; saveGame(); }
  }

  function render(){
    ctx.clearRect(0,0,W,H);
    drawBackground();
    customers.forEach(drawCustomer);
    drawChef(W/2, chefStationY());
    drawCounter();
    drawParticles();
    if(screenFlash>0){ ctx.fillStyle=`rgba(255,255,255,${screenFlash*0.4})`; ctx.fillRect(0,0,W,H); }
  }

  function loop(now){ update(now); render(); requestAnimationFrame(loop); }

  // ---------- Input ----------
  canvas.addEventListener("pointerdown",(e)=>{
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const hit=customers.find(c=>c.state==="waiting" && Math.abs(c.x-x)<44 && Math.abs(custYPos()-y)<96);
    if(hit){ serveCustomer(hit); return; }
    if(y>counterY()-150) tapCook();
  });
  document.getElementById("cook-btn").addEventListener("click", tapCook);

  // ---------- HUD + Shop ----------
  const moneyEl=document.getElementById("money");
  const levelEl=document.getElementById("level");
  function updateHUD(){ moneyEl.textContent=format(S.money); levelEl.textContent=S.level; }
  function format(n){ n=Math.floor(n); if(n<1000)return""+n; if(n<1e6)return(n/1e3).toFixed(n<1e4?1:0)+"K"; if(n<1e9)return(n/1e6).toFixed(1)+"M"; return(n/1e9).toFixed(1)+"B"; }

  const shopList=document.getElementById("shop-list");
  const shopPanel=document.getElementById("shop-panel");
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

  // ---------- Offline / welcome ----------
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

  // ---------- Boot ----------
  function boot(){
    resize(); layoutCustomers(); updateHUD(); renderShop();
    const offline=computeOfflineEarnings();
    if(offline>0){ S.money+=offline; updateHUD(); showModal("Welcome back! 🍔", `Your shop earned ${format(offline)} coins while you were away!`, "COLLECT"); }
    else if(S.served===0){ showModal("🍔 Burger Ready!", "Tap COOK to grill burgers, then tap a hungry customer to serve them. Earn coins and upgrade your shop!", "LET'S COOK!"); }
    else document.getElementById("modal").classList.add("hidden");
    window.addEventListener("beforeunload", saveGame);
    document.addEventListener("visibilitychange",()=>{ if(document.hidden) saveGame(); });
    requestAnimationFrame((t)=>{ last=t; loop(t); });
  }
  boot();

  // register service worker for PWA / offline (optional, ignored if file missing)
  if("serviceWorker" in navigator){ window.addEventListener("load",()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }); }
})();
