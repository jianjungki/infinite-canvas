import type { ImageReferenceRole, ReferenceImage } from "@/types/image";

export function imageReferenceLabel(index: number) {
    return `图片${index + 1}`;
}

export function imageReferenceRoleLabel(role?: ImageReferenceRole) {
    return role === "style" ? "风格参考" : "内容参考";
}

export function imageReferenceDisplayLabel(image: ReferenceImage, index: number) {
    return `${imageReferenceLabel(index)} · ${imageReferenceRoleLabel(image.role)}`;
}

export function buildImageReferencePromptText(prompt: string, references: ReferenceImage[]) {
    const text = prompt.trim();
    if (!references.length) return text;
    const labels = references.map((image, index) => `${imageReferenceLabel(index)}（${imageReferenceRoleLabel(image.role)}）`);
    const roleGuide = references.some((image) => image.role === "style") ? "内容参考用于主体、结构、姿态和构图；风格参考只用于色彩、材质、光影、笔触和整体视觉语言，不要照搬其中的主体。\n" : "";
    return `参考图片编号：${labels.join("、")}。请按上传顺序和角色理解图片引用。\n${roleGuide}\n${text}`;
}
