import localforage from "localforage";

export type SyncDomainKey = "canvas" | "assets" | "image-workbench" | "video-workbench";
export type SyncTombstone = { id: string; deletedAt: string };

const store = localforage.createInstance({ name: "infinite-canvas", storeName: "sync_tombstones" });
const queues = new Map<SyncDomainKey, Promise<void>>();

export function recordSyncDeletions(domain: SyncDomainKey, ids: Iterable<string>) {
    const tombstones = Array.from(new Set(ids)).filter(Boolean).map((id) => ({ id, deletedAt: new Date().toISOString() }));
    if (!tombstones.length) return;
    void enqueue(domain, async () => {
        const current = await read(domain);
        await store.setItem(domain, mergeSyncTombstones(current, tombstones));
    });
}

export async function getSyncTombstones(domain: SyncDomainKey) {
    await queues.get(domain);
    return read(domain);
}

export async function replaceSyncTombstones(domain: SyncDomainKey, tombstones: SyncTombstone[]) {
    await enqueue(domain, () => store.setItem(domain, mergeSyncTombstones([], tombstones)));
}

export function mergeSyncTombstones(...groups: SyncTombstone[][]) {
    const merged = new Map<string, SyncTombstone>();
    groups.flat().forEach((item) => {
        if (!item?.id || !item.deletedAt) return;
        const deletedAt = Date.parse(item.deletedAt);
        if (!Number.isFinite(deletedAt)) return;
        const current = merged.get(item.id);
        if (!current || deletedAt >= Date.parse(current.deletedAt)) merged.set(item.id, item);
    });
    return Array.from(merged.values()).sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
}

function enqueue(domain: SyncDomainKey, task: () => Promise<unknown>) {
    const next = (queues.get(domain) || Promise.resolve())
        .then(task)
        .then(() => undefined)
        .catch((error) => console.error(`${domain} 删除记录保存失败`, error));
    queues.set(domain, next);
    next.then(() => {
        if (queues.get(domain) === next) queues.delete(domain);
    });
    return next;
}

async function read(domain: SyncDomainKey) {
    const value = await store.getItem<SyncTombstone[]>(domain);
    return Array.isArray(value) ? mergeSyncTombstones([], value) : [];
}
