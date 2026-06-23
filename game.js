/* ============================================================
   BURGER READY!  —  an original idle burger-shop game
   Vanilla JS + HTML5 Canvas. All graphics drawn in code.
   ============================================================ */

(() => {
  "use strict";

  // ---------- Canvas setup ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);

  // ---------- Persistent game state ----------
  const SAVE_KEY = "burgerReadySave_v1";

  const defaultState = {
    money: 0,
    level: 1,
    served: 0,
    trayMax: 3,          // burgers that fit on counter tray
    cookSpeedLvl: 0,     // affects auto-cook speed / tap power
    priceLvl: 0,         // price per burger
    cooks: 0,            // auto burger makers
    cashiers: 0,         // auto servers
    seats: 2,            // number of customer slots
    upgrades: {},        // levels keyed by upgrade id
    lastSeen: Date.now(),
  };

  let S = loadGame();

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return Object.assign(structuredClone(defaultState), parsed);
    } catch {
      return structuredClone(defaultState);
    }
  }

  let saveTimer = 0;
  function saveGame() {
    S.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {}
  }

  // ---------- Economy / upgrade definitions ----------
  const UPGRADES = [
    {
      id: "price",
      icon: "💲",
      name: "Tastier Recipe",
      desc: "Earn more coins per burger served.",
      baseCost: 25,
      growth: 1.55,
      max: 50,
      apply: (lvl) => { S.priceLvl = lvl; },
    },
    {
      id: "tray",
      icon: "🍔",
      name: "Bigger Counter",
      desc: "Hold more ready burgers on the counter.",
      baseCost: 40,
      growth: 1.7,
      max: 12,
      apply: (lvl) => { S.trayMax = 3 + lvl; },
    },
    {
      id: "cookspeed",
      icon: "⚡",
      name: "Faster Grill",
      desc: "Cooks make burgers faster.",
      baseCost: 60,
      growth: 1.6,
      max: 30,
      apply: (lvl) => { S.cookSpeedLvl = lvl; },
    },
    {
      id: "cooks",
      icon: "👨‍🍳",
      name: "Hire Cook",
      desc: "Auto-cooks burgers for you.",
      baseCost: 120,
      growth: 1.9,
      max: 6,
      apply: (lvl) => { S.cooks = lvl; },
    },
    {
      id: "cashiers",
      icon: "🧑‍💼",
      name: "Hire Cashier",
      desc: "Auto-serves waiting customers.",
      baseCost: 200,
      growth: 2.0,
      max: 4,
      apply: (lvl) => { S.cashiers = lvl; },
    },
    {
      id: "seats",
      icon: "🪑",
      name: "More Space",
      desc: "Adds room for more customers.",
      baseCost: 90,
      growth: 1.75,
      max: 6,
      apply: (lvl) => { S.seats = 2 + lvl; },
    },
  ];

  function upgLevel(id) { return S.upgrades[id] || 0; }
  function upgCost(u) {
    const lvl = upgLevel(u.id);
    return Math.floor(u.baseCost * Math.pow(u.growth, lvl));
  }
  function burgerPrice() { return 5 + S.priceLvl * 3; }
  function cookInterval() { return Math.max(380, 1500 - S.cookSpeedLvl * 45); } // ms per auto burger

  // Re-apply all upgrade effects to derived state (after load).
  function applyAllUpgrades() {
    for (const u of UPGRADES) u.apply(upgLevel(u.id));
  }
  applyAllUpgrades();

  // ---------- Runtime (non-saved) state ----------
  let trayCount = 0;          // burgers ready on the counter
  let cookProgress = 0;       // 0..1 progress of the burger currently grilling (manual tap fills it)
  const customers = [];       // active customers
  let spawnTimer = 0;
  let cookAutoTimer = 0;
  let cashierTimer = 0;
  let chefBob = 0;            // animation phase

  // ---------- Customer model ----------
  let custId = 0;
  function makeCustomer() {
    const want = 1 + Math.floor(Math.random() * Math.min(3, 1 + Math.floor(S.level / 3)));
    return {
      id: ++custId,
      want,
      got: 0,
      x: W + 60,           // enters from right
      targetX: 0,          // assigned by layout
      state: "walkin",     // walkin -> waiting -> leaving
      hue: Math.floor(Math.random() * 360),
      bounce: Math.random() * Math.PI * 2,
      eat: 0,
    };
  }

  function customerSlots() {
    // positions across the lower-mid area where customers stand
    const slots = [];
    const n = S.seats;
    const margin = 60;
    const usable = W - margin * 2;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      slots.push(margin + usable * t);
    }
    return slots;
  }

  function layoutCustomers() {
    const slots = customerSlots();
    customers.forEach((c, i) => {
      if (i < slots.length) c.targetX = slots[i];
      else c.targetX = W + 80; // overflow waits off screen
    });
  }

  // ---------- Actions ----------
  function cookOneBurger() {
    if (trayCount >= S.trayMax) {
      floatText("Counter full!", W / 2, H - 200, "#ff6b6b");
      return false;
    }
    trayCount++;
    spawnPop(W / 2, counterY() - 10);
    return true;
  }

  function tapCook() {
    // Manual tap instantly cooks a burger (with a little juice).
    cookOneBurger();
  }

  function serveCustomer(c) {
    if (trayCount <= 0) return false;
    if (c.state !== "waiting") return false;
    const need = c.want - c.got;
    const give = Math.min(need, trayCount);
    if (give <= 0) return false;
    trayCount -= give;
    c.got += give;
    c.eat = 0.6;
    if (c.got >= c.want) {
      const pay = c.want * burgerPrice();
      gainMoney(pay, c.targetX, c.yPos());
      c.state = "leaving";
      S.served += c.want;
      maybeLevelUp();
    }
    return true;
  }

  function gainMoney(amount, x, y) {
    S.money += amount;
    floatText("+" + format(amount), x, y, "#ffe14d", true);
    updateHUD();
  }

  function maybeLevelUp() {
    const need = S.level * 8;
    if (S.served >= need) {
      S.level++;
      floatText("LEVEL " + S.level + "!", W / 2, H / 2 - 40, "#7be36a");
      flashScreen();
      updateHUD();
      renderShop();
    }
  }

  // ---------- Floating text / particles ----------
  const floatLayer = document.getElementById("float-layer");
  function floatText(txt, x, y, color, coin) {
    const el = document.createElement("div");
    el.className = "float-txt" + (coin ? " coin" : "");
    el.textContent = txt;
    el.style.left = x + "px";
    el.style.top = y + "px";
    if (color) el.style.color = color;
    floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  const pops = [];
  function spawnPop(x, y) {
    for (let i = 0; i < 6; i++) {
      pops.push({
        x, y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 3 - 1,
        life: 1,
        size: 3 + Math.random() * 3,
      });
    }
  }

  let screenFlash = 0;
  function flashScreen() { screenFlash = 0.6; }

  // ---------- Drawing helpers (original art) ----------
  function counterY() { return H * 0.62; }

  function drawBackground() {
    // Wall
    const wallH = counterY();
    let g = ctx.createLinearGradient(0, 0, 0, wallH);
    g.addColorStop(0, "#ffe39a");
    g.addColorStop(1, "#ffcf73");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, wallH);

    // Wall stripes
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    for (let i = 0; i < W; i += 70) ctx.fillRect(i, 0, 35, wallH);

    // Menu board
    drawMenuBoard(W * 0.5, 70);

    // Floor
    g = ctx.createLinearGradient(0, wallH, 0, H);
    g.addColorStop(0, "#b56a3a");
    g.addColorStop(1, "#8a4e28");
    ctx.fillStyle = g;
    ctx.fillRect(0, wallH, W, H - wallH);

    // Floor tiles
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 2;
    for (let i = -H; i < W; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, wallH);
      ctx.lineTo(i + (H - wallH) * 0.5, H);
      ctx.stroke();
    }
  }

  function drawMenuBoard(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    roundRect(-120, -34, 240, 78, 12);
    ctx.fillStyle = "#3a2a1a";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#d9a441";
    ctx.stroke();
    ctx.fillStyle = "#ffd95a";
    ctx.font = "900 22px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BURGER MENU", 0, -6);
    ctx.font = "700 14px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("🍔 Classic   🍔 Double   🍔 Deluxe", 0, 20);
    ctx.restore();
  }

  function drawCounter() {
    const y = counterY();
    // Counter front
    let g = ctx.createLinearGradient(0, y, 0, y + 70);
    g.addColorStop(0, "#f0f0f5");
    g.addColorStop(1, "#c7c7d6");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, 70);
    // Counter top edge
    ctx.fillStyle = "#8d6a4a";
    ctx.fillRect(0, y - 14, W, 14);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(0, y - 14, W, 4);

    // Tray with ready burgers
    drawTray(W / 2, y - 14);

    // Grill / chef station behind counter
    drawChef(W * 0.5, y - 96);
  }

  function drawTray(cx, topY) {
    const max = S.trayMax;
    const slotW = Math.min(46, (W - 120) / Math.max(max, 1));
    const totalW = slotW * max;
    const startX = cx - totalW / 2 + slotW / 2;
    // tray base
    roundRect(cx - totalW / 2 - 8, topY - 20, totalW + 16, 22, 8);
    ctx.fillStyle = "#9aa0b5";
    ctx.fill();
    for (let i = 0; i < max; i++) {
      const x = startX + i * slotW;
      ctx.save();
      ctx.globalAlpha = i < trayCount ? 1 : 0.18;
      drawBurger(x, topY - 18, slotW * 0.42);
      ctx.restore();
    }
  }

  // The signature original burger sprite (drawn with paths)
  function drawBurger(cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    // bottom bun
    ctx.fillStyle = "#e8a85c";
    roundRect(-r, 4, r * 2, r * 0.7, r * 0.35);
    ctx.fill();
    // patty
    ctx.fillStyle = "#6b3e1d";
    roundRect(-r * 0.95, 0, r * 1.9, r * 0.55, r * 0.27);
    ctx.fill();
    // cheese
    ctx.fillStyle = "#ffcf3f";
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, 2);
    ctx.lineTo(r * 0.95, 2);
    ctx.lineTo(r * 0.55, r * 0.5);
    ctx.lineTo(r * 0.1, r * 0.1);
    ctx.lineTo(-r * 0.4, r * 0.5);
    ctx.closePath();
    ctx.fill();
    // lettuce
    ctx.fillStyle = "#7bc043";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * r * 0.55, -1, r * 0.4, Math.PI, 0);
      ctx.fill();
    }
    // top bun
    ctx.fillStyle = "#f0b25e";
    ctx.beginPath();
    ctx.arc(0, -2, r, Math.PI, 0);
    ctx.fill();
    roundRect(-r, -2, r * 2, 5, 0);
    ctx.fill();
    // sesame seeds
    ctx.fillStyle = "#fff4dc";
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + 0.35 + i * 0.5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.6, -2 + Math.sin(a) * r * 0.45, 2.2, 3.4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawChef(cx, baseY) {
    ctx.save();
    const bob = Math.sin(chefBob) * 3;
    ctx.translate(cx, baseY + bob);
    // body
    ctx.fillStyle = "#ffffff";
    roundRect(-26, 0, 52, 50, 14);
    ctx.fill();
    // apron
    ctx.fillStyle = "#e8431f";
    roundRect(-18, 18, 36, 32, 8);
    ctx.fill();
    // head
    ctx.fillStyle = "#f3c79a";
    ctx.beginPath();
    ctx.arc(0, -12, 18, 0, Math.PI * 2);
    ctx.fill();
    // chef hat
    ctx.fillStyle = "#fff";
    roundRect(-16, -34, 32, 12, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-10, -36, 9, 0, Math.PI * 2);
    ctx.arc(0, -40, 11, 0, Math.PI * 2);
    ctx.arc(10, -36, 9, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath();
    ctx.arc(-6, -12, 2.4, 0, Math.PI * 2);
    ctx.arc(6, -12, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // smile
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -7, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // cook progress bar (grill)
    if (S.cooks > 0 || cookAutoTimer > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      roundRect(-26, 58, 52, 8, 4); ctx.fill();
      ctx.fillStyle = "#ff8a4c";
      const p = cookAutoTimer / cookInterval();
      roundRect(-26, 58, 52 * Math.min(1, p), 8, 4); ctx.fill();
    }
    ctx.restore();
  }

  function drawCustomer(c) {
    const y = c.yPos();
    const bob = Math.sin(c.bounce) * 4;
    ctx.save();
    ctx.translate(c.x, y + bob);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 46, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = `hsl(${c.hue},65%,55%)`;
    roundRect(-22, -4, 44, 50, 14);
    ctx.fill();
    // head
    ctx.fillStyle = "#f3c79a";
    ctx.beginPath();
    ctx.arc(0, -18, 16, 0, Math.PI * 2);
    ctx.fill();
    // hair
    ctx.fillStyle = `hsl(${(c.hue + 180) % 360},40%,30%)`;
    ctx.beginPath();
    ctx.arc(0, -22, 16, Math.PI, 0);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath();
    ctx.arc(-5, -18, 2.2, 0, Math.PI * 2);
    ctx.arc(5, -18, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // mouth (eating vs smile)
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (c.eat > 0) ctx.arc(0, -11, 4, 0, Math.PI * 2);
    else ctx.arc(0, -13, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    ctx.restore();

    // order bubble
    if (c.state === "waiting") drawOrderBubble(c, y + bob);
  }

  function drawOrderBubble(c, y) {
    const remaining = c.want - c.got;
    ctx.save();
    ctx.translate(c.x, y - 56);
    roundRect(-34, -22, 68, 34, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 2; ctx.stroke();
    // pointer
    ctx.beginPath();
    ctx.moveTo(-6, 12); ctx.lineTo(6, 12); ctx.lineTo(0, 22);
    ctx.closePath(); ctx.fillStyle = "#fff"; ctx.fill();
    // mini burger + count
    drawBurger(-10, -3, 11);
    ctx.fillStyle = "#3a2a1a";
    ctx.font = "900 20px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("x" + remaining, 6, 4);
    ctx.restore();
  }

  function drawPops() {
    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = "#fff3c4";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // customer Y position helper
  function custYPos() { return counterY() + 96; }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // attach yPos to customers via prototype-ish helper
  function attachCustomerHelpers(c) {
    c.yPos = () => custYPos();
  }

  // ---------- Update loop ----------
  let last = performance.now();
  function update(now) {
    const dt = Math.min(50, now - last);
    last = now;
    chefBob += dt * 0.005;

    // spawn customers
    spawnTimer -= dt;
    if (spawnTimer <= 0 && customers.length < S.seats) {
      const c = makeCustomer();
      attachCustomerHelpers(c);
      customers.push(c);
      layoutCustomers();
      spawnTimer = 1400 + Math.random() * 1200;
    }

    // move + update customers
    for (let i = customers.length - 1; i >= 0; i--) {
      const c = customers[i];
      c.bounce += dt * 0.006;
      if (c.eat > 0) c.eat -= dt * 0.002;

      if (c.state === "walkin") {
        c.x += (c.targetX - c.x) * 0.12;
        if (Math.abs(c.x - c.targetX) < 2) { c.x = c.targetX; c.state = "waiting"; }
      } else if (c.state === "leaving") {
        c.x -= dt * 0.45; // walk off to the left
        if (c.x < -80) {
          customers.splice(i, 1);
          layoutCustomers();
        }
      }
    }

    // auto cooks
    if (S.cooks > 0) {
      cookAutoTimer += dt;
      const interval = cookInterval() / Math.max(1, S.cooks);
      if (cookAutoTimer >= interval) {
        cookAutoTimer = 0;
        if (trayCount < S.trayMax) cookOneBurger();
      }
    }

    // auto cashiers
    if (S.cashiers > 0) {
      cashierTimer += dt;
      const interval = Math.max(350, 1100 - S.cashiers * 150);
      if (cashierTimer >= interval) {
        cashierTimer = 0;
        const waiting = customers.find((c) => c.state === "waiting");
        if (waiting && trayCount > 0) serveCustomer(waiting);
      }
    }

    // particles
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= dt * 0.002;
      if (p.life <= 0) pops.splice(i, 1);
    }

    if (screenFlash > 0) screenFlash -= dt * 0.002;

    // autosave
    saveTimer += dt;
    if (saveTimer > 3000) { saveTimer = 0; saveGame(); }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    // customers behind counter front but in front of wall
    customers.forEach(drawCustomer);

    drawCounter();
    drawPops();

    if (screenFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${screenFlash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(now) {
    update(now);
    render();
    requestAnimationFrame(loop);
  }

  // ---------- Input ----------
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // tapping a waiting customer serves them
    const hit = customers.find(
      (c) => c.state === "waiting" && Math.abs(c.x - x) < 40 && Math.abs(c.yPos() - y) < 90
    );
    if (hit) {
      serveCustomer(hit);
      return;
    }
    // tapping near the counter cooks a burger
    if (y > counterY() - 130) tapCook();
  });

  document.getElementById("cook-btn").addEventListener("click", tapCook);

  // ---------- HUD + Shop UI ----------
  const moneyEl = document.getElementById("money");
  const levelEl = document.getElementById("level");
  function updateHUD() {
    moneyEl.textContent = format(S.money);
    levelEl.textContent = S.level;
  }

  function format(n) {
    n = Math.floor(n);
    if (n < 1000) return "" + n;
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + "K";
    if (n < 1e9) return (n / 1e6).toFixed(1) + "M";
    return (n / 1e9).toFixed(1) + "B";
  }

  const shopList = document.getElementById("shop-list");
  const shopPanel = document.getElementById("shop-panel");

  function renderShop() {
    shopList.innerHTML = "";
    for (const u of UPGRADES) {
      const lvl = upgLevel(u.id);
      const maxed = lvl >= u.max;
      const cost = upgCost(u);
      const afford = S.money >= cost;

      const row = document.createElement("div");
      row.className = "upgrade";
      row.innerHTML = `
        <div class="icon">${u.icon}</div>
        <div class="info">
          <div class="name">${u.name}</div>
          <div class="desc">${u.desc}</div>
          <div class="lvl">Level ${lvl}${u.max < 99 ? " / " + u.max : ""}</div>
        </div>`;
      const btn = document.createElement("button");
      btn.className = "buy-btn" + (maxed ? " maxed" : afford ? "" : " locked");
      btn.textContent = maxed ? "MAX" : "🪙 " + format(cost);
      btn.onclick = () => buyUpgrade(u);
      row.appendChild(btn);
      shopList.appendChild(row);
    }
  }

  function buyUpgrade(u) {
    const lvl = upgLevel(u.id);
    if (lvl >= u.max) return;
    const cost = upgCost(u);
    if (S.money < cost) {
      floatText("Need more 🪙", W / 2, H / 2, "#ff6b6b");
      return;
    }
    S.money -= cost;
    S.upgrades[u.id] = lvl + 1;
    u.apply(lvl + 1);
    layoutCustomers();
    updateHUD();
    renderShop();
    saveGame();
  }

  document.getElementById("shop-toggle").onclick = () => {
    shopPanel.classList.add("open");
    renderShop();
  };
  document.getElementById("shop-close").onclick = () => shopPanel.classList.remove("open");

  // refresh affordability styling periodically while shop is open
  setInterval(() => { if (shopPanel.classList.contains("open")) renderShop(); }, 600);

  // ---------- Offline / welcome ----------
  function computeOfflineEarnings() {
    const away = Date.now() - (S.lastSeen || Date.now());
    if (away < 60000) return 0; // ignore < 1 min
    if (S.cooks === 0 || S.cashiers === 0) return 0;
    const perSec = (S.cashiers * 0.8) * burgerPrice() * 0.5;
    const capped = Math.min(away / 1000, 8 * 3600); // cap 8h
    return Math.floor(perSec * capped);
  }

  function showModal(title, body, btn) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").textContent = body;
    document.getElementById("modal-btn").textContent = btn;
    document.getElementById("modal").classList.remove("hidden");
  }
  document.getElementById("modal-btn").onclick = () =>
    document.getElementById("modal").classList.add("hidden");

  // ---------- Boot ----------
  function boot() {
    resize();
    layoutCustomers();
    updateHUD();
    renderShop();

    const offline = computeOfflineEarnings();
    if (offline > 0) {
      S.money += offline;
      updateHUD();
      showModal("Welcome back! 🍔", `Your shop earned ${format(offline)} coins while you were away!`, "COLLECT");
    } else if (S.served === 0) {
      showModal("🍔 Burger Ready!", "Tap COOK to make burgers, then tap a customer to serve them. Earn coins and upgrade your shop!", "LET'S COOK!");
    } else {
      document.getElementById("modal").classList.add("hidden");
    }

    window.addEventListener("beforeunload", saveGame);
    requestAnimationFrame((t) => { last = t; loop(t); });
  }

  boot();
})();
