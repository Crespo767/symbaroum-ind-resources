import { MODULE_ID } from "./constants.mjs";

export class ChatController {
  static #hooks = [];
  static #registered = false;

  static registerRenderHook(callback) {
    this.#hooks.push(callback);
    if (!this.#registered) {
      this.#registered = true;
      Hooks.on("renderChatMessageHTML", (message, html) => {
        for (const cb of this.#hooks) {
          try {
            cb(message, html);
          } catch (e) {
            console.error(`${MODULE_ID} | Error in renderChatMessageHTML hook:`, e);
          }
        }
      });
    }
  }
}
