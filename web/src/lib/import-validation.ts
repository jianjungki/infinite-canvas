import { z } from "zod";

import type { CanvasExportFile } from "@/types/canvas-export";
import { CanvasNodeType } from "@/types/canvas";
import type { Asset } from "@/stores/use-asset-store";

const MAX_ITEMS = 10_000;
const MAX_TEXT = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const shortText = z.string().max(10_000);
const idText = z.string().min(1).max(10_000);
const longText = z.string().max(MAX_TEXT);
const finiteNumber = z.number().finite();
const dateText = z.string().min(1).max(64);
const storageKey = z.string().min(1).max(512).regex(/^(image|video|audio|file|video-reference|audio-reference):/);
const safePath = z.string().min(1).max(1024).refine((path) => path.startsWith("files/") && !path.includes("\\") && !path.split("/").includes(".."), "文件路径无效");

const storedImageReferenceSchema = z.object({ source: z.string().min(1).max(MAX_TEXT), role: z.enum(["content", "style"]) }).strict();
const videoTaskSchema = z.object({ id: idText, provider: z.enum(["openai", "seedance"]), model: idText }).strict();
const nodeMetadataSchema = z
    .object({
        content: longText.optional(),
        composerContent: longText.optional(),
        prompt: longText.optional(),
        status: z.enum(["idle", "success", "loading", "error"]).optional(),
        errorDetails: longText.optional(),
        fontSize: finiteNumber.optional(),
        generationMode: z.enum(["text", "image", "video", "audio"]).optional(),
        generationType: z.enum(["generation", "edit"]).optional(),
        model: shortText.optional(),
        size: shortText.optional(),
        quality: shortText.optional(),
        count: finiteNumber.optional(),
        seconds: shortText.optional(),
        vquality: shortText.optional(),
        generateAudio: shortText.optional(),
        watermark: shortText.optional(),
        audioVoice: shortText.optional(),
        audioFormat: shortText.optional(),
        audioSpeed: shortText.optional(),
        audioInstructions: longText.optional(),
        references: z.array(z.string().max(MAX_TEXT)).max(64).optional(),
        imageReferences: z.array(storedImageReferenceSchema).max(64).optional(),
        imageReferenceRole: z.enum(["content", "style"]).optional(),
        videoTask: videoTaskSchema.optional(),
        naturalWidth: finiteNumber.nonnegative().optional(),
        naturalHeight: finiteNumber.nonnegative().optional(),
        freeResize: z.boolean().optional(),
        isBatchRoot: z.boolean().optional(),
        batchRootId: shortText.optional(),
        batchChildIds: z.array(shortText).max(MAX_ITEMS).optional(),
        batchUsesReferenceImages: z.boolean().optional(),
        primaryImageId: shortText.optional(),
        imageBatchExpanded: z.boolean().optional(),
        storageKey: storageKey.optional(),
        mimeType: shortText.optional(),
        bytes: finiteNumber.nonnegative().max(MAX_FILE_BYTES).optional(),
        durationMs: finiteNumber.nonnegative().optional(),
        groupId: shortText.optional(),
    })
    .passthrough();

const nodeSchema = z
    .object({
        id: idText,
        type: z.nativeEnum(CanvasNodeType),
        title: shortText,
        position: z.object({ x: finiteNumber, y: finiteNumber }).strict(),
        width: finiteNumber.positive().max(100_000),
        height: finiteNumber.positive().max(100_000),
        metadata: nodeMetadataSchema.optional(),
    })
    .strict();

const connectionSchema = z.object({ id: idText, fromNodeId: idText, toNodeId: idText }).strict();
const assistantReferenceSchema = z.object({ id: idText, type: z.nativeEnum(CanvasNodeType), title: shortText, dataUrl: longText.optional(), storageKey: storageKey.optional(), text: longText.optional() }).strict();
const assistantMessageSchema = z.object({ id: idText, role: z.enum(["user", "assistant", "system", "tool", "error"]), title: shortText.optional(), text: longText, meta: shortText.optional(), detail: z.unknown().optional(), references: z.array(assistantReferenceSchema).max(256).optional() }).strict();
const assistantSessionSchema = z.object({ id: idText, title: shortText, messages: z.array(assistantMessageSchema).max(MAX_ITEMS), createdAt: dateText, updatedAt: dateText }).strict();
const projectSchema = z
    .object({
        id: idText,
        title: shortText,
        createdAt: dateText,
        updatedAt: dateText,
        nodes: z.array(nodeSchema).max(MAX_ITEMS),
        connections: z.array(connectionSchema).max(MAX_ITEMS * 2),
        chatSessions: z.array(assistantSessionSchema).max(1000),
        activeChatId: shortText.nullable(),
        backgroundMode: z.enum(["dots", "lines", "blank"]),
        showImageInfo: z.boolean(),
        viewport: z.object({ x: finiteNumber, y: finiteNumber, k: finiteNumber.positive().max(100) }).strict(),
    })
    .strict()
    .superRefine((project, context) => {
        const nodeIds = new Set(project.nodes.map((node) => node.id));
        if (nodeIds.size !== project.nodes.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "画布包含重复节点 ID" });
        project.connections.forEach((connection, index) => {
            if (!nodeIds.has(connection.fromNodeId) || !nodeIds.has(connection.toNodeId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["connections", index], message: "连线引用了不存在的节点" });
        });
    });

const fileSchema = z.object({ storageKey, path: safePath, mimeType: shortText, bytes: finiteNumber.nonnegative().max(MAX_FILE_BYTES) }).strict();
const canvasExportSchema = z
    .object({
        app: z.literal("infinite-canvas"),
        version: z.literal(3),
        exportedAt: dateText,
        projects: z.array(z.object({ project: projectSchema, files: z.array(fileSchema).max(2000) }).strict()).max(1000),
    })
    .strict();

const assetBase = { id: shortText, title: shortText, coverUrl: longText, tags: z.array(shortText).max(256), source: shortText.optional(), note: longText.optional(), createdAt: dateText, updatedAt: dateText, metadata: z.record(z.unknown()).optional() };
const assetSchema = z.discriminatedUnion("kind", [
    z.object({ ...assetBase, kind: z.literal("text"), data: z.object({ content: longText }).strict() }).strict(),
    z.object({ ...assetBase, kind: z.literal("image"), data: z.object({ dataUrl: longText, storageKey: storageKey.optional(), width: finiteNumber.nonnegative(), height: finiteNumber.nonnegative(), bytes: finiteNumber.nonnegative().max(MAX_FILE_BYTES), mimeType: shortText }).strict() }).strict(),
    z.object({ ...assetBase, kind: z.literal("video"), data: z.object({ url: longText, storageKey: storageKey.optional(), width: finiteNumber.nonnegative(), height: finiteNumber.nonnegative(), bytes: finiteNumber.nonnegative().max(MAX_FILE_BYTES), mimeType: shortText }).strict() }).strict(),
]);
const assetExportSchema = z.object({ app: z.literal("infinite-canvas"), version: z.literal(1), exportedAt: dateText, assets: z.array(assetSchema).max(MAX_ITEMS), files: z.array(fileSchema).max(2000) }).strict();

export function parseCanvasExport(value: unknown) {
    return parse(canvasExportSchema, value, "画布清单格式无效") as CanvasExportFile;
}

export function parseAssetExport(value: unknown) {
    return parse(assetExportSchema, value, "素材清单格式无效") as { assets: Asset[]; files: Array<{ storageKey: string; path: string; mimeType: string; bytes: number }> };
}

export function assertImportedFile(blob: Blob | undefined, expectedBytes: number, path: string) {
    if (!blob) throw new Error(`压缩包缺少文件：${path}`);
    if (blob.size !== expectedBytes) throw new Error(`文件大小不匹配：${path}`);
    return blob;
}

function parse<T>(schema: z.ZodType<T>, value: unknown, fallback: string) {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    const issue = result.error.issues[0];
    throw new Error(issue ? `${fallback}：${issue.path.join(".") || "root"} ${issue.message}` : fallback);
}
