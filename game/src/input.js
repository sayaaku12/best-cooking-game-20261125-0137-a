// Ember & Thyme: keyboard + mouse input, shared by world and main.
export class KitchenInput {
  constructor(canvas, onAction) {
    this.keys = new Set();
    this.onAction = onAction; // callback(actionName) for edge-triggered keys
    this.mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };
    this._onKeyDown = (e) => this.handleKeyDown(e);
    this._onKeyUp = (e) => this.handleKeyUp(e);
    this._onMouseMove = (e) => this.handleMouseMove(e, canvas);
    this._onMouseDown = (e) => this.handleMouseDown(e, canvas);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
  }

  handleKeyDown(e) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    if (k === 'e' || k === ' ') this.onAction('interact');
    if (k === 'enter') this.onAction('confirm');
    if (k === 'p' || k === 'escape') this.onAction('pause');
    if (k === 'r') this.onAction('restart');
    if (k === 'm') this.onAction('mute');
    if (k === 'h') this.onAction('help');
    if (k >= '1' && k <= '6') this.onAction('pantry' + k);
  }

  handleKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
  }

  handleMouseMove(e, canvas) {
    const r = canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  }

  handleMouseDown(e, canvas) {
    const r = canvas.getBoundingClientRect();
    this.mouse.clickX = (e.clientX - r.left) * (canvas.width / r.width);
    this.mouse.clickY = (e.clientY - r.top) * (canvas.height / r.height);
    this.mouse.clicked = true;
    this.mouse.x = this.mouse.clickX;
    this.mouse.y = this.mouse.clickY;
  }

  consumeClick() {
    if (!this.mouse.clicked) return null;
    this.mouse.clicked = false;
    return { x: this.mouse.clickX, y: this.mouse.clickY };
  }

  // Normalised movement vector from held keys.
  moveVector() {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  get interactHeld() {
    return this.keys.has('e') || this.keys.has(' ');
  }
}
