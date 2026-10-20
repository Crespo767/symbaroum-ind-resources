/** One local scheduler; its caller elects the sole primary GM allowed to advance world time. */
export class CalendarClockRunner {
  #timer = null;
  #last = 0;
  #busy = false;
  #generation = 0;
  #rate = 1;
  #remainder = 0;

  constructor({ canRun, advance, onError, getRate = () => 1, now = () => performance.now(),
    schedule = callback => globalThis.setInterval(callback, 1000),
    cancel = timer => globalThis.clearInterval(timer) }) {
    Object.assign(this, { canRun, advance, onError, getRate, now, schedule, cancel });
  }

  synchronize() {
    if (!this.canRun()) { this.stop(); return; }
    const rate = this.getRate();
    if (this.#timer !== null && rate === this.#rate) return;
    this.stop();
    this.#rate = rate;
    this.#last = this.now();
    this.#generation++;
    this.#timer = this.schedule(() => { void this.tick(); });
    this.#timer?.unref?.();
  }

  stop() {
    if (this.#timer !== null) this.cancel(this.#timer);
    this.#timer = null;
    this.#generation++;
    this.#last = 0;
    this.#remainder = 0;
  }

  async tick() {
    if (!this.canRun()) { this.stop(); return; }
    if (this.#timer === null || this.#busy) return;
    const elapsed = Math.floor((this.now() - this.#last) / 1000);
    if (elapsed < 1) return;
    this.#last += elapsed * 1000;
    const scaled = elapsed * this.#rate + this.#remainder;
    const seconds = Math.floor(scaled + 1e-9);
    this.#remainder = Math.max(0, scaled - seconds);
    if (seconds < 1) return;
    const generation = this.#generation;
    this.#busy = true;
    try {
      // Recheck after entering the shared queue: a pause or GM change invalidates queued ticks.
      await this.advance(seconds, () => generation === this.#generation && this.canRun());
    } catch (error) {
      if (generation === this.#generation) {
        this.stop();
        await this.onError(error);
      }
    } finally { this.#busy = false; }
  }
}
