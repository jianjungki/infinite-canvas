import { saveAs } from "file-saver";

import { defaultR2StorageConfig, useConfigStore, type AiConfig, type R2StorageConfig, type WebdavSyncConfig } from "@/stores/use-config-store";
import { usePromptSourceStore, type PromptSourceSchedule } from "@/stores/use-prompt-source-store";
import type { PromptSource } from "@/services/api/prompt-source-presets";

type AppConfigFile = {
    app: "infinite-canvas";
    version: 1;
    exportedAt: string;
    config: AiConfig;
    webdav: WebdavSyncConfig;
    r2?: R2StorageConfig;
    promptSources: {
        sources: PromptSource[];
        schedule: PromptSourceSchedule;
    };
};

export function exportAppConfig() {
    const { config, webdav, r2 } = useConfigStore.getState();
    const { sources, schedule } = usePromptSourceStore.getState();
    const data: AppConfigFile = { app: "infinite-canvas", version: 1, exportedAt: new Date().toISOString(), config, webdav, r2, promptSources: { sources, schedule } };
    saveAs(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }), "infinite-canvas-config.json");
}

export async function importAppConfig(file: File) {
    let data: AppConfigFile;
    try {
        data = JSON.parse(await file.text()) as AppConfigFile;
    } catch {
        throw new Error("配置文件格式不正确");
    }
    if (data.app !== "infinite-canvas" || data.version !== 1 || !data.config || !data.webdav || !data.promptSources) throw new Error("配置文件格式不正确");
    const r2 = { ...defaultR2StorageConfig, ...(data.r2 || {}) };
    r2.workerUrl = r2.workerUrl.trim() || defaultR2StorageConfig.workerUrl;
    useConfigStore.setState({ config: data.config, webdav: data.webdav, r2 });
    usePromptSourceStore.setState(data.promptSources);
}
