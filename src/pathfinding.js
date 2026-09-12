import { TILE, WORLD } from "./data.js";
import { clamp } from "./utils.js";

export class Pathfinder {
  constructor(objects, tables) {
    this.cols = WORLD.cols;
    this.rows = WORLD.rows;
    this.blocked = new Set();
    this.build(objects, tables);
  }

  build(objects, tables) {
    this.blocked.clear();
    const blockers = [
      ...objects.filter((object) => object.blocked),
      ...tables.map((table) => ({ x: table.x - 28, y: table.y - 22, w: 56, h: 44 }))
    ];
    for (const rect of blockers) {
      const x0 = clamp(Math.floor(rect.x / TILE), 0, this.cols - 1);
      const y0 = clamp(Math.floor(rect.y / TILE), 0, this.rows - 1);
      const x1 = clamp(Math.floor((rect.x + rect.w - 1) / TILE), 0, this.cols - 1);
      const y1 = clamp(Math.floor((rect.y + rect.h - 1) / TILE), 0, this.rows - 1);
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          this.blocked.add(`${x},${y}`);
        }
      }
    }
    for (const object of objects.filter((item) => item.spot)) {
      const tile = this.tileFromPoint({ x: object.spot[0], y: object.spot[1] });
      this.blocked.delete(`${tile.x},${tile.y}`);
    }
    this.openImportantAisles();
  }

  openImportantAisles() {
    const points = [
      [3, 15], [4, 15], [5, 14], [8, 12], [10, 10], [12, 10], [16, 10], [22, 10],
      [24, 7], [27, 7], [30, 7], [33, 7], [36, 7], [38, 7], [29, 16], [34, 16],
      [38, 16], [41, 16], [21, 21], [24, 21], [28, 21], [34, 21], [39, 21], [43, 21],
      [43, 23], [43, 25], [2, 15], [44, 21]
    ];
    for (const [x, y] of points) this.blocked.delete(`${x},${y}`);
  }

  tileFromPoint(point) {
    return {
      x: clamp(Math.floor(point.x / TILE), 0, this.cols - 1),
      y: clamp(Math.floor(point.y / TILE), 0, this.rows - 1)
    };
  }

  pointFromTile(tile) {
    return { x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2 };
  }

  isBlocked(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return true;
    return this.blocked.has(`${x},${y}`);
  }

  findPath(startPoint, endPoint) {
    const start = this.nearestOpen(this.tileFromPoint(startPoint));
    const goal = this.nearestOpen(this.tileFromPoint(endPoint));
    const key = (tile) => `${tile.x},${tile.y}`;
    const open = [start];
    const came = new Map();
    const g = new Map([[key(start), 0]]);
    const f = new Map([[key(start), this.heuristic(start, goal)]]);
    const openKeys = new Set([key(start)]);

    while (open.length) {
      open.sort((a, b) => (f.get(key(a)) || Infinity) - (f.get(key(b)) || Infinity));
      const current = open.shift();
      const currentKey = key(current);
      openKeys.delete(currentKey);
      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstruct(came, current).map((tile) => this.pointFromTile(tile));
      }
      for (const next of this.neighbors(current)) {
        const nextKey = key(next);
        const tentative = (g.get(currentKey) || 0) + 1;
        if (tentative < (g.get(nextKey) ?? Infinity)) {
          came.set(nextKey, current);
          g.set(nextKey, tentative);
          f.set(nextKey, tentative + this.heuristic(next, goal));
          if (!openKeys.has(nextKey)) {
            open.push(next);
            openKeys.add(nextKey);
          }
        }
      }
    }
    return [endPoint];
  }

  neighbors(tile) {
    const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    return deltas
      .map(([dx, dy]) => ({ x: tile.x + dx, y: tile.y + dy }))
      .filter((next) => !this.isBlocked(next.x, next.y));
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  reconstruct(came, current) {
    const path = [current];
    let key = `${current.x},${current.y}`;
    while (came.has(key)) {
      current = came.get(key);
      path.unshift(current);
      key = `${current.x},${current.y}`;
    }
    return path;
  }

  nearestOpen(tile) {
    if (!this.isBlocked(tile.x, tile.y)) return tile;
    for (let radius = 1; radius < 8; radius += 1) {
      for (let y = tile.y - radius; y <= tile.y + radius; y += 1) {
        for (let x = tile.x - radius; x <= tile.x + radius; x += 1) {
          if (!this.isBlocked(x, y)) return { x, y };
        }
      }
    }
    return tile;
  }
}
