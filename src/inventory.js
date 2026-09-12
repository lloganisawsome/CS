import { DELIVERY_PACK, INGREDIENTS, INITIAL_MAIN_INVENTORY, INITIAL_STATION_INVENTORY } from "./data.js";
import { clone } from "./utils.js";

export class InventorySystem {
  constructor() {
    this.main = clone(INITIAL_MAIN_INVENTORY);
    this.stations = clone(INITIAL_STATION_INVENTORY);
  }

  canMake(recipe) {
    const station = this.stations[recipe.station] || {};
    const missingStation = [];
    const missingTotal = [];
    for (const [id, amount] of Object.entries(recipe.ingredients)) {
      if ((station[id] || 0) < amount) missingStation.push(id);
      if ((station[id] || 0) + (this.main[id] || 0) < amount) missingTotal.push(id);
    }
    return { ok: missingStation.length === 0 && missingTotal.length === 0, missingStation, missingTotal };
  }

  consumeForRecipe(recipe) {
    const station = this.stations[recipe.station] || {};
    for (const [id, amount] of Object.entries(recipe.ingredients)) {
      station[id] = Math.max(0, (station[id] || 0) - amount);
    }
  }

  restock(stationId, ingredientId, maxTransfer = 8) {
    const station = this.stations[stationId] || {};
    const mainAvailable = this.main[ingredientId] || 0;
    const current = station[ingredientId] || 0;
    const amount = Math.min(maxTransfer, mainAvailable, Math.max(1, 12 - current));
    if (amount <= 0) return 0;
    station[ingredientId] = current + amount;
    this.main[ingredientId] = mainAvailable - amount;
    return amount;
  }

  addDeliveryBox(ingredientId, amount) {
    this.main[ingredientId] = (this.main[ingredientId] || 0) + amount;
  }

  lowStationItems() {
    const lows = [];
    for (const [stationId, stock] of Object.entries(this.stations)) {
      for (const [ingredientId, value] of Object.entries(stock)) {
        const critical = value <= 1;
        const low = value <= 4;
        if ((critical || low) && (this.main[ingredientId] || 0) > 0) {
          lows.push({ stationId, ingredientId, value, critical });
        }
      }
    }
    return lows;
  }

  outOfStock() {
    return Object.keys(INGREDIENTS).filter((id) => (this.main[id] || 0) <= 0 && this.stationTotal(id) <= 0);
  }

  stationTotal(ingredientId) {
    return Object.values(this.stations).reduce((sum, station) => sum + (station[ingredientId] || 0), 0);
  }

  deliveryPack() {
    return clone(DELIVERY_PACK);
  }

  snapshot() {
    return { main: clone(this.main), stations: clone(this.stations) };
  }

  restore(data) {
    this.main = clone(data.main);
    this.stations = clone(data.stations);
  }
}
