import { MODULE_ID } from "./constants.mjs";
import { expeditionDayKey } from "./expedition-state.mjs";

const PACK_NAME = `${MODULE_ID}-expeditions`;
const PACK_ID = `world.${PACK_NAME}`;
const OWNERSHIP = { GAMEMASTER: "OWNER", ASSISTANT: "OWNER", TRUSTED: "NONE", PLAYER: "NONE" };
let creatingPack;

/** Os dados não pertencem ao Actor compartilhado nem ao índice do compêndio. */
async function privatePack(create = false) {
  if (!globalThis.game?.user?.isGM) throw new Error("Private expedition storage requires a GM.");
  let pack = game.packs?.get?.(PACK_ID);
  let created = false;
  if (!pack && create) {
    const Collection = globalThis.foundry?.documents?.collections?.CompendiumCollection ?? globalThis.CompendiumCollection;
    if (!Collection?.createCompendium) throw new Error("Private expedition storage is unavailable.");
    creatingPack ??= Collection.createCompendium({ name: PACK_NAME, label: game.i18n.localize("TENEBRE.Party.PrivateResultsPack"), type: "JournalEntry", ownership: OWNERSHIP });
    try { pack = await creatingPack; created = true; } finally { creatingPack = null; }
  }
  if (pack && (pack.metadata?.type !== "JournalEntry" || pack.metadata?.packageType !== "world")) throw new Error("Invalid private expedition pack.");
  if (pack && Object.entries(OWNERSHIP).some(([role, level]) => pack.ownership?.[role] !== level)) {
    // Não escreve segredos num compêndio cuja configuração foi aberta a jogadores.
    if (!created) throw new Error("Private expedition pack permissions have changed.");
    await pack.configure({ ownership: OWNERSHIP });
  }
  if (pack?.locked && create) throw new Error("Private expedition pack is locked.");
  return pack;
}

export async function ensureExpeditionPrivateStorage() { await privatePack(true); }

export function canReadExpeditionResult(record, user = globalThis.game?.user) {
  if (!record || !user) return false;
  if (!record.visibility || record.visibility.mode === "publicroll" || user.isGM) return true;
  const { author, recipients = [], blind } = record.visibility;
  return recipients.includes(user.id) || (author === user.id && !blind);
}

export async function readPrivateExpeditionResult(reference, party, slot) {
  if (reference?.restricted && !reference.privateId) throw new Error("Private expedition reference is incomplete.");
  if (!reference?.privateId) return reference;
  const pack = await privatePack();
  const doc = await pack?.getDocument(reference.privateId);
  const record = doc?.flags?.[MODULE_ID]?.expeditionResult;
  // Referências editáveis do Actor não podem apontar para outro grupo ou dia.
  if (!record || record.party !== party.uuid || record.slot !== slot || record.day !== expeditionDayKey(party) || record.revision !== reference.revision) return null;
  return record;
}

export async function storePrivateExpeditionResult(party, slot, result, visibility) {
  if (visibility.mode === "publicroll") return result;
  const pack = await privatePack(true);
  const revision = result.revision ?? globalThis.foundry?.utils?.randomID?.() ?? crypto.randomUUID();
  const record = { ...result, revision, party: party.uuid, day: expeditionDayKey(party), slot, visibility };
  const doc = await pack.documentClass.create({
    name: game.i18n.localize("TENEBRE.Party.PrivateResultDocument"), ownership: { default: 0 },
    flags: { [MODULE_ID]: { expeditionResult: record } }
  }, { pack: pack.collection });
  if (!doc?.id) throw new Error("Private expedition result could not be saved.");
  // Apenas metadados sem resultado, fórmula, bônus ou destinatários no Actor.
  return { rolled: true, restricted: true, privateId: doc.id, revision };
}

// socketlib transmite respostas no canal do módulo. Dados privados nunca retornam
// em texto aberto: cada leitura usa uma chave efêmera, mantida apenas no cliente.
export async function expeditionReadKey() {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  return { privateKey: keys.privateKey, publicKey: Array.from(new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey))) };
}

async function readCipher(privateKey, publicKey) {
  if (!Array.isArray(publicKey) || publicKey.length !== 65 || publicKey.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error("Invalid expedition read key.");
  const key = await crypto.subtle.importKey("raw", new Uint8Array(publicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
  return crypto.subtle.deriveKey({ name: "ECDH", public: key }, privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function sealExpeditionRead(data, publicKey, binding) {
  const keys = await expeditionReadKey();
  const key = await readCipher(keys.privateKey, publicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(binding) }, key, new TextEncoder().encode(JSON.stringify(data)));
  return { publicKey: keys.publicKey, iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
}

export async function openExpeditionRead(envelope, privateKey, binding) {
  const key = await readCipher(privateKey, envelope.publicKey);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(envelope.iv), additionalData: new TextEncoder().encode(binding) }, key, new Uint8Array(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
