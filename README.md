# 程序员百宝箱

一个基于 React、Vite 和 Tailwind CSS 的浏览器端开发工具箱，集成常用文本处理、格式转换、网络调试、安全计算、图片/PDF 处理、AI 辅助和若干定制化交互工具。

## 功能概览

### 编码 / 文本

- JSON 格式化、压缩与校验
- JSON 转 TypeScript / Go / Java 代码
- XML 格式化与 XML / JSON 转换
- YAML / JSON 互转
- CSV / JSON 互转
- Base64 编码与解码
- URL 编码与解码
- HTML / Unicode 转义与反转义
- Markdown 预览
- 大小写命名转换
- 文本去重、排序、全半角转换等批处理
- Slug 生成
- 文本统计
- JavaScript 正则表达式测试
- 简易文本差异对比

### 时间 / 日期

- Unix 时间戳与日期时间互转
- 日期差值计算

### 网络 / Web

- 简易 HTTP 请求构造器
- URL 结构解析与查询参数拆解
- User Agent 解析
- 本机公网 IP 信息查询
- 浏览器、屏幕、系统等设备信息查看

### 加密 / 安全

- JWT Header / Payload 解码
- SHA-1、SHA-256、SHA-512 Hash 生成
- HMAC-SHA256 计算
- 可配置随机密码生成

### 前端 / UI / 文件

- PX / REM 单位转换
- Hex / RGB 颜色转换与预览
- 二维码生成
- 图片压缩与格式转换
- 贴纸图 / 素材图自动切片，并支持单图或 ZIP 下载
- 大头照提取：基于 MediaPipe 自动识别人脸并生成裁剪图
- PDF 合并
- PDF 页面转 PNG 图片
- 本地 WebGL 换脸工具

### 运维与生成器

- Chmod 权限计算
- UUID v4 生成
- 随机字符串与 NanoID 生成

### 定制工具

- AI 首饰文字定制：加载字体、生成可制造的文字轮廓，支持拖拽、缩放、旋转、工艺参数调整和 SVG 导出
- 小学几何解题工作区：加载 / 保存题目 JSON，支持交互画辅助线、移动端点、撤销、清空，以及教学模式展示

### AI 助手

- 内置 Gemini 代码助手，可用于代码解释、正则编写、格式转换等简短开发问答

## 技术栈

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- lucide-react
- Google GenAI SDK
- MediaPipe Tasks Vision / Face Mesh
- Konva / React Konva
- pdf-lib / pdfjs-dist
- quicktype-core
- browser-image-compression
- js-yaml / fast-xml-parser / papaparse
- marked / react-markdown / KaTeX
- Zustand

## 本地运行

### 环境要求

- Node.js 18 或更高版本
- npm

### 安装依赖

```bash
npm install
```

### 配置环境变量

AI 助手需要 Gemini API Key。新建 `.env.local`：

```bash
GEMINI_API_KEY=your_gemini_api_key
```

如果不使用 AI 助手，可以跳过该配置；其他本地工具仍可正常使用。

### 启动开发服务

```bash
npm run dev
```

默认监听：

```text
http://localhost:3000
```

## 常用脚本

```bash
npm run dev      # 启动 Vite 开发服务
npm run build    # 生产构建
npm run preview  # 预览生产构建
npm run lint     # ESLint 检查
```

## 路由说明

应用支持工具深链访问：

```text
/tools/json
/tools/pdf
/tools/image
/tools/smart-geometry
```

侧边栏切换工具时会同步更新浏览器地址，刷新页面后会恢复到对应工具。

## 部署

项目是标准 Vite 单页应用，可部署到 Vercel、Netlify、静态服务器或任意支持 SPA fallback 的环境。

生产构建：

```bash
npm run build
```

构建产物位于 `dist/`。

## 注意事项

- 大多数工具在浏览器端完成处理，上传的图片、PDF、文本不会主动提交到业务后端。
- AI 助手会调用 Gemini API，请不要在提示词中输入敏感信息。
- 大头照、换脸、首饰字体加载等功能会从 CDN 或公开字体仓库加载模型 / 脚本 / 字体资源，需要网络可用。
- HTTP 请求工具受浏览器 CORS 策略限制。
