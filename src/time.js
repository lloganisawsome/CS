import { DAYS, SERVICE_PERIODS } from "./data.js";
import { formatClock } from "./utils.js";

export class TimeSystem {
  constructor() {
    this.day = 1;
    this.dayIndex = 0;
    this.minute = 5 * 60;
    this.speed = 1;
    this.paused = false;
    this.accumulator = 0;
    this.lastPeriodKey = this.period.key;
  }

  get absoluteMinute() {
    return (this.day - 1) * 24 * 60 + this.minute;
  }

  get period() {
    return getServicePeriod(this.minute);
  }

  tick(realDt, game) {
    if (this.paused) return 0;
    this.accumulator += realDt * this.speed;
    let advanced = 0;
    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      this.minute += 1;
      advanced += 1;
      if (this.minute >= 24 * 60) {
        this.minute = 0;
        this.day += 1;
        this.dayIndex = (this.dayIndex + 1) % DAYS.length;
        game.closeDay();
      }
      const current = this.period.key;
      if (current !== this.lastPeriodKey) {
        this.lastPeriodKey = current;
        game.onServicePeriodChanged(this.period);
      }
    }
    return advanced;
  }

  snapshot() {
    return {
      day: this.day,
      dayIndex: this.dayIndex,
      minute: this.minute,
      speed: this.speed,
      paused: this.paused,
      lastPeriodKey: this.lastPeriodKey
    };
  }

  restore(data) {
    Object.assign(this, data);
    this.accumulator = 0;
  }

  displayDay() {
    return `${DAYS[this.dayIndex]} ${this.day}`;
  }

  displayClock() {
    return formatClock(this.minute);
  }
}

export function getServicePeriod(minute) {
  const normalized = minute < 5 * 60 ? minute + 24 * 60 : minute;
  return SERVICE_PERIODS.find((period) => normalized >= period.start && normalized < period.end) || SERVICE_PERIODS[0];
}
