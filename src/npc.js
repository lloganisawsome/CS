import { clamp, dist, uid } from "./utils.js";

export class Employee {
  constructor(def, index) {
    this.id = uid("emp");
    this.name = def.name;
    this.role = def.role;
    this.label = def.label;
    this.skill = def.skill;
    this.speed = def.speed;
    this.wage = def.wage;
    this.color = def.color;
    this.shift = def.shift;
    this.x = 424 + (index % 5) * 24;
    this.y = 610 + Math.floor(index / 5) * 24;
    this.path = [];
    this.pathGoal = null;
    this.task = null;
    this.stepIndex = 0;
    this.stepProgress = 0;
    this.activity = "Waiting for shift";
    this.carry = null;
    this.energy = 100;
    this.onShift = false;
    this.selected = false;
    this.training = 0;
  }

  update(dt, game) {
    const minute = game.time.minute;
    const scheduled = minute >= this.shift[0] && minute <= this.shift[1] && game.time.period.key !== "closed";
    this.onShift = scheduled || game.canWorkProcedureOvertime(this);
    if (!this.onShift) {
      if (this.task) {
        this.runTask(dt, game);
        return;
      }
      this.activity = "Off Shift";
      this.carry = null;
      const breakSpot = game.destinationForObject?.("employeeArea") || { x: 456, y: 604 };
      if (dist(this, breakSpot) > 8) this.walkTo(breakSpot, game);
      this.followPath(dt, game);
      return;
    }
    this.energy = clamp(this.energy - dt * 0.018 * game.time.speed, 18, 100);
    if (!scheduled && this.onShift && game.serviceState === "closing") {
      const overtime = dt * game.time.speed / 60;
      game.closingStats.overtime += overtime;
      game.economy.labor += this.wage / 60 * overtime * 1.25;
      game.money -= this.wage / 60 * overtime * 1.25;
    }
    if (!this.task) this.task = game.tasks.claim(this);
    if (!this.task) {
      this.activity = "Idle";
      this.carry = null;
      return;
    }
    this.runTask(dt, game);
  }

  runTask(dt, game) {
    if (!this.task.started) {
      this.task.started = true;
      this.task.onStart?.(this);
    }
    const step = this.task.steps[this.stepIndex];
    if (!step) {
      this.finishTask(game);
      return;
    }
    const destination = game.destinationForStep(step);
    if (destination && dist(this, destination) > 18) {
      this.activity = `Walking: ${step.label}`;
      this.carry = step.carry || this.carry;
      this.walkTo(destination, game);
      this.followPath(dt, game);
      return;
    }
    this.path = [];
    this.activity = step.label;
    this.carry = step.carry || this.carry;
    const pace = (this.skill + this.speed) / 2;
    this.stepProgress += dt * game.time.speed * pace * game.staffActionMultiplier(this);
    if (this.stepProgress >= step.duration) {
      this.stepProgress = 0;
      this.stepIndex += 1;
      if (this.stepIndex >= this.task.steps.length) this.finishTask(game);
    }
  }

  finishTask(game) {
    this.task.onComplete?.(this);
    this.task = null;
    this.stepIndex = 0;
    this.stepProgress = 0;
    this.activity = "Idle";
    this.carry = null;
  }

  walkTo(point, game) {
    if (this.path.length && this.pathGoal && dist(this.pathGoal, point) < 8) return;
    this.pathGoal = { x: point.x, y: point.y };
    this.path = game.pathfinder.findPath(this, point);
  }

  followPath(dt, game) {
    const target = this.path[0];
    if (!target) return;
    const urgency = this.task && ["high", "critical"].includes(this.task.priority) ? 1.14 : 1;
    const carryDrag = ["box", "trash", "dishes"].includes(this.carry) ? 0.94 : 1;
    const speed = (92 + this.speed * 34) * game.time.speed * (this.energy < 35 ? 0.85 : 1) * game.staffMoveMultiplier(this) * urgency * carryDrag;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) {
      this.path.shift();
      if (!this.path.length) this.pathGoal = null;
      return;
    }
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
  }
}

export class Customer {
  constructor(profile, spawnIndex) {
    this.id = uid("cust");
    this.name = profile.name;
    this.x = 26;
    this.y = 360 + (spawnIndex % 4) * 9;
    this.color = profile.color;
    this.patience = profile.patience;
    this.budget = profile.budget;
    this.groupSize = profile.groupSize;
    this.dineIn = profile.dineIn;
    this.preference = profile.preference;
    this.cleanExpectation = profile.cleanExpectation;
    this.satisfaction = 1;
    this.state = "Entering";
    this.orderId = null;
    this.recipeId = null;
    this.queueSlot = null;
    this.tableId = null;
    this.waitMinutes = 0;
    this.eatLeft = 0;
    this.path = [];
    this.pathGoal = null;
    this.activity = "Entering";
    this.selected = false;
  }

  update(dt, game) {
    if (this.state !== "Leaving" && this.state !== "Eating") {
      this.waitMinutes += dt * game.time.speed;
      const patienceLimit = this.state === "WaitingPickup" ? this.patience * 1.35 : this.patience;
      if (this.waitMinutes > patienceLimit) {
        this.satisfaction -= 0.35;
        game.refundOrLoseCustomer(this, "left after waiting too long");
        this.leave(game);
      }
    }
    switch (this.state) {
      case "Entering":
        this.goQueue(game);
        break;
      case "Queued":
        this.queueBehavior(game);
        break;
      case "WaitingPickup":
        this.waitForPickup(game);
        break;
      case "FindingTable":
        this.findTable(game);
        break;
      case "Eating":
        this.eat(dt, game);
        break;
      case "Leaving":
        this.walkOut(dt, game);
        break;
      default:
        break;
    }
    this.followPath(dt, game);
  }

  goQueue(game) {
    const slot = game.reserveQueueSlot(this);
    if (!slot) {
      this.satisfaction -= 0.15;
      this.activity = "Crowded queue";
      return;
    }
    this.queueSlot = slot.id;
    this.state = "Queued";
    this.activity = "Joining queue";
    this.walkTo({ x: slot.spot[0], y: slot.spot[1] }, game);
  }

  queueBehavior(game) {
    const slot = game.queueSlots.find((item) => item.id === this.queueSlot);
    if (slot) this.walkTo({ x: slot.spot[0], y: slot.spot[1] }, game);
    const queued = game.customers
      .filter((customer) => customer.state === "Queued")
      .sort((a, b) => game.queueIndex(a.queueSlot) - game.queueIndex(b.queueSlot));
    const position = queued.findIndex((customer) => customer.id === this.id);
    if (position >= 0 && position < game.activeRegisterCount() && !game.hasTaskForCustomer(this.id) && !this.orderId) {
      game.tasks.add(game.buildTakeOrderTask(this.id, position));
    }
    this.activity = position >= 0 && position < game.activeRegisterCount() ? "At register" : "Waiting in queue";
  }

  waitForPickup(game) {
    this.activity = "Waiting for pickup";
    this.walkTo({ x: 414, y: 288 + (Number(this.id.split("-").pop()) % 5) * 18 }, game);
    const order = game.orders.find((item) => item.id === this.orderId);
    if (order?.status === "Ready") {
      order.status = "Picked Up";
      this.waitMinutes = 0;
      if (this.dineIn) {
        this.state = "FindingTable";
      } else {
        this.leave(game);
      }
    }
  }

  findTable(game) {
    const table = game.tables.find((item) => !item.occupied && item.dirty < this.cleanExpectation && item.seats >= this.groupSize);
    if (!table) {
      this.activity = "No clean table";
      this.satisfaction -= 0.02;
      if (this.waitMinutes > 4) this.leave(game);
      return;
    }
    table.occupied = this.id;
    this.tableId = table.id;
    this.state = "Eating";
    this.eatLeft = 8 + Math.random() * (game.time.period.key === "dinner" ? 14 : 8);
    this.walkTo({ x: table.x + 38, y: table.y + 30 }, game);
  }

  eat(dt, game) {
    this.activity = "Eating";
    this.eatLeft -= dt * game.time.speed;
    if (this.eatLeft <= 0) {
      const table = game.tables.find((item) => item.id === this.tableId);
      if (table) {
        table.occupied = null;
        table.dirty = clamp(table.dirty + 35 + this.groupSize * 8, 0, 100);
      }
      game.trashLevel = clamp(game.trashLevel + 2 + this.groupSize, 0, 100);
      this.leave(game);
    }
  }

  leave(game) {
    this.state = "Leaving";
    this.activity = "Leaving";
    if (this.queueSlot) game.releaseQueueSlot(this.queueSlot);
    if (this.orderId) {
      const order = game.orders.find((item) => item.id === this.orderId);
      if (order && order.status === "Ready") order.status = "Abandoned";
    }
    this.walkTo({ x: 24, y: 366 }, game);
  }

  walkOut(dt, game) {
    this.activity = "Leaving";
    if (this.x < 42 && this.y > 318 && this.y < 418) this.remove = true;
  }

  walkTo(point, game) {
    if (this.path.length && this.pathGoal && dist(this.pathGoal, point) < 8) return;
    this.pathGoal = { x: point.x, y: point.y };
    this.path = game.pathfinder.findPath(this, point);
  }

  followPath(dt, game) {
    const target = this.path[0];
    if (!target) return;
    const speed = 56 * game.time.speed;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) {
      this.path.shift();
      if (!this.path.length) this.pathGoal = null;
      return;
    }
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
  }
}
