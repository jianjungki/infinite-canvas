import assert from "node:assert/strict";

import { buildImageReferencePromptText } from "../src/lib/image-reference-prompt";

const prompt = buildImageReferencePromptText("生成一张海报", [
    { id: "content", name: "content.png", type: "image/png", dataUrl: "data:image/png;base64,AA==", role: "content" },
    { id: "style", name: "style.png", type: "image/png", dataUrl: "data:image/png;base64,AA==", role: "style" },
]);

assert.match(prompt, /图片1（内容参考）/);
assert.match(prompt, /图片2（风格参考）/);
assert.match(prompt, /风格参考只用于色彩、材质、光影、笔触/);

console.log("image reference prompt tests passed");
