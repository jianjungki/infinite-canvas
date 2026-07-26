import { unzip, zipSync } from "fflate";

type ZipFile = {
    name: string;
    data: BlobPart;
};

export async function createZip(files: ZipFile[]) {
    const entries = await Promise.all(
        files.map(async (file) => {
            const data = new Uint8Array(await new Blob([file.data]).arrayBuffer());
            return [file.name, data] as const;
        }),
    );
    return new Blob([zipSync(Object.fromEntries(entries), { level: 0 })], { type: "application/zip" });
}

export async function readZip(file: Blob) {
    if (file.size > MAX_ZIP_BYTES) throw new Error("压缩包不能超过 512MB");
    const input = new Uint8Array(await file.arrayBuffer());
    let entryCount = 0;
    let unpackedBytes = 0;
    let limitError: Error | null = null;
    const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        unzip(
            input,
            {
                filter: (entry) => {
                    entryCount += 1;
                    unpackedBytes += entry.originalSize;
                    if (!isSafeZipPath(entry.name)) limitError ||= new Error("压缩包包含无效文件路径");
                    if (entryCount > MAX_ZIP_ENTRIES) limitError ||= new Error("压缩包文件数量过多");
                    if (entry.originalSize > MAX_ZIP_ENTRY_BYTES || unpackedBytes > MAX_ZIP_BYTES) limitError ||= new Error("压缩包解压后体积过大");
                    return !limitError;
                },
            },
            (error, data) => {
                if (limitError) reject(limitError);
                else if (error) reject(error);
                else resolve(data);
            },
        );
    });
    return new Map(Object.entries(entries).map(([name, data]) => [name, new Blob([data])]));
}

const MAX_ZIP_BYTES = 512 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 2000;

function isSafeZipPath(path: string) {
    return Boolean(path && !path.includes("\\") && !path.includes("\0") && !path.startsWith("/") && !path.split("/").includes(".."));
}
