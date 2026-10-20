/** Read-only, per-window search over observable party members. */
export function normalizePartySearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

export function buildPartySearchEntries(members, { user, localize }) {
  return members.flatMap(member => {
    const actor = member.actor;
    if (!user?.isGM && !actor?.testUserPermission?.(user, "OBSERVER")) return [];
    const attributes = Object.entries(actor.system?.attributes ?? {}).flatMap(([key, data]) => {
      if (data == null) return [];
      const total = Number(typeof data === "object" ? data.total ?? data.value : data);
      return Number.isFinite(total) ? [{ kind: "attribute", key, name: localize(data.label || `ATTRIBUTE.${key.toUpperCase()}`), total }] : [];
    });
    const items = Array.from(actor.items?.values?.() ?? []).map(item => {
      const tier = ["master", "adept", "novice"].find(level => item.system?.[level]?.isActive);
      return { kind: ["ability", "trait", "mysticalPower", "ritual", "boon", "burden"].includes(item.type) ? "ability" : "item",
        key: normalizePartySearch(item.name), name: item.name, tier: tier ? localize(`ABILITY.${tier.toUpperCase()}`) : "" };
    });
    return [{ id: member.id, name: member.name, fields: [...attributes, ...items] }];
  });
}

export function partySearchSuggestions(entries, query) {
  const term = normalizePartySearch(query);
  if (!term) return [];
  const unique = new Map();
  for (const entry of entries) for (const field of entry.fields) {
    if (normalizePartySearch(field.name).includes(term)) unique.set(`${field.kind}:${field.key}`, field);
  }
  return [...unique.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)).slice(0, 15);
}

export function searchPartyMembers(entries, query, selection = null) {
  const term = normalizePartySearch(query);
  if (!term) return entries.map(entry => ({ id: entry.id, matches: [] }));
  const exactAttribute = entries.flatMap(entry => entry.fields).find(field => field.kind === "attribute" && normalizePartySearch(field.name) === term);
  const target = selection ?? (exactAttribute ? { kind: "attribute", key: exactAttribute.key } : null);
  const results = entries.flatMap(entry => {
    const matches = entry.fields.filter(field => target ? field.kind === target.kind && field.key === target.key : normalizePartySearch(field.name).includes(term));
    return matches.length || (!target && normalizePartySearch(entry.name).includes(term)) ? [{ id: entry.id, matches }] : [];
  });
  if (target?.kind === "attribute") results.sort((a, b) => b.matches[0].total - a.matches[0].total);
  return results;
}
