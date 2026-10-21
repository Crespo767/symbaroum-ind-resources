// Minimal public RollTable contract for tests. Production always uses Foundry's documents.
export function nativeRollTableFixture(data) {
  const table = { formula: "1d20", replacement: true, ...data, id: data._id ?? data.id,
    calls: { roll: [], draw: [], toMessage: [] } };
  table.results = new Map((data.results ?? [{ range: [1, 35], description: "Native table result" }])
    .map((r, i) => [String(i), { id: String(i), ...r }]));
  table.roll = async function(options) {
    this.calls.roll.push(options);
    await options.roll.evaluate();
    return { roll: options.roll, results: [...this.results.values()].filter(r => !r.drawn && options.roll.total >= r.range[0] && options.roll.total <= r.range[1]) };
  };
  table.draw = async function(options) {
    this.calls.draw.push(options);
    if (!this.replacement && !this.pack) for (const result of options.results) result.drawn = true;
    return { roll: options.roll, results: options.results };
  };
  table.toMessage = async function(results, options) {
    this.calls.toMessage.push({ results, options });
    const data = { ...options.messageData, flags: { "core.RollTable": this.id, ...options.messageData.flags },
      content: `<div class="table-draw">${this.name}</div>` };
    if (options.roll) data.rolls = [options.roll];
    return globalThis.ChatMessage.create(data, options.messageOptions);
  };
  return table;
}
