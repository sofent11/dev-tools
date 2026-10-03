# 程序员百宝箱

基于 React、TypeScript、Vite 和 Tailwind CSS 的浏览器工具箱。当前提供 8 个分类、13 个 Studio 和 84 个工具标签，涵盖数据格式、文本编码、网络请求、前端样式、文件媒体、安全密钥、时间生成器及 3D/CAD。

完整工具、地址和成熟度见[自动生成的工具目录](docs/tool-catalog.md)。目录来源是注册的 Studio 定义；搜索可以直接定位子工具。逐页功能、优化和删除依据见[功能审查记录](docs/feature-audit.md)。

## 本地运行

需要 Node.js 22.13 或以上、npm。

```bash
npm ci
npm run dev
```

开发服务默认地址为 `http://localhost:3000`。安装后会从锁定的 npm 依赖生成本地运行时文件，并检查资源清单。无需配置 AI API Key；当前版本不提供 AI 助手。

## 验证和构建

```bash
npm run verify          # 严格类型、Lint、目录/文档/资源检查、单测、审计、构建预算与生产 E2E
npm run build
npm run preview        # 预览 dist
npm run catalog:generate # 修改 Studio 后重新生成搜索与文档目录
npm run assets:prepare # 修改运行时依赖后重新生成文件和 SHA-256 清单
```

E2E 使用独立端口 4173 的生产预览，固定中文环境，并覆盖语言切换、真实文件、任务取消和数据保留。英文全目录检查包含在 E2E 中，也可对已启动的站点单独运行：

```bash
CHECK_I18N_APP_URL=http://127.0.0.1:4173 npm run check:i18n:visible
```

## 路由

```text
/tools/data-format-studio#json
/tools/file-document-studio#pdf
/tools/image-media-studio#animation-frame
/tools/cad-geometry-studio#smart-geometry
```

支持浏览器前进/后退和标签深链。已有旧工作室和单工具地址兼容跳转到当前入口；新增链接请使用工具目录里的地址。无效工具地址回退到默认工具，非法 URL 编码不会使应用崩溃。

## 数据和资源边界

- 普通文本工具的主要输入在当前标签页内保留草稿；刷新后清除。草稿有 8 MB 总预算，单项约 1 MB 输入限制，超过预算的旧草稿会被淘汰。文件、Canvas、模型和 Worker 不会作为草稿常驻内存。
- 暂存箱中的普通条目保存在本地 IndexedDB，小文本另有元数据副本。敏感条目只保留于当前会话，不写入 IndexedDB 或 localStorage，刷新后清除。旧版标记为敏感的记录在迁移时清理。
- 文件读取、转换和密钥计算不会主动上传到业务后端。HTTP/WebSocket/IP 查询和视频解析是联网工具，会向所选目标或 Worker 发送请求。
- PDF、SQLite、OpenPGP、国密、图片压缩 Worker、密码强度、GIF、Lottie 和 MediaPipe WASM 随站点部署。经典脚本和 WASM 通过资源清单校验 SHA-256；PDF ES 模块及其 worker 在构建阶段检查，不宣称浏览器动态 import 自带完整性校验。
- NuGet CMS/X.509 解析使用随构建按需加载的 PKIjs/ASN1js，指纹由浏览器 WebCrypto 计算；不依赖 node-forge 或外部 CDN。证书信息和签名者标记不代表签名、信任链、时间戳或吊销状态验证。
- 人脸模型和首饰字体仍需要外部资源；人脸模型失败可手动裁剪。浏览器缓存不可用时，本站运行时仍可直接加载。
- 视频解析默认提供 sopace 公共 Worker，也支持自有 Worker。它改善部分 CORS 抓取限制，不绕过登录、DRM、地区或平台权限限制。自有 Worker 配置见 [workers/README.md](workers/README.md)。

## 计算边界

- JSON Schema 使用严格 draft-07 校验，未知关键字、其他不支持的规范及不满足的约束会报告错误；支持标准格式校验。生成结果是样本推导，不代表完整业务规则。生成与校验均在 Worker 中运行，预算 2.5 秒、合计 2 MB 输入。
- 正则测试在 Worker 中执行，单次计算预算 1.5 秒，最多 1 MB 文本、10 KB 表达式和 1,000 个匹配。
- SQLite 在独立 Worker 中运行，单任务 10 秒，数据库 64 MB，结果最多 1,000 行/2 MB。失败或取消不会替换上次成功的数据库快照。离开工具会释放数据库；需要长期保留时请导出。
- PDF 每批最多 120 页；大文件请分批处理。动画最多 500 帧，并限制累计像素和导出内存。APNG/WebP 依赖浏览器 WebCodecs ImageDecoder。
- STL 壁厚为采样估算，CSG/Voronoi 为实验级几何处理；导出后应继续复核尺寸、拓扑和可制造性。

## 部署

将 `dist/` 部署到支持 SPA fallback 的静态服务器。Vercel 配置已包含路由回退。构建时不要排除 `public/vendor` 的生成步骤；最终站点必须包含这些运行时资源和许可证声明。

## 维护约定

- `components/tools/registry.ts` 和被注册的 Studio 定义是工具目录来源，`src/tool-catalog.json` 与 `docs/tool-catalog.md` 是生成结果。
- 计算逻辑优先放入可测试的领域模块；不可预测的计算放进可取消的 Worker。共享存储、资源加载、草稿和任务执行位于 `components/tools/shared`。
- 国际化在 React 渲染阶段处理界面字符串，不遍历或改写用户数据、编辑器内容和 DOM。新增界面文字需同时补充英文翻译。
- 依赖审计明确使用官方 npm 审计端点；不以镜像源缺少审计接口当成检查通过。
