# Infinite Canvas R2 Worker

该 Worker 为浏览器提供受访问令牌保护的 R2 读写接口。浏览器不会持有 R2 S3 Access Key 或 Secret。

## 部署

1. `wrangler.jsonc` 已绑定现有的 `canvas-images` 桶，并允许 `http://localhost:3000` 与正式前端 `https://canvas.justhomemaker.com` 访问。
2. 进入本目录后执行 `npm install`，首次部署先执行 `npx wrangler login`。
3. 创建桶：`npx wrangler r2 bucket create <bucket_name>`。
4. 设置 Worker 访问令牌：`npx wrangler secret put ACCESS_TOKEN`。使用独立、随机的高强度字符串，不要使用 R2 S3 密钥。
5. 部署：`npm run deploy`。
6. 应用已默认填写 `https://resources-canvas.justhomemaker.com`，只需在“Cloudflare R2”配置页填写同一访问令牌，测试连接后启用同步。

## 存储内容

- `images/`：启用后的新生成图片和上传图片。
- `prompt-sources/`：每个提示词来源成功拉取后的私有缓存。外部来源仍然是更新数据的上游；本地缓存不存在时，应用会先从 R2 恢复缓存。
- `prompt-images/`：提示词封面和说明中的参考图。Worker 受令牌保护地下载外链图片后写入 R2，浏览器读取时不会在图片地址中暴露令牌。

Worker 只允许读写以上三个前缀。访问令牌保存在浏览器本地配置中，因此配置导出文件包含该令牌，不应公开分享。
