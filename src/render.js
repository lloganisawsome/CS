import { INGREDIENTS, OBJECTS, RECIPES, TILE, WORLD } from "./data.js";
import { byId, clamp, percent } from "./utils.js";

const ROOM_COLORS = {
  dining: "#f3e6d2",
  bar: "#e7efe7",
  kitchen: "#e9edf0",
  back: "#e4dfd6",
  exterior: "#d8e0d1"
};

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.game = game;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    this.drawRooms(ctx);
    this.drawGrid(ctx);
    this.drawWalls(ctx);
    this.drawObjects(ctx);
    this.drawTables(ctx);
    this.drawDeliveries(ctx);
    this.drawOrders(ctx);
    this.drawNpcs(ctx);
    this.drawLighting(ctx);
    this.drawOpenSign(ctx);
    this.drawModeTint(ctx);
  }

  drawRooms(ctx) {
    ctx.fillStyle = ROOM_COLORS.exterior;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    this.room(ctx, 48, 58, 492, 565, ROOM_COLORS.dining, "Diner / Cafe Seating");
    this.room(ctx, 552, 58, 496, 190, ROOM_COLORS.bar, "Coffee Bar");
    this.room(ctx, 600, 264, 480, 200, ROOM_COLORS.kitchen, "Kitchen");
    this.room(ctx, 372, 488, 708, 155, ROOM_COLORS.back, "Back of House");
    this.room(ctx, 884, 604, 254, 88, "#d5d6cc", "Truck Loading Bay");
    ctx.fillStyle = "#bfa985";
    ctx.fillRect(47, 58, 4, 565);
    ctx.fillRect(48, 58, 492, 4);
    ctx.fillRect(552, 58, 496, 4);
    ctx.fillRect(600, 264, 480, 4);
    ctx.fillRect(372, 488, 708, 4);
    ctx.fillRect(1136, 604, 4, 88);
    ctx.fillStyle = "#8fb7a7";
    ctx.fillRect(18, 330, 34, 78);
    ctx.fillRect(1090, 558, 38, 72);
    ctx.fillStyle = "#787568";
    ctx.fillRect(892, 612, 236, 72);
    ctx.fillStyle = "#eee8dc";
    ctx.fillRect(902, 620, 216, 56);
    ctx.fillStyle = "#b7b0a0";
    ctx.fillRect(904, 648, 212, 7);
    ctx.fillStyle = "rgba(70, 62, 52, 0.55)";
    ctx.font = "700 11px Inter, sans-serif";
    ctx.fillText("TRUCK ONLY", 962, 674);
  }

  room(ctx, x, y, w, h, color, label) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#c5b9a8";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "rgba(65, 55, 42, 0.55)";
    ctx.font = "700 12px Inter, sans-serif";
    ctx.fillText(label, x + 12, y + 20);
  }

  drawGrid(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#8e826f";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.width; x += TILE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += TILE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawObjects(ctx) {
    for (const object of OBJECTS) {
      if (object.type === "marker" || object.type === "door" || object.type === "wall") continue;
      const equipment = byId(this.game.equipment, object.id);
      let fill = "#c7ab83";
      if (object.type === "storage") fill = "#9e907c";
      if (object.type === "pickup") fill = "#b98f69";
      if (equipment) {
        fill = equipment.status === "Needs Repair" ? "#b85d4a" : equipment.status === "Needs Cleaning" ? "#d6ad5d" : "#87a799";
      }
      roundRect(ctx, object.x, object.y, object.w, object.h, 5, fill, "#6e6255");
      ctx.fillStyle = "#2e302c";
      ctx.font = "700 10px Inter, sans-serif";
      wrapLabel(ctx, object.label, object.x + 5, object.y + 14, object.w - 8, 11);
      if (equipment) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(object.x + 5, object.y + object.h - 9, object.w - 10, 4);
        ctx.fillStyle = equipment.cleanliness < 35 ? "#b85d4a" : "#4f8f6b";
        ctx.fillRect(object.x + 5, object.y + object.h - 9, (object.w - 10) * equipment.cleanliness / 100, 4);
        if (equipment.powerState && equipment.powerState !== "Ready") {
          ctx.fillStyle = equipment.powerState === "Off" ? "#3f4844" : "#c28b35";
          ctx.font = "700 8px Inter, sans-serif";
          ctx.fillText(equipment.powerState.toUpperCase(), object.x + 5, object.y + object.h - 13);
        }
      }
    }
    this.drawQueue(ctx);
    this.drawTrash(ctx);
  }

  drawQueue(ctx) {
    ctx.strokeStyle = "#907c63";
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(230, 306);
    ctx.lineTo(84, 374);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const slot of this.game.queueSlots) {
      ctx.fillStyle = slot.customerId ? "rgba(184, 93, 74, 0.28)" : "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(slot.spot[0], slot.spot[1], 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTables(ctx) {
    for (const table of this.game.tables) {
      const dirty = table.dirty / 100;
      roundRect(ctx, table.x - 28, table.y - 18, 56, 36, 8, dirty > 0.45 ? "#a98368" : "#cfb48d", "#806d57");
      ctx.fillStyle = table.occupied ? "#7e9d74" : "#f6eee0";
      ctx.beginPath();
      ctx.arc(table.x - 36, table.y, 7, 0, Math.PI * 2);
      ctx.arc(table.x + 36, table.y, 7, 0, Math.PI * 2);
      ctx.arc(table.x - 18, table.y + 28, 7, 0, Math.PI * 2);
      ctx.arc(table.x + 18, table.y + 28, 7, 0, Math.PI * 2);
      ctx.fill();
      if (dirty > 0.1) {
        ctx.fillStyle = `rgba(91, 74, 58, ${0.25 + dirty * 0.55})`;
        ctx.fillRect(table.x - 10, table.y - 7, 8, 5);
        ctx.fillRect(table.x + 6, table.y + 4, 9, 5);
      }
      if (this.game.selected?.item?.id === table.id) this.selectionRing(ctx, table.x, table.y + 8, 48);
    }
  }

  drawDeliveries(ctx) {
    for (const delivery of this.game.deliveries) {
      if (delivery.status === "Complete" || delivery.status === "Traveling") continue;
      roundRect(ctx, delivery.x, delivery.y, 150, 66, 6, "#e6cf7d", "#695a3d");
      ctx.fillStyle = "#6f8fa0";
      ctx.fillRect(delivery.x + 12, delivery.y + 10, 44, 22);
      ctx.fillStyle = "#4f4a43";
      ctx.beginPath();
      ctx.arc(delivery.x + 34, delivery.y + 68, 11, 0, Math.PI * 2);
      ctx.arc(delivery.x + 122, delivery.y + 68, 11, 0, Math.PI * 2);
      ctx.fill();
      const waiting = delivery.boxes.filter((box) => box.status !== "Stored").length;
      ctx.fillStyle = "#2e302c";
      ctx.font = "700 12px Inter, sans-serif";
      ctx.fillText(`${delivery.status}: ${waiting} boxes`, delivery.x + 12, delivery.y - 8);
    }
  }

  drawWalls(ctx) {
    ctx.fillStyle = "#8e7d66";
    ctx.strokeStyle = "#615542";
    ctx.lineWidth = 1.5;
    const walls = OBJECTS.filter((object) => object.type === "wall");
    for (const wall of walls) {
      roundRect(ctx, wall.x, wall.y, wall.w, wall.h, 2, "#8e7d66", "#615542");
    }
    ctx.fillStyle = "#b98f69";
    ctx.fillRect(540, 200, 12, 74);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "700 10px Inter, sans-serif";
    ctx.fillText("PASS", 532, 238);
    ctx.fillStyle = "#c7b28e";
    ctx.fillRect(600, 452, 92, 12);
    ctx.fillStyle = "#6f604e";
    ctx.fillText("STAFF DOOR", 614, 461);
  }

  drawOrders(ctx) {
    const ready = this.game.orders.filter((order) => order.status === "Ready").slice(0, 8);
    ready.forEach((order, index) => {
      const x = 348 + index * 15;
      const y = 184;
      ctx.fillStyle = RECIPES[order.recipeId].role === "cook" ? "#f3ead7" : "#d9ecf0";
      ctx.strokeStyle = "#7a6858";
      ctx.beginPath();
      ctx.roundRect(x, y, 18, 12, 3);
      ctx.fill();
      ctx.stroke();
    });
  }

  drawNpcs(ctx) {
    const actors = [...this.game.customers, ...this.game.employees].sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      const isEmployee = "wage" in actor;
      this.drawNpc(ctx, actor, isEmployee);
    }
  }

  drawNpc(ctx, npc, isEmployee) {
    const bob = Math.sin(performance.now() / 180 + npc.x * 0.02) * (npc.path?.length ? 1.7 : 0.4);
    ctx.save();
    ctx.translate(npc.x, npc.y + bob);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 11, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = npc.color;
    ctx.beginPath();
    ctx.arc(0, -5, isEmployee ? 10 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isEmployee ? "#fffaf0" : "#2f302d";
    ctx.fillRect(-6, 2, 12, 15);
    ctx.fillStyle = "#2c2420";
    ctx.beginPath();
    ctx.arc(0, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    if (npc.carry) this.drawCarry(ctx, npc.carry);
    if (npc.task) {
      const step = npc.task.steps[npc.stepIndex];
      if (step) {
        const p = clamp(npc.stepProgress / step.duration, 0, 1);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillRect(-14, -25, 28, 4);
        ctx.fillStyle = "#4d8b68";
        ctx.fillRect(-14, -25, 28 * p, 4);
      }
    }
    ctx.restore();
    if (this.game.selected?.item?.id === npc.id) this.selectionRing(ctx, npc.x, npc.y, 18);
  }

  drawCarry(ctx, carry) {
    const colors = {
      box: "#b98545",
      drink: "#d9edf0",
      plate: "#f8f0df",
      meal: "#e7ba6f",
      milk: "#eef7f8",
      beans: "#5c3a29",
      cleaning: "#6e9a74",
      dishes: "#f2f2eb",
      trash: "#3c3c3a",
      toolbox: "#6a7585",
      pastry: "#c9925a",
      dessert: "#e2bad4",
      ingredients: "#78a36d",
      cup: "#f1f5f5"
    };
    ctx.fillStyle = colors[carry] || colors.box;
    ctx.strokeStyle = "#4d4338";
    ctx.beginPath();
    ctx.roundRect(8, -8, 13, 12, 3);
    ctx.fill();
    ctx.stroke();
  }

  selectionRing(ctx, x, y, r) {
    ctx.strokeStyle = "#2b75b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawTrash(ctx) {
    ctx.fillStyle = "#3d4740";
    ctx.fillRect(80, 610, 26, 34);
    ctx.fillStyle = "#b6bfaf";
    ctx.fillRect(84, 604, 18, 6);
    ctx.fillStyle = this.game.trashLevel > 75 ? "#b85d4a" : "#6e8b73";
    ctx.fillRect(84, 638 - this.game.trashLevel * 0.28, 18, this.game.trashLevel * 0.28);
  }

  drawLighting(ctx) {
    const zones = [
      ["dining", 48, 58, 492, 565],
      ["bar", 552, 58, 496, 190],
      ["kitchen", 600, 264, 480, 200],
      ["back", 372, 488, 708, 155]
    ];
    ctx.save();
    for (const [key, x, y, w, h] of zones) {
      if (this.game.roomLights[key]) {
        ctx.fillStyle = "rgba(255, 244, 190, 0.08)";
      } else {
        ctx.fillStyle = "rgba(23, 30, 34, 0.42)";
      }
      ctx.fillRect(x, y, w, h);
    }
    if (this.game.serviceState === "closed" || this.game.serviceState === "opening") {
      ctx.fillStyle = "rgba(12, 18, 22, 0.12)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }
    ctx.restore();
  }

  drawOpenSign(ctx) {
    roundRect(ctx, 58, 326, 44, 22, 4, this.game.openSignOn ? "#d85d44" : "#4d4d48", "#36312b");
    ctx.fillStyle = this.game.openSignOn ? "#fff2df" : "#c7c3b8";
    ctx.font = "700 10px Inter, sans-serif";
    ctx.fillText(this.game.openSignOn ? "OPEN" : "CLOSED", 63, 341);
    if (this.game.frontDoorLocked) {
      ctx.fillStyle = "#2d3536";
      ctx.fillRect(24, 366, 20, 8);
    }
  }

  drawModeTint(ctx) {
    const mode = this.game.time.period.mode;
    ctx.save();
    ctx.globalAlpha = mode === "Restaurant" ? 0.08 : mode === "Diner" ? 0.055 : 0.04;
    ctx.fillStyle = mode === "Restaurant" ? "#b85d4a" : mode === "Diner" ? "#c28b35" : "#6e8b73";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

function wrapLabel(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}
