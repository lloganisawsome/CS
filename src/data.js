export const TILE = 24;
export const WORLD = { width: 1152, height: 720, cols: 48, rows: 30 };

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SERVICE_PERIODS = [
  { key: "earlyCafe", label: "Early Cafe", mode: "Cafe", start: 5 * 60, end: 7 * 60, demand: 0.33, note: "coffee, pastries, commuters" },
  { key: "breakfast", label: "Breakfast Diner", mode: "Diner", start: 7 * 60, end: 10 * 60 + 30, demand: 0.78, note: "eggs, pancakes, fast coffee" },
  { key: "transition", label: "Lunch Prep", mode: "Cafe", start: 10 * 60 + 30, end: 11 * 60, demand: 0.24, note: "stations changing over" },
  { key: "lunch", label: "Lunch Diner", mode: "Diner", start: 11 * 60, end: 14 * 60, demand: 0.95, note: "sandwiches, burgers, salads" },
  { key: "afternoon", label: "Afternoon Cafe", mode: "Cafe", start: 14 * 60, end: 17 * 60, demand: 0.45, note: "students, iced drinks, snacks" },
  { key: "dinner", label: "Dinner Restaurant", mode: "Restaurant", start: 17 * 60, end: 21 * 60, demand: 0.72, note: "entrees, plated meals, longer seating" },
  { key: "lateCafe", label: "Late Cafe", mode: "Cafe", start: 21 * 60, end: 22 * 60, demand: 0.25, note: "desserts, tea, closing tasks" },
  { key: "closed", label: "Closed", mode: "Closed", start: 22 * 60, end: 29 * 60, demand: 0, note: "resetting for tomorrow" }
];

export const INGREDIENTS = {
  beans: { label: "Coffee Beans", unit: "bag", cost: 5, storage: "dryStorage" },
  wholeMilk: { label: "Whole Milk", unit: "case", cost: 4, storage: "walkIn" },
  oatMilk: { label: "Oat Milk", unit: "case", cost: 5, storage: "walkIn" },
  cups: { label: "Cups", unit: "sleeve", cost: 2, storage: "dryStorage" },
  tea: { label: "Tea", unit: "tin", cost: 3, storage: "dryStorage" },
  ice: { label: "Ice", unit: "bin", cost: 1, storage: "freezer" },
  eggs: { label: "Eggs", unit: "flat", cost: 4, storage: "walkIn" },
  batter: { label: "Pancake Batter", unit: "tub", cost: 3, storage: "walkIn" },
  bread: { label: "Bread", unit: "loaf", cost: 2, storage: "dryStorage" },
  cheese: { label: "Cheese", unit: "pack", cost: 3, storage: "walkIn" },
  chicken: { label: "Chicken", unit: "tray", cost: 7, storage: "walkIn" },
  greens: { label: "Greens", unit: "crate", cost: 4, storage: "walkIn" },
  beef: { label: "Beef", unit: "tray", cost: 8, storage: "walkIn" },
  pastry: { label: "Pastries", unit: "box", cost: 6, storage: "dryStorage" },
  dessert: { label: "Desserts", unit: "box", cost: 6, storage: "freezer" },
  soup: { label: "Soup Base", unit: "pot", cost: 5, storage: "walkIn" }
};

export const RECIPES = {
  espresso: {
    label: "Espresso",
    price: 4,
    period: "all",
    station: "espressoBar",
    role: "barista",
    prep: 2.4,
    ingredients: { beans: 1, cups: 1 },
    steps: [
      { object: "grinder", label: "Grinding Coffee", carry: "beans" },
      { object: "espressoMachine", label: "Pulling Espresso", carry: null },
      { object: "pickup", label: "Setting Drink Out", carry: "drink" }
    ]
  },
  latte: {
    label: "Latte",
    price: 6,
    period: "all",
    station: "espressoBar",
    role: "barista",
    prep: 3.4,
    ingredients: { beans: 1, wholeMilk: 1, cups: 1 },
    steps: [
      { object: "grinder", label: "Grinding Coffee", carry: "beans" },
      { object: "espressoMachine", label: "Pulling Shots", carry: null },
      { object: "milkFridge", label: "Steaming Milk", carry: "milk" },
      { object: "pickup", label: "Finishing Latte", carry: "drink" }
    ]
  },
  icedTea: {
    label: "Iced Tea",
    price: 4,
    period: "all",
    station: "coldStation",
    role: "barista",
    prep: 2.1,
    ingredients: { tea: 1, ice: 1, cups: 1 },
    steps: [
      { object: "coldStation", label: "Building Iced Tea", carry: "cup" },
      { object: "pickup", label: "Setting Drink Out", carry: "drink" }
    ]
  },
  pastry: {
    label: "Pastry",
    price: 5,
    period: "all",
    station: "pastryCase",
    role: "barista",
    prep: 1.4,
    ingredients: { pastry: 1 },
    steps: [
      { object: "pastryCase", label: "Boxing Pastry", carry: "pastry" },
      { object: "pickup", label: "Setting Pastry Out", carry: "plate" }
    ]
  },
  eggs: {
    label: "Egg Plate",
    price: 11,
    period: "breakfast",
    station: "kitchenPrep",
    role: "cook",
    prep: 5,
    ingredients: { eggs: 2, bread: 1, cheese: 1 },
    steps: [
      { object: "prepCounter", label: "Prepping Eggs", carry: "ingredients" },
      { object: "grill", label: "Cooking Eggs", carry: null },
      { object: "plating", label: "Plating Breakfast", carry: "meal" },
      { object: "pickup", label: "Running Plate", carry: "plate" }
    ]
  },
  pancakes: {
    label: "Pancakes",
    price: 10,
    period: "breakfast",
    station: "kitchenPrep",
    role: "cook",
    prep: 5.5,
    ingredients: { batter: 2, eggs: 1 },
    steps: [
      { object: "prepCounter", label: "Mixing Batter", carry: "ingredients" },
      { object: "grill", label: "Cooking Pancakes", carry: null },
      { object: "plating", label: "Plating Pancakes", carry: "meal" },
      { object: "pickup", label: "Running Plate", carry: "plate" }
    ]
  },
  sandwich: {
    label: "Chicken Sandwich",
    price: 13,
    period: "lunch",
    station: "kitchenPrep",
    role: "cook",
    prep: 5.8,
    ingredients: { chicken: 1, bread: 1, greens: 1 },
    steps: [
      { object: "prepCounter", label: "Building Sandwich", carry: "ingredients" },
      { object: "grill", label: "Grilling Chicken", carry: null },
      { object: "plating", label: "Plating Lunch", carry: "meal" },
      { object: "pickup", label: "Running Plate", carry: "plate" }
    ]
  },
  burger: {
    label: "Cafe Burger",
    price: 15,
    period: "lunchDinner",
    station: "kitchenPrep",
    role: "cook",
    prep: 6.5,
    ingredients: { beef: 1, bread: 1, cheese: 1, greens: 1 },
    steps: [
      { object: "prepCounter", label: "Prepping Burger", carry: "ingredients" },
      { object: "grill", label: "Cooking Burger", carry: null },
      { object: "plating", label: "Plating Burger", carry: "meal" },
      { object: "pickup", label: "Running Plate", carry: "plate" }
    ]
  },
  dinnerPlate: {
    label: "Dinner Plate",
    price: 19,
    period: "dinner",
    station: "kitchenPrep",
    role: "cook",
    prep: 8,
    ingredients: { chicken: 2, greens: 1, soup: 1 },
    steps: [
      { object: "prepCounter", label: "Preparing Dinner", carry: "ingredients" },
      { object: "oven", label: "Cooking Entree", carry: null },
      { object: "plating", label: "Plating Dinner", carry: "meal" },
      { object: "pickup", label: "Running Plate", carry: "plate" }
    ]
  },
  dessert: {
    label: "Dessert Plate",
    price: 8,
    period: "dinner",
    station: "pastryCase",
    role: "barista",
    prep: 2.3,
    ingredients: { dessert: 1 },
    steps: [
      { object: "pastryCase", label: "Plating Dessert", carry: "dessert" },
      { object: "pickup", label: "Setting Dessert Out", carry: "plate" }
    ]
  }
};

export const EMPLOYEE_DEFS = [
  { name: "Jordan", role: "barista", label: "Barista", skill: 0.82, speed: 1.05, wage: 18, color: "#407c86", shift: [5 * 60, 14 * 60] },
  { name: "Nia", role: "barista", label: "Barista", skill: 0.76, speed: 1.08, wage: 17, color: "#4c8aa8", shift: [7 * 60, 16 * 60] },
  { name: "Maya", role: "cashier", label: "Cashier", skill: 0.78, speed: 1.02, wage: 16, color: "#b66a47", shift: [5 * 60, 15 * 60] },
  { name: "Theo", role: "cashier", label: "Cashier", skill: 0.7, speed: 1.04, wage: 15, color: "#c98252", shift: [10 * 60, 19 * 60] },
  { name: "Dev", role: "cook", label: "Cook", skill: 0.8, speed: 0.96, wage: 20, color: "#8a6049", shift: [6 * 60 + 30, 22 * 60] },
  { name: "Lena", role: "cook", label: "Cook", skill: 0.74, speed: 0.98, wage: 19, color: "#9b7054", shift: [10 * 60 + 30, 21 * 60] },
  { name: "Rin", role: "cleaner", label: "Cleaner", skill: 0.74, speed: 1.08, wage: 15, color: "#668e68", shift: [7 * 60, 22 * 60] },
  { name: "Sam", role: "stocker", label: "Stocker", skill: 0.72, speed: 1.0, wage: 16, color: "#7768a9", shift: [6 * 60, 18 * 60] },
  { name: "Owen", role: "stocker", label: "Stocker", skill: 0.68, speed: 1.03, wage: 16, color: "#8771bd", shift: [11 * 60, 20 * 60] },
  { name: "Elena", role: "manager", label: "Shift Lead", skill: 0.86, speed: 0.98, wage: 24, color: "#c28b35", shift: [9 * 60, 22 * 60] },
  { name: "Riley", role: "maintenance", label: "Maintenance", skill: 0.72, speed: 0.92, wage: 22, color: "#6a7585", shift: [11 * 60, 20 * 60] }
];

export const OBJECTS = [
  { id: "entrance", label: "Front Entrance", type: "door", x: 18, y: 330, w: 34, h: 78, spot: [72, 368] },
  { id: "loading", label: "Loading Bay Door", type: "door", x: 1090, y: 558, w: 38, h: 72, spot: [1038, 586] },
  { id: "frontWallUpper", label: "", type: "wall", x: 540, y: 58, w: 12, h: 142, blocked: true },
  { id: "frontWallLower", label: "", type: "wall", x: 540, y: 274, w: 12, h: 212, blocked: true },
  { id: "kitchenNorthWall", label: "", type: "wall", x: 600, y: 264, w: 480, h: 12, blocked: true },
  { id: "kitchenSouthWallLeft", label: "", type: "wall", x: 692, y: 452, w: 180, h: 12, blocked: true },
  { id: "kitchenSouthWallRight", label: "", type: "wall", x: 960, y: 452, w: 120, h: 12, blocked: true },
  { id: "kitchenEastWall", label: "", type: "wall", x: 1068, y: 264, w: 12, h: 200, blocked: true },
  { id: "register", label: "POS Register 1", type: "equipment", x: 226, y: 204, w: 58, h: 38, spot: [264, 268], blocked: true },
  { id: "register2", label: "POS Register 2", type: "equipment", x: 296, y: 204, w: 58, h: 38, spot: [332, 268], blocked: true },
  { id: "pickup", label: "Pickup Pass", type: "pickup", x: 430, y: 206, w: 102, h: 38, spot: [488, 268], blocked: true },
  { id: "queue1", label: "Queue 1", type: "marker", x: 224, y: 306, w: 1, h: 1, spot: [224, 306] },
  { id: "queue2", label: "Queue 2", type: "marker", x: 178, y: 326, w: 1, h: 1, spot: [178, 326] },
  { id: "queue3", label: "Queue 3", type: "marker", x: 132, y: 346, w: 1, h: 1, spot: [132, 346] },
  { id: "queue4", label: "Queue 4", type: "marker", x: 90, y: 368, w: 1, h: 1, spot: [90, 368] },
  { id: "grinder", label: "Coffee Grinder", type: "equipment", x: 590, y: 102, w: 48, h: 42, spot: [612, 174], blocked: true, station: "espressoBar" },
  { id: "espressoMachine", label: "Espresso Machine", type: "equipment", x: 650, y: 102, w: 78, h: 42, spot: [688, 174], blocked: true, station: "espressoBar" },
  { id: "coffeeBrewer", label: "Drip Brewer", type: "equipment", x: 742, y: 102, w: 58, h: 42, spot: [772, 174], blocked: true, station: "espressoBar" },
  { id: "milkFridge", label: "Milk Refrigerator", type: "equipment", x: 816, y: 102, w: 58, h: 42, spot: [846, 174], blocked: true, station: "espressoBar" },
  { id: "coldStation", label: "Cold Station", type: "equipment", x: 890, y: 104, w: 64, h: 40, spot: [922, 174], blocked: true, station: "coldStation" },
  { id: "pastryCase", label: "Pastry Case", type: "equipment", x: 430, y: 146, w: 102, h: 38, spot: [488, 202], blocked: true, station: "pastryCase" },
  { id: "sink", label: "Coffee Sink", type: "equipment", x: 970, y: 102, w: 54, h: 42, spot: [996, 174], blocked: true },
  { id: "prepCounter", label: "Prep Counter", type: "equipment", x: 642, y: 314, w: 116, h: 46, spot: [696, 386], blocked: true, station: "kitchenPrep" },
  { id: "grill", label: "Grill", type: "equipment", x: 784, y: 314, w: 78, h: 46, spot: [820, 386], blocked: true, station: "kitchenPrep" },
  { id: "oven", label: "Oven", type: "equipment", x: 890, y: 314, w: 70, h: 46, spot: [924, 386], blocked: true, station: "kitchenPrep" },
  { id: "plating", label: "Plating Area", type: "equipment", x: 986, y: 314, w: 76, h: 46, spot: [1018, 386], blocked: true, station: "kitchenPrep" },
  { id: "dryStorage", label: "Dry Storage", type: "storage", x: 596, y: 540, w: 112, h: 74, spot: [650, 522], blocked: true },
  { id: "walkIn", label: "Walk-In Cooler", type: "storage", x: 732, y: 532, w: 110, h: 86, spot: [786, 518], blocked: true },
  { id: "freezer", label: "Freezer", type: "storage", x: 866, y: 540, w: 88, h: 74, spot: [910, 522], blocked: true },
  { id: "dishwasher", label: "Dishwasher", type: "equipment", x: 976, y: 546, w: 78, h: 50, spot: [1014, 522], blocked: true },
  { id: "dishStorage", label: "Dish Storage", type: "storage", x: 494, y: 540, w: 74, h: 74, spot: [530, 522], blocked: true },
  { id: "cleaning", label: "Cleaning Supplies", type: "storage", x: 396, y: 548, w: 72, h: 54, spot: [432, 522], blocked: true },
  { id: "trashArea", label: "Trash Area", type: "storage", x: 1068, y: 410, w: 64, h: 54, spot: [1044, 426], blocked: true },
  { id: "employeeArea", label: "Employee Area", type: "room", x: 394, y: 626, w: 126, h: 50, spot: [456, 604], blocked: true }
];

export const TABLE_DEFS = [
  { id: "t1", x: 124, y: 122, seats: 2 },
  { id: "t2", x: 262, y: 118, seats: 2 },
  { id: "t3", x: 128, y: 494, seats: 4 },
  { id: "t4", x: 302, y: 494, seats: 4 },
  { id: "t5", x: 420, y: 400, seats: 2 },
  { id: "t6", x: 304, y: 358, seats: 2 },
  { id: "t7", x: 120, y: 246, seats: 2 },
  { id: "t8", x: 420, y: 304, seats: 2 }
];

export const INITIAL_MAIN_INVENTORY = {
  beans: 38,
  wholeMilk: 34,
  oatMilk: 22,
  cups: 90,
  tea: 30,
  ice: 42,
  eggs: 42,
  batter: 28,
  bread: 45,
  cheese: 30,
  chicken: 32,
  greens: 38,
  beef: 26,
  pastry: 36,
  dessert: 18,
  soup: 20
};

export const INITIAL_STATION_INVENTORY = {
  espressoBar: { beans: 8, wholeMilk: 8, oatMilk: 5, cups: 24 },
  coldStation: { tea: 8, ice: 12, cups: 18 },
  pastryCase: { pastry: 10, dessert: 6 },
  kitchenPrep: { eggs: 10, batter: 8, bread: 12, cheese: 8, chicken: 8, greens: 10, beef: 6, soup: 5 }
};

export const DELIVERY_PACK = {
  beans: 24,
  wholeMilk: 18,
  oatMilk: 14,
  cups: 48,
  eggs: 24,
  batter: 14,
  bread: 22,
  cheese: 14,
  chicken: 18,
  greens: 18,
  beef: 14,
  pastry: 18,
  dessert: 12,
  soup: 12,
  ice: 18,
  tea: 14
};
