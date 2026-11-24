import { MODULE_ID } from "./constants.mjs";

const GROUP_KEY = "davokarGroup";
const STATE_KEY = "davokarState";
const VERSION = 1;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function newDavokarState(config) {
  return { version: VERSION, revision: 0, current: createDavokarDay(1, config), history: [] };
}

export function createDavokarDay(number, config) {
  return { number, config, results: {}, attempts: [], resolutions: [] };
}

function keyLocation() {
  return MODULE_ID + ".davokarKey." + game.world.id + "." + game.user.id;
}

export function getDavokarKey() {
  return globalThis.game?.user?.isGM ? localStorage.getItem(keyLocation()) ?? "" : "";
}

export async function restoreDavokarKey(value) {
  if (!game.user.isGM) throw new Error("Forbidden");
  const key = await importKey(value);
  for (const journal of game.journal.values()) {
    const groupUuid = journal.getFlag(MODULE_ID, GROUP_KEY);
    if (groupUuid) await openDavokarData(journal.getFlag(MODULE_ID, STATE_KEY), groupUuid, key);
  }
  localStorage.setItem(keyLocation(), value);
}

function encode(bytes) {
  return Uint8Array.from(bytes).reduce((result, byte) => result + byte.toString(16).padStart(2, "0"), "");
}

function decode(hex) {
  if (typeof hex !== "string" || !/^(?:[0-9a-f]{2})+$/.test(hex)) throw new Error("KeyRequired");
  return Uint8Array.from(hex.match(/../g), byte => Number.parseInt(byte, 16));
}

async function importKey(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new Error("KeyRequired");
  if (!globalThis.crypto?.subtle) throw new Error("SecureContext");
  return crypto.subtle.importKey("raw", decode(value), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function readKey() {
  if (!globalThis.crypto?.subtle) throw new Error("SecureContext");
  return importKey(getDavokarKey());
}

async function createKeyIfNeeded() {
  if (!globalThis.crypto?.subtle) throw new Error("SecureContext");
  if (getDavokarKey()) return;
  // One key per world. Other GMs or browsers use a backup of this same key.
  if ([...game.journal.values()].some(journal => journal.getFlag(MODULE_ID, GROUP_KEY))) throw new Error("KeyRequired");
  localStorage.setItem(keyLocation(), encode(crypto.getRandomValues(new Uint8Array(32))));
}

export async function sealDavokarData(value, context) {
  if (!game.user.isGM) throw new Error("Forbidden");
  const key = await readKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    key, encoder.encode(JSON.stringify(value)));
  return { iv: encode(iv), value: bytesToBase64(new Uint8Array(encrypted)) };
}

function bytesToBase64(bytes) {
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + 8192)));
  }
  return btoa(chunks.join(""));
}

export async function openDavokarData(envelope, context, key = null) {
  if (!game.user.isGM) throw new Error("Forbidden");
  key ??= await readKey();
  try {
    const { iv, value } = typeof envelope === "string" ? JSON.parse(envelope) : envelope;
    const data = Uint8Array.from(atob(value), char => char.charCodeAt(0));
    const buffer = await crypto.subtle.decrypt({
      name: "AES-GCM", iv: decode(iv), additionalData: encoder.encode(context)
    }, key, data);
    return JSON.parse(decoder.decode(buffer));
  } catch {
    throw new Error("KeyRequired");
  }
}

export async function readDavokarJournal(groupUuid) {
  if (!globalThis.game?.user?.isGM) return { journal: null, state: null };
  const matches = [...game.journal.values()].filter(doc => doc.getFlag(MODULE_ID, GROUP_KEY) === groupUuid);
  if (!matches.length) return { journal: null, state: null };
  if (matches.length > 1) throw new Error("StorageError");
  const [journal] = matches;
  if (journal.ownership.default !== 0 || Object.entries(journal.ownership).some(([id, level]) =>
    id !== "default" && level !== 0 && !game.users.get(id)?.isGM)) throw new Error("StorageError");
  const state = await openDavokarData(journal.getFlag(MODULE_ID, STATE_KEY), groupUuid);
  if (!state || state.version !== VERSION || !Number.isSafeInteger(state.revision) || !state.current?.config || !Array.isArray(state.history)) {
    throw new Error("StorageError");
  }
  return { journal, state };
}

export async function saveDavokarJournal(group, journal, state) {
  if (!game.user.isGM) throw new Error("Forbidden");
  if (!journal) await createKeyIfNeeded();
  // A serialized envelope replaces the entire flag in a single document operation.
  const serialized = JSON.stringify(await sealDavokarData(state, group.uuid));
  if (journal) {
    await journal.setFlag(MODULE_ID, STATE_KEY, serialized);
  } else {
    await JournalEntry.create({
      name: game.i18n.format("TENEBRE.Davokar.JournalTitle", { group: group.name }),
      ownership: { default: 0 },
      flags: { [MODULE_ID]: { [GROUP_KEY]: group.uuid, [STATE_KEY]: serialized } }
    });
  }
}
