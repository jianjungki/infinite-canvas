import assert from "node:assert/strict";

import { parseCanvasExport } from "../src/lib/import-validation";

const project = {
    id: "project-1",
    title: "测试画布",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    nodes: [{ id: "image-1", type: "image", title: "参考图", position: { x: 0, y: 0 }, width: 320, height: 320, metadata: { imageReferenceRole: "style" } }],
    connections: [],
    chatSessions: [],
    activeChatId: null,
    backgroundMode: "lines",
    showImageInfo: false,
    viewport: { x: 0, y: 0, k: 1 },
};

assert.equal(parseCanvasExport({ app: "infinite-canvas", version: 3, exportedAt: project.updatedAt, projects: [{ project, files: [] }] }).projects[0].project.nodes[0].metadata?.imageReferenceRole, "style");
assert.throws(() => parseCanvasExport({ app: "infinite-canvas", version: 3, exportedAt: project.updatedAt, projects: [{ project: { ...project, connections: [{ id: "edge", fromNodeId: "missing", toNodeId: "image-1" }] }, files: [] }] }), /不存在的节点/);
assert.throws(() => parseCanvasExport({ app: "infinite-canvas", version: 3, exportedAt: project.updatedAt, projects: [{ project, files: [{ storageKey: "image:test", path: "../escape.png", mimeType: "image/png", bytes: 1 }] }] }), /文件路径无效/);

console.log("import validation tests passed");
