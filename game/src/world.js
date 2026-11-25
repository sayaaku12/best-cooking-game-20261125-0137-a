// Ember & Thyme: game state — orders, stations, chef, tray, plate, scoring.
import {
  CANVAS_W, CANVAS_H, SHIFT_SECONDS, MAX_HEARTS, MAX_TRAY, MAX_ORDERS,
  INGREDIENTS, RECIPES, recipePoolFor, spawnIntervalFor, patienceFor,
  STATIONS, PANTRY_ITEMS, CHOP_TIME, GRILL_TIME, BURN_TIME,
  COMBO_WINDOW, CHEF_SPEED, CHEF_RADIUS,
} from './config.js';
import { mulberry32, clamp, dist, distToRect, nearestPointOnRect, pointInRect, sameMultiset, pickRandom } from './random.js';
import { KitchenAudio } from './audio.js';

const FLOOR_TOP = 160;
const FLOOR_BOTTOM = CANVAS_H - 8;
const INTERACT_RANGE = 78;

export class KitchenWorld {
  constructor() {
    this.audio = new KitchenAudio();
    this.rng = mulberry32(20261125);
    this.reset();
  }

  reset() {
    this.screen = 'title'; // title | playing | paused | dayover
    this.chef = { x: 640, y: 540, tx: null, ty: null, path: null, facing: 1, moving: false };
    this.tray = [];        // prepared item ids carried (max MAX_TRAY)
    this.plate = null;     // carried plate: array of prepared ids, or null
    this.counterPlate = []; // items sitting on the assembly counter
    this.board = null;     // { item, progress } on the chopping board
    this.grill = [null, null]; // slots: { item:'patty', t, state:'cooking'|'done'|'burnt' }
    this.orders = [];
    this.nextOrderId = 1;
    this.score = 0;
    this.coins = 0;
    this.hearts = MAX_HEARTS;
    this.combo = 0;
    this.comboTimer = 0;
    this.timeLeft = SHIFT_SECONDS;
    this.elapsed = 0;
    this.spawnTimer = 6;
    this.served = 0;
    this.mistakes = 0;
    this.best = 0;
    try { this.best = Number(window.localStorage.getItem('ember-thyme-best') || 0) || 0; } catch (e) { this.best = 0; }
    this.banner = null;    // { text, sub, color, t }
    this.bannerTimer = 0;
    this.flash = null;     // { color, t } full-screen flash
    this.helpOpen = false;
    this.sizzleTimer = 0;
    this.chopSoundTimer = 0;
    this.selectedPantry = 0;
    this.pantryHover = -1;
    this.toast = null;
    this.shotMode = null;
  }

  startGame() {
    this.reset();
    this.screen = 'playing';
    this.audio.ensure();
    this.audio.startMusic();
    this.spawnOrder();
    this.spawnOrder();
    this.showBanner('SHIFT START!', 'Serve the orders before they walk out', '#ffd166');
  }

  showBanner(text, sub, color) {
    this.banner = { text, sub: sub || '', color: color || '#ffd166' };
    this.bannerTimer = 2.6;
  }

  flashScreen(color) {
    this.flash = { color, t: 0.35 };
  }

  spawnOrder(recipeId) {
    if (this.orders.length >= MAX_ORDERS) return null;
    const pool = recipePoolFor(this.elapsed);
    const id = recipeId || pickRandom(this.rng, pool);
    const patience = patienceFor(this.elapsed);
    const order = { id: this.nextOrderId++, recipe: id, patience, maxPatience: patience };
    this.orders.push(order);
    this.audio.orderIn();
    return order;
  }

  // ---- pantry bins (layout inside the pantry rect) ----
  pantryBinRect(index) {
    const p = STATIONS.pantry;
    const bw = p.w - 20;
    const bh = 34;
    return { x: p.x + 10, y: p.y + 30 + index * 36, w: bw, h: bh };
  }

  pantryBinAt(x, y) {
    for (let i = 0; i < PANTRY_ITEMS.length; i++) {
      if (pointInRect(x, y, this.pantryBinRect(i))) return i;
    }
    return -1;
  }

  nearestStation() {
    let bestName = null, bestD = Infinity;
    for (const name of Object.keys(STATIONS)) {
      const d = distToRect(this.chef.x, this.chef.y, STATIONS[name]);
      if (d < bestD) { bestD = d; bestName = name; }
    }
    return bestD <= INTERACT_RANGE ? { name: bestName, dist: bestD } : null;
  }

  // ---- interaction ----
  interact() {
    if (this.screen !== 'playing') return;
    const near = this.nearestStation();
    if (!near) return;
    const name = near.name;
    if (name === 'pantry') this.pickFromPantry(this.pantryHover >= 0 ? this.pantryHover : this.selectedPantry);
    else if (name === 'board') this.useBoard();
    else if (name === 'grill') this.useGrill();
    else if (name === 'counter') this.useCounter();
    else if (name === 'window') this.useWindow();
    else if (name === 'trash') this.useTrash();
  }

  pickFromPantry(index) {
    const item = PANTRY_ITEMS[index];
    if (!item) return;
    this.selectedPantry = index;
    if (this.plate) { this.audio.error(); return; }
    if (this.tray.length >= MAX_TRAY) {
      this.showBanner('TRAY FULL', 'Serve or trash something first', '#ff6b6b');
      this.audio.error();
      return;
    }
    this.tray.push(item);
    this.audio.pickup();
  }

  useBoard() {
    // Take a finished chopped item off the board.
    if (this.board && this.board.progress >= CHOP_TIME) {
      if (this.tray.length >= MAX_TRAY) { this.audio.error(); return; }
      this.tray.push('chopped:' + this.board.item);
      this.board = null;
      this.audio.choppedDone();
      return;
    }
    // Put a choppable raw item on the board.
    if (!this.board) {
      const idx = this.tray.findIndex((id) => INGREDIENTS[id] && INGREDIENTS[id].chop);
      if (idx === -1) {
        this.showBanner('NOTHING TO CHOP', 'Bring tomato, lettuce or onion', '#ff6b6b');
        this.audio.error();
        return;
      }
      this.board = { item: this.tray.splice(idx, 1)[0], progress: 0 };
      this.audio.place();
    }
  }

  // Hold-to-chop: called every frame while the interact key is held near the board.
  chopTick(dt) {
    if (!this.board || this.board.progress >= CHOP_TIME) return;
    const near = this.nearestStation();
    if (!near || near.name !== 'board') return;
    this.board.progress += dt;
    this.chopSoundTimer -= dt;
    if (this.chopSoundTimer <= 0) { this.audio.chop(); this.chopSoundTimer = 0.28; }
    if (this.board.progress >= CHOP_TIME) {
      this.board.progress = CHOP_TIME;
      this.audio.choppedDone();
      this.showBanner('CHOPPED!', prepareName('chopped:' + this.board.item) + ' is ready — press E to take it', '#7dc242');
    }
  }

  useGrill() {
    // Take a done patty off first.
    const doneIdx = this.grill.findIndex((s) => s && s.state === 'done');
    if (doneIdx >= 0) {
      if (this.tray.length >= MAX_TRAY) { this.audio.error(); return; }
      this.tray.push('grilled:patty');
      this.grill[doneIdx] = null;
      this.audio.pickup();
      return;
    }
    // Clear a burnt patty.
    const burntIdx = this.grill.findIndex((s) => s && s.state === 'burnt');
    if (burntIdx >= 0) {
      this.grill[burntIdx] = null;
      this.audio.burn();
      this.showBanner('BURNT!', 'That patty is ruined — trash it next time', '#ff6b6b');
      return;
    }
    // Place a raw patty on a free slot.
    const freeIdx = this.grill.findIndex((s) => s === null);
    if (freeIdx === -1) { this.audio.error(); return; }
    const idx = this.tray.indexOf('patty');
    if (idx === -1) {
      this.showBanner('NEED A PATTY', 'Grab a patty from the pantry', '#ff6b6b');
      this.audio.error();
      return;
    }
    this.tray.splice(idx, 1);
    this.grill[freeIdx] = { item: 'patty', t: 0, state: 'cooking' };
    this.audio.place();
  }

  useCounter() {
    // Pick the finished plate up (tray must be empty).
    if (!this.plate && this.counterPlate.length > 0 && this.tray.length === 0) {
      this.plate = this.counterPlate;
      this.counterPlate = [];
      this.audio.pickup();
      this.showBanner('PLATE READY', 'Carry it to the serving window!', '#ffd166');
      return;
    }
    // Add a tray item to the plate on the counter.
    if (!this.plate && this.tray.length > 0) {
      this.counterPlate.push(this.tray.shift());
      this.audio.place();
      return;
    }
    if (this.plate) this.audio.error();
  }

  useWindow() {
    if (!this.plate) {
      this.showBanner('NO PLATE', 'Assemble a dish on the counter first', '#ff6b6b');
      this.audio.error();
      return;
    }
    const match = this.orders.find((o) => sameMultiset(this.plate, RECIPES[o.recipe].needs));
    if (!match) {
      this.plate = null;
      this.loseHeart('WRONG DISH!', 'Nobody ordered that — the plate went in the bin');
      return;
    }
    this.serveOrder(match);
  }

  serveOrder(order) {
    const recipe = RECIPES[order.recipe];
    const tip = Math.round(recipe.price * (order.patience / order.maxPatience) * 0.5);
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = COMBO_WINDOW;
    const mult = Math.min(this.combo, 4);
    const earned = (recipe.price + tip) * mult;
    this.score += earned;
    this.coins += recipe.price + tip;
    this.served++;
    this.orders = this.orders.filter((o) => o !== order);
    this.plate = null;
    this.audio.serve();
    this.audio.coin();
    this.flashScreen('rgba(255,209,102,0.18)');
    this.showBanner(
      'SERVED! +' + earned + ' PTS',
      recipe.name + ' — tip $' + tip + (mult > 1 ? ' · COMBO x' + mult : ''),
      '#7dc242',
    );
  }

  useTrash() {
    if (this.plate) {
      this.plate = null;
      this.audio.error();
      this.showBanner('PLATE TRASHED', 'Start the dish again', '#ff6b6b');
      return;
    }
    if (this.tray.length > 0) {
      this.tray = [];
      this.audio.place();
      return;
    }
    if (this.counterPlate.length > 0) {
      this.counterPlate = [];
      this.audio.place();
    }
  }

  loseHeart(title, sub) {
    this.hearts -= 1;
    this.mistakes++;
    this.combo = 0;
    this.comboTimer = 0;
    this.audio.error();
    this.flashScreen('rgba(229,72,77,0.25)');
    this.showBanner(title, sub, '#ff6b6b');
    if (this.hearts <= 0) this.endDay(false);
  }

  endDay(won) {
    this.screen = 'dayover';
    this.audio.stopMusic();
    const isBest = this.score > this.best;
    if (isBest) {
      this.best = this.score;
      try { window.localStorage.setItem('ember-thyme-best', String(this.best)); } catch (e) {}
    }
    this.dayWon = won;
    this.dayIsBest = isBest;
    if (won) this.audio.win(); else this.audio.lose();
  }

  // ---- mouse ----
  clickAt(x, y) {
    if (this.screen !== 'playing') return;
    // Clicking a pantry bin picks it when close, else walks there.
    const bin = this.pantryBinAt(x, y);
    if (bin >= 0) {
      this.pantryHover = bin;
      this.selectedPantry = bin;
      if (distToRect(this.chef.x, this.chef.y, STATIONS.pantry) <= INTERACT_RANGE) {
        this.pickFromPantry(bin);
        return;
      }
    }
    // Clicking a station: interact if in range, else walk to it.
    for (const name of Object.keys(STATIONS)) {
      if (pointInRect(x, y, STATIONS[name])) {
        const p = nearestPointOnRect(this.chef.x, this.chef.y, STATIONS[name]);
        if (distToRect(this.chef.x, this.chef.y, STATIONS[name]) <= INTERACT_RANGE) {
          if (name === 'pantry' && bin >= 0) this.pickFromPantry(bin);
          else this.interactAt(name);
        } else {
          this.setMoveTarget(p.x, p.y);
        }
        return;
      }
    }
    this.setMoveTarget(x, y);
  }

  interactAt(name) {
    if (name === 'pantry') this.pickFromPantry(this.selectedPantry);
    else if (name === 'board') this.useBoard();
    else if (name === 'grill') this.useGrill();
    else if (name === 'counter') this.useCounter();
    else if (name === 'window') this.useWindow();
    else if (name === 'trash') this.useTrash();
  }

  // ---- grid pathfinding (click-to-move routes around counters) ----
  findPath(sx, sy, tx, ty) {
    const CELL = 20;
    const cols = Math.ceil(CANVAS_W / CELL);
    const rows = Math.ceil(CANVAS_H / CELL);
    const blocked = (cx, cy) => {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return true;
      const x = cx * CELL + CELL / 2;
      const y = cy * CELL + CELL / 2;
      if (y < FLOOR_TOP || y > FLOOR_BOTTOM) return true;
      if (x < 24 + CHEF_RADIUS || x > CANVAS_W - 24 - CHEF_RADIUS) return true;
      for (const name of Object.keys(STATIONS)) {
        const s = STATIONS[name];
        if (x > s.x - CHEF_RADIUS && x < s.x + s.w + CHEF_RADIUS &&
            y > s.y - CHEF_RADIUS && y < s.y + s.h + CHEF_RADIUS) return true;
      }
      return false;
    };
    const toCell = (x, y) => ({
      x: clamp(Math.floor(x / CELL), 0, cols - 1),
      y: clamp(Math.floor(y / CELL), 0, rows - 1),
    });
    const start = toCell(sx, sy);
    let goal = toCell(tx, ty);
    if (blocked(goal.x, goal.y)) {
      // Nearest free cell to the goal (spiral search).
      let found = null;
      for (let r = 1; r <= 6 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const c = { x: goal.x + dx, y: goal.y + dy };
            if (!blocked(c.x, c.y)) found = c;
          }
        }
      }
      if (!found) return null;
      goal = found;
    }
    const key = (c) => c.x + ',' + c.y;
    const prev = new Map();
    const seen = new Set([key(start)]);
    const queue = [start];
    const DIRS = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.x === goal.x && cur.y === goal.y) break;
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (blocked(nx, ny) || seen.has(nx + ',' + ny)) continue;
        // No cutting corners diagonally.
        if (dx !== 0 && dy !== 0 && (blocked(cur.x + dx, cur.y) || blocked(cur.x, cur.y + dy))) continue;
        seen.add(nx + ',' + ny);
        prev.set(nx + ',' + ny, cur);
        queue.push({ x: nx, y: ny });
      }
    }
    if (!seen.has(key(goal))) return null;
    const cells = [];
    let cur = goal;
    while (!(cur.x === start.x && cur.y === start.y)) {
      cells.unshift(cur);
      cur = prev.get(key(cur));
      if (!cur) break;
    }
    const points = cells.map((c) => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 }));
    points.push({ x: tx, y: ty });
    return points;
  }

  setMoveTarget(x, y) {
    const path = this.findPath(this.chef.x, this.chef.y, x, y);
    this.chef.path = path;
    this.chef.tx = x;
    this.chef.ty = y;
  }
  update(dt, input) {
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
    if (this.screen !== 'playing') return;

    // Shift clock.
    this.elapsed += dt;
    this.timeLeft -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.endDay(this.hearts > 0); return; }

    // Order spawning.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnOrder();
      this.spawnTimer = spawnIntervalFor(this.elapsed);
    }

    // Order patience.
    for (const order of this.orders.slice()) {
      order.patience -= dt;
      if (order.patience <= 0) {
        this.orders = this.orders.filter((o) => o !== order);
        this.audio.walkout();
        this.loseHeart('ORDER WALKED OUT!', RECIPES[order.recipe].name + ' waited too long');
        if (this.screen !== 'playing') return;
      }
    }

    // Grill timers.
    for (let i = 0; i < this.grill.length; i++) {
      const slot = this.grill[i];
      if (!slot) continue;
      slot.t += dt;
      if (slot.state === 'cooking' && slot.t >= GRILL_TIME) {
        slot.state = 'done';
        this.audio.grillDone();
        this.showBanner('PATTY READY!', 'Grab it off the grill before it burns', '#f5c542');
      } else if (slot.state === 'done' && slot.t >= BURN_TIME) {
        slot.state = 'burnt';
        this.audio.burn();
      }
    }
    // Grill sizzle ambience.
    if (this.grill.some((s) => s && s.state === 'cooking')) {
      this.sizzleTimer -= dt;
      if (this.sizzleTimer <= 0) { this.audio.sizzle(); this.sizzleTimer = 1.1; }
    }

    // Hold-to-chop.
    if (input.interactHeld) this.chopTick(dt);

    // Chef movement: keys win over a click target.
    const mv = input.moveVector();
    if (mv.x !== 0 || mv.y !== 0) {
      this.chef.path = null; this.chef.tx = null; this.chef.ty = null;
      this.moveChef(mv.x * CHEF_SPEED * dt, mv.y * CHEF_SPEED * dt);
      this.chef.moving = true;
      this.chef.facing = mv.x !== 0 ? Math.sign(mv.x) : this.chef.facing;
    } else if (this.chef.path && this.chef.path.length > 0) {
      const wp = this.chef.path[0];
      const dx = wp.x - this.chef.x;
      const dy = wp.y - this.chef.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 8) {
        this.chef.path.shift();
        if (this.chef.path.length === 0) { this.chef.tx = null; this.chef.ty = null; this.chef.moving = false; }
      } else {
        const step = Math.min(d, CHEF_SPEED * dt);
        this.moveChef((dx / d) * step, (dy / d) * step);
        this.chef.moving = true;
        this.chef.facing = dx !== 0 ? Math.sign(dx) : this.chef.facing;
      }
    } else {
      this.chef.moving = false;
    }

    // Pantry hover follows the mouse.
    this.pantryHover = this.pantryBinAt(input.mouse.x, input.mouse.y);
  }

  moveChef(dx, dy) {
    const r = CHEF_RADIUS;
    // Axis-separated movement with strict bounds: the chef stops exactly at a
    // station's edge but can always slide along it (no wedging on a boundary).
    const EPS = 1e-6;
    const insideStation = (x, y) => {
      for (const name of Object.keys(STATIONS)) {
        const s = STATIONS[name];
        // EPS: the chef's y can sit a hair (1e-13) inside a boundary after a
        // diagonal approach; without it the chef wedges on the edge forever.
        if (x > s.x - r + EPS && x < s.x + s.w + r - EPS &&
            y > s.y - r + EPS && y < s.y + s.h + r - EPS) return true;
      }
      return false;
    };
    const nx = clamp(this.chef.x + dx, 24 + r, CANVAS_W - 24 - r);
    if (!insideStation(nx, this.chef.y)) this.chef.x = nx;
    const ny = clamp(this.chef.y + dy, FLOOR_TOP + r, FLOOR_BOTTOM - r);
    if (!insideStation(this.chef.x, ny)) this.chef.y = ny;
  }
}

function prepareName(id) {
  if (id.startsWith('chopped:')) return 'Chopped ' + INGREDIENTS[id.slice(8)].name;
  if (id.startsWith('grilled:')) return 'Grilled ' + INGREDIENTS[id.slice(8)].name;
  return INGREDIENTS[id].name;
}
