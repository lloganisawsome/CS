import { INGREDIENTS, RECIPES } from "./data.js";
import { byId, uid } from "./utils.js";

const ROLE_GROUPS = {
  cashier: ["cashier", "manager"],
  barista: ["barista", "manager"],
  cook: ["cook", "manager"],
  cleaner: ["cleaner", "manager"],
  stocker: ["stocker", "manager"],
  maintenance: ["maintenance", "manager"],
  manager: ["manager"],
  allStaff: ["cashier", "barista", "cook", "cleaner", "stocker", "manager", "maintenance"]
};

export class TaskManager {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.knownKeys = new Set();
  }

  add(task) {
    const full = {
      id: uid("task"),
      priority: "normal",
      createdAt: this.game.time.absoluteMinute,
      progress: 0,
      ...task
    };
    if (full.key && this.knownKeys.has(full.key)) return null;
    if (full.key) this.knownKeys.add(full.key);
    this.queue.push(full);
    this.sort();
    return full;
  }

  sort() {
    const weight = { critical: 4, high: 3, normal: 2, low: 1 };
    this.queue.sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0) || a.createdAt - b.createdAt);
  }

  claim(employee) {
    if (!employee.onShift && !this.game.canWorkProcedureOvertime(employee)) return null;
    const index = this.queue.findIndex((task) => this.canDo(employee, task));
    if (index < 0) return null;
    const [task] = this.queue.splice(index, 1);
    if (task.key) this.knownKeys.delete(task.key);
    task.assignedTo = employee.id;
    return task;
  }

  canDo(employee, task) {
    const allowed = ROLE_GROUPS[task.role] || [task.role];
    if (allowed.includes(employee.role)) return true;
    return this.canCrossTrain(employee, task);
  }

  canCrossTrain(employee, task) {
    if (!["cook", "barista"].includes(employee.role)) return false;
    if (this.hasQueuedPrimaryWork(employee.role)) return false;
    if (task.type === "takeOrder") {
      return this.frontLinePressure() >= 1 || this.game.time.period.key === "earlyCafe" || this.game.time.period.key === "lateCafe";
    }
    if (task.type !== "makeOrder") return false;
    const recipe = RECIPES[task.recipeId];
    if (!recipe) return false;
    if (employee.role === "cook" && recipe.role === "barista") {
      return recipe.period === "all" || ["earlyCafe", "afternoon", "lateCafe"].includes(this.game.time.period.key);
    }
    if (employee.role === "barista" && recipe.role === "cook") {
      return ["earlyCafe", "afternoon", "lateCafe"].includes(this.game.time.period.key);
    }
    return false;
  }

  hasQueuedPrimaryWork(role) {
    return this.queue.some((task) => task.role === role && ["critical", "high"].includes(task.priority));
  }

  frontLinePressure() {
    const queuedCustomers = this.game.customers.filter((customer) => customer.state === "Queued").length;
    const waitingOrders = this.game.orders.filter((order) => ["Queued", "Waiting for Restock"].includes(order.status)).length;
    return queuedCustomers + waitingOrders;
  }

  clear() {
    this.queue = [];
    this.knownKeys.clear();
  }
}

export function buildOrderTask(game, order) {
  const recipe = RECIPES[order.recipeId];
  const steps = recipe.steps.map((step) => ({
    type: "action",
    objectId: step.object,
    label: step.label,
    duration: step.object === "pickup" ? 0.42 : Math.max(0.55, recipe.prep / recipe.steps.length * 0.74),
    carry: step.carry
  }));
  return {
    type: "makeOrder",
    label: `Make ${recipe.label}`,
    role: recipe.role,
    priority: "high",
    orderId: order.id,
    recipeId: order.recipeId,
    steps,
    onStart(employee) {
      game.inventory.consumeForRecipe(recipe);
      order.status = "Preparing";
      order.employee = employee.role === recipe.role ? employee.name : `${employee.name} (helping)`;
    },
    onComplete(employee) {
      employee.carry = recipe.role === "cook" ? "plate" : "drink";
      game.completeOrder(order.id);
    }
  };
}

export function buildTakeOrderTask(game, customerId, registerId = "register") {
  return {
    type: "takeOrder",
    label: "Take Customer Order",
    role: "cashier",
    priority: "high",
    customerId,
    steps: [
      { type: "action", objectId: registerId, label: "Taking Order", duration: 0.8, carry: null }
    ],
    onComplete() {
      game.takeCustomerOrder(customerId);
    }
  };
}

export function buildProcedureTask(game, item) {
  return {
    type: item.phase,
    key: `${item.phase}:${item.id}`,
    label: item.label,
    role: item.role || "allStaff",
    priority: item.priority || "normal",
    checklistId: item.id,
    steps: item.steps.map((step) => ({
      type: step.type || "action",
      objectId: step.objectId,
      tableId: step.tableId,
      label: step.label,
      duration: step.duration,
      carry: step.carry || null
    })),
    onStart(employee) {
      item.status = "In Progress";
      item.employee = employee.name;
      game.addAlert(`${employee.name} started: ${item.label}`, item.phase === "opening" ? "normal" : "high", 20);
    },
    onComplete() {
      item.status = "Done";
      item.completedAt = game.time.absoluteMinute;
      game.completeProcedureItem(item);
    }
  };
}

export function buildRestockTask(game, stationId, ingredientId, critical = false) {
  const ingredient = INGREDIENTS[ingredientId];
  const storageId = ingredient.storage;
  return {
    type: "restock",
    key: `restock:${stationId}:${ingredientId}`,
    label: `Restock ${ingredient.label}`,
    role: "stocker",
    priority: critical ? "high" : "normal",
    stationId,
    ingredientId,
    steps: [
      { type: "action", objectId: storageId, label: `Retrieving ${ingredient.label}`, duration: 1.35, carry: "box" },
      { type: "action", objectId: stationObjectFor(stationId), label: `Restocking ${ingredient.label}`, duration: 1.15, carry: ingredientId }
    ],
    onComplete() {
      const amount = game.inventory.restock(stationId, ingredientId, critical ? 10 : 6);
      if (amount > 0) game.addAlert(`${ingredient.label} restocked at ${stationLabel(stationId)} (+${amount})`, "normal");
      game.releaseWaitingOrders();
    }
  };
}

export function buildCleanTableTask(game, tableId) {
  return {
    type: "clean",
    key: `clean:${tableId}`,
    label: "Clean Dirty Table",
    role: "cleaner",
    priority: "normal",
    tableId,
    steps: [
      { type: "action", objectId: "cleaning", label: "Getting Cleaning Supplies", duration: 0.8, carry: "cleaning" },
      { type: "table", tableId, label: "Wiping Table", duration: 2.1, carry: "cleaning" },
      { type: "action", objectId: "dishwasher", label: "Dropping Dishes", duration: 0.9, carry: "dishes" }
    ],
    onComplete() {
      const table = byId(game.tables, tableId);
      if (table) table.dirty = 0;
      game.stats.dishesWashed += 1;
    }
  };
}

export function buildTrashTask(game) {
  return {
    type: "trash",
    key: "trash:takeout",
    label: "Take Trash Out",
    role: "cleaner",
    priority: game.trashLevel > 80 ? "high" : "normal",
    steps: [
      { type: "action", objectId: "trashArea", label: "Bagging Trash", duration: 1.5, carry: "trash" },
      { type: "action", objectId: "loading", label: "Taking Trash Outside", duration: 2.2, carry: "trash" }
    ],
    onComplete() {
      game.trashLevel = Math.max(0, game.trashLevel - 60);
      game.addAlert("Trash was taken out.", "normal");
    }
  };
}

export function buildMaintenanceTask(game, equipmentId) {
  return {
    type: "maintenance",
    key: `maintenance:${equipmentId}`,
    label: "Repair Equipment",
    role: "maintenance",
    priority: "critical",
    equipmentId,
    steps: [
      { type: "action", objectId: equipmentId, label: "Diagnosing Equipment", duration: 2.5, carry: "toolbox" },
      { type: "action", objectId: equipmentId, label: "Repairing Equipment", duration: 4.5, carry: "toolbox" },
      { type: "action", objectId: equipmentId, label: "Testing Equipment", duration: 1.4, carry: "toolbox" }
    ],
    onComplete() {
      const equipment = byId(game.equipment, equipmentId);
      if (equipment) {
        equipment.condition = Math.min(100, equipment.condition + 45);
        equipment.cleanliness = Math.min(100, equipment.cleanliness + 15);
        equipment.status = "Ready";
        game.economy.maintenance += 45;
        game.money -= 45;
      }
    }
  };
}

export function buildCleanEquipmentTask(game, equipmentId) {
  return {
    type: "cleanEquipment",
    key: `cleanEquipment:${equipmentId}`,
    label: "Clean Equipment",
    role: "cleaner",
    priority: "normal",
    equipmentId,
    steps: [
      { type: "action", objectId: "cleaning", label: "Getting Supplies", duration: 1, carry: "cleaning" },
      { type: "action", objectId: equipmentId, label: "Cleaning Machine", duration: 3.2, carry: "cleaning" }
    ],
    onComplete() {
      const equipment = byId(game.equipment, equipmentId);
      if (equipment) equipment.cleanliness = Math.min(100, equipment.cleanliness + 42);
    }
  };
}

export function buildUnloadTask(game, deliveryId, boxId) {
  const delivery = byId(game.deliveries, deliveryId);
  const box = delivery?.boxes.find((item) => item.id === boxId);
  if (!delivery || !box) return null;
  const ingredient = INGREDIENTS[box.ingredientId];
  return {
    type: "unload",
    key: `unload:${deliveryId}:${boxId}`,
    label: `Unload ${ingredient.label}`,
    role: "stocker",
    priority: "normal",
    deliveryId,
    boxId,
    steps: [
      { type: "delivery", deliveryId, label: `Lifting ${ingredient.label}`, duration: 0.95, carry: "box" },
      { type: "action", objectId: ingredient.storage, label: `Stocking ${ingredient.label}`, duration: 1.25, carry: "box" }
    ],
    onStart() {
      box.status = "Moving";
    },
    onComplete() {
      box.status = "Stored";
      game.inventory.addDeliveryBox(box.ingredientId, box.amount);
      game.stats.boxesUnloaded += 1;
    }
  };
}

function stationObjectFor(stationId) {
  return {
    espressoBar: "milkFridge",
    coldStation: "coldStation",
    pastryCase: "pastryCase",
    kitchenPrep: "prepCounter"
  }[stationId] || "dryStorage";
}

function stationLabel(stationId) {
  return {
    espressoBar: "Espresso Bar",
    coldStation: "Cold Station",
    pastryCase: "Pastry Case",
    kitchenPrep: "Kitchen Prep"
  }[stationId] || stationId;
}
