import localforage from "localforage";

import { nanoid } from "nanoid";
import { readImageMeta } from "@/lib/image-utils";
import { createR2ImageStorageKey, deleteR2Object, getR2Object, isR2ImageStorageKey, isR2StorageEnabled, putR2Object, r2ImageObjectKey } from "@/services/r2-storage";

export type UploadedImage = {
    url: string;
    storageKey: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

const store = localforage.createInstance({ name: "infinite-canvas", storeName: "image_files" });
const objectUrls = new Map<string, string>();

export async function uploadImage(input: string | Blob): Promise<UploadedImage> {
    const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
    const storageKey = isR2StorageEnabled() ? createR2ImageStorageKey(nanoid()) : `image:${nanoid()}`;
    const url = URL.createObjectURL(blob);
    const meta = await readImageMeta(url);
    const mimeType = blob.type || meta.mimeType || "application/octet-stream";
    try {
        if (isR2ImageStorageKey(storageKey)) await putR2Object(r2ImageObjectKey(storageKey), blob, mimeType);
        else await store.setItem(storageKey, blob);
    } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
    }
    objectUrls.set(storageKey, url);
    return { url, storageKey, width: meta.width, height: meta.height, bytes: blob.size, mimeType };
}

export async function resolveImageUrl(storageKey?: string, fallback = "") {
    if (!storageKey) return fallback;
    const cached = objectUrls.get(storageKey);
    if (cached) return cached;
    const blob = isR2ImageStorageKey(storageKey) ? await getR2Object(r2ImageObjectKey(storageKey)) : await store.getItem<Blob>(storageKey);
    if (!blob) return fallback;
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

export async function getImageBlob(storageKey: string) {
    return isR2ImageStorageKey(storageKey) ? getR2Object(r2ImageObjectKey(storageKey)) : store.getItem<Blob>(storageKey);
}

export async function setImageBlob(storageKey: string, blob: Blob) {
    if (isR2ImageStorageKey(storageKey)) await putR2Object(r2ImageObjectKey(storageKey), blob, blob.type || "application/octet-stream");
    else await store.setItem(storageKey, blob);
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

export async function imageToDataUrl(image: { url?: string; dataUrl?: string; storageKey?: string }) {
    const url = image.dataUrl || (await resolveImageUrl(image.storageKey, image.url || ""));
    if (!url || url.startsWith("data:")) return url;
    return blobToDataUrl(await (await fetch(url)).blob());
}

export async function deleteStoredImages(keys: Iterable<string>) {
    await Promise.all(
        Array.from(new Set(keys)).map(async (key) => {
            const url = objectUrls.get(key);
            if (url) URL.revokeObjectURL(url);
            objectUrls.delete(key);
            if (isR2ImageStorageKey(key)) await deleteR2Object(r2ImageObjectKey(key));
            else await store.removeItem(key);
        }),
    );
}

export async function cleanupUnusedImages(usedData: unknown) {
    const usedKeys = collectImageStorageKeys(usedData);
    const unused: string[] = [];
    await store.iterate((_value, key) => {
        if (!usedKeys.has(key)) unused.push(key);
    });
    await deleteStoredImages(unused);
}

export function collectImageStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.startsWith("image:")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectImageStorageKeys(child, keys)) : collectImageStorageKeys(item, keys)));
    return keys;
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}
