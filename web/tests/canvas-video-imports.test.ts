import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
const videoImport = source.match(/import\s*\{([^}]+)\}\s*from\s*"@\/services\/api\/video"/);

assert.ok(videoImport, "canvas project imports the video API module");
const importedNames = new Set(videoImport[1].split(",").map((name) => name.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]));
for (const name of ["createVideoGenerationTask", "storeGeneratedVideo", "VideoGenerationTaskFailedError", "waitForVideoGenerationTask", "VideoGenerationTask"]) {
    assert.ok(importedNames.has(name), `canvas project imports ${name}`);
}

console.log("canvas video imports tests passed");
