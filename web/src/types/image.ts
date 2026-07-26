export type ImageReferenceRole = "content" | "style";

export type ReferenceImage = {
    id: string;
    name: string;
    type: string;
    dataUrl: string;
    url?: string;
    storageKey?: string;
    role?: ImageReferenceRole;
};
