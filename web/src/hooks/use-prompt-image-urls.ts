import { useEffect, useState } from "react";

import { getR2Object, isR2StorageConfigured } from "@/services/r2-storage";
import { useConfigStore } from "@/stores/use-config-store";

const objectUrls = new Map<string, string>();
const loadingUrls = new Map<string, Promise<string>>();

export function usePromptImageUrl(fallbackUrl: string, storageKey?: string) {
    return usePromptImageUrls([fallbackUrl], [storageKey || ""])[0] || "";
}

export function usePromptImageUrls(fallbackUrls: string[], storageKeys: string[] = []) {
    const r2Signature = useConfigStore((state) => `${state.r2.workerUrl}\n${state.r2.accessToken}`);
    const signature = JSON.stringify([fallbackUrls, storageKeys]);
    const [urls, setUrls] = useState(fallbackUrls);

    useEffect(() => {
        let cancelled = false;
        setUrls(fallbackUrls);
        if (!isR2StorageConfigured()) return;
        void Promise.all(fallbackUrls.map((fallbackUrl, index) => resolvePromptImageUrl(fallbackUrl, storageKeys[index]))).then((nextUrls) => {
            if (!cancelled) setUrls(nextUrls);
        });
        return () => {
            cancelled = true;
        };
    }, [r2Signature, signature]);

    return urls;
}

async function resolvePromptImageUrl(fallbackUrl: string, storageKey?: string) {
    if (!storageKey) return fallbackUrl;
    const cached = objectUrls.get(storageKey);
    if (cached) return cached;
    const loading = loadingUrls.get(storageKey) || getR2Object(storageKey).then((blob) => {
        const url = URL.createObjectURL(blob);
        objectUrls.set(storageKey, url);
        return url;
    });
    loadingUrls.set(storageKey, loading);
    try {
        return await loading;
    } catch {
        loadingUrls.delete(storageKey);
        return fallbackUrl;
    }
}
