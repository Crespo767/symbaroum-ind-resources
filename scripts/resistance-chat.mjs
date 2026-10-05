import { ChatController } from "./chat-controller.mjs";
const SYMBAROUM_SYSTEM_ID = "symbaroum";
const RESISTANCE_ROLL_FLAG = "resistRoll";
const pendingResistanceMessages = new Set();

export class ResistanceChatService {
  static #registered = false;

  static register() {
    if (this.#registered) return;
    this.#registered = true;

    ChatController.registerRenderHook( (message, html) => {
      bindResistancePrompt(message, html);
    });

    Hooks.on("updateChatMessage", (message) => {
      void removeCompletedResistancePrompt(message).catch((error) => {
        console.warn("Symbaroum Ind Resources | Could not remove the completed resistance prompt.", error);
      });
    });

    Hooks.on("deleteChatMessage", (message) => {
      pendingResistanceMessages.delete(message?.id);
    });
  }
}

export function bindResistancePrompt(message, html, pending = pendingResistanceMessages) {
  if (!message?.id || !message.getFlag?.(SYMBAROUM_SYSTEM_ID, RESISTANCE_ROLL_FLAG)) return false;

  const scope = html?.querySelectorAll ? html : html?.[0];
  if (!scope?.querySelectorAll) return false;

  let bound = false;
  for (const button of scope.querySelectorAll("#applyEffect")) {
    if (button.dataset.tenebreResistanceRemoval === "true") continue;
    button.dataset.tenebreResistanceRemoval = "true";
    button.addEventListener("click", () => pending.add(message.id), { capture: true });
    bound = true;
  }
  return bound;
}

export async function removeCompletedResistancePrompt(message, pending = pendingResistanceMessages) {
  if (!message?.id || !pending.has(message.id)) return false;
  if (message.getFlag?.(SYMBAROUM_SYSTEM_ID, RESISTANCE_ROLL_FLAG)) return false;

  await message.delete();
  pending.delete(message.id);
  return true;
}
