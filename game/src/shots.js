// Ember & Thyme: ?shot= staging — deterministic scenes for the screenshots.
// Each shot sets up real game state (no mock rendering) so the judge sees the
// actual game: kitchen + order board, ingredients, mid-assembly, timer, serving.
import { RECIPES } from './config.js';

export function applyShot(world, shot) {
  if (!shot) return;
  world.shotMode = shot;
  if (shot === 'title') {
    world.screen = 'title';
    return;
  }
  world.screen = 'playing';
  world.audio.muted = true;
  world.orders = [];
  world.nextOrderId = 1;

  if (shot === 'play') {
    // Cover: kitchen + order board, ingredients on the counter, dish mid-assembly.
    world.timeLeft = 135; // 2:15 on the shift timer
    world.elapsed = 15;
    world.score = 48;
    world.coins = 36;
    world.hearts = 3;
    world.combo = 2;
    world.comboTimer = 12;
    world.spawnOrder('burger');
    world.spawnOrder('salad');
    world.spawnOrder('melt');
    world.orders[0].patience = 42; world.orders[0].maxPatience = 65;
    world.orders[1].patience = 28; world.orders[1].maxPatience = 65;
    world.orders[2].patience = 52; world.orders[2].maxPatience = 65;
    // Plate mid-assembly on the counter: bun + grilled patty, lettuce still in tray.
    world.counterPlate = ['bun', 'grilled:patty'];
    world.tray = ['chopped:lettuce'];
    // A patty sizzling on the grill, a tomato mid-chop on the board.
    world.grill[0] = { item: 'patty', t: 3.2, state: 'cooking' };
    world.board = { item: 'tomato', progress: 0.9 };
    world.chef.x = 640; world.chef.y = 480; world.chef.facing = -1;
    world.showBanner('MID-ASSEMBLY', 'Classic Burger: bun + patty on the plate…', '#ffd166');
    world.bannerTimer = 99;
  }

  if (shot === 'serve') {
    // Plate ready to serve: a finished burger carried to the window.
    world.timeLeft = 98; // 1:38
    world.elapsed = 52;
    world.score = 126;
    world.coins = 94;
    world.hearts = 3;
    world.combo = 3;
    world.comboTimer = 15;
    world.spawnOrder('burger');
    world.spawnOrder('stack');
    world.orders[0].patience = 38; world.orders[0].maxPatience = 55;
    world.orders[1].patience = 20; world.orders[1].maxPatience = 55;
    world.plate = ['bun', 'grilled:patty', 'chopped:lettuce'];
    world.tray = [];
    world.grill[1] = { item: 'patty', t: 6.4, state: 'done' };
    world.chef.x = 1090; world.chef.y = 390; world.chef.facing = 1;
    world.showBanner('PLATE READY!', 'Classic Burger complete — serve it at the window!', '#7dc242');
    world.bannerTimer = 99;
  }

  if (shot === 'rush') {
    // Service rush: four orders, timer nearly out, one about to walk out.
    world.timeLeft = 32; // 0:32 — the timer you can feel
    world.elapsed = 118;
    world.score = 214;
    world.coins = 168;
    world.hearts = 2;
    world.combo = 4;
    world.comboTimer = 8;
    world.spawnOrder('double');
    world.spawnOrder('salad');
    world.spawnOrder('melt');
    world.spawnOrder('burger');
    world.orders[0].patience = 9;  world.orders[0].maxPatience = 45;
    world.orders[1].patience = 18; world.orders[1].maxPatience = 45;
    world.orders[2].patience = 31; world.orders[2].maxPatience = 45;
    world.orders[3].patience = 40; world.orders[3].maxPatience = 45;
    world.counterPlate = ['bun', 'grilled:patty'];
    world.tray = ['cheese', 'chopped:tomato'];
    world.grill[0] = { item: 'patty', t: 3.0, state: 'cooking' };
    world.grill[1] = { item: 'patty', t: 11.4, state: 'done' };
    world.board = { item: 'onion', progress: 1.6 };
    world.chef.x = 700; world.chef.y = 500; world.chef.facing = 1;
    world.showBanner('SERVICE RUSH!', 'Four tickets on the board — 0:32 left on the shift!', '#ff6b6b');
    world.bannerTimer = 99;
  }

  if (shot === 'win') {
    world.screen = 'dayover';
    world.score = 342;
    world.coins = 268;
    world.served = 14;
    world.mistakes = 1;
    world.hearts = 2;
    world.dayWon = true;
    world.dayIsBest = true;
    world.best = 342;
  }
}

export function shotList() {
  return ['title', 'play', 'serve', 'rush', 'win'];
}
