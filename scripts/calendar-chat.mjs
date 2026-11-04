import { MODULE_ID } from "./constants.mjs";
import { ChatController } from "./chat-controller.mjs";
import { validateCalendarDate } from "./calendar-date.mjs";
import { readCalendarClientOptions, formatCalendarTime } from "./calendar-options.mjs";
import { formatCalendarDate } from "./calendar-view.mjs";

/** Store timestamps when messages are authored; rendering only reads the saved snapshot. */
export function stampCalendarMessage(message, service) {
  const date = service.getDate();
  if (!date || !globalThis.game?.settings?.get(MODULE_ID, "enableCalendar")) return false;
  message.updateSource({ [`flags.${MODULE_ID}.calendarTimestamp`]: { date, time: service.getTime() } });
  return true;
}
export function renderCalendarTimestamp(message, element) {
  const root = element?.[0] ?? element;
  const preferences = readCalendarClientOptions();
  root?.querySelector?.(".tenebre-calendar-chat-time")?.remove();
  if (!preferences.chatTimestamp || !game.settings.get(MODULE_ID, "enableCalendar")) return false;
  const stamp = message.getFlag?.(MODULE_ID, "calendarTimestamp");
  if (!stamp || !Number.isFinite(stamp.time)) return false;
  let date;
  try { date = validateCalendarDate(stamp.date); } catch { return false; }
  const host = root?.querySelector?.(".message-metadata");
  if (!host) return false;
  const label = document.createElement("time");
  label.className = "tenebre-calendar-chat-time";
  label.textContent = `${formatCalendarDate(date)} · ${formatCalendarTime(stamp.time, preferences)}`;
  host.append(label);
  return true;
}
export function registerCalendarChat(service) {
  Hooks.on("preCreateChatMessage", message => stampCalendarMessage(message, service));
  ChatController.registerRenderHook(renderCalendarTimestamp);
}
