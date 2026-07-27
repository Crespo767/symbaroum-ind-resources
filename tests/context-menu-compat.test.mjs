import assert from "node:assert/strict";
import test from "node:test";

import { buildContextMenuEntry } from "../scripts/compatibility.mjs";

test("context menu entries normalize the public Foundry v13 contract", () => {
  const target = { id: "stored-item" };
  const clicks = [];
  const entry = buildContextMenuEntry({
    label: "Split",
    icon: '<i class="fas fa-code-branch"></i>',
    visible: (element) => element === target,
    onClick: (element, event) => clicks.push({ element, event })
  }, 13);

  assert.equal(entry.name, "Split");
  assert.equal(entry.label, undefined);
  assert.equal(entry.condition({ 0: target }), true);
  entry.callback({ 0: target });
  assert.deepEqual(clicks, [{ element: target, event: undefined }]);
});

test("context menu entries normalize the public Foundry v14 contract", () => {
  const target = { id: "stored-item" };
  const event = { type: "click" };
  const clicks = [];
  const entry = buildContextMenuEntry({
    label: "Split",
    icon: '<i class="fas fa-code-branch"></i>',
    visible: (element) => element === target,
    onClick: (element, pointerEvent) => clicks.push({ element, pointerEvent })
  }, 14);

  assert.equal(entry.label, "Split");
  assert.equal(entry.name, undefined);
  assert.equal(entry.visible(target), true);
  entry.onClick(event, target);
  assert.deepEqual(clicks, [{ element: target, pointerEvent: event }]);
});
