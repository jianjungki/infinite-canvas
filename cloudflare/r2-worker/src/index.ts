type WorkerEnv = Env & { ACCESS_TOKEN: string };

const OBJECT_PATH = "/v1/objects/";
const ALLOWED_PREFIXES = ["images/", "prompt-sources/", "prompt-images/"];
const MAX_IMPORTED_IMAGE_BYTES = 20 * 1024 * 1024;

export default {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
        try {
            const cors = corsHeaders(request, env);
            if (!cors) return new Response("Origin not allowed", { status: 403 });
            if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
            if (!(await isAuthorized(request, env))) return text(request, env, "Unauthorized", 401);

            const url = new URL(request.url);
            if (url.pathname === "/health") {
                await env.canvas_images.head("healthcheck");
                return json(request, env, { ok: true });
            }

            const key = parseObjectKey(url);
            if (!key) return text(request, env, "Invalid object key", 400);
            if (request.method === "GET") return getObject(request, env, key);
            if (request.method === "PUT") return putObject(request, env, key);
            if (request.method === "POST" && key.startsWith("prompt-images/")) return importImage(request, env, key);
            if (request.method === "DELETE") return deleteObject(request, env, key);
            return text(request, env, "Method not allowed", 405, { Allow: "GET, PUT, POST, DELETE, OPTIONS" });
        } catch (error) {
            console.error(JSON.stringify({ message: "R2 Worker request failed", error: error instanceof Error ? error.message : String(error), path: new URL(request.url).pathname }));
            return text(request, env, "Internal server error", 500);
        }
    },
} satisfies ExportedHandler<WorkerEnv>;

async function getObject(request: Request, env: WorkerEnv, key: string) {
    const object = await env.canvas_images.get(key);
    if (!object) return text(request, env, "Object not found", 404);
    const headers = corsHeaders(request, env) || new Headers();
    object.writeHttpMetadata(headers);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/octet-stream");
    headers.set("Content-Length", String(object.size));
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "private, max-age=86400");
    return new Response(object.body, { headers });
}

async function putObject(request: Request, env: WorkerEnv, key: string) {
    if (!request.body) return text(request, env, "Request body required", 400);
    const contentType = request.headers.get("Content-Type") || "application/octet-stream";
    await env.canvas_images.put(key, request.body, { httpMetadata: { contentType } });
    return json(request, env, { key }, 201);
}

async function importImage(request: Request, env: WorkerEnv, key: string) {
    let url: URL;
    try {
        const body = (await request.json()) as { url?: unknown };
        url = new URL(typeof body.url === "string" ? body.url : "");
    } catch {
        return text(request, env, "Invalid image URL", 400);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return text(request, env, "Invalid image URL", 400);

    let response: Response;
    try {
        response = await fetch(url, { redirect: "follow" });
    } catch {
        return text(request, env, "Image download failed", 502);
    }
    if (!response.ok) return text(request, env, `Image download failed (${response.status})`, 502);
    const contentType = response.headers.get("Content-Type") || "";
    const contentLength = Number(response.headers.get("Content-Length"));
    if (!contentType.toLowerCase().startsWith("image/") || (Number.isFinite(contentLength) && contentLength > MAX_IMPORTED_IMAGE_BYTES)) return text(request, env, "Invalid image response", 422);
    const data = await response.arrayBuffer();
    if (data.byteLength > MAX_IMPORTED_IMAGE_BYTES) return text(request, env, "Image is too large", 413);
    await env.canvas_images.put(key, data, { httpMetadata: { contentType } });
    return json(request, env, { key }, 201);
}

async function deleteObject(request: Request, env: WorkerEnv, key: string) {
    await env.canvas_images.delete(key);
    return new Response(null, { status: 204, headers: corsHeaders(request, env) || undefined });
}

function parseObjectKey(url: URL) {
    if (!url.pathname.startsWith(OBJECT_PATH)) return null;
    try {
        const key = decodeURIComponent(url.pathname.slice(OBJECT_PATH.length));
        if (!key || key.length > 1024 || key.includes("\0") || key.split("/").some((part) => !part || part === "." || part === "..")) return null;
        return ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix)) ? key : null;
    } catch {
        return null;
    }
}

async function isAuthorized(request: Request, env: WorkerEnv) {
    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token || !env.ACCESS_TOKEN) return false;
    const encoder = new TextEncoder();
    const [tokenHash, expectedHash] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(token)), crypto.subtle.digest("SHA-256", encoder.encode(env.ACCESS_TOKEN))]);
    return crypto.subtle.timingSafeEqual(tokenHash, expectedHash);
}

function corsHeaders(request: Request, env: WorkerEnv) {
    const origin = request.headers.get("Origin");
    if (!origin) return new Headers();
    const allowedOrigins = (env.ALLOWED_ORIGIN || "").split(",").map((item) => item.trim()).filter(Boolean);
    const allowAnyOrigin = allowedOrigins.includes("*");
    if (!allowAnyOrigin && !allowedOrigins.includes(origin)) return null;
    const headers = new Headers({
        "Access-Control-Allow-Origin": allowAnyOrigin ? "*" : origin,
        "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
    });
    if (!allowAnyOrigin) headers.set("Vary", "Origin");
    return headers;
}

function json(request: Request, env: WorkerEnv, value: unknown, status = 200) {
    const headers = corsHeaders(request, env) || new Headers();
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(value), { status, headers });
}

function text(request: Request, env: WorkerEnv, value: string, status: number, extraHeaders?: HeadersInit) {
    const headers = corsHeaders(request, env) || new Headers();
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
    return new Response(value, { status, headers });
}
