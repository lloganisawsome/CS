import {
  EMPLOYEE_DEFS,
  INGREDIENTS,
  OBJECTS,
  RECIPES,
  TABLE_DEFS,
  WORLD
} from "./data.js";
import { InventorySystem } from "./inventory.js";
import { Customer, Employee } from "./npc.js";
import { Pathfinder } from "./pathfinding.js";
import { TaskManager } from "./tasks.js";
import {
  buildCleanEquipmentTask,
  buildCleanTableTask,
  buildMaintenanceTask,
  buildOrderTask,
  buildProcedureTask,
  buildRestockTask,
  buildTakeOrderTask,
  buildTrashTask,
  buildUnloadTask
} from "./tasks.js";
import { TimeSystem } from "./time.js";
import { byId, choice, clamp, clone, rectContains, uid, weightedChoice } from "./utils.js";

const CUSTOMER_NAMES = ["Alex", "Casey", "Taylor", "Morgan", "Ari", "Jamie", "Quinn", "Rowan", "Sky", "Reese"];
const CUSTOMER_COLORS = ["#2f7891", "#b96a58", "#6d8a4d", "#8c6ab5", "#c08a32", "#596c80"];
const INACTIVE_ORDER_STATUSES = ["Picked Up", "Refunded", "Abandoned"];
const SCHEDULE = {
  openingStart: 5 * 60,
  doorsOpen: 6 * 60,
  lastCall: 21 * 60 + 30,
  lastAdmission: 21 * 60 + 45,
  closeAdmission: 22 * 60,
  staffLeave: 23 * 60
};

export class Game {
  constructor() {
    this.objects = clone(OBJECTS);
    this.tables = TABLE_DEFS.map((table) => ({ ...table, dirty: 0, occupied: null }));
    this.queueSlots = this.objects.filter((object) => object.id.startsWith("queue")).map((slot) => ({ ...slot, customerId: null }));
    this.pathfinder = new Pathfinder(this.objects, this.tables);
    this.time = new TimeSystem();
    this.inventory = new InventorySystem();
    this.tasks = new TaskManager(this);
    this.employees = EMPLOYEE_DEFS.map((def, index) => new Employee(def, index));
    this.customers = [];
    this.orders = [];
    this.deliveries = [];
    this.alerts = [];
    this.money = 2500;
    this.serviceState = "opening";
    this.autoOpen = true;
    this.autoClose = true;
    this.frontDoorLocked = true;
    this.openSignOn = false;
    this.openingGeneratedDay = 0;
    this.closingGeneratedDay = 0;
    this.lastCallAnnouncedDay = 0;
    this.reportedDay = 0;
    this.activeBusinessDay = 1;
    this.closingStats = { openingReadinessAtOpen: 0, closingCompletion: 0, overtime: 0, waste: 0, unfinishedTasks: 0, tomorrowReadiness: 0 };
    this.roomLights = { dining: false, bar: false, kitchen: false, back: true, exterior: true };
    this.openingChecklist = [];
    this.closingChecklist = [];
    this.hustleUntil = 0;
    this.staffTrainingLevel = 0;
    this.spawnAccumulator = 0;
    this.systemAccumulator = 0;
    this.autosaveAccumulator = 0;
    this.selected = null;
    this.trashLevel = 10;
    this.dayReports = [];
    this.economy = {
      revenue: 0,
      ingredients: 0,
      labor: 0,
      utilities: 0,
      maintenance: 0,
      deliveryFees: 0,
      waste: 0,
      refunds: 0
    };
    this.stats = {
      customersServed: 0,
      customersLost: 0,
      ordersCompleted: 0,
      dishesWashed: 0,
      boxesUnloaded: 0,
      totalWait: 0,
      maxCustomers: 0
    };
    this.equipment = this.objects
      .filter((object) => object.type === "equipment")
      .map((object) => ({
        id: object.id,
        label: object.label,
        condition: 82 + Math.random() * 15,
        cleanliness: 74 + Math.random() * 24,
        status: "Ready",
        powerState: "Off",
        queue: 0,
        objectId: object.id
      }));
    this.prep = {
      breakfast: { eggs: 1, pancakes: 1, grill: 1 },
      lunch: { chicken: 0.35, soup: 0.25, sandwichStation: 0.42, grill: 0.55, coldStation: 0.7 },
      dinner: { entrees: 0.2, oven: 0.45, plating: 0.55, dessert: 0.75 }
    };
    this.generateOpeningTasks();
    this.addAlert("Opening crew arrived. Doors are locked until the cafe opens.", "normal");
  }

  get hustleActive() {
    return this.time.absoluteMinute < this.hustleUntil;
  }

  get hustleMinutesLeft() {
    return Math.max(0, Math.ceil(this.hustleUntil - this.time.absoluteMinute));
  }

  staffActionMultiplier(employee) {
    const training = 1 + (employee.training || 0) * 0.04 + this.staffTrainingLevel * 0.025;
    const energy = employee.energy < 35 ? 0.88 : 1;
    return training * energy * (this.hustleActive && employee.onShift ? 1.55 : 1);
  }

  staffMoveMultiplier(employee) {
    const training = 1 + (employee.training || 0) * 0.025 + this.staffTrainingLevel * 0.015;
    return training * (this.hustleActive && employee.onShift ? 1.38 : 1);
  }

  startHustleShift() {
    if (this.hustleActive) {
      this.addAlert(`Hustle shift already active (${this.hustleMinutesLeft} min left).`, "normal");
      return;
    }
    const cost = 45;
    if (this.money < cost) {
      this.addAlert("Not enough cash for a hustle shift.", "high");
      return;
    }
    this.money -= cost;
    this.economy.labor += cost;
    this.hustleUntil = this.time.absoluteMinute + 60;
    for (const employee of this.employees) {
      if (employee.onShift) employee.energy = Math.min(100, employee.energy + 18);
    }
    this.addAlert("Hustle shift active: on-shift staff move faster and work 55% quicker for 60 minutes.", "high");
  }

  trainStaff() {
    const cost = 120 + this.staffTrainingLevel * 55;
    if (this.money < cost) {
      this.addAlert(`Training costs $${cost}; cash is too low.`, "high");
      return;
    }
    if (this.staffTrainingLevel >= 6) {
      this.addAlert("Staff training is maxed for this prototype.", "normal");
      return;
    }
    this.money -= cost;
    this.economy.labor += cost;
    this.staffTrainingLevel += 1;
    for (const employee of this.employees) {
      employee.training = (employee.training || 0) + 1;
      employee.skill = clamp(employee.skill + 0.035, 0.55, 1.25);
      employee.speed = clamp(employee.speed + 0.035, 0.65, 1.32);
    }
    this.addAlert(`Staff training complete. Everyone is faster permanently. Level ${this.staffTrainingLevel}.`, "normal");
  }

  isOpenForCustomers() {
    return this.serviceState === "open" && !this.frontDoorLocked && this.time.minute < SCHEDULE.lastAdmission;
  }

  canWorkProcedureOvertime(employee) {
    if (this.serviceState === "closing") return true;
    if (this.serviceState !== "opening") return false;
    if (employee.task) return true;
    const minute = this.time.minute;
    return minute >= employee.shift[0] - 45 && minute <= employee.shift[1] + 75;
  }

  manageProcedures() {
    const minute = this.time.minute;
    if (this.serviceState === "closed" && this.openingGeneratedDay !== this.time.day && minute >= SCHEDULE.openingStart && minute < SCHEDULE.doorsOpen) {
      this.generateOpeningTasks();
    }
    if (this.autoOpen && this.serviceState === "opening" && minute >= SCHEDULE.doorsOpen) {
      this.openCafe(false);
    }
    if (this.autoClose && this.serviceState === "open" && minute >= SCHEDULE.lastCall && this.lastCallAnnouncedDay !== this.time.day) {
      this.lastCallAnnouncedDay = this.time.day;
      this.addAlert("Closing soon: last call is active.", "high");
    }
    if (this.autoClose && this.serviceState === "open" && minute >= SCHEDULE.closeAdmission) {
      this.closeAdmission(false);
      this.beginClosing(false);
    }
    if (this.serviceState === "closing") {
      this.promoteClosingPriorities();
    }
  }

  generateOpeningTasks() {
    this.openingGeneratedDay = this.time.day;
    this.activeBusinessDay = this.time.day;
    this.serviceState = "opening";
    this.frontDoorLocked = true;
    this.openSignOn = false;
    this.roomLights = { dining: false, bar: false, kitchen: false, back: true, exterior: true };
    this.setEquipmentPower("Off");
    this.openingChecklist = this.makeOpeningChecklist();
    for (const item of this.openingChecklist) this.tasks.add(buildProcedureTask(this, item));
  }

  generateClosingTasks() {
    if (this.closingGeneratedDay === this.time.day) return;
    this.closingGeneratedDay = this.time.day;
    this.closingChecklist = this.makeClosingChecklist();
    for (const item of this.closingChecklist) this.tasks.add(buildProcedureTask(this, item));
  }

  makeOpeningChecklist() {
    return [
      proc("lightsDining", "Turn on dining room lights", "opening", "allStaff", "normal", "entrance", 0.7, "Switching Dining Lights"),
      proc("lightsKitchen", "Turn on kitchen lights", "opening", "cook", "normal", "prepCounter", 0.7, "Switching Kitchen Lights"),
      proc("unlockDoor", "Unlock front entrance", "opening", "manager", "high", "entrance", 0.8, "Unlocking Front Door"),
      proc("pos", "Power on POS registers", "opening", "cashier", "high", "register", 1.1, "Starting POS"),
      proc("espresso", "Start espresso machine", "opening", "barista", "high", "espressoMachine", 2.5, "Heating Espresso Machine"),
      proc("brewer", "Brew first coffee batch", "opening", "barista", "normal", "coffeeBrewer", 2.1, "Brewing Coffee"),
      proc("grill", "Heat grill", "opening", "cook", "normal", "grill", 2.2, "Heating Grill"),
      proc("oven", "Preheat oven", "opening", "cook", "normal", "oven", 2.4, "Preheating Oven"),
      proc("pastry", "Stock pastry case", "opening", "barista", "normal", "pastryCase", 1.4, "Stocking Pastries", "pastry"),
      proc("milk", "Restock milk", "opening", "stocker", "normal", "milkFridge", 1.2, "Restocking Milk", "milk"),
      proc("breakfastPrep", "Prepare breakfast ingredients", "opening", "cook", "normal", "prepCounter", 2.8, "Preparing Breakfast"),
      proc("diningSetup", "Set up dining room", "opening", "cleaner", "low", "entrance", 1.5, "Setting Tables")
    ];
  }

  makeClosingChecklist() {
    return [
      proc("lockDoor", "Lock front entrance", "closing", "manager", "critical", "entrance", 0.8, "Locking Front Door"),
      proc("cleanTables", "Clean dining room tables", "closing", "cleaner", "high", "cleaning", 2.0, "Cleaning Dining Room", "cleaning"),
      proc("trash", "Take trash outside", "closing", "cleaner", "high", "trashArea", 1.4, "Bagging Trash", "trash"),
      proc("espressoClean", "Clean espresso machine", "closing", "barista", "normal", "espressoMachine", 2.2, "Cleaning Espresso Machine", "cleaning"),
      proc("grinderClean", "Clean grinder", "closing", "barista", "normal", "grinder", 1.3, "Cleaning Grinder", "cleaning"),
      proc("grillClean", "Clean and cool grill", "closing", "cook", "normal", "grill", 2.4, "Cleaning Grill", "cleaning"),
      proc("ovenOff", "Shut down oven", "closing", "cook", "normal", "oven", 1.6, "Shutting Down Oven"),
      proc("dishFinal", "Run final dishwasher load", "closing", "cleaner", "normal", "dishwasher", 2.0, "Running Dishwasher", "dishes"),
      proc("putAwayFood", "Store leftover ingredients", "closing", "cook", "normal", "walkIn", 1.7, "Storing Food", "ingredients"),
      proc("restockTomorrow", "Restock cups for tomorrow", "closing", "stocker", "low", "dryStorage", 1.4, "Restocking Cups", "box"),
      proc("lightsOff", "Turn off customer lights", "closing", "manager", "low", "entrance", 0.7, "Turning Off Lights"),
      proc("finalCheck", "Manager final building check", "closing", "manager", "low", "employeeArea", 1.4, "Final Check")
    ];
  }

  openCafe(manual = true) {
    if (this.serviceState === "open") return;
    const unlock = this.openingChecklist.find((item) => item.id === "unlockDoor");
    if (unlock && unlock.status !== "Done") {
      unlock.status = "Done";
      unlock.employee = manual ? "Player" : "Auto";
      unlock.completedAt = this.time.absoluteMinute;
    }
    this.serviceState = "open";
    this.frontDoorLocked = false;
    this.openSignOn = true;
    this.roomLights.dining = true;
    this.roomLights.bar = true;
    this.roomLights.kitchen = true;
    this.closingStats.openingReadinessAtOpen = this.openingReadiness();
    if (this.closingStats.openingReadinessAtOpen >= 80) {
      for (const item of this.openingChecklist.filter((entry) => entry.priority === "low" && entry.status === "Pending")) {
        item.status = "Done";
        item.employee = "Opening Crew";
        item.completedAt = this.time.absoluteMinute;
      }
      this.tasks.queue = this.tasks.queue.filter((task) => !(task.type === "opening" && this.openingChecklist.find((item) => item.id === task.checklistId)?.status === "Done"));
      this.tasks.sort();
    }
    this.addAlert(`${manual ? "Manual" : "Scheduled"} opening: front doors unlocked. Readiness ${this.closingStats.openingReadinessAtOpen}%.`, this.closingStats.openingReadinessAtOpen < 80 ? "high" : "normal");
  }

  closeAdmission(manual = true) {
    this.frontDoorLocked = true;
    this.openSignOn = false;
    this.addAlert(`${manual ? "Manual" : "Scheduled"} close admission: no new customers will enter.`, "high");
  }

  beginClosing(manual = true) {
    if (this.serviceState === "closing") return;
    this.serviceState = "closing";
    this.frontDoorLocked = true;
    this.openSignOn = false;
    this.generateClosingTasks();
    this.addAlert(`${manual ? "Manual" : "Scheduled"} closing procedures started. Existing customers can finish.`, "high");
  }

  setEquipmentPower(state) {
    for (const equipment of this.equipment) equipment.powerState = state;
  }

  openingReadiness() {
    return checklistPercent(this.openingChecklist);
  }

  closingCompletion() {
    return checklistPercent(this.closingChecklist);
  }

  completeProcedureItem(item) {
    if (item.phase === "opening") this.applyOpeningEffect(item.id);
    if (item.phase === "closing") this.applyClosingEffect(item.id);
  }

  applyOpeningEffect(id) {
    if (id === "lightsDining" || id === "diningSetup") this.roomLights.dining = true;
    if (id === "lightsKitchen" || id === "breakfastPrep") this.roomLights.kitchen = true;
    if (id === "pos") this.setEquipmentState(["register", "register2"], "Ready", "Ready");
    if (id === "espresso") this.setEquipmentState(["espressoMachine"], "Ready", "Ready");
    if (id === "brewer") this.setEquipmentState(["coffeeBrewer"], "Ready", "Ready");
    if (id === "grill") this.setEquipmentState(["grill"], "Ready", "Ready");
    if (id === "oven") this.setEquipmentState(["oven"], "Ready", "Ready");
    if (id === "unlockDoor" && this.serviceState === "open") this.frontDoorLocked = false;
    if (id === "breakfastPrep") this.prep.breakfast = { eggs: 1, pancakes: 1, grill: 1 };
  }

  applyClosingEffect(id) {
    if (id === "lockDoor") this.frontDoorLocked = true;
    if (id === "cleanTables") for (const table of this.tables) if (!table.occupied) table.dirty = 0;
    if (id === "trash") this.trashLevel = 0;
    if (id === "espressoClean") this.setEquipmentState(["espressoMachine"], "Off", "Off", 100);
    if (id === "grinderClean") this.setEquipmentState(["grinder"], "Off", "Off", 100);
    if (id === "grillClean") this.setEquipmentState(["grill"], "Off", "Off", 100);
    if (id === "ovenOff") this.setEquipmentState(["oven"], "Off", "Off");
    if (id === "lightsOff") this.roomLights.dining = false;
    if (id === "finalCheck") this.tryFinishClosingDay();
  }

  setEquipmentState(ids, status, powerState, cleanliness = null) {
    for (const id of ids) {
      const equipment = byId(this.equipment, id);
      if (!equipment) continue;
      equipment.status = status;
      equipment.powerState = powerState;
      if (cleanliness !== null) equipment.cleanliness = cleanliness;
    }
  }

  promoteClosingPriorities() {
    if (this.customers.length || this.orders.some((order) => !INACTIVE_ORDER_STATUSES.includes(order.status))) return;
    for (const task of this.tasks.queue) {
      if (task.type === "closing" && task.priority !== "critical") task.priority = "high";
    }
    this.tasks.sort();
    this.tryFinishClosingDay();
  }

  tryFinishClosingDay() {
    if (this.serviceState !== "closing") return;
    const unfinished = this.closingChecklist.filter((item) => item.status !== "Done").length;
    if (this.customers.length || this.orders.some((order) => !INACTIVE_ORDER_STATUSES.includes(order.status)) || unfinished) return;
    this.serviceState = "closed";
    this.roomLights = { dining: false, bar: false, kitchen: false, back: false, exterior: true };
    this.setEquipmentPower("Off");
    this.closingStats.closingCompletion = this.closingCompletion();
    this.closingStats.unfinishedTasks = unfinished;
    this.closingStats.tomorrowReadiness = Math.round((this.closingStats.closingCompletion + this.openingReadiness()) / 2);
    this.addAlert("Closing complete. Staff are leaving and the cafe is shut down.", "normal");
    this.finishDayReport();
  }

  update(realDt) {
    const advancedMinutes = this.time.tick(realDt, this);
    this.manageProcedures();
    this.spawnCustomers(realDt);
    this.systemAccumulator += realDt;
    this.autosaveAccumulator += realDt;
    for (const employee of this.employees) employee.update(realDt, this);
    for (const customer of this.customers) customer.update(realDt, this);
    this.customers = this.customers.filter((customer) => !customer.remove);
    this.cleanupOrphanOrders();
    this.updateDeliveries(realDt);
    this.updateSystems(realDt, advancedMinutes);
    if (this.autosaveAccumulator > 30) {
      this.autosaveAccumulator = 0;
      this.save();
    }
  }

  updateSystems(realDt, advancedMinutes) {
    if (this.systemAccumulator < 0.8) return;
    this.systemAccumulator = 0;
    this.scanStationInventory();
    this.scanCleaning();
    this.scanEquipment();
    this.advancePrep();
    this.stats.maxCustomers = Math.max(this.stats.maxCustomers, this.customers.length);
    if (advancedMinutes) {
      this.economy.utilities += advancedMinutes * 0.18;
      this.money -= advancedMinutes * 0.18;
      const laborRate = this.hustleActive ? 1.12 : 1;
      const labor = this.employees.filter((employee) => employee.onShift).reduce((sum, employee) => sum + employee.wage / 60 * advancedMinutes * laborRate * 0.42, 0);
      this.economy.labor += labor;
      this.money -= labor;
    }
  }

  spawnCustomers(realDt) {
    const period = this.time.period;
    if (!this.isOpenForCustomers()) return;
    if (period.demand <= 0 || this.customers.length > 85) return;
    const weekendBoost = this.time.dayIndex >= 5 && ["breakfast", "lunch"].includes(period.key) ? 1.3 : 1;
    const rushBoost = this.rushMultiplier(this.time.minute);
    this.spawnAccumulator += realDt * this.time.speed * period.demand * weekendBoost * rushBoost;
    const threshold = 13;
    while (this.spawnAccumulator >= threshold) {
      this.spawnAccumulator -= threshold;
      this.customers.push(new Customer(this.makeCustomerProfile(period), this.customers.length));
    }
  }

  rushMultiplier(minute) {
    const windows = [
      [7 * 60 + 15, 8 * 60 + 45, 1.55],
      [11 * 60 + 45, 13 * 60, 1.75],
      [15 * 60, 16 * 60, 1.25],
      [18 * 60, 19 * 60 + 30, 1.45]
    ];
    return windows.find(([start, end]) => minute >= start && minute <= end)?.[2] || 1;
  }

  makeCustomerProfile(period) {
    const groupSize = weightedChoice([
      { value: 1, weight: period.key === "dinner" ? 4 : 8 },
      { value: 2, weight: 5 },
      { value: 3, weight: period.key === "dinner" ? 3 : 1 },
      { value: 4, weight: period.key === "dinner" ? 2 : 1 }
    ]);
    return {
      name: choice(CUSTOMER_NAMES),
      color: choice(CUSTOMER_COLORS),
      patience: 42 + Math.random() * (period.key === "lunch" ? 24 : 32),
      budget: 8 + Math.random() * (period.key === "dinner" ? 26 : 16),
      groupSize,
      dineIn: Math.random() < (period.key === "earlyCafe" ? 0.25 : period.key === "dinner" ? 0.78 : 0.55),
      preference: period.key,
      cleanExpectation: 55 + Math.random() * 35
    };
  }

  reserveQueueSlot(customer) {
    const slot = this.queueSlots.find((item) => !item.customerId);
    if (slot) slot.customerId = customer.id;
    return slot;
  }

  releaseQueueSlot(slotId) {
    const slot = this.queueSlots.find((item) => item.id === slotId);
    if (slot) slot.customerId = null;
    this.compactQueue();
  }

  compactQueue() {
    const queued = this.customers.filter((customer) => customer.state === "Queued").sort((a, b) => this.queueIndex(a.queueSlot) - this.queueIndex(b.queueSlot));
    for (const slot of this.queueSlots) slot.customerId = null;
    queued.forEach((customer, index) => {
      const slot = this.queueSlots[index];
      if (slot) {
        slot.customerId = customer.id;
        customer.queueSlot = slot.id;
      }
    });
  }

  queueIndex(slotId) {
    return this.queueSlots.findIndex((item) => item.id === slotId);
  }

  hasTaskForCustomer(customerId) {
    return this.tasks.queue.some((task) => task.customerId === customerId) || this.employees.some((employee) => employee.task?.customerId === customerId);
  }

  activeRegisterCount() {
    const onShift = this.employees.filter((employee) => employee.onShift);
    const trainedFront = onShift.filter((employee) => ["cashier", "manager", "barista", "cook"].includes(employee.role)).length;
    return Math.max(1, Math.min(2, trainedFront));
  }

  buildTakeOrderTask(customerId, laneIndex = 0) {
    const customer = byId(this.customers, customerId);
    const index = Math.max(0, laneIndex ?? (customer ? this.queueIndex(customer.queueSlot) : 0));
    return buildTakeOrderTask(this, customerId, index === 1 ? "register2" : "register");
  }

  takeCustomerOrder(customerId) {
    const customer = byId(this.customers, customerId);
    if (!customer || customer.state === "Leaving") return;
    const recipeId = this.chooseRecipeForCustomer(customer);
    const recipe = RECIPES[recipeId];
    customer.recipeId = recipeId;
    this.releaseQueueSlot(customer.queueSlot);
    customer.queueSlot = null;
    const availability = this.inventory.canMake(recipe);
    if (availability.missingTotal.length) {
      customer.satisfaction -= 0.4;
      this.stats.customersLost += 1;
      this.addAlert(`${recipe.label} unavailable: ${availability.missingTotal.map((id) => INGREDIENTS[id].label).join(", ")}`, "high");
      customer.leave(this);
      return;
    }
    if (availability.missingStation.length) {
      for (const ingredientId of availability.missingStation) {
        this.tasks.add(buildRestockTask(this, recipe.station, ingredientId, true));
      }
      customer.satisfaction -= 0.08;
    }
    const partyTicketMultiplier = 0.85 + customer.groupSize * 0.55;
    const ticketTotal = Math.round(recipe.price * partyTicketMultiplier);
    const order = {
      id: uid("order"),
      customerId,
      recipeId,
      label: recipe.label,
      status: availability.missingStation.length ? "Waiting for Restock" : "Queued",
      createdAt: this.time.absoluteMinute,
      employee: null,
      paid: ticketTotal,
      wait: 0
    };
    this.orders.push(order);
    customer.orderId = order.id;
    customer.state = "WaitingPickup";
    customer.waitMinutes = 0;
    this.money += ticketTotal;
    this.economy.revenue += ticketTotal;
    this.economy.ingredients += this.recipeCost(recipe);
    this.money -= this.recipeCost(recipe);
    if (!availability.missingStation.length) this.tasks.add(buildOrderTask(this, order));
  }

  chooseRecipeForCustomer(customer) {
    const period = this.time.period.key;
    const pool = Object.entries(RECIPES).filter(([, recipe]) => {
      if (recipe.period === "all") return true;
      if (recipe.period === period) return true;
      if (recipe.period === "lunchDinner" && ["lunch", "dinner"].includes(period)) return true;
      return false;
    });
    const weighted = pool.map(([id, recipe]) => {
      let weight = recipe.period === "all" ? 2 : 5;
      if (period === "earlyCafe" && ["espresso", "latte", "pastry"].includes(id)) weight += 5;
      if (period === "afternoon" && ["latte", "icedTea", "pastry"].includes(id)) weight += 4;
      if (period === "dinner" && ["dinnerPlate", "burger", "dessert"].includes(id)) weight += 5;
      if (recipe.price > customer.budget) weight *= 0.25;
      return { value: id, weight };
    });
    return weightedChoice(weighted);
  }

  recipeCost(recipe) {
    return Object.entries(recipe.ingredients).reduce((sum, [id, amount]) => sum + (INGREDIENTS[id].cost * amount * 0.28), 0);
  }

  completeOrder(orderId) {
    const order = byId(this.orders, orderId);
    if (!order) return;
    order.status = "Ready";
    order.readyAt = this.time.absoluteMinute;
    const customer = byId(this.customers, order.customerId);
    if (customer) {
      const wait = this.time.absoluteMinute - order.createdAt;
      this.stats.totalWait += Math.max(0, wait);
      customer.satisfaction = clamp(customer.satisfaction + 0.1 - Math.max(0, wait - 12) * 0.01, 0, 1.1);
    }
    this.stats.ordersCompleted += 1;
    this.stats.customersServed += 1;
  }

  releaseWaitingOrders() {
    for (const order of this.orders.filter((item) => item.status === "Waiting for Restock")) {
      const recipe = RECIPES[order.recipeId];
      if (this.inventory.canMake(recipe).ok && !this.tasks.queue.some((task) => task.orderId === order.id) && !this.employees.some((employee) => employee.task?.orderId === order.id)) {
        order.status = "Queued";
        this.tasks.add(buildOrderTask(this, order));
      }
    }
  }

  cleanupOrphanOrders() {
    for (const order of this.orders) {
      if (order.status !== "Ready") continue;
      if (this.customers.some((customer) => customer.id === order.customerId)) continue;
      order.status = "Abandoned";
      const recipe = RECIPES[order.recipeId];
      const waste = recipe ? this.recipeCost(recipe) : 0;
      this.economy.waste += waste;
      this.closingStats.waste += waste;
    }
  }

  refundOrLoseCustomer(customer, reason) {
    if (customer.orderId) {
      const order = byId(this.orders, customer.orderId);
      if (order && !["Ready", "Picked Up"].includes(order.status)) {
        this.money -= order.paid;
        this.economy.refunds += order.paid;
        order.status = "Refunded";
      }
    }
    this.stats.customersLost += 1;
    this.addAlert(`${customer.name} ${reason}.`, "high");
  }

  scanStationInventory() {
    for (const low of this.inventory.lowStationItems()) {
      this.tasks.add(buildRestockTask(this, low.stationId, low.ingredientId, low.critical));
      if (low.critical) this.addAlert(`${INGREDIENTS[low.ingredientId].label} nearly empty at ${low.stationId}.`, "high", 22);
    }
    for (const id of this.inventory.outOfStock()) {
      this.addAlert(`${INGREDIENTS[id].label} out of stock.`, "critical", 40);
    }
  }

  scanCleaning() {
    for (const table of this.tables) {
      if (!table.occupied && table.dirty > 45) this.tasks.add(buildCleanTableTask(this, table.id));
    }
    if (this.trashLevel > 72) this.tasks.add(buildTrashTask(this));
  }

  scanEquipment() {
    for (const equipment of this.equipment) {
      equipment.condition = clamp(equipment.condition - 0.006 * this.time.speed, 0, 100);
      equipment.cleanliness = clamp(equipment.cleanliness - 0.014 * this.time.speed, 0, 100);
      if (equipment.condition < 24) {
        equipment.status = "Needs Repair";
        this.tasks.add(buildMaintenanceTask(this, equipment.id));
        this.addAlert(`${equipment.label} needs repair.`, "critical", 35);
      } else if (equipment.cleanliness < 35) {
        equipment.status = "Needs Cleaning";
        this.tasks.add(buildCleanEquipmentTask(this, equipment.id));
        this.addAlert(`${equipment.label} requires cleaning.`, "high", 35);
      } else {
        equipment.status = "Ready";
      }
    }
  }

  advancePrep() {
    const period = this.time.period.key;
    if (period === "transition") {
      this.prep.lunch.chicken = clamp(this.prep.lunch.chicken + 0.018, 0, 1);
      this.prep.lunch.soup = clamp(this.prep.lunch.soup + 0.015, 0, 1);
      this.prep.lunch.sandwichStation = clamp(this.prep.lunch.sandwichStation + 0.02, 0, 1);
      this.prep.lunch.grill = clamp(this.prep.lunch.grill + 0.016, 0, 1);
    }
    if (period === "afternoon") {
      this.prep.dinner.entrees = clamp(this.prep.dinner.entrees + 0.012, 0, 1);
      this.prep.dinner.oven = clamp(this.prep.dinner.oven + 0.014, 0, 1);
      this.prep.dinner.plating = clamp(this.prep.dinner.plating + 0.011, 0, 1);
    }
    if (period === "lunch" && Object.values(this.prep.lunch).some((value) => value < 0.85)) {
      this.addAlert("Lunch preparation is behind schedule; lunch items will move slower.", "high", 45);
    }
  }

  placeEmergencyDelivery() {
    const active = this.deliveries.some((delivery) => ["Traveling", "Arriving", "Unloading"].includes(delivery.status));
    if (active) {
      this.addAlert("A delivery is already active.", "normal");
      return;
    }
    const pack = this.inventory.deliveryPack();
    const boxes = Object.entries(pack).map(([ingredientId, amount]) => ({
      id: uid("box"),
      ingredientId,
      amount,
      status: "Waiting"
    }));
    const delivery = {
      id: uid("delivery"),
      type: "Emergency",
      orderedAt: this.time.absoluteMinute,
      arriveAt: this.time.absoluteMinute + 20,
      status: "Traveling",
      x: WORLD.width + 190,
      y: 612,
      boxes,
      announced: false
    };
    this.deliveries.push(delivery);
    this.money -= 80;
    this.economy.deliveryFees += 80;
    this.addAlert("Emergency delivery ordered. Truck ETA: 20 in-game minutes.", "normal");
  }

  updateDeliveries(realDt) {
    for (const delivery of this.deliveries) {
      if (delivery.status === "Traveling" && this.time.absoluteMinute >= delivery.arriveAt) {
        delivery.status = "Arriving";
        this.addAlert("Delivery truck arrived at the loading entrance.", "high");
      }
      if (delivery.status === "Arriving") {
        delivery.x = Math.max(902, delivery.x - realDt * this.time.speed * 95);
        if (delivery.x <= 902) {
          delivery.status = "Unloading";
          this.addAlert("Unloading started. Stockers will carry boxes into storage.", "normal");
        }
      }
      if (delivery.status === "Unloading") {
        for (const box of delivery.boxes.filter((box) => box.status === "Waiting").slice(0, 4)) {
          const task = buildUnloadTask(this, delivery.id, box.id);
          if (task) this.tasks.add(task);
        }
        if (delivery.boxes.every((box) => box.status === "Stored")) {
          delivery.status = "Leaving";
          this.addAlert("Delivery complete. Truck leaving.", "normal");
        }
      }
      if (delivery.status === "Leaving") {
        delivery.x += realDt * this.time.speed * 120;
        if (delivery.x > WORLD.width + 220) delivery.status = "Complete";
      }
    }
  }

  destinationForStep(step) {
    if (step.type === "table") {
      const table = byId(this.tables, step.tableId);
      return table ? { x: table.x + 40, y: table.y + 34 } : null;
    }
    if (step.type === "delivery") {
      const delivery = byId(this.deliveries, step.deliveryId);
      return delivery ? { x: delivery.x + 42, y: delivery.y + 24 } : null;
    }
    const object = byId(this.objects, step.objectId);
    return object ? { x: object.spot[0], y: object.spot[1] } : null;
  }

  destinationForObject(objectId) {
    const object = byId(this.objects, objectId);
    return object ? { x: object.spot[0], y: object.spot[1] } : null;
  }

  objectAt(x, y) {
    const employee = [...this.employees].reverse().find((npc) => Math.hypot(npc.x - x, npc.y - y) < 15);
    if (employee) return { type: "employee", item: employee };
    const customer = [...this.customers].reverse().find((npc) => Math.hypot(npc.x - x, npc.y - y) < 13);
    if (customer) return { type: "customer", item: customer };
    const table = this.tables.find((item) => rectContains({ x: item.x - 32, y: item.y - 24, w: 64, h: 52 }, x, y));
    if (table) return { type: "table", item: table };
    const object = this.objects.find((item) => item.type !== "marker" && item.type !== "wall" && rectContains(item, x, y));
    if (object) {
      const equipment = byId(this.equipment, object.id);
      return { type: equipment ? "equipment" : object.type, item: equipment || object };
    }
    const delivery = this.deliveries.find((item) => item.status !== "Complete" && rectContains({ x: item.x, y: item.y, w: 150, h: 72 }, x, y));
    if (delivery) return { type: "delivery", item: delivery };
    return null;
  }

  select(selection) {
    this.selected = selection;
  }

  onServicePeriodChanged(period) {
    this.addAlert(`${period.label} mode started: ${period.note}.`, period.key === "lunch" || period.key === "dinner" ? "high" : "normal");
    if (period.key === "transition") this.addAlert("Breakfast to lunch changeover: stations need preparation and restocking.", "high");
    if (period.key === "dinner" && Object.values(this.prep.dinner).some((value) => value < 0.75)) {
      this.addAlert("Dinner service started before all prep finished.", "high");
    }
  }

  addAlert(message, level = "normal", cooldown = 8) {
    const now = this.time.absoluteMinute;
    const recent = this.alerts.find((alert) => alert.message === message && now - alert.minute < cooldown);
    if (recent) return;
    this.alerts.unshift({ id: uid("alert"), message, level, minute: now });
    this.alerts = this.alerts.slice(0, 18);
  }

  closeDay() {
    if (this.serviceState === "closing" || this.customers.length || this.orders.some((order) => !INACTIVE_ORDER_STATUSES.includes(order.status))) {
      this.addAlert("Midnight passed, but the business day stays active until closing is complete.", "high", 120);
      return;
    }
    if (this.reportedDay === this.activeBusinessDay) return;
    if (this.serviceState === "closed") return;
    this.finishDayReport();
  }

  finishDayReport() {
    if (this.reportedDay === this.activeBusinessDay) return;
    const report = {
      day: this.activeBusinessDay,
      revenue: this.economy.revenue,
      ingredients: this.economy.ingredients,
      labor: this.economy.labor,
      utilities: this.economy.utilities,
      deliveryFees: this.economy.deliveryFees,
      maintenance: this.economy.maintenance,
      refunds: this.economy.refunds,
      openingReadiness: this.closingStats.openingReadinessAtOpen,
      closingCompletion: this.closingStats.closingCompletion,
      overtime: Math.round(this.closingStats.overtime),
      waste: Math.round(this.closingStats.waste),
      unfinishedTasks: this.closingStats.unfinishedTasks,
      tomorrowReadiness: this.closingStats.tomorrowReadiness,
      net: this.economy.revenue - this.economy.ingredients - this.economy.labor - this.economy.utilities - this.economy.deliveryFees - this.economy.maintenance - this.economy.refunds,
      customers: this.stats.customersServed,
      orders: this.stats.ordersCompleted
    };
    this.reportedDay = this.activeBusinessDay;
    this.dayReports.unshift(report);
    this.economy = { revenue: 0, ingredients: 0, labor: 0, utilities: 0, maintenance: 0, deliveryFees: 0, waste: 0, refunds: 0 };
    this.addAlert(`Day ${report.day} closed. Net profit: ${Math.round(report.net)}.`, report.net >= 0 ? "normal" : "high");
  }

  save() {
    const data = {
      time: this.time.snapshot(),
      inventory: this.inventory.snapshot(),
      money: this.money,
      economy: this.economy,
      stats: this.stats,
      equipment: this.equipment,
      tables: this.tables,
      prep: this.prep,
      trashLevel: this.trashLevel,
      dayReports: this.dayReports,
      serviceState: this.serviceState,
      autoOpen: this.autoOpen,
      autoClose: this.autoClose,
      frontDoorLocked: this.frontDoorLocked,
      openSignOn: this.openSignOn,
      roomLights: this.roomLights,
      openingChecklist: this.openingChecklist,
      closingChecklist: this.closingChecklist,
      closingStats: this.closingStats,
      reportedDay: this.reportedDay,
      activeBusinessDay: this.activeBusinessDay
      ,
      hustleUntil: this.hustleUntil,
      staffTrainingLevel: this.staffTrainingLevel,
      employeeTraining: this.employees.map((employee) => ({
        name: employee.name,
        skill: employee.skill,
        speed: employee.speed,
        training: employee.training || 0
      }))
    };
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("modeCafeSave", JSON.stringify(data));
    }
    return data;
  }

  load() {
    if (typeof localStorage === "undefined") return false;
    const raw = localStorage.getItem("modeCafeSave");
    if (!raw) {
      this.addAlert("No save found yet.", "normal");
      return false;
    }
    const data = JSON.parse(raw);
    this.time.restore(data.time);
    this.inventory.restore(data.inventory);
    this.money = data.money;
    this.economy = data.economy;
    this.stats = data.stats;
    this.equipment = data.equipment;
    this.tables = data.tables;
    this.prep = data.prep;
    this.trashLevel = data.trashLevel;
    this.dayReports = data.dayReports || [];
    this.serviceState = data.serviceState || "opening";
    this.autoOpen = data.autoOpen ?? true;
    this.autoClose = data.autoClose ?? true;
    this.frontDoorLocked = data.frontDoorLocked ?? true;
    this.openSignOn = data.openSignOn ?? false;
    this.roomLights = data.roomLights || this.roomLights;
    this.openingChecklist = data.openingChecklist || [];
    this.closingChecklist = data.closingChecklist || [];
    this.closingStats = data.closingStats || this.closingStats;
    this.reportedDay = data.reportedDay || 0;
    this.activeBusinessDay = data.activeBusinessDay || this.time.day;
    this.hustleUntil = data.hustleUntil || 0;
    this.staffTrainingLevel = data.staffTrainingLevel || 0;
    for (const saved of data.employeeTraining || []) {
      const employee = this.employees.find((item) => item.name === saved.name);
      if (employee) {
        employee.skill = saved.skill ?? employee.skill;
        employee.speed = saved.speed ?? employee.speed;
        employee.training = saved.training || 0;
      }
    }
    this.customers = [];
    this.orders = [];
    this.deliveries = [];
    this.tasks.clear();
    this.addAlert("Game loaded.", "normal");
    return true;
  }
}

function proc(id, label, phase, role, priority, objectId, duration, actionLabel, carry = null) {
  return {
    id,
    label,
    phase,
    role,
    priority,
    status: "Pending",
    employee: null,
    steps: [
      { objectId, label: actionLabel, duration, carry }
    ]
  };
}

function checklistPercent(items) {
  if (!items?.length) return 0;
  return Math.round(items.filter((item) => item.status === "Done").length / items.length * 100);
}
