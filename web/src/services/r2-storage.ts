import { useConfigStore, type R2StorageConfig } from "@/stores/use-config-store";

const R2_IMAGE_STORAGE_PREFIX = "image:r2:";
const R2_IMAGE_OBJECT_PREFIX = "images/";

export function isR2StorageConfigured(config = useConfigStore.getState().r2) {
    return Boolean(config.workerUrl.trim() && config.accessToken.trim());
}

export function isR2StorageEnabled(config = useConfigStore.getState().r2) {
    return config.enabled && isR2StorageConfigured(config);
}

export function createR2ImageStorageKey(id: string) {
    return `${R2_IMAGE_STORAGE_PREFIX}${id}`;
}

export function isR2ImageStorageKey(storageKey: string) {
    return storageKey.startsWith(R2_IMAGE_STORAGE_PREFIX);
}

export function r2ImageObjectKey(storageKey: string) {
    if (!isR2ImageStorageKey(storageKey)) throw new Error("R2 图片存储标识无效");
    return `${R2_IMAGE_OBJECT_PREFIX}${storageKey.slice(R2_IMAGE_STORAGE_PREFIX.length)}`;
}

export function promptSourceObjectKey(sourceId: string) {
    return `prompt-sources/${encodeURIComponent(sourceId)}.json`;
}

export function promptImageObjectKey(sourceId: string, promptId: string, name: string) {
    return `prompt-images/${encodeURIComponent(sourceId)}/${encodeURIComponent(promptId)}/${name}`;
}

export async function putR2Object(key: string, body: Blob | string, contentType: string) {
    await r2Request(key, { method: "PUT", body, headers: { "Content-Type": contentType } });
}

export async function getR2Object(key: string) {
    return (await r2Request(key)).blob();
}

export async function deleteR2Object(key: string) {
    await r2Request(key, { method: "DELETE" });
}

export async function importR2Image(key: string, url: string) {
    await r2Request(key, { method: "POST", body: JSON.stringify({ url }), headers: { "Content-Type": "application/json" } });
}

export async function testR2Connection(config: R2StorageConfig) {
    const response = await fetch(`${workerBaseUrl(config)}/health`, { headers: authorizationHeaders(config) });
    if (!response.ok) throw new Error(await r2ErrorMessage(response));
}

async function r2Request(key: string, init: RequestInit = {}) {
    const config = useConfigStore.getState().r2;
    if (!isR2StorageConfigured(config)) throw new Error("请先填写 Cloudflare R2 Worker 地址和访问令牌");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.accessToken.trim()}`);
    const response = await fetch(`${workerBaseUrl(config)}/v1/objects/${encodeObjectKey(key)}`, { ...init, headers });
    if (!response.ok) throw new Error(await r2ErrorMessage(response));
    return response;
}

function workerBaseUrl(config: R2StorageConfig) {
    return config.workerUrl.trim().replace(/\/+$/, "");
}

function authorizationHeaders(config: R2StorageConfig) {
    if (!isR2StorageConfigured(config)) throw new Error("请先填写 Cloudflare R2 Worker 地址和访问令牌");
    return { Authorization: `Bearer ${config.accessToken.trim()}` };
}

function encodeObjectKey(key: string) {
    return key
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
}

async function r2ErrorMessage(response: Response) {
    const text = (await response.text()).trim();
    return text || `R2 请求失败 (${response.status})`;
}
