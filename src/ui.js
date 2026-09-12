import { INGREDIENTS, RECIPES } from "./data.js";
import { money, percent } from "./utils.js";

export class UI {
  constructor(game, renderer) {
    this.game = game;
    this.renderer = renderer;
    this.activeTab = "inspect";
    this.bind();
  }

  bind() {
    document.querySelectorAll(".speed").forEach((button) => {
      button.addEventListener("click", () => {
        this.game.time.speed = Number(button.dataset.speed);
        this.game.time.paused = false;
        document.querySelectorAll(".speed").forEach((item) => item.classList.toggle("active", item === button));
        document.getElementById("pauseBtn").textContent = "Pause";
      });
    });
    document.getElementById("pauseBtn").addEventListener("click", () => {
      this.game.time.paused = !this.game.time.paused;
      document.getElementById("pauseBtn").textContent = this.game.time.paused ? "Resume" : "Pause";
    });
    document.getElementById("deliveryBtn").addEventListener("click", () => this.game.placeEmergencyDelivery());
    document.getElementById("hustleBtn").addEventListener("click", () => this.game.startHustleShift());
    document.getElementById("trainBtn").addEventListener("click", () => this.game.trainStaff());
    document.getElementById("openCafeBtn").addEventListener("click", () => this.game.openCafe(true));
    document.getElementById("closeAdmissionBtn").addEventListener("click", () => this.game.closeAdmission(true));
    document.getElementById("beginClosingBtn").addEventListener("click", () => this.game.beginClosing(true));
    document.getElementById("autoOpenBtn").addEventListener("click", () => {
      this.game.autoOpen = !this.game.autoOpen;
      this.game.addAlert(`Auto open ${this.game.autoOpen ? "enabled" : "disabled"}.`, "normal");
    });
    document.getElementById("autoCloseBtn").addEventListener("click", () => {
      this.game.autoClose = !this.game.autoClose;
      this.game.addAlert(`Auto close ${this.game.autoClose ? "enabled" : "disabled"}.`, "normal");
    });
    document.getElementById("saveBtn").addEventListener("click", () => {
      this.game.save();
      this.game.addAlert("Game saved.", "normal");
    });
    document.getElementById("loadBtn").addEventListener("click", () => this.game.load());
    document.getElementById("resetBtn").addEventListener("click", () => {
      localStorage.removeItem("modeCafeSave");
      window.location.reload();
    });
    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        this.activeTab = button.dataset.tab;
        document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button));
        this.renderPanel();
      });
    });
    this.renderer.canvas.addEventListener("click", (event) => {
      const rect = this.renderer.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (this.renderer.canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (this.renderer.canvas.height / rect.height);
      const selection = this.game.objectAt(x, y);
      this.game.select(selection);
      this.activeTab = "inspect";
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item.dataset.tab === "inspect"));
      this.renderPanel();
    });
  }

  render() {
    const period = this.game.time.period;
    document.getElementById("hudTime").textContent = this.game.time.displayClock();
    document.getElementById("hudDay").textContent = this.game.time.displayDay();
    document.getElementById("hudService").textContent = this.game.serviceState === "open" ? period.label : stateLabel(this.game.serviceState);
    document.getElementById("hudCash").textContent = money(this.game.money);
    document.getElementById("hudCustomers").textContent = String(this.game.customers.length);
    document.getElementById("hudOrders").textContent = String(this.game.orders.filter((order) => !["Picked Up", "Refunded", "Abandoned"].includes(order.status)).length);
    const avg = this.game.stats.ordersCompleted ? this.game.stats.totalWait / this.game.stats.ordersCompleted : 0;
    document.getElementById("hudWait").textContent = `${Math.round(avg)}m`;
    document.getElementById("serviceLine").textContent = `${stateLabel(this.game.serviceState)}: ${this.game.frontDoorLocked ? "doors locked" : "doors open"} | ${period.mode} mode: ${period.note}`;
    document.getElementById("hustleBtn").textContent = this.game.hustleActive ? `Hustle ${this.game.hustleMinutesLeft}m` : "Hustle Shift";
    document.getElementById("hustleBtn").classList.toggle("active", this.game.hustleActive);
    document.getElementById("autoOpenBtn").textContent = `Auto Open: ${this.game.autoOpen ? "On" : "Off"}`;
    document.getElementById("autoCloseBtn").textContent = `Auto Close: ${this.game.autoClose ? "On" : "Off"}`;
    document.getElementById("openCafeBtn").disabled = this.game.serviceState === "open";
    document.getElementById("beginClosingBtn").disabled = this.game.serviceState === "closing";
    this.renderPanel();
    this.renderAlerts();
  }

  renderAlerts() {
    document.getElementById("alerts").innerHTML = this.game.alerts
      .slice(0, 8)
      .map((alert) => `<div class="alert ${alert.level}">${escapeHtml(alert.message)}</div>`)
      .join("");
  }

  renderPanel() {
    const panel = document.getElementById("panel");
    const renderers = {
      inspect: () => this.inspectPanel(),
      staff: () => this.staffPanel(),
      orders: () => this.ordersPanel(),
      inventory: () => this.inventoryPanel(),
      equipment: () => this.equipmentPanel(),
      finances: () => this.financesPanel(),
      stats: () => this.statsPanel()
    };
    panel.innerHTML = renderers[this.activeTab]();
  }

  inspectPanel() {
    const selection = this.game.selected;
    if (!selection) {
      return `<div class="card"><h3>Inspect</h3><p>Click an employee, customer, table, station, storage area, equipment, or delivery truck to inspect it.</p></div>${this.procedureCard()}${this.prepCard()}`;
    }
    const item = selection.item;
    if (selection.type === "employee") {
      const task = item.task;
      const step = task?.steps[item.stepIndex];
      const progress = step ? item.stepProgress / step.duration : 0;
      return `<div class="card"><h3>${item.name}</h3><div class="meta">
        <span>Role</span><strong>${item.label}</strong>
        <span>Current Task</span><strong>${task?.label || item.activity}</strong>
        <span>Destination</span><strong>${step?.objectId || step?.tableId || "None"}</strong>
        <span>Carrying</span><strong>${item.carry || "Nothing"}</strong>
        <span>Status</span><strong>${item.activity}</strong>
        <span>Energy</span><strong>${Math.round(item.energy)}%</strong>
        <span>Speed Boost</span><strong>${Math.round(this.game.staffActionMultiplier(item) * 100)}%</strong>
      </div><div class="bar"><i style="width:${percent(progress)}"></i></div></div>`;
    }
    if (selection.type === "customer") {
      return `<div class="card"><h3>${item.name}</h3><div class="meta">
        <span>State</span><strong>${item.state}</strong>
        <span>Activity</span><strong>${item.activity}</strong>
        <span>Order</span><strong>${item.recipeId ? RECIPES[item.recipeId].label : "None"}</strong>
        <span>Group</span><strong>${item.groupSize}</strong>
        <span>Dine In</span><strong>${item.dineIn ? "Yes" : "No"}</strong>
        <span>Satisfaction</span><strong>${Math.round(item.satisfaction * 100)}%</strong>
      </div></div>`;
    }
    if (selection.type === "equipment") {
      return `<div class="card"><h3>${item.label}</h3><div class="meta">
        <span>Status</span><strong>${item.status}</strong>
        <span>Condition</span><strong>${Math.round(item.condition)}%</strong>
        <span>Cleanliness</span><strong>${Math.round(item.cleanliness)}%</strong>
      </div><div class="bar"><i style="width:${item.condition}%"></i></div><div class="bar"><i style="width:${item.cleanliness}%"></i></div></div>`;
    }
    if (selection.type === "table") {
      return `<div class="card"><h3>Table ${item.id.toUpperCase()}</h3><div class="meta">
        <span>Seats</span><strong>${item.seats}</strong>
        <span>Occupied</span><strong>${item.occupied ? "Yes" : "No"}</strong>
        <span>Dirty</span><strong>${Math.round(item.dirty)}%</strong>
      </div></div>`;
    }
    if (selection.type === "storage") {
      const stock = Object.entries(this.game.inventory.main)
        .filter(([id]) => INGREDIENTS[id].storage === item.id)
        .map(([id, value]) => `<span class="pill">${INGREDIENTS[id].label}: ${value}</span>`)
        .join("");
      return `<div class="card"><h3>${item.label}</h3>${stock}</div>`;
    }
    if (selection.type === "delivery") {
      const waiting = item.boxes.filter((box) => box.status !== "Stored").length;
      return `<div class="card"><h3>${item.type} Delivery</h3><div class="meta"><span>Status</span><strong>${item.status}</strong><span>Boxes Left</span><strong>${waiting}</strong></div></div>`;
    }
    return `<div class="card"><h3>${item.label || selection.type}</h3></div>`;
  }

  staffPanel() {
    const header = `<div class="card"><h3>Staff Speed</h3><div class="meta">
        <span>Hustle</span><strong>${this.game.hustleActive ? `${this.game.hustleMinutesLeft} min left` : "Inactive"}</strong>
        <span>Training</span><strong>Level ${this.game.staffTrainingLevel}</strong>
        <span>Hustle Cost</span><strong>$45 / 60 min</strong>
        <span>Next Training</span><strong>${money(120 + this.game.staffTrainingLevel * 55)}</strong>
      </div><p>Cooks and baristas cross-cover register and simple orders when their main station is quiet.</p></div>`;
    return header + this.game.employees
      .map((employee) => `<div class="card"><h3>${employee.name} <span class="pill">${employee.label}</span></h3><div class="meta">
        <span>Status</span><strong>${employee.onShift ? employee.activity : "Off Shift"}</strong>
        <span>Task</span><strong>${employee.task?.label || "None"}</strong>
        <span>Carrying</span><strong>${employee.carry || "Nothing"}</strong>
        <span>Training</span><strong>Level ${employee.training || 0}</strong>
        <span>Work Speed</span><strong>${Math.round(this.game.staffActionMultiplier(employee) * 100)}%</strong>
        <span>Can Help</span><strong>${helpRoles(employee.role)}</strong>
        <span>Wage</span><strong>${money(employee.wage)}/hr</strong>
      </div></div>`)
      .join("");
  }

  ordersPanel() {
    const active = this.game.orders.filter((order) => !["Picked Up", "Refunded", "Abandoned"].includes(order.status)).slice(-18).reverse();
    if (!active.length) return `<div class="card"><h3>Orders</h3><p>No active orders yet.</p></div>`;
    return active.map((order) => `<div class="card"><h3>${order.label}</h3><div class="meta">
      <span>Status</span><strong>${order.status}</strong>
      <span>Employee</span><strong>${order.employee || "Unassigned"}</strong>
      <span>Paid</span><strong>${money(order.paid)}</strong>
    </div></div>`).join("");
  }

  inventoryPanel() {
    const stations = Object.entries(this.game.inventory.stations).map(([station, stock]) => `<div class="card"><h3>${labelStation(station)}</h3>${Object.entries(stock).map(([id, value]) => `<span class="pill">${INGREDIENTS[id].label}: ${value}</span>`).join("")}</div>`).join("");
    const main = `<div class="card"><h3>Main Storage</h3>${Object.entries(this.game.inventory.main).map(([id, value]) => `<span class="pill">${INGREDIENTS[id].label}: ${value}</span>`).join("")}</div>`;
    return `${stations}${main}`;
  }

  equipmentPanel() {
    return this.game.equipment.map((equipment) => `<div class="card"><h3>${equipment.label}</h3><div class="meta">
      <span>Status</span><strong>${equipment.status}</strong>
      <span>Condition</span><strong>${Math.round(equipment.condition)}%</strong>
      <span>Cleanliness</span><strong>${Math.round(equipment.cleanliness)}%</strong>
    </div></div>`).join("");
  }

  financesPanel() {
    const e = this.game.economy;
    const net = e.revenue - e.ingredients - e.labor - e.utilities - e.deliveryFees - e.maintenance - e.refunds - e.waste;
    return `<div class="card"><h3>Today</h3><div class="meta">
      <span>Revenue</span><strong>${money(e.revenue)}</strong>
      <span>Ingredients</span><strong>-${money(e.ingredients)}</strong>
      <span>Labor</span><strong>-${money(e.labor)}</strong>
      <span>Utilities</span><strong>-${money(e.utilities)}</strong>
      <span>Delivery Fees</span><strong>-${money(e.deliveryFees)}</strong>
      <span>Repairs</span><strong>-${money(e.maintenance)}</strong>
      <span>Refunds</span><strong>-${money(e.refunds)}</strong>
      <span>Net</span><strong>${money(net)}</strong>
    </div></div>${this.game.dayReports.slice(0, 3).map((r) => `<div class="card"><h3>Day ${r.day}</h3><div class="meta"><span>Customers</span><strong>${r.customers}</strong><span>Orders</span><strong>${r.orders}</strong><span>Net</span><strong>${money(r.net)}</strong></div></div>`).join("")}`;
  }

  statsPanel() {
    const s = this.game.stats;
    return `<div class="card"><h3>Business Stats</h3><div class="meta">
      <span>Served</span><strong>${s.customersServed}</strong>
      <span>Lost</span><strong>${s.customersLost}</strong>
      <span>Orders</span><strong>${s.ordersCompleted}</strong>
      <span>Boxes Unloaded</span><strong>${s.boxesUnloaded}</strong>
      <span>Dishes Washed</span><strong>${s.dishesWashed}</strong>
      <span>Peak Customers</span><strong>${s.maxCustomers}</strong>
      <span>Trash</span><strong>${Math.round(this.game.trashLevel)}%</strong>
    </div></div>${this.procedureCard()}${this.prepCard()}`;
  }

  procedureCard() {
    const phase = this.game.serviceState === "closing" || this.game.closingChecklist.some((item) => item.status !== "Pending") ? "closing" : "opening";
    const items = phase === "closing" ? this.game.closingChecklist : this.game.openingChecklist;
    const done = items.filter((item) => item.status === "Done").length;
    const total = items.length || 1;
    const title = phase === "closing" ? "Closing" : "Opening";
    const percentDone = Math.round(done / total * 100);
    const rows = items.map((item) => {
      const mark = item.status === "Done" ? "✓" : item.status === "In Progress" ? "…" : "○";
      const worker = item.employee ? ` <span class="pill">${escapeHtml(item.employee)}</span>` : "";
      return `<div class="checkline ${item.status === "Done" ? "done" : ""}"><span>${mark}</span><strong>${escapeHtml(item.label)}</strong><em>${escapeHtml(item.status)}</em>${worker}</div>`;
    }).join("");
    return `<div class="card"><h3>${title} — ${done}/${items.length} Complete</h3><div class="meta">
      <span>Readiness</span><strong>${percentDone}%</strong>
      <span>Doors</span><strong>${this.game.frontDoorLocked ? "Locked" : "Open"}</strong>
      <span>Open Sign</span><strong>${this.game.openSignOn ? "On" : "Off"}</strong>
      <span>Auto</span><strong>${this.game.autoOpen ? "Open" : "Manual Open"} / ${this.game.autoClose ? "Close" : "Manual Close"}</strong>
    </div><div class="bar"><i style="width:${percentDone}%"></i></div>${rows}</div>`;
  }

  prepCard() {
    const lunch = this.game.prep.lunch;
    const dinner = this.game.prep.dinner;
    return `<div class="card"><h3>Preparation</h3><div class="meta">
      <span>Lunch Chicken</span><strong>${percent(lunch.chicken)}</strong>
      <span>Lunch Soup</span><strong>${percent(lunch.soup)}</strong>
      <span>Sandwich Station</span><strong>${percent(lunch.sandwichStation)}</strong>
      <span>Grill Heating</span><strong>${percent(lunch.grill)}</strong>
      <span>Dinner Entrees</span><strong>${percent(dinner.entrees)}</strong>
      <span>Oven Heating</span><strong>${percent(dinner.oven)}</strong>
      <span>Dessert Setup</span><strong>${percent(dinner.dessert)}</strong>
    </div></div>`;
  }
}

function labelStation(station) {
  return {
    espressoBar: "Espresso Bar",
    coldStation: "Cold Station",
    pastryCase: "Pastry Case",
    kitchenPrep: "Kitchen Prep"
  }[station] || station;
}

function helpRoles(role) {
  return {
    cook: "Register, cafe orders",
    barista: "Register, light food",
    manager: "All service",
    cashier: "Register",
    stocker: "Stock/delivery",
    cleaner: "Cleaning",
    maintenance: "Repairs"
  }[role] || "Role tasks";
}

function stateLabel(state) {
  return {
    opening: "Opening",
    open: "Open",
    closing: "Closing",
    closed: "Closed"
  }[state] || state;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
