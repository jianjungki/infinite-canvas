import assert from "node:assert/strict";

import { resetInterruptedGeneration } from "../src/lib/canvas/canvas-generation-helpers";
import { VideoGenerationTaskFailedError, waitForVideoGenerationTask } from "../src/services/api/video";
import type { AiConfig } from "../src/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

await assert.rejects(
    waitForVideoGenerationTask({} as AiConfig, { id: "expired-plugin-task", provider: "plugin", model: "test-video" }),
    (error) => error instanceof VideoGenerationTaskFailedError && error.message === "插件视频任务已失效，请重新生成",
);

const pendingVideo = {
    id: "video",
    type: CanvasNodeType.Video,
    title: "视频",
    position: { x: 0, y: 0 },
    width: 320,
    height: 180,
    metadata: { status: "loading", videoTask: { id: "task", provider: "openai", model: "test-video" } },
} satisfies CanvasNodeData;
const interruptedImage = { ...pendingVideo, id: "image", type: CanvasNodeType.Image, metadata: { status: "loading" as const } } satisfies CanvasNodeData;
const [restoredVideo, restoredImage] = resetInterruptedGeneration([pendingVideo, interruptedImage]);

assert.equal(restoredVideo.metadata?.status, "loading", "a persisted video task remains resumable after refresh");
assert.equal(restoredImage.metadata?.status, "error", "a non-resumable generation is marked interrupted after refresh");

console.log("video task tests passed");
