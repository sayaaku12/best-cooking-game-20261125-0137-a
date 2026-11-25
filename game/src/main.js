// Ember & Thyme — Rush Hour Kitchen: game loop, screens, input wiring.
import { KitchenWorld } from './world.js';
import { KitchenRender } from './render.js';
import { KitchenInput } from './input.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const world = new KitchenWorld();
const render = new KitchenRender(canvas);

function handleAction(action) {
  if (action === 'confirm') {
    if (world.screen === 'title') { world.startGame(); return; }
    if (world.screen === 'dayover') { world.startGame(); return; }
  }
  if (action === 'restart') {
    if (world.screen === 'playing' || world.screen === 'paused' || world.screen === 'dayover') {
      world.startGame();
    }
    return;
  }
  if (action === 'pause') {
    if (world.screen === 'playing') { world.screen = 'paused'; world.audio.stopMusic(); }
    else if (world.screen === 'paused') { world.screen = 'playing'; world.audio.startMusic(); }
    return;
  }
  if (action === 'mute') {
    world.audio.setMuted(!world.audio.muted);
    return;
  }
  if (action === 'help') {
    if (world.screen === 'playing') world.helpOpen = !world.helpOpen;
    return;
  }
  if (action === 'interact') {
    if (world.screen === 'playing' && !world.helpOpen) world.interact();
    return;
  }
  if (action.startsWith('pantry')) {
    const idx = Number(action.slice(6)) - 1;
    if (world.screen === 'playing') {
      world.selectedPantry = idx;
      const near = world.nearestStation();
      if (near && near.name === 'pantry') world.pickFromPantry(idx);
    }
  }
}

const input = new KitchenInput(canvas, handleAction);

canvas.addEventListener('click', () => {
  if (world.screen === 'title' || world.screen === 'dayover') {
    world.startGame();
    return;
  }
  if (world.screen === 'paused') {
    world.screen = 'playing';
    world.audio.startMusic();
  }
});

let lastTime = performance.now();
let shotApplied = false;

function frame(now) {
  // Uncapped-ish dt (0.25 s): on a slow or software-rendered machine the game
  // clock must track real time, or orders would outlast the chef's legs.
  const dt = Math.min((now - lastTime) / 1000, 0.25);
  lastTime = now;
  if (!shotApplied) {
    shotApplied = true;
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      applyShot(world, shot);
      if (world.screen === 'playing') world.audio.startMusic();
    }
  }
  const click = input.consumeClick();
  if (click) world.clickAt(click.x, click.y);
  world.update(dt, input);
  render.draw(world, input);
  requestAnimationFrame(frame);
}

// Debug handle for automated play-testing (never shown in the game itself).
window.__ember = {
  world,
  start: () => world.startGame(),
  state: () => ({
    screen: world.screen,
    score: world.score,
    coins: world.coins,
    hearts: world.hearts,
    timeLeft: world.timeLeft,
    orders: world.orders.map((o) => o.recipe),
    tray: world.tray.slice(),
    plate: world.plate ? world.plate.slice() : null,
    counterPlate: world.counterPlate.slice(),
    grill: world.grill.map((g) => (g ? g.state : null)),
    chef: { x: world.chef.x, y: world.chef.y },
    served: world.served,
  }),
};

requestAnimationFrame(frame);
