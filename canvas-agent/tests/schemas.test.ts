import assert from "node:assert/strict";

import { parseToolInput } from "../src/tools.js";

const input = parseToolInput("canvas_create_node", { nodeType: "group", title: "分组" }) as { nodeType: string };
assert.equal(input.nodeType, "group");

console.log("canvas agent schema tests passed");
