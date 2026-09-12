import { Game } from "./game.js";
import { Renderer } from "./render.js";
import { UI } from "./ui.js";

const canvas = document.getElementById("gameCanvas");
const game = new Game();
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer);

let last = performance.now();
let uiAccumulator = 0;

function loop(now) {
  const dt = Math.min(0.08, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.draw();
  uiAccumulator += dt;
  if (uiAccumulator > 0.25) {
    uiAccumulator = 0;
    ui.render();
  }
  requestAnimationFrame(loop);
}

ui.render();
requestAnimationFrame(loop);
