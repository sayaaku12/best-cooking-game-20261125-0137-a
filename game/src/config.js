// Ember & Thyme — Rush Hour Kitchen: recipes, ingredients, stations, levels.
// Every recipe is a set of prepared items; the order board asks for them by name.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;
export const SHIFT_SECONDS = 150;
export const MAX_HEARTS = 3;
export const MAX_TRAY = 3;
export const MAX_ORDERS = 4;

// Ingredient catalogue. chop: needs the chopping board. grill: needs the grill.
export const INGREDIENTS = {
  tomato:  { name: 'Tomato',  color: '#e5484d', dark: '#a92c31', chop: true,  grill: false, emoji: '🍅' },
  lettuce: { name: 'Lettuce', color: '#7dc242', dark: '#4d8a26', chop: true,  grill: false, emoji: '🥬' },
  onion:   { name: 'Onion',   color: '#e8d8f0', dark: '#b08cc0', chop: true,  grill: false, emoji: '🧅' },
  cheese:  { name: 'Cheese',  color: '#f5c542', dark: '#c9921a', chop: false, grill: false, emoji: '🧀' },
  bun:     { name: 'Bun',     color: '#e8a85c', dark: '#b57a30', chop: false, grill: false, emoji: '🍞' },
  patty:   { name: 'Patty',   color: '#8a5a3b', dark: '#5e3a24', chop: false, grill: true,  emoji: '🥩' },
};

// A prepared item id is "chopped:tomato", "grilled:patty" or the raw id for bun/cheese.
export function prepareLabel(id) {
  if (id.startsWith('chopped:')) return 'Chopped ' + INGREDIENTS[id.slice(8)].name;
  if (id.startsWith('grilled:')) return 'Grilled ' + INGREDIENTS[id.slice(8)].name;
  return INGREDIENTS[id].name;
}

export function ingredientColor(id) {
  const base = id.includes(':') ? id.split(':')[1] : id;
  return INGREDIENTS[base].color;
}

// Recipes: id -> { name, price, needs: [prepared ids], color }
export const RECIPES = {
  salad: {
    name: 'Garden Salad', price: 12,
    needs: ['chopped:lettuce', 'chopped:tomato', 'chopped:onion'],
    color: '#7dc242',
  },
  burger: {
    name: 'Classic Burger', price: 18,
    needs: ['bun', 'grilled:patty', 'chopped:lettuce'],
    color: '#e8a85c',
  },
  melt: {
    name: 'Cheese Melt', price: 16,
    needs: ['bun', 'grilled:patty', 'cheese'],
    color: '#f5c542',
  },
  stack: {
    name: 'Veggie Stack', price: 20,
    needs: ['bun', 'chopped:tomato', 'chopped:lettuce', 'chopped:onion'],
    color: '#e5484d',
  },
  double: {
    name: 'Double Trouble', price: 26,
    needs: ['bun', 'grilled:patty', 'grilled:patty', 'cheese'],
    color: '#c98a2e',
  },
};

export const RECIPE_IDS = Object.keys(RECIPES);

// Which recipes may appear as the shift heats up (minute, recipe pool).
export function recipePoolFor(elapsedSeconds) {
  if (elapsedSeconds < 40) return ['salad', 'burger'];
  if (elapsedSeconds < 90) return ['salad', 'burger', 'melt', 'stack'];
  return RECIPE_IDS;
}

// Order spawn interval (seconds) shrinks as the shift goes on.
export function spawnIntervalFor(elapsedSeconds) {
  if (elapsedSeconds < 40) return 14;
  if (elapsedSeconds < 90) return 11;
  return 8;
}

// Patience (seconds) an order waits before it walks out.
export function patienceFor(elapsedSeconds) {
  if (elapsedSeconds < 40) return 65;
  if (elapsedSeconds < 90) return 55;
  return 45;
}

// Kitchen stations (canvas rects). The pantry bins are laid out inside the pantry.
export const STATIONS = {
  pantry:   { x: 16,  y: 196, w: 150, h: 250, label: 'PANTRY' },
  board:    { x: 196, y: 168, w: 170, h: 84,  label: 'CHOPPING BOARD' },
  grill:    { x: 940, y: 168, w: 190, h: 92,  label: 'GRILL' },
  counter:  { x: 470, y: 300, w: 340, h: 130, label: 'ASSEMBLY COUNTER' },
  window:   { x: 1150, y: 300, w: 114, h: 180, label: 'SERVING WINDOW' },
  trash:    { x: 16,  y: 620, w: 110, h: 84,  label: 'TRASH' },
};

export const PANTRY_ITEMS = ['tomato', 'lettuce', 'onion', 'cheese', 'bun', 'patty'];

export const CHOP_TIME = 1.6;   // seconds of chopping per item
export const GRILL_TIME = 6.0;  // seconds until a patty is grilled
export const BURN_TIME = 12.0;  // seconds until a grilled patty burns
export const COMBO_WINDOW = 20; // seconds to keep the combo alive between serves

export const CHEF_SPEED = 250;
export const CHEF_RADIUS = 20;
