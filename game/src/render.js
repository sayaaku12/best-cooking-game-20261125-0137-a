// Ember & Thyme: canvas rendering — kitchen, order board, chef, HUD, overlays.
import {
  CANVAS_W, CANVAS_H, INGREDIENTS, RECIPES, STATIONS, PANTRY_ITEMS,
  CHOP_TIME, GRILL_TIME, BURN_TIME, CHEF_RADIUS,
} from './config.js';
import { clamp, formatClock, pointInRect } from './random.js';

const INK = '#2b1d12';
const CREAM = '#fdf6e3';

export class KitchenRender {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(world, input) {
    const ctx = this.ctx;
    this.drawFloor(ctx);
    this.drawStations(ctx, world, input);
    this.drawChef(ctx, world);
    this.drawOrderBoard(ctx, world);
    this.drawHud(ctx, world);
    if (world.banner && world.bannerTimer > 0) this.drawBanner(ctx, world);
    if (world.flash) this.drawFlash(ctx, world);
    if (world.screen === 'title') this.drawTitle(ctx, world);
    if (world.screen === 'paused') this.drawPause(ctx, world);
    if (world.screen === 'dayover') this.drawDayOver(ctx, world);
    if (world.helpOpen && world.screen === 'playing') this.drawHelp(ctx);
  }

  // ---- floor & walls ----
  drawFloor(ctx) {
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Checker floor tiles.
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 20; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#8a6a4a' : '#7a5a3e';
        ctx.fillRect(20 + x * 62, 160 + y * 46, 62, 46);
      }
    }
    // Wall band + skirting.
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(0, 150, CANVAS_W, 10);
    ctx.fillStyle = '#c98a4a';
    ctx.fillRect(0, 0, CANVAS_W, 4);
  }

  // ---- stations ----
  drawStations(ctx, world, input) {
    const near = world.nearestStation();
    for (const name of Object.keys(STATIONS)) {
      const s = STATIONS[name];
      const isNear = near && near.name === name;
      this.drawStationBase(ctx, s, isNear);
    }
    this.drawPantry(ctx, world);
    this.drawBoard(ctx, world);
    this.drawGrill(ctx, world);
    this.drawCounter(ctx, world);
    this.drawWindow(ctx, world);
    this.drawTrash(ctx, world);
    // Interact prompt.
    if (near && world.screen === 'playing') {
      const s = STATIONS[near.name];
      const label = this.promptFor(near.name, world);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const w = ctx.measureText(label).width + 90;
      ctx.beginPath();
      ctx.roundRect(s.x + s.w / 2 - w / 2, s.y - 34, w, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('E  ·  ' + label, s.x + s.w / 2, s.y - 16);
    }
  }

  promptFor(name, world) {
    if (name === 'pantry') return 'Take ' + INGREDIENTS[PANTRY_ITEMS[world.selectedPantry]].name;
    if (name === 'board') {
      if (world.board && world.board.progress >= CHOP_TIME) return 'Take chopped ' + INGREDIENTS[world.board.item].name;
      if (world.board) return 'Hold E to chop!';
      return 'Place veg to chop';
    }
    if (name === 'grill') {
      if (world.grill.some((g) => g && g.state === 'done')) return 'Take grilled patty';
      if (world.grill.some((g) => g && g.state === 'burnt')) return 'Clear burnt patty';
      return 'Grill a patty';
    }
    if (name === 'counter') {
      if (world.plate) return 'Plate in hand!';
      if (world.counterPlate.length > 0 && world.tray.length === 0) return 'Pick up plate';
      return 'Add to plate';
    }
    if (name === 'window') return 'Serve the plate!';
    if (name === 'trash') return 'Throw away';
    return 'Use';
  }

  drawStationBase(ctx, s, isNear) {
    ctx.fillStyle = isNear ? '#b98a52' : '#6b4a2e';
    ctx.beginPath();
    ctx.roundRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8, 10);
    ctx.fill();
    ctx.fillStyle = '#8a6a44';
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 8);
    ctx.fill();
    ctx.fillStyle = '#f5e6c8';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, s.x + s.w / 2, s.y + 16);
  }

  drawPantry(ctx, world) {
    const p = STATIONS.pantry;
    for (let i = 0; i < PANTRY_ITEMS.length; i++) {
      const id = PANTRY_ITEMS[i];
      const r = world.pantryBinRect(i);
      const hovered = world.pantryHover === i || world.selectedPantry === i;
      ctx.fillStyle = hovered ? '#fff3d6' : '#fdf6e3';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 6);
      ctx.fill();
      ctx.strokeStyle = hovered ? '#e8a85c' : '#c9b18a';
      ctx.lineWidth = hovered ? 3 : 1;
      ctx.stroke();
      this.drawIngredient(ctx, id, r.x + 22, r.y + r.h / 2, 13);
      ctx.fillStyle = INK;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(INGREDIENTS[id].name, r.x + 42, r.y + r.h / 2 + 5);
      ctx.fillStyle = '#8a7a5e';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('[' + (i + 1) + ']', r.x + r.w - 8, r.y + r.h / 2 + 4);
    }
  }

  drawBoard(ctx, world) {
    const s = STATIONS.board;
    // Wooden board.
    ctx.fillStyle = '#d9b380';
    ctx.beginPath();
    ctx.roundRect(s.x + 14, s.y + 26, s.w - 28, s.h - 34, 8);
    ctx.fill();
    ctx.strokeStyle = '#a97e4e';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (world.board) {
      const b = world.board;
      const cx = s.x + s.w / 2, cy = s.y + 52;
      this.drawIngredient(ctx, b.item, cx, cy, 18);
      if (b.progress < CHOP_TIME) {
        const frac = b.progress / CHOP_TIME;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(s.x + 20, s.y + s.h - 14, s.w - 40, 8);
        ctx.fillStyle = '#7dc242';
        ctx.fillRect(s.x + 20, s.y + s.h - 14, (s.w - 40) * frac, 8);
        ctx.fillStyle = CREAM;
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HOLD E — CHOPPING ' + Math.round(frac * 100) + '%', cx, s.y + s.h - 18);
      } else {
        ctx.fillStyle = '#2e7d32';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CHOPPED ✓ — press E', cx, s.y + s.h - 18);
      }
    } else {
      ctx.fillStyle = '#8a6a44';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('bring veg to chop', s.x + s.w / 2, s.y + 56);
    }
  }

  drawGrill(ctx, world) {
    const s = STATIONS.grill;
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.roundRect(s.x + 10, s.y + 26, s.w - 20, s.h - 34, 8);
    ctx.fill();
    // Grill bars.
    ctx.strokeStyle = '#5a5a5a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + 16, s.y + 34 + i * 8);
      ctx.lineTo(s.x + s.w - 16, s.y + 34 + i * 8);
      ctx.stroke();
    }
    world.grill.forEach((slot, i) => {
      const cx = s.x + 48 + i * (s.w - 96);
      const cy = s.y + 58;
      if (!slot) {
        ctx.fillStyle = '#777';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('empty', cx, cy + 4);
        return;
      }
      if (slot.state === 'burnt') {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💨', cx, cy + 6);
        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('BURNT!', cx, cy + 32);
        return;
      }
      const frac = clamp(slot.t / GRILL_TIME, 0, 1);
      // Patty darkens as it cooks.
      ctx.fillStyle = slot.state === 'done' ? '#6b4226' : '#a06a45';
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a2c17';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Progress ring.
      ctx.strokeStyle = slot.state === 'done' ? '#7dc242' : '#f5c542';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 23, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      if (slot.state === 'done') {
        ctx.fillStyle = '#7dc242';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('READY!', cx, cy + 36);
      }
      // Sizzle wisps.
      if (slot.state === 'cooking') {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('~', cx - 8, cy - 26);
        ctx.fillText('~', cx + 8, cy - 30);
      }
    });
  }

  drawCounter(ctx, world) {
    const s = STATIONS.counter;
    // White plate on the counter.
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2 + 8;
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 120, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9b18a';
    ctx.lineWidth = 2;
    ctx.stroke();
    const items = world.counterPlate;
    if (items.length === 0) {
      ctx.fillStyle = '#8a7a5e';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('empty plate — add ingredients', cx, cy + 4);
    } else {
      items.forEach((id, i) => {
        const x = cx - (items.length - 1) * 26 + i * 52;
        this.drawIngredient(ctx, id, x, cy, 16);
      });
      const match = this.matchingRecipe(world, items);
      const status = match ? '✓ ' + RECIPES[match].name + ' — pick it up!' : 'assembling… (' + items.length + ' items)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      const tw = ctx.measureText(status).width + 18;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.roundRect(cx - tw / 2, s.y + s.h - 20, tw, 16, 8);
      ctx.fill();
      ctx.fillStyle = match ? '#a8e063' : CREAM;
      ctx.textAlign = 'center';
      ctx.fillText(status, cx, s.y + s.h - 8);
    }
  }

  matchingRecipe(world, items) {
    for (const id of Object.keys(RECIPES)) {
      if (items.length === RECIPES[id].needs.length) {
        const counts = new Map();
        for (const it of items) counts.set(it, (counts.get(it) || 0) + 1);
        let ok = true;
        for (const need of RECIPES[id].needs) {
          if ((counts.get(need) || 0) === 0) { ok = false; break; }
          counts.set(need, counts.get(need) - 1);
        }
        if (ok) return id;
      }
    }
    return null;
  }

  drawWindow(ctx, world) {
    const s = STATIONS.window;
    ctx.fillStyle = '#2b1d12';
    ctx.beginPath();
    ctx.roundRect(s.x + 8, s.y + 26, s.w - 16, s.h - 34, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔔', s.x + s.w / 2, s.y + 62);
    ctx.fillStyle = CREAM;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('SERVE', s.x + s.w / 2, s.y + 84);
    ctx.fillStyle = '#d8c9a8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('ring the bell,', s.x + s.w / 2, s.y + 102);
    ctx.fillText('make them smile', s.x + s.w / 2, s.y + 118);
    if (world.plate) {
      ctx.fillStyle = '#7dc242';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('PLATE READY ✓', s.x + s.w / 2, s.y + 140);
    }
  }

  drawTrash(ctx, world) {
    const s = STATIONS.trash;
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.roundRect(s.x + 18, s.y + 24, s.w - 36, s.h - 30, 6);
    ctx.fill();
    ctx.fillStyle = '#ddd';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🗑️', s.x + s.w / 2, s.y + 52);
  }

  // ---- chef ----
  drawChef(ctx, world) {
    const c = world.chef;
    const bob = c.moving ? Math.sin(Date.now() / 90) * 2 : 0;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 18, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body (apron).
    ctx.fillStyle = '#f5f0e6';
    ctx.beginPath();
    ctx.roundRect(c.x - 16, c.y - 8 + bob, 32, 30, 10);
    ctx.fill();
    ctx.fillStyle = '#e5484d';
    ctx.fillRect(c.x - 16, c.y + 8 + bob, 32, 6);
    // Head.
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(c.x, c.y - 16 + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    // Chef hat.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.x - 8, c.y - 28 + bob, 9, 0, Math.PI * 2);
    ctx.arc(c.x + 8, c.y - 28 + bob, 9, 0, Math.PI * 2);
    ctx.arc(c.x, c.y - 32 + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(c.x - 13, c.y - 28 + bob, 26, 6);
    // Eyes face the movement direction.
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(c.x - 5 + c.facing * 2, c.y - 16 + bob, 1.8, 0, Math.PI * 2);
    ctx.arc(c.x + 5 + c.facing * 2, c.y - 16 + bob, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Tray items carried (little circles above the head).
    if (world.tray.length > 0) {
      world.tray.forEach((id, i) => {
        const x = c.x - (world.tray.length - 1) * 13 + i * 26;
        this.drawIngredient(ctx, id, x, c.y - 44 + bob, 11);
      });
    }
    // Carried plate.
    if (world.plate) {
      ctx.fillStyle = '#fdf6e3';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - 42 + bob, 26, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9b18a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      world.plate.forEach((id, i) => {
        const x = c.x - (world.plate.length - 1) * 9 + i * 18;
        this.drawIngredient(ctx, id, x, c.y - 44 + bob, 7);
      });
    }
  }

  drawIngredient(ctx, id, x, y, r) {
    const base = id.includes(':') ? id.split(':')[1] : id;
    const ing = INGREDIENTS[base];
    ctx.fillStyle = ing.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ing.dark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = Math.round(r * 1.1) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ing.emoji, x, y + 1);
    ctx.textBaseline = 'alphabetic';
    if (id.startsWith('chopped:')) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y);
      ctx.lineTo(x + r * 0.5, y);
      ctx.stroke();
    }
    if (id.startsWith('grilled:')) {
      ctx.fillStyle = '#5e3a24';
      ctx.beginPath();
      ctx.arc(x - 4, y - 3, 2, 0, Math.PI * 2);
      ctx.arc(x + 4, y + 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- order board & HUD ----
  drawOrderBoard(ctx, world) {
    ctx.fillStyle = '#241811';
    ctx.fillRect(0, 64, CANVAS_W, 92);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📋  ORDER BOARD', 16, 88);
    ctx.fillStyle = '#d8c9a8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('serve the dish before the timer runs out', 16, 106);
    if (world.orders.length === 0) {
      ctx.fillStyle = '#8a7a5e';
      ctx.font = 'italic 14px Georgia, serif';
      ctx.fillText('No orders yet — the lunch rush is coming…', 200, 132);
    }
    world.orders.forEach((order, i) => {
      const recipe = RECIPES[order.recipe];
      const x = 300 + i * 240;
      const y = 72;
      const frac = clamp(order.patience / order.maxPatience, 0, 1);
      const urgent = frac < 0.35;
      ctx.fillStyle = urgent ? '#5e1f1f' : '#3a2a1a';
      ctx.beginPath();
      ctx.roundRect(x, y, 228, 76, 10);
      ctx.fill();
      ctx.strokeStyle = urgent ? '#ff6b6b' : '#8a6a44';
      ctx.lineWidth = urgent ? 3 : 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('#' + order.id + '  ' + recipe.name.toUpperCase(), x + 10, y + 18);
      ctx.fillStyle = '#f5c542';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('$' + recipe.price, x + 218, y + 18);
      // Needed items.
      recipe.needs.forEach((need, j) => {
        this.drawIngredient(ctx, need, x + 24 + j * 34, y + 40, 13);
      });
      // Patience bar + seconds.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x + 10, y + 60, 160, 8);
      ctx.fillStyle = urgent ? '#ff6b6b' : frac < 0.6 ? '#f5c542' : '#7dc242';
      ctx.fillRect(x + 10, y + 60, 160 * frac, 8);
      ctx.fillStyle = urgent ? '#ff9a9a' : CREAM;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.ceil(order.patience) + 's', x + 218, y + 68);
    });
  }

  drawHud(ctx, world) {
    // Top bar.
    ctx.fillStyle = '#241811';
    ctx.fillRect(0, 0, CANVAS_W, 64);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('🔥 EMBER & THYME', 16, 28);
    ctx.fillStyle = '#d8c9a8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Rush Hour Kitchen', 16, 48);
    // Score & coins.
    ctx.fillStyle = CREAM;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('SCORE  ' + world.score, 300, 28);
    ctx.fillStyle = '#f5c542';
    ctx.fillText('🪙  $' + world.coins, 300, 50);
    // Hearts.
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    let hearts = '';
    for (let i = 0; i < 3; i++) hearts += i < world.hearts ? '❤️' : '🖤';
    ctx.fillText(hearts, 470, 32);
    ctx.fillStyle = '#d8c9a8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('served: ' + world.served, 470, 52);
    // Combo.
    if (world.combo > 1) {
      ctx.fillStyle = '#ff9f43';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('COMBO x' + Math.min(world.combo, 4) + ' 🔥', 620, 30);
    }
    // Shift timer — big, pulsing when low.
    const low = world.timeLeft < 30 && world.screen === 'playing';
    const pulse = low ? 1 + Math.sin(Date.now() / 150) * 0.08 : 1;
    ctx.save();
    ctx.translate(1120, 34);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = low ? '#ff6b6b' : CREAM;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏱ ' + formatClock(world.timeLeft), 0, 0);
    ctx.restore();
    ctx.fillStyle = '#d8c9a8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SHIFT TIMER', 1120, 54);
    // Tray readout (bottom-left).
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(16, 676, 260, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#d8c9a8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TRAY: ', 26, 698);
    if (world.plate) {
      ctx.fillStyle = '#7dc242';
      ctx.fillText('🍽️ plate (' + world.plate.length + ' items) — serve it!', 76, 698);
    } else if (world.tray.length === 0) {
      ctx.fillStyle = '#8a7a5e';
      ctx.fillText('empty — grab ingredients', 76, 698);
    } else {
      world.tray.forEach((id, i) => this.drawIngredient(ctx, id, 100 + i * 30, 693, 11));
    }
  }

  drawBanner(ctx, world) {
    const b = world.banner;
    const alpha = clamp(world.bannerTimer / 0.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = 520;
    ctx.beginPath();
    ctx.roundRect(CANVAS_W / 2 - w / 2, 180, w, 64, 12);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.text, CANVAS_W / 2, 208);
    ctx.fillStyle = CREAM;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(b.sub, CANVAS_W / 2, 232);
    ctx.restore();
  }

  drawFlash(ctx, world) {
    ctx.fillStyle = world.flash.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // ---- screens ----
  drawTitle(ctx, world) {
    ctx.fillStyle = 'rgba(20,12,6,0.82)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 EMBER & THYME 🔥', CANVAS_W / 2, 190);
    ctx.fillStyle = CREAM;
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText('Rush Hour Kitchen', CANVAS_W / 2, 240);
    ctx.fillStyle = '#d8c9a8';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('The lunch rush is on. Take orders from the board, chop and grill,', CANVAS_W / 2, 300);
    ctx.fillText('assemble each dish on the counter and serve it before it walks out!', CANVAS_W / 2, 326);
    // Mini recipe card.
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.roundRect(CANVAS_W / 2 - 260, 356, 520, 96, 12);
    ctx.fill();
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('TODAY\'S MENU', CANVAS_W / 2, 382);
    ctx.fillStyle = CREAM;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Garden Salad · Classic Burger · Cheese Melt · Veggie Stack · Double Trouble', CANVAS_W / 2, 410);
    ctx.fillStyle = '#d8c9a8';
    ctx.fillText('Pantry → chop / grill → assemble → serve. 3 hearts. 2½-minute shift.', CANVAS_W / 2, 434);
    const blink = world.shotMode === 'title' || Math.sin(Date.now() / 300) > 0;
    if (blink) {
      ctx.fillStyle = '#7dc242';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText('Press ENTER or click to start cooking!', CANVAS_W / 2, 510);
    }
    ctx.fillStyle = '#8a7a5e';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD / arrows move · E use station · hold E to chop · P pause · R restart · M mute · H help', CANVAS_W / 2, 560);
    if (world.best > 0) {
      ctx.fillStyle = '#f5c542';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('Best score: ' + world.best, CANVAS_W / 2, 596);
    }
  }

  drawPause(ctx, world) {
    ctx.fillStyle = 'rgba(20,12,6,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = CREAM;
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSED', CANVAS_W / 2, 330);
    ctx.fillStyle = '#d8c9a8';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('The orders are waiting… press P or Esc to get back to the stove.', CANVAS_W / 2, 372);
  }

  drawDayOver(ctx, world) {
    ctx.fillStyle = 'rgba(20,12,6,0.85)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = world.dayWon === false && world.hearts <= 0 ? '#ff6b6b' : '#ffd166';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.hearts <= 0 ? 'KITCHEN CLOSED!' : 'SHIFT OVER!', CANVAS_W / 2, 220);
    ctx.fillStyle = CREAM;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(
      world.hearts <= 0 ? 'Three strikes — the dinner crowd went home hungry.' : 'The lunch rush is done. The kitchen smells of victory.',
      CANVAS_W / 2, 262,
    );
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('SCORE  ' + world.score, CANVAS_W / 2, 330);
    ctx.fillStyle = CREAM;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Dishes served: ' + world.served + '   ·   Coins earned: $' + world.coins + '   ·   Mistakes: ' + world.mistakes, CANVAS_W / 2, 368);
    if (world.dayIsBest) {
      ctx.fillStyle = '#7dc242';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText('★ NEW BEST SCORE! ★', CANVAS_W / 2, 406);
    } else {
      ctx.fillStyle = '#d8c9a8';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Best score: ' + world.best, CANVAS_W / 2, 406);
    }
    const blink = Math.sin(Date.now() / 300) > 0;
    if (blink) {
      ctx.fillStyle = '#7dc242';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('Press R to cook another shift', CANVAS_W / 2, 480);
    }
  }

  drawHelp(ctx) {
    ctx.fillStyle = 'rgba(20,12,6,0.85)';
    ctx.beginPath();
    ctx.roundRect(340, 150, 600, 420, 14);
    ctx.fill();
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO COOK', 640, 196);
    const lines = [
      '1. Read the ORDER BOARD — each ticket lists a dish and its timer.',
      '2. PANTRY (left): take ingredients. Keys 1–6 or click a bin.',
      '3. CHOPPING BOARD: place tomato / lettuce / onion, hold E to chop.',
      '4. GRILL: place a patty, take it when the ring turns green —',
      '    leave it too long and it burns!',
      '5. ASSEMBLY COUNTER: add tray items to the plate, then pick the plate up.',
      '6. SERVING WINDOW: serve the plate. Match the ticket to earn a tip;',
      '    serve fast in a row to build a COMBO multiplier (up to x4).',
      '7. Wrong dish or a walked-out order costs a heart. 3 hearts, 2½ minutes.',
      '',
      'Mouse: click a station to walk to it, click again to use it.',
    ];
    ctx.fillStyle = CREAM;
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    lines.forEach((line, i) => ctx.fillText(line, 370, 232 + i * 26));
    ctx.fillStyle = '#7dc242';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press H to close', 640, 540);
  }
}
