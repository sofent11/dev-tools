# 全页面功能审查

更新日期：2026-10-03。范围为当前注册的 13 个工作室、84 个工具页面，以及页面内的子模式、参数、输入输出、复制、下载、暂存、取消和恢复操作。

## 判断与实施

逐项以实际用途、结果正确性、操作成本和维护成本判断是否保留。保留有明确用途的功能；修复真实的数据、状态和导出缺陷；删除没有实现的选择项、无消费者的旧组件和重复目录。既有链接、用户输入、敏感条目的会话边界及任务取消保护继续保留。

- 保留 Atelier 主题和按任务组织的交互，合并主线已完成的本地运行库、草稿、存储和 Worker 可靠性基础。
- JSON 代码生成只提供六个真实目标；删除只有注释输出的 C#、Swift 和 Kotlin 选项。删除零注册、零导入的旧时间组件及静态安全说明组件。
- 修复 SQL、HTML、XML、JSON 合并和人民币大写的语义或精度问题；补齐真正的密钥导入配对、代码序列化和均匀随机数生成。
- 修复抠图遮罩、PDF 原始旋转、CSG 索引几何与变换、首饰实体对齐/物理单位和媒体导出的旧结果问题。
- 为网络和媒体任务补齐取消、超时、输入预算、资源释放与异步结果隔离；缓存或暂存失败不再伪装成请求失败或保存成功。
- 名称与能力一致：色键抠图、文字首饰定制、几何练习、PEM/证书解析，以及单向文件转 Base64 不再承诺未实现的能力。

## 验证边界

下面的矩阵区分源码审查、核心算法测试和实际浏览器验证。英文目录测试遍历所有 84 个页面；它证明初始界面与加载状态，不代替每种输入组合的功能验证。网络测试采用拦截或本地 Mock，没有使用真实生产凭据或私人文件。

已移除受 [node-forge RSA PKCS#1 v1.5 签名验证公告](https://github.com/advisories/GHSA-86w9-cpqp-85rv)影响的依赖、类型包和旧生成资源。NuGet CMS/X.509 元数据改用构建内按需加载的 PKIjs/ASN1js；SHA-1/SHA-256 指纹与 PEM 均基于原始证书 DER，签名者按 issuer/serial 或 SubjectKeyIdentifier 匹配。解析有大小、层级、节点数和证书数限制，但不承诺密码学签名或证书信任验证。开发依赖 brace-expansion 定向升级到兼容补丁版本。生产与全依赖审计均为零漏洞，保留 `audit:prod` 门禁。此前已升级有修复版本的 fast-uri。

真实第三方 API/CORS/受限视频可用性、Safari/Firefox、实际设备、生产密钥与证书信任链、CAD 可制造性仍需对应环境和样本验证。人脸模型与首饰字体还可能依赖外部资源。

## 页面覆盖索引

索引与当前生成目录一致。详细功能和判断见后续四组矩阵；全局共享交互单独列出。

| 工具 | 当前路由 | 详细审查组 |
| --- | --- | --- |
| JSON 格式化 | `/tools/data-format-studio#json` | 内容、结构与编码 |
| JSON 转代码 | `/tools/data-format-studio#json2ts` | 内容、结构与编码 |
| JSON Schema | `/tools/data-format-studio#json-schema` | 内容、结构与编码 |
| XML 工具 | `/tools/data-format-studio#xml` | 内容、结构与编码 |
| YAML ↔ JSON | `/tools/data-format-studio#yaml` | 内容、结构与编码 |
| CSV ↔ JSON | `/tools/data-format-studio#csv` | 内容、结构与编码 |
| JSON 结构化对比 | `/tools/data-format-studio#json-diff` | 内容、结构与编码 |
| GitHub 仓库浏览器 | `/tools/repo-dependency-studio#github-repos` | 仓库、CAD 与媒体 |
| GitHub 组织关联研究 | `/tools/repo-dependency-studio#github-org-research` | 仓库、CAD 与媒体 |
| 仓库文件夹下载 | `/tools/repo-dependency-studio#repo-folder-download` | 仓库、CAD 与媒体 |
| NuGet 依赖树 | `/tools/repo-dependency-studio#nuget-deps` | 仓库、CAD 与媒体 |
| PyPI 依赖树 | `/tools/repo-dependency-studio#pypi-deps` | 仓库、CAD 与媒体 |
| Rust Crate 依赖树 | `/tools/repo-dependency-studio#rust-deps` | 仓库、CAD 与媒体 |
| NuGet 签名检查 | `/tools/repo-dependency-studio#nuget-signature` | 仓库、CAD 与媒体 |
| SQL 格式化 | `/tools/sql-database-studio#sql-format` | 内容、结构与编码 |
| SQLite WASM 沙箱 | `/tools/sql-database-studio#sqlite-sandbox` | 内容、结构与编码 |
| 大小写转换 | `/tools/text-markup-studio#case` | 内容、结构与编码 |
| 文本处理 | `/tools/text-markup-studio#text-manip` | 内容、结构与编码 |
| Slug 生成 | `/tools/text-markup-studio#slug` | 内容、结构与编码 |
| 文本统计 | `/tools/text-markup-studio#stats` | 内容、结构与编码 |
| 正则测试 | `/tools/text-markup-studio#regex` | 内容、结构与编码 |
| 文本对比 | `/tools/text-markup-studio#diff` | 内容、结构与编码 |
| Markdown 预览 | `/tools/text-markup-studio#markdown` | 内容、结构与编码 |
| HTML 转 Markdown | `/tools/text-markup-studio#html-markdown` | 内容、结构与编码 |
| HTML 格式化/压缩器 | `/tools/text-markup-studio#html-format` | 内容、结构与编码 |
| Unicode 字符检查器 | `/tools/encoding-binary-studio#unicode-inspector` | 内容、结构与编码 |
| Hex 字节转文本 | `/tools/encoding-binary-studio#hex-text` | 内容、结构与编码 |
| Base64 转换 | `/tools/encoding-binary-studio#base64` | 内容、结构与编码 |
| 文件转 Base64 | `/tools/encoding-binary-studio#file-base64` | 文件、图像与共享交互 |
| 十六进制 Hex 查看器 | `/tools/encoding-binary-studio#hex-viewer` | 内容、结构与编码 |
| URL 编码 | `/tools/encoding-binary-studio#url` | 内容、结构与编码 |
| HTML/Uni 转义 | `/tools/encoding-binary-studio#escape` | 内容、结构与编码 |
| HTTP 请求 | `/tools/network-diagnostics-studio#http` | 网络、安全、生成与时间 |
| WebSocket & SSE 沙箱 | `/tools/network-diagnostics-studio#websocket-sse` | 网络、安全、生成与时间 |
| Ping 延迟诊断 | `/tools/network-diagnostics-studio#ping` | 网络、安全、生成与时间 |
| URL 解析器 | `/tools/network-diagnostics-studio#urlparser` | 网络、安全、生成与时间 |
| User Agent | `/tools/network-diagnostics-studio#useragent` | 网络、安全、生成与时间 |
| IP 信息 | `/tools/network-diagnostics-studio#ip` | 网络、安全、生成与时间 |
| 设备信息 | `/tools/network-diagnostics-studio#device` | 网络、安全、生成与时间 |
| PX/REM 转换 | `/tools/frontend-style-studio#pxrem` | 网络、安全、生成与时间 |
| 颜色转换 | `/tools/frontend-style-studio#color` | 网络、安全、生成与时间 |
| CSS 可视化生成器 | `/tools/frontend-style-studio#css-generator` | 网络、安全、生成与时间 |
| SVG 转 CSS | `/tools/frontend-style-studio#svg-css` | 网络、安全、生成与时间 |
| SVG 智能压缩 | `/tools/frontend-style-studio#svg-optimizer` | 网络、安全、生成与时间 |
| HTML 转 JSX | `/tools/frontend-style-studio#html-jsx` | 网络、安全、生成与时间 |
| SVG 转 React | `/tools/frontend-style-studio#svg-react` | 网络、安全、生成与时间 |
| PDF 工具箱 | `/tools/file-document-studio#pdf` | 文件、图像与共享交互 |
| 文件属性信息 | `/tools/file-document-studio#file-info` | 文件、图像与共享交互 |
| 文件名路径提取 | `/tools/file-document-studio#filename` | 文件、图像与共享交互 |
| MIME 类型速查 | `/tools/file-document-studio#mime` | 网络、安全、生成与时间 |
| 图片压缩/转换 | `/tools/image-media-studio#image` | 仓库、CAD 与媒体 |
| 色键抠图与精修 | `/tools/image-media-studio#background-removal` | 文件、图像与共享交互 |
| 图片转 Base64 | `/tools/image-media-studio#image-base64` | 文件、图像与共享交互 |
| 图片颜色提取 | `/tools/image-media-studio#image-colors` | 文件、图像与共享交互 |
| 图片水印 | `/tools/image-media-studio#image-watermark` | 文件、图像与共享交互 |
| 视觉质心计算器 | `/tools/image-media-studio#visual-centroid` | 文件、图像与共享交互 |
| 拼豆图纸生成 | `/tools/image-media-studio#perler-beads` | 文件、图像与共享交互 |
| 大头照提取 | `/tools/image-media-studio#headshot` | 仓库、CAD 与媒体 |
| 动画帧提取 | `/tools/image-media-studio#animation-frame` | 仓库、CAD 与媒体 |
| 视频下载解析 | `/tools/image-media-studio#video-download` | 网络、安全、生成与时间 |
| JWT 解析 | `/tools/security-key-studio#jwt` | 网络、安全、生成与时间 |
| Hash 生成 | `/tools/security-key-studio#hash` | 网络、安全、生成与时间 |
| HMAC 计算 | `/tools/security-key-studio#hmac` | 网络、安全、生成与时间 |
| 密码生成 | `/tools/security-key-studio#password` | 网络、安全、生成与时间 |
| Basic Auth 生成器 | `/tools/security-key-studio#basic-auth` | 网络、安全、生成与时间 |
| PEM / 证书解析 | `/tools/security-key-studio#cert-parser` | 网络、安全、生成与时间 |
| 非对称密钥转换 | `/tools/security-key-studio#asymmetric-key` | 网络、安全、生成与时间 |
| GPG / PGP 密钥中心 | `/tools/security-key-studio#pgp-keymaster` | 网络、安全、生成与时间 |
| 国密算法套件 (SM2/3/4) | `/tools/security-key-studio#sm-crypto` | 网络、安全、生成与时间 |
| 数字占卜 | `/tools/generator-utility-studio#arithmancy` | 网络、安全、生成与时间 |
| UUID 生成 | `/tools/generator-utility-studio#uuid` | 网络、安全、生成与时间 |
| 随机字符串 | `/tools/generator-utility-studio#random-str` | 内容、结构与编码 |
| 随机数生成器 | `/tools/generator-utility-studio#random-number` | 网络、安全、生成与时间 |
| 占位与 Mock 数据 | `/tools/generator-utility-studio#lorem` | 网络、安全、生成与时间 |
| 人民币大写 | `/tools/generator-utility-studio#rmb-uppercase` | 内容、结构与编码 |
| 二维码生成 | `/tools/generator-utility-studio#qrcode` | 网络、安全、生成与时间 |
| 时间与时区工作室 | `/tools/time-ops-studio#unix-time-studio` | 网络、安全、生成与时间 |
| Cron 表达式 | `/tools/time-ops-studio#cron` | 网络、安全、生成与时间 |
| Chmod 计算 | `/tools/time-ops-studio#chmod` | 网络、安全、生成与时间 |
| 文字首饰定制 | `/tools/cad-geometry-studio#jewelry` | 仓库、CAD 与媒体 |
| STL 修复/降面 | `/tools/cad-geometry-studio#stl-repair` | 仓库、CAD 与媒体 |
| STL 镂空/Voronoi | `/tools/cad-geometry-studio#stl-voronoi` | 仓库、CAD 与媒体 |
| 3D 实体布尔运算 | `/tools/cad-geometry-studio#3d-csg` | 仓库、CAD 与媒体 |
| 小学几何练习 | `/tools/cad-geometry-studio#smart-geometry` | 仓库、CAD 与媒体 |

## 逐项审查矩阵

## 内容、结构与编码

验证标记：B 为浏览器用例，U 为核心单元，C 为源码核查，N 为原生编译。Go/Java 样例编译与 Python 语法编译通过；Rust serde 完整编译和 Pydantic 实例化的边界见本组末尾。

#### 通用操作（逐页适用）


| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 示例载入 | 保留 | 帮助快速建立合法输入；实际转换类型对应样例。26 页中随机字符串只需生成，RMB 示例金额，其余页面均有合适入口。 | B |
| 清空输入与过期结果 | 修复 | 输入变化或清空同步清理旧输出/错误；取消后台任务，避免旧结果重新出现。Unicode 清空也清码点/名称查询；二进制清空同时中止文件读取。 | B、C |
| 输出复制 | 保留 | 有输出才启用，统一 useCopyToClipboard 与共享 ContentEditor；复制失败沿用主线反馈。 | C；主线 clipboard tests |
| 继续处理 / 反向转换 | 保留 | 显式将结果回填，不静默改写原始输入；仅对支持该流程的页显示。 | B |
| 输入草稿 | 补全 | 所有字符串型工作输入使用主线 useDraftState，按页/类型区分键，草稿仅在当前应用会话内；不存文件、Worker、DOM、派生输出。 | B（SPA 跨工作室往返） |
| 国际化 | 修复 | 保留显式 tr/useLocaleRender，补新增精确翻译键与 option 边界；输出字符串和用户文件名保持原样。 | C；全目录英文可见扫描 |
| 选项与错误呈现 | 保留 | 主要操作在输入前，专业选项 disclosure 收纳，解析失败在输入旁或结果区域内显示；错误时不允许复制旧的成功结果。 | B |
| 文件任务的异步归属 | 修复 | 新读入递增版本/中止旧 FileReader；旧成功/失败结果不能覆盖新文件；成功时才更新名称及字节。 | C；Worker U |

## 逐页、逐功能矩阵

### JSON 格式化（data-format#json）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 美化 | 保留 | JSON.parse + JSON.stringify，验证后再输出，输入保留。 | B |
| 压缩 | 保留 | 输出无缩进 JSON，不对字符串内部空白做替换。 | B |
| 2 / 4 空格缩进 | 保留 | 选择影响下一次格式化；避免无意义的自由数值。 | B |
| 继续处理 | 保留 | 单击回填输出并清除旧结果。 | B |
| 无效 JSON 恢复 | 保留 | 行内错误、输出为空；可修正或清空。 | B |
| 暂存结果 | 保留 | 仅成功输出可送 scratchpad，JSON 类型和 MIME 明确。 | C、scratchpad U |
| 从暂存载入 | 保留 | 读取文本或 Blob 文本，经统一 updateInput。 | C、scratchpad U |

### JSON 转代码（data-format#json2ts）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| TypeScript | 修复 | present null 字段仍为必填；根数组保留别名；混合数组采纳全部元素；嵌套类型避免同名碰撞。 | U（真实 tsc）、B |
| Go Struct | 修复 | 合法字段名与明确 JSON tag、重名消歧、混合数组使用 interface{}、根值/数组有别名；无法由 encoding/json tag 保留的名称明确拒绝。 | U、B、N |
| Java Class | 修复 | java.util.List 导入；只根类 public；关键字和非法字段归一；重命名 JSON 字段以注释标注，不声称内置 JSON 映射；注释禁止形成 Java Unicode 预处理逃逸。 | U、B、N |
| Python Pydantic | 修复 | Field(alias=...) 保留原 JSON 名；关键字/数字开头/重名合法化；混合数组使用 List[Any]；根值有别名。 | U、B、N（语法） |
| Rust Struct | 修复 | serde rename 保留原键；控制码使用 Rust Unicode 语法；孤立代理码点无法成为 Rust String，明确拒绝；混合数组 Vec<Value>。 | U、B |
| SQL DDL / MySQL | 修复 | 明确 MySQL 方言，反引号转义列名，INT/BIGINT/DOUBLE 区分；对象/数组用 JSON；不凭一条样本推断主键，也不凭空生成 id。 | U、B |
| C# / Swift / Kotlin | 删除 | 原实现只给出 TypeScript/JSON 参考，功能名称与产物不一致；真实 TS 功能已覆盖参考目的。 | C、U（拒绝未知目标）、B（仅 6 目标） |
| 根类型命名 | 保留 | 自定义根名规范化，嵌套以父名与字段序号生成唯一名。 | U、C |
| 非对象根 | 补全 | TS/Go/Python/Rust 生成根别名；Java/SQL 无合理类/表结构则明确报错。 | U、B |
| 异构数组 | 修复 | 不再只用首项推断，TS 联合类型，原生目标通用类型保持样本可表示。 | U、B |
| 输入复杂度预算 | 补全 | 1 MB 源文、10,000 值、100 层嵌套，避免递归/产物膨胀。 | U、C |
| 虚假加载状态 | 简化 | 原转换同步且没有异步工作，移除装饰性 loading。 | C |

### JSON Schema（data-format#json-schema）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 根据样例生成 | 修复 | 主线生成器纳入数组所有样本，anyOf 表示混合类型；空数组 items={}。 | U、B |
| 编辑 Schema | 保留 | 生成结果允许继续编辑，以自定义规则校验同一数据。 | B |
| type / required / additionalProperties | 补全 | 主线 AJV strict draft-07 替代有限手写检查。 | U、B |
| format / 数值范围 / enum / 组合规则 | 补全 | 使用 AJV 与 ajv-formats；非法或未支持规则明确报错，避免虚假“通过”。 | U、B |
| 完整错误列表 | 保留 | allErrors，包含 instancePath、规则信息与参数。 | B、C |
| 修改输入取消旧任务 | 补全 | AbortController 与当前任务身份检查，过期结果不能覆盖新输入。 | C、worker U |
| 主动取消 / 超时 | 补全 | 可取消 Worker；2 MB 输入、单任务 2.5 秒边界。 | U、C |
| 支持范围说明 | 修复 | 明确 draft-07、组合推断、输入与时长边界；不宣传完整任意 Schema 方言。 | C |

### XML（data-format#xml）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 格式化 XML | 修复 | 原 builder format 给混合文本插入换行，改变内容；现在只整理纯元素结构之间的空白。 | U、B |
| 压缩 XML | 修复 | 原 preserveOrder + trimValues=false 留下原缩进；现在移除可安全识别的结构空白，保留混合内容。 | U、B |
| XML → JSON | 保留 | fast-xml-parser 明确保留属性、命名空间、字符串数值；不是无损 XML 的 JSON 表示。 | B |
| mixed content / xml:space | 修复 | Hello <b>world</b> ! 文本不变；xml:space=preserve 继承保护原空白。 | U、B |
| 声明 / CDATA / 注释 / 前导零 | 修复 | DOM 序列化保留内容语义、声明、CDATA；无自动数值强制转换。 | U、B |
| XML 校验与大小预算 | 补全 | fast XMLValidator + DOM parsererror；1 MB 上限，失败清旧输出。 | B、C |
| 继续处理 | 保留 | XML 结果可回填；JSON 输出不混作 XML 继续处理。 | C |

### YAML ↔ JSON（data-format#yaml）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| YAML → JSON | 保留 | js-yaml load；保留数组、布尔、Unicode 值。 | B |
| JSON → YAML | 保留 | 先严格解析 JSON，再 js-yaml dump。 | B |
| 反向转换 | 保留 | 结果回填，方向切换，实现快速往返校验。 | B |
| 暂存转换结果 | 保留 | 依据输出方向标记 JSON/text 与正确扩展名/MIME。 | C、scratchpad U |
| 从暂存载入 | 保留 | 同页统一草稿输入路径。 | C |
| 解析错误 | 保留 | 不保留旧输出；行内错误。 | C |

### CSV ↔ JSON（data-format#csv）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| CSV → JSON | 保留 | Papa parse，解析错误明确显示，不忽略坏行。 | B |
| JSON → CSV | 保留 | Papa unparse 处理数组及对象行；引号内分隔符正确保留。 | B |
| 首行为字段名 | 保留 | 有表头对象行，无表头二维数组；反向时禁用不适用选项。 | B |
| 自动 / 逗号 / 分号 / Tab | 保留 | 自动检测及显式 delimiter；反向生成也使用同一选择。 | B、C |
| 跳过空行 | 保留 | 避免空记录混入数据；保留非空字段值。 | C |
| 反向转换 | 保留 | 回填结果并切换方向，避免丢失源文。 | B |
| 暂存结果 / 载入暂存 | 保留 | 输出格式类型与 MIME 正确，沿用统一 scratchpad 接口。 | C、scratchpad U |

### JSON 结构化对比（data-format#json-diff）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 树状增删改对比 | 保留 | 键顺序与空白无关，数组按位置；原结构路径保留。 | U、B |
| 节点折叠 | 保留 | 控制大树阅读，不增加第二种数据模型。 | C |
| 仅显示差异 | 保留 | 可隐藏 unchanged，随时切回完整树。 | C |
| 合并至左侧 | 修复 | 原型键用 defineProperty，__proto__ 成为真实自有字段而不是改变对象原型。 | U、B |
| 合并至右侧 | 修复 | 增/删/改的方向逻辑与右侧目标一致，同样保护原型键。 | U、B |
| 撤销上次合并 | 保留 | 记录左右源文一次快照，输入变化后清除失效撤销。 | B |
| 交换左右 | 保留 | 明确交换源文，清除旧撤销。 | B |
| JSON Patch | 保留 | RFC 路径的 ~ 与 / 转义、数组删除顺序由既有 core tests 验证。 | U |
| 数据预算 / 解析失败 | 补全 | 每侧 2 MB，10,000 值/100 层；失败不继续构建树。 | U、C |

### SQL 格式化（sql-database#sql-format）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 格式化 | 保留 | sql-formatter，根据所选方言解析，语法错误明示。 | B |
| 方言选择 | 保留 | 沿用包提供的 supportedDialects，而非维护假支持列表。 | C |
| UPPER / lower / preserve | 保留 | 只影响关键字格式化，不更改值。 | B |
| 压缩 | 修复 | 从全局空白正则换为词法扫描，保护字面量、引号标识符、dollar quote。 | U、B |
| -- / /* */ / MySQL # 注释 | 修复 | 保留行终止；# 仅在 MySQL/MariaDB 视为注释，避免破坏其他方言的 # 标识符。 | U |
| 未闭合引号/注释 | 补全 | 明确报错，不输出可能改变含义的 SQL。 | U |
| 继续处理 | 保留 | 输出回填，源与产物流程清楚。 | C |

### SQLite 沙箱（sql-database#sqlite-sandbox）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 初始化 / 演示库 | 补全 | 主线本地 sql.js WASM Worker，避免远程 runtime 失败；载入演示库可恢复。 | U、B |
| 执行 SELECT / 写入 / 多语句 | 保留 | 每次任务基于快照，在成功后提交新数据库；失败保留前次成功状态。 | U、B |
| Ctrl/Cmd+Enter | 保留 | 与执行按钮同一 handler，loading/空 SQL 时防重复。 | C |
| 表结构与快捷 SELECT | 保留 | 名称正确双引号转义，LIMIT 100；含引号表名安全可查。 | B |
| 预置查询 | 保留 | 是填写 SQL 的教程入口，不另设伪执行路径。 | C |
| 最近查询 | 保留 | 成功记录、去重、限定条数，点击回填。 | C |
| 查询耗时 / 行数 / 多结果表 | 保留 | Worker 成功响应计时，逐结果集渲染，真实 NULL 明示。 | B、C |
| 导入数据库 | 修复 | 64 MB 上限；文件读取版本归属；成功才更换名称；读取失败/取消保留已完成库。 | B、C |
| 导出数据库 | 保留 | 导出当前已完成 snapshot，任务中禁用避免过期误导。 | B（重新导入再查询） |
| 主动取消 / 超时 | 补全 | AbortController，文件读取版本失效；10 秒 Worker 超时；取消不提交写入。 | U、C |
| 行数/字节/结果集预算 | 补全 | 1,000 行、2 MB 结果、100 结果集、SQL 1 MB，超过则整次任务不提交。 | U、B（INSERT 后超限回滚） |
| 清空查询 | 保留 | 只清查询与结果，不隐式删除数据库。 | C |
| 失败重试 | 补全 | 演示库按钮始终可重新建立成功状态；保留最后有效 snapshot。 | C |

### Base64（encoding-binary#base64）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| UTF-8 文本编码 | 保留 | 中文/Emoji 正确编码为字节再 Base64。 | B |
| Base64 解码 | 保留 | 验证 Base64 与 UTF-8，坏输入不产生旧结果。 | B |
| 编码/解码切换 | 保留 | 切换清旧输出而保留输入，支持检查同一内容。 | B |
| 反向转换 | 保留 | 成功结果回填并切方向，可检验完整往返。 | B |
| 格式错误恢复 | 保留 | 行内错误，可继续编辑。 | B |

### URL 编码（encoding-binary#url）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 参数值编码 | 保留 | encodeURIComponent；页面明确参数语义。 | B |
| 解码 | 保留 | decodeURIComponent；百分号坏序列明确错误。 | B |
| 反向转换 | 保留 | Unicode 往返成立，输入不会被操作静默覆盖。 | B |
| 编码/解码切换 | 保留 | 输出与错误重置。 | B |

### 字符串转义（encoding-binary#escape）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| Base64 双向编辑 | 修复 | 原始/编码同步，非法编辑保留源文；恢复草稿时立即算派生输出。 | B、C |
| URL 双向编辑 | 修复 | 捕获孤立代理导致的 URIError；非法百分号编辑不污染其他编码。 | B、C |
| HTML 实体双向编辑 | 修复 | 按实体用 inert textarea 解码，字面 <b> 保留而不被 DOMParser 当标签删除。 | B |
| Unicode UTF-16 \u 双向编辑 | 保留 | 所有码元可表示；补手动 \u{codepoint} 解析及上限验证。 | B |
| Hex \x 双向编辑 | 修复 | 非 Latin-1 不生成歧义 \x4e2d；改用 Unicode 的提示与空输出防误复制。 | C |
| 比较所有编码 | 保留 | 一次展开所有可编辑产物，主界面保留一个当前编码，避免重复大面板。 | C |
| 手动 Base64 / URL / HTML / Unicode / Hex 解码 | 补全 | 五个模式共用严谨 helper；\xzz、坏 \u 明确报错。 | B、C |
| 手动结果回原始输入 | 保留 | “继续处理”切回编码页，显式回填。 | C |
| 手机号脱敏 | 保留 | 既有本地规则，先预览后应用，不把工具宣传为完整安全识别器。 | B |
| 身份证 / 银行号 / 邮箱 / 中文姓名脱敏 | 保留 | 保留现有规则与姓名误判说明，用户检查预览再应用。 | C |
| 取消脱敏预览 | 保留 | 不改变原输入。 | C |
| 文件选择 / 拖放 | 修复 | 10 MB 上限、旧 FileReader 中止/归属检查、错误反馈，成功才更新文件信息。 | B（空文件）、C |
| 文件签名 / 字节表 | 保留 | 本地读取 bytes，魔数说明，不将后缀当真实类型。 | C |
| 文件分页 | 修复 | 空文件也有一页；上一页/下一页边界正确。 | B、C |
| 暂存 Hex | 保留 | 导出文件真实字节的十六进制文本，无二次编码猜测。 | C |

### Hex 查看器（encoding-binary#hex-viewer）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 文件选择 / 拖放 / 示例 | 修复 | 同一 processFile；10 MB 上限；FileReader 取消/身份保护；错误后保留当前可用文件。 | B、C |
| 从暂存载入 | 修复 | bytes / Data URL / 文本路径有相同大小预算与版本保护。 | C |
| 魔数与后缀匹配 | 保留 | 呈现真实签名推断及后缀差异，不宣称文件内容完整校验。 | C |
| OFFSET / HEX / 可打印 ASCII | 保留 | 同一 bytes 视图，不做字符编码误读。 | B |
| 点击 HEX / ASCII 选字节 | 保留 | 同一 selectedIdx，显示 hex、binary、decimal。 | B、C |
| 十进制 / 0x 偏移跳转 | 保留 | 整数、非负、文件范围校验；跳到对应分页。 | B |
| UTF-8 文本搜索 | 修复 | TextEncoder 搜索中文字节；旧 ASCII charCode 不适用中文。 | U、B |
| HEX 搜索 | 修复 | 空格/0x/连续 Hex；text: 明确强制搜索看起来像 Hex 的文本。 | U、B |
| 重叠匹配与下个匹配 | 修复 | KMP，线性复杂度；最多高亮 5,000 字节，查询最多 1,024 字符，避免巨大 Set 与嵌套扫描。 | U、B |
| 文件分页 | 保留 | 限制一次呈现量，选择与搜索可跨页。 | C |
| 下载原文件 | 保留 | bytes 直接 Blob 下载，浏览器读回与原输入完全相等。 | B |

### Hex 字节转文本（encoding-binary#hex-text）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| Hex 规范化 | 保留 | 支持空格、0x、\x 与常见分隔符；非法字符/奇数长度明确错误。 | U、B |
| UTF-8 | 保留 | TextDecoder fatal，坏字节拒绝，中文成功。 | U、B |
| UTF-16 LE | 保留 | 明确小端字节，不猜编码。 | U、B |
| UTF-16 BE | 保留 | 明确大端字节。 | U、B |
| Windows-1252 | 保留 | 浏览器 TextDecoder 语义，0x80 对应 €。 | U、B |
| ISO-8859-1 | 保留 | WHATWG TextDecoder 的 legacy 编码语义。 | B、C |
| Latin-1 alias | 保留 | 与既有 ISO-8859-1 映射兼容，不偷偷换成另一套字节表。 | B、C |
| 字节数 / 规范化序列 | 保留 | 依据实际解析 bytes；详情 disclosure 收纳。 | B、C |
| 输入预算 | 补全 | 1 MB 源文上限，避免实时解析/渲染过大输入。 | C |

### Unicode 检查器（encoding-binary#unicode-inspector）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 字符去重详情 | 保留 | 基于 Array.from 码点，显示码点、名称、区块、UTF-8。 | U、B |
| 保留重复字符 | 保留 | 开启后顺序保留；默认避免重复行。 | B |
| 显示 UTF-16 BE / LE | 保留 | 可选编码列，Emoji 代理对明确可查。 | U、B |
| 区块统计 | 保留 | 根据当前去重/保留重复模式一致统计。 | U、B |
| Emoji 序列 | 保留 | 既有内置序列表；未宣传能覆盖全部 Unicode emoji。 | U、B |
| 重复 Emoji key | 修复 | React key 纳入索引，保留重复模式不会重复 key。 | C |
| 码点查询 | 保留 | U+ 等已有格式解析、有效范围检查。 | U、B |
| 名称查询 | 保留 | 内置 + 导入名称，最多返回 20 项。 | U、B |
| UnicodeData.txt 导入 | 修复 | 8 MB 上限，版本归属、重新选同文件可触发；坏文件保留有效名称映射。 | B、C |
| 文本与行数预算 | 补全 | 10,000 UTF-16 字符，过限显示错误、不继续分析；详情最多 500 项，区块仍统计全部。 | B、C |
| 查询 disclosure | 保留 | 字符分析是第一任务，专家名称库与查找按需展开。 | B |

### 命名大小写（text-markup#case）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| camelCase | 修复 | 识别 HTTPResponse 缩写边界及下划线，保留多行。 | U、B |
| PascalCase | 修复 | user_profile → UserProfile；不再 Userprofile。 | U、B |
| snake_case | 修复 | 缩写边界与分隔符统一。 | U、B |
| kebab-case | 修复 | 同一拆词规则，支持多行独立标识符。 | B |
| UPPERCASE | 保留 | 直接 Unicode toUpperCase，不改分隔结构。 | B |
| lowercase | 保留 | 直接 Unicode toLowerCase。 | B |
| 比较所有命名格式 | 保留 | 详情展开六种输出，主视图选一种复制。 | C |
| 继续处理 | 保留 | 当前格式输出显式回填。 | C |

### 文本处理（text-markup#text-manip）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 去空白与空行 | 修复 | CRLF / CR / LF 统一按行，逐行 trim 并删除空条目。 | B |
| 按行去重 | 修复 | 保留首次出现顺序，正确处理跨系统换行。 | B |
| 按行排序 | 修复 | 明确 JS 字符排序，统一换行，不暗示自然数/语言排序。 | B |
| 转全角 | 保留 | ASCII 可打印字符与空格转换，其余码元原样保留。 | B |
| 转半角 | 保留 | 对应全角范围与全角空格还原。 | B |
| 输入/输出行数 | 保留 | 实际行数便于检查处理效果。 | C |
| 继续处理 | 保留 | 支持清洗后去重等叠加操作，不增加流水线实体。 | C |

### Slug（text-markup#slug）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 默认 ASCII Slug | 保留 | 小写、删标点、空白/下划线/连字符归一。 | B |
| 保留 Unicode | 保留 | Unicode 字母和数字选项，中文标题可用；无字符时给提示。 | B |
| URL 前缀预览 | 保留 | 只做组合预览，不访问用户输入 URL。 | B |
| 复制 Slug | 保留 | 复制当前 Slug，未混入展示前缀。 | C |

### 文本统计（text-markup#stats）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 字符总数 | 保留 | 明确 UTF-16 code units，Emoji 可大于码点数。 | B |
| 非空字符 | 保留 | 去 JS 空白后 UTF-16 长度。 | C |
| 单词数 | 保留 | 明确按空白分隔，未误称中文分词。 | C |
| 行数 | 修复 | CRLF/CR/LF 一致，空输入 0。 | C |
| Unicode 码点数 | 保留 | Array.from，区别代理对。 | B |
| UTF-8 字节数 | 保留 | TextEncoder 字节量，A中👋 为 8。 | B |
| 汉字数 | 保留 | 既有基本 CJK 范围；不声称覆盖所有扩展平面。 | C |

### 正则（text-markup#regex）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 正则输入 | 保留 | JavaScript RegExp 语法，格式错误内联。 | B |
| g / i / m / s / u 与手动 flags | 保留 | 专家标记可直接输入，常用复选项不隐藏能力。 | B、C |
| 全局匹配 | 修复 | Worker matchAll，真实次数/位置/捕获组。 | B |
| 非全局匹配 | 修复 | exec 得到一个完整 match，不把 capture 当多个匹配。 | B |
| 捕获组 / 空匹配 | 保留 | groups 可检查；零宽匹配用 ∅ 表示。 | B、C |
| 超时 / 主动取消 | 补全 | debounce 200ms，Worker 1.5 秒超时/Abort；复杂表达式不锁主 UI。 | U、B |
| 输入归属 / 过期结果 | 修复 | source signature 与 AbortController 双重保护，改输入立即隐藏旧 matches。 | B、C |
| 工作与显示预算 | 保留 | 文本 1 MB、pattern 10 KB、最多收集 1,000 matches、呈现前 500。 | U、C |

### 文本 Diff（text-markup#diff）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 行级增删改 | 保留 | LCS，统一换行，结果与真实行内容对应。 | B |
| 行内词级高亮 | 修复 | token pair 预算 100,000，超限退为整行标色，避免二次矩阵爆炸。 | C |
| 统一视图 | 保留 | 一列查看增删上下文。 | B |
| 左右对照 | 保留 | 对齐修改行便于比较。 | B |
| 仅显示改动 | 保留 | 可显示全部 unchanged。 | B |
| JS / JSON 示例 | 保留 | 合法可对比代码样例。 | B、C |
| 交换左右 | 保留 | 交换输入与方向，重置展示量。 | B |
| 逐批更多行 | 保留 | 初始 150、按需增加，不一次挂大量结果节点。 | C |
| 大输入限制 | 补全 | 1 MB 每侧、2,000,000 LCS 单元，超限给错误而非内存冻结。 | B |

### Markdown 预览（text-markup#markdown）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 实时渲染 | 保留 | marked parse + sanitizeHtmlMarkup，旧异步结果 active guard。 | B |
| HTML 源码切换 | 保留 | 与实际预览同一 sanitized HTML，不另给危险原文。 | B |
| 脚本/事件/危险链接过滤 | 保留 | 主线 sanitizer 保持；浏览器 window.xss 未执行。 | U、B |
| 复制 HTML | 保留 | 复制实际安全产物。 | C |
| 暂存 HTML | 保留 | HTML MIME、文本类型，与预览输出一致。 | C |
| 从暂存载入 | 保留 | 回填 Markdown 草稿，不执行暂存内容。 | C |

### HTML → Markdown（text-markup#html-markdown）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 标题/列表/链接转换 | 保留 | Turndown，输入 HTML 不挂到页面执行。 | B、C |
| # / 下划线标题 | 保留 | 两个真实 headingStyle。 | B |
| 围栏/缩进代码块 | 保留 | 两个真实 codeBlockStyle。 | B |
| 复制 Markdown | 保留 | 明确当前文本输出。 | C |
| 转换错误 | 保留 | 不以异常中断页面，输入旁显示。 | C |

### HTML 格式化（text-markup#html-format）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 格式化 | 修复 | 只整理明确块级结构；不对混合行内内容插入新空白。 | U、B |
| 压缩 | 修复 | 只去可安全识别结构空白，保留 span 间空格。 | U、B |
| pre / script / style / textarea | 修复 | 原文空白保留，不误改字符串/预格式文本。 | U、B |
| 注释 / 实体 / void 标签 | 修复 | 注释不丢、实体语义正确、不生成 </img>。 | U、B |
| 输入大小预算 | 补全 | 1 MB 限制与明确错误。 | C |
| 继续处理 | 保留 | 手动回填输出，保留核对源文机会。 | C |

### 随机字符串（generator-utility#random-str）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 随机字符串 | 修复 | 用已有 NanoID customAlphabet 替代 Math.random，使用密码学随机源。 | B、C |
| NanoID | 保留 | NanoID 自有 URL 安全字母表，提示与普通字符串选项作用分开。 | B |
| 长度 1–1,024 | 保留 | 输入即 clamp，生成长度真实正确。 | B |
| 包含数字 | 保留 | 只控制普通随机字符串 charset。 | B |
| 包含符号 | 保留 | 只控制普通随机字符串 charset。 | B |
| 复制/清空输出 | 保留 | 空产物禁用复制，清空不抹掉选项。 | C |

### 人民币大写（generator-utility#rmb-uppercase）

| 功能 | 处置 | 依据与最终行为 | 验证 |
|---|---|---|---|
| 整数万/亿/兆分节 | 修复 | BigInt 精确分节，补跨节零；不再依赖浮点处理大金额。 | U、B |
| 角/分与舍入 | 修复 | 纯十进制取第三位四舍五入；1.005→壹元零壹分、0.05→零元零伍分。 | U、B |
| 0 元 / 整 | 保留 | 明确零元整、没有角分追加整。 | U |
| 负数/非法/超范围 | 保留 | 明确合法范围，错误产物禁用复制。 | B、C |
| 大金额精度 | 修复 | 999999999999998.01 的壹分保留，不被 Number 转换吞掉。 | U |
| 复制大写 | 保留 | 只复制有效结果，用户数据不走英文翻译。 | B、C |

## 边界与未验证部分

- Rust 代码已覆盖目标语法与 escaping 单元断言及页面产物，未安装/拉取 serde 依赖做独立 cargo 编译。Python 只做语法编译，未安装 Pydantic 执行模型实例化。Java 为普通 DTO，重命名映射靠明确注释供调用方配置，并非 JSON 序列化框架绑定。
- JSON 样例推断无法证明业务 Schema、主键、可选性或全部数组变体，因此不凭样本猜唯一约束，输出需要开发者结合契约检查。
- HTML/XML formatter 做语义尽量保守的 whitespace 整理，DOM 序列化可能规范化实体写法/引号；不是逐字节无损编辑器。SQL minifier 保留注释，不做注释删除或 query rewriting。
- 文本统计汉字范围、Unicode 内置 Emoji 序列表沿用已有覆盖，不新增虚假“完整 Unicode 数据库”能力。
- 重复文件/取消任务依靠身份检查与上游 worker tests，部分用户点击组合做代码审查，未声称浏览器测试穷尽所有竞态调度。
- 暂存箱共享存储与复制 API 另有统一回归，内容页保留有效类型与成功产物接口。

## 仓库、CAD 与媒体

验证标记：U 为核心单元，R 为实际仓库 Mock 流程与390px布局，C 为STL/Voronoi真实Worker流程，M 为实际媒体/CSG/首饰fixture，E 为永久浏览器回归。对应回归文件为 `repository-cad-media-audit.spec.ts`；复杂拖拽与第三方服务边界另行注明。

### 仓库研究工具


路由前缀均为 `/tools/repo-dependency-studio`。

| 子页 / 功能或参数 | 决定 | 必要性、正确性和限界 | 验证 |
|---|---|---|---|
| `#github-repos` 用户/组织登录名与读取 | 保留 | 账户仓库盘点的核心输入；成功结果单独记录 `resultEntity`，编辑下一次输入不能改变当前 Release 请求归属。 | R |
| `#github-repos` 访问令牌 | 保留/收起 | 私有数据与额度需要；仅本页请求使用，未改变已有持久化或认证策略。 | 代码核对 |
| `#github-repos` 本地缓存、失败回退、清除 | 已修 | IDB 写入是可选优化；配额/不可用不应把已成功的网络数据判成失败。成功数据保留，显示缓存不可用；清除仍可独立执行。 | R/E |
| `#github-repos` 检查最新 Release、EXE 资产 | 保留/已修 | 需要区分未检查、无 Release、读取失败；单仓库失败不抹掉其他结果。只检查最新 Release，不表示任意历史版本可执行资产存在。 | R |
| `#github-repos` 名称、语言、描述、发布状态过滤 | 保留 | 均直接作用于已读取结果；不追加网络请求；过滤紧邻结果。 | R |
| `#github-repos` 总数/匹配数/发布数摘要、JSON 导出 | 保留 | 用于确认数据范围与复用结果；服务返回信息不是仓库可信度判断。 | R/代码核对 |
| `#github-org-research` 父组织、搜索词、GraphQL token | 保留 | 明确查询对象；token 必填且不增加保存策略；失败需要报告 GraphQL errors。 | R |
| `#github-org-research` 公开域名、验证标记、可见成员线索 | 保留/澄清 | 只能提供关联线索，不能证明所有权。最多比较 50 个组织、每组织前 30 个可见成员；没有线索不代表没有关系。 | R/代码核对 |
| `#github-org-research` 关联筛选、结果计数 | 保留 | 便于先看共享父组织成员或域名/关联成员证据，再看全部候选。 | R |
| `#github-org-research` 研究历史缓存 | 已修 | 成功研究结果不能因可选历史写入失败变成“研究失败”；写入改为 best effort，并如实给出缓存状态。 | R/代码核对 |
| `#repo-folder-download` GitHub/HuggingFace 文件夹 URL | 保留 | 精确文件夹选择比整个仓库 ZIP 更有用；分支/path 解析与源 API 保持原实现。 | R/原核心 tests |
| `#repo-folder-download` GitHub/HF token、CORS 模板 | 保留/收起 | API 权限与浏览器 CORS 场景确有需要；没有新增权限、token 缓存或代理转发策略。 | 代码核对 |
| `#repo-folder-download` 目录扫描、折叠树、单文件/目录勾选、全选/清除 | 保留 | 用户需要在传输前知道范围和大小；未勾选不可导出。 | R |
| `#repo-folder-download` ZIP 导出、文件传输进度 | 保留 | 浏览器普遍支持；顺序读取避免大量并发峰值；大目录仍受浏览器内存和远端配额影响。 | R |
| `#repo-folder-download` 保存本地目录 | 保留/条件显示 | 支持 File System Access 的浏览器可避免 ZIP 内存累积；不支持时明确提示使用 ZIP；取消不算成功。 | 代码核对；系统目录授权未自动化 |
| `#repo-folder-download` 并发滑杆 | 简化/删除无效控制 | 原下载循环顺序读取，滑杆不影响行为，保留会误导用户；已在工作流改造中移除。 | 当前代码无假控制 |
| `#nuget-deps` 包名、注册表/代理 | 保留 | .NET 包依赖研究核心输入；依赖注册信息按既有范围近似选择，不能替代 NuGet restore/lock。 | R/原核心 tests |
| `#nuget-deps` 4 层/250 节点预算、循环/重复/失败标记 | 保留 | 防止无限图遍历，标记截断而非隐藏失败；合并 dependencyGroups 会包含不同目标框架信息。 | 原核心 tests/代码核对 |
| `#nuget-deps` tree/list、包名/版本/原声明搜索、namespace 过滤 | 保留 | 分支浏览与平面检索各有用途；过滤两种视图一致作用。Verified prefix 只是注册表标记。 | R |
| `#pypi-deps` 包名、Extras（空/逗号分隔/all） | 保留/澄清 | Extras 可增加根包的可选依赖；读取最新元数据，环境标记未完整求值，不能替代 pip 环境解析。 | R/原核心 tests |
| `#pypi-deps` 同维护者叶子过滤 | 保留/已修 | 有助聚焦外部依赖，但不能丢掉原树；即时可逆，无重新请求。维护者字符串不是经认证的身份关系。 | R |
| `#pypi-deps` tree/list、搜索、预算/循环/失败 | 保留 | 与 NuGet 共享结果组件；清楚显示读取失败与遍历上限，不把 partial 结果写成完整环境。 | R/原核心 tests |
| `#rust-deps` Crate 名、深度 0–4 | 保留/已修 | 控制探索请求成本；深度 0 只读根元数据，1 才查直接依赖；各层按 latest 读取。 | R |
| `#rust-deps` 普通依赖树/列表、搜索、原声明 | 保留/澄清 | 便于研究 crates 关系；未执行 Cargo features/target/optional/lock 的最终解算。 | R/代码核对 |
| `#rust-deps` CORS proxy 模板 | 保留/收起 | 远端跨域限制确有需要；用户可以更换或清空模板，未增加自动 token 转发。 | R |
| `#nuget-signature` 包名→加载版本→选版本→解析 | 保留/已修 | 在明确版本下读取 nupkg，避免边输入边解析；包名改变清掉旧版本和旧证书结果。 | R |
| `#nuget-signature` unsigned 状态、签名容器、证书 subject/issuer/serial/日期/指纹/PEM | 保留/澄清 | 仅查看签名元信息与日期；不能把有签名文件或证书当前日期有效写成密码学签名有效。没有链验证、时间戳验证、吊销检查。 | R unsigned；本地签名容器/证书/校验运行库回归通过；真实包未在线验证 |
| `#nuget-signature` SHA 摘要、nuspec 元数据 | 保留 | 用于文件识别和内容研究；摘要不能独立证明来源可信。 | 代码核对 |
| `#nuget-signature` CMS/X.509 解析 | 已完善 | 移除 node-forge，PKIjs/ASN1js 随构建按需加载；保留原始 DER 指纹/PEM、issuer/serial 与 SKI 签名者匹配及输入预算。不把证书解析视为签名验证。 | 真 OpenSSL CMS 样本、解析器单测、浏览器回归 |

### CAD 与几何

路由前缀均为 `/tools/cad-geometry-studio`。

| 子页 / 功能或参数 | 决定 | 必要性、正确性和限界 | 验证 |
|---|---|---|---|
| `#stl-repair` ASCII/二进制 STL、本地真实 drop/file input | 保留/已完善 | 输入是修复起点；错误格式、空文件、读失败必须可重试；导出需确有完成输出。 | C |
| `#stl-repair` 轻量清理/保留细节/添加底座预设 | 保留 | 为常见目标提供起点，不隐藏具体设置；预设修改实际 RepairOptions。 | C/代码核对 |
| `#stl-repair` decimate / targetFaces / targetError | 保留 | 降面用于减小文件与后续计算；目标值不保证严格达到，拓扑限制如实显示。 | 原 Worker tests/C |
| `#stl-repair` weldTolerance / keepLargest / fillHoles | 保留/澄清 | 焊接与碎片清理有实际效果；keepLargest 会舍弃小组件；补洞只覆盖小三角/四边开口，复杂坏面仍需复检。 | 原 Worker tests/C |
| `#stl-repair` addBase 圆形底座 | 保留 | 提供展示底座，采用模型当前坐标尺度；STL 不包含单位，不能宣称毫米尺寸或已完成实体布尔融合。 | 原 Worker tests/代码核对 |
| `#stl-repair` 热力图开关、快速/精确壁厚、阈值 | 保留/保留显性控制 | 壁厚是打印诊断，模式选择保持可见；阈值/厚度按模型坐标，不假设 STL 毫米单位；采样结果不是制造证明，保留时间预算/取消。 | C/壁厚 tests |
| `#stl-repair` 材质、线框、轨道视角、报告分段 | 保留 | 外观便于检查，无需重跑修复；输入/清理后/最终统计、边界/非流形/补洞/简化误差帮助判断限界。 | C |
| `#stl-repair` 二进制导出、共享网格、旧参数输出 | 已修/保留 | 捕获处理开始的 options；参数变化后保留旧预览并阻止导出，重新处理恢复；Worker/read 初始化失败解除忙态。 | C |
| `#stl-voronoi` STL drop / 共享修复网格 | 保留 | 支持独立模型和连续 CAD 工作流；保留 worker 与 mesh bridge。 | C |
| `#stl-voronoi` 均衡/大孔/粗杆/平面预设 | 保留 | 直接映射密度与厚度，降低初次配置负担。 | C |
| `#stl-voronoi` low/standard/high 密度 | 保留/澄清 | 控制表面采样与近邻杆件；生成的是 Voronoi 风格杆架，不是实体表面真实布尔挖孔。 | C/代码核对 |
| `#stl-voronoi` plane/thin/standard/thick 厚度 | 保留/澄清 | 杆半径按模型包围盒比例；plane 为极细杆视觉实验，不提供可打印实体保证。 | C |
| `#stl-voronoi` mixed/lattice/original、showOriginal、材质/线框 | 保留 | 检查来源和生成结果；外观变更不影响输出快照、不禁导出。 | C |
| `#stl-voronoi` 报告/导出、旧输出阻止、Worker/read 失败 | 已完善 | 几何 options 快照与结果绑定；相交圆管/节点球仍需后续修复或切片复检水密。 | C |
| `#3d-csg` cube/sphere/cylinder/cone 新增/切换 | 保留 | 四种基本建模原语足够支撑布尔示例；没有新增形状。 | E/代码核对 |
| `#3d-csg` 上传 STL / 共享网格 | 保留/已修 | 读失败可重试；限制非空≤64MB、输入总计≤50k triangles；indexed 输入先展开成真正三角面，修复 cube/共享网格错序。 | U/M |
| `#3d-csg` 基准实体、工具勾选、可见性、删除、重命名 | 保留/已完善 | 明确相减方向与运算范围；有效基准及≥1工具才允许运算；系统名字用 nameKey 翻译，用户改名保持原值；所有按钮可键盘访问。 | 现有 E2E/U/M |
| `#3d-csg` union/subtract/intersect | 保留/已修 | 均有实际几何用途；实际相减结果有效；无重叠交集是正常空结果，应警示而禁导出，不假称已生成实体。 | M/E |
| `#3d-csg` 包围盒尺寸、XYZ 位移、XYZ 比例 | 保留/已完善 | 比例与位移真实改变几何；新增 range 语义标签；STL 无单位，包围盒显示模型坐标而非武断标 mm；处理/读取时锁定。 | M/代码核对 |
| `#3d-csg` 移动/旋转/缩放 gizmo | 保留/已修 | 旧拖拽仅保存位置，旋转/缩放丢失；现在保存 quaternion 与比例，同场景、worker 和对齐 bounds 共用；正在处理时禁用 gizmo。 | 代码链核对；精确鼠标旋转拖拽未自动化 |
| `#3d-csg` 居中/顶叠/左右/底贴齐 | 保留 | 便于组合原语；bounds 计算使用已旋转几何与尺寸，不另设变换系统。 | 代码核对 |
| `#3d-csg` 材质/线框/相机、统计、STL | 保留/已修 | 材质只影响预览；导出实验级网格；移除/隐藏时释放 scene mesh/material/helper，重渲染不 dispose 同一结果几何后再复用。 | M/U/代码核对 |
| `#3d-csg` 进度、取消、runtime/Worker 错误 | 保留/完善 | 取消终止 Worker，请求 ID 阻止旧消息；失败后可重试；初始化异常捕获，保留主线所有权清理。 | 代码核对/M |
| `#jewelry` 名称→文字首饰定制 | 简化误导承诺 | 没有 AI 生成功能，改为真实能力名称；保留所有字体/轮廓算法。 | 目录与源码核对 |
| `#jewelry` 短文字、font gallery/font preview、重试 | 保留/已修 | 首饰核心输入；≤80 characters，字体必须覆盖字符；空文字停止忙态/清几何，切换字体先清旧 font，缺字不导出 .notdef 方块。 | M |
| `#jewelry` 文字贴片/单孔吊坠/双耳项链预设 | 保留 | 直接映射 frame/loop 参数；快捷起点而非三套算法。 | 代码核对 |
| `#jewelry` 字号、轮廓增粗、字距 | 保留 | 实际改变轮廓与连通；隐藏到折叠配置降低首屏负担，短文字便于连通。 | M/代码核对 |
| `#jewelry` none/contour/bar/heart/oval 底框、留边 | 保留/已修 | 结构/视觉需求不同；3D 文字与底框采用相同全设计中心，不各自居中造成偏移。 | U/M |
| `#jewelry` 无/顶部单孔/左右双耳/顶部双耳、内外径 | 保留 | 提供连接位置；外径改变限制内径，避免非法同径；强度/挂孔可用性仍需人工判断。 | 代码核对 |
| `#jewelry` extrusion thickness、文字/底框 material | 保留/澄清 | 挤出厚度真实影响几何，材质仅预览；倒角与底框增加整体厚度，不能把设置值当最终总厚。 | M/代码核对 |
| `#jewelry` minBridge、maxGap、flattenTolerance、autoTighten/max、units/mm | 保留/收起 | 均进入 geometry config；连桥与字距有实际作用，非新制约；多连通分量提供警示，不承诺打印强度。 | U/代码核对 |
| `#jewelry` 2D/3D/双视图、平移旋转缩放、重置视图 | 保留 | 图纸检查与材质预览用途不同；变换仅预览，不悄悄改变物理输出。 | M/代码核对 |
| `#jewelry` SVG / DXF / STL 导出、旧几何禁导出 | 已修/保留 | SVG physical width/height 使用实际 unitsPerMm，DXF 原实现同换算；STL 共用设计原点，导出完成与失败释放临时几何/材质；所有格式只允许当前有效快照。 | U/M |
| `#smart-geometry` 名称→小学几何练习 | 简化误导承诺 | 现有功能是手工探索与讲解，不是自动解题器；不为保留旧名称新增求解引擎。 | 目录与源码核对 |
| `#smart-geometry` 样例 / JSON 导入 / 保存 / 重置 | 保留/已修 | ≤1MB 非空文件；有限坐标及点/线/多边形/讲解引用校验，旧异步读取不覆盖新题；重置回本次加载源。 | U/代码核对 |
| `#smart-geometry` 自由作图 / 分步讲解 | 保留/澄清 | 自由作图不自动求解、不强制保持 constraints；讲解仅展示导入 slide，不生成数学证明。 | U/代码核对 |
| `#smart-geometry` pan / move / auxiliary line、snap | 保留 | 三种操作各有明确用途，键盘 P/V/L 与工具提示；辅助线吸附顶点、中点、垂足，移动点可观察变化。 | 代码核对；实际复杂题拖线未新增 fixture |
| `#smart-geometry` 撤销 / 清辅助线 / fit / wheel zoom / Esc | 保留 | 防止绘图操作不可逆并便于视口恢复；输入框不拦截快捷键。 | 代码核对 |
| `#smart-geometry` constraints 与 slides JSON 字段 | 保留/澄清 | 为既有题目兼容保留 schema；constraints 目前只随题目保存，不强制执行；slides 坏引用拒绝输入，预算 200。 | U |

### 媒体

路由前缀均为 `/tools/image-media-studio`。

| 子页 / 功能或参数 | 决定 | 必要性、正确性和限界 | 验证 |
|---|---|---|---|
| `#animation-frame` GIF | 保留/已修 | 本地部署 gifuct runtime；在 eager decompress 前检查预算；使用实际逐帧 delay 与平均 FPS，partial 失败释放 URLs。 | U/M/E |
| `#animation-frame` APNG / animated WebP | 保留/已修 | 浏览器 ImageDecoder 能力相关，明确 unsupported；等待 tracks.ready 后判断 metadata；损坏 frame 不能被当 EOF，unknown count 超 500 不静默截断；VideoFrame 始终 close。 | U/M/E |
| `#animation-frame` Lottie JSON | 保留/已修 | 本地 runtime；帧数、FPS、画布校验；DOMLoaded/data_failed/15s timeout/abort 全部有出口；拥有 anim 即刻登记，取消/卸载销毁。外部动画素材仍依赖原文件链接/网络。 | M/代码核对 |
| `#animation-frame` 上传/真实拖放、file64MB / frame500 / perframe4096² / total160M pixels | 保留/完善 | 解码可产生远超压缩文件大小的数据，需要保留预算；错误可重试，不用失败成功态掩盖超限。 | U/M/E |
| `#animation-frame` 播放/暂停/前后帧/滑杆/跳转/time position | 保留/已修 | 对照逐帧素材必需；raster 播放使用当前帧 delay，非统一FPS；批量渲染暂停播放，避免画布被抢写。 | M |
| `#animation-frame` 下载当前 PNG / 当前暂存 | 保留/已修 | raster 使用所选帧的已解码 blob，不导出落后的异步 preview canvas；Lottie 同步定位后导出；filename 保留完整 stem。 | M/E |
| `#animation-frame` 全帧 ZIP / 全帧暂存 / 取消 | 保留/已修 | 适合批量工作流；保留进度、预算、取消；锁定同时单帧导出，旧异步绘图和对象 URL 有请求/生命周期保护。 | M/E/代码核对 |
| `#headshot` MediaPipe 自动定位/上身重试 | 保留 | 自动头肩初选有价值；本地 WASM/模型策略与主线一致，模型失败不阻塞上传/手工功能。自动识别质量取决于照片内容。 | M离线；真实人脸质量未新增外部 fixture |
| `#headshot` 手动默认 crop / 自由 / 1:1 / 4:5 | 保留/已修 | 模型加载中即进入可用手动模式；重新自动定位复位正方形 aspect，避免旧比例与新框冲突。 | M/E |
| `#headshot` 裁剪微调、预览、保存 PNG | 保留/已修 | 坐标换算使用源图 natural pixels，移除 DPR 额外放大；24MP/64MB 输入限制；坏图 read/decode 解锁重试；请求/卸载保护。 | M/E |
| `#headshot` 模型状态/重试自动定位 | 保留/完善 | 加载中与不可用均可手动；模型后就绪可显式再次定位，不后台覆盖用户微调。 | M/代码核对 |
| `#image` 压缩/转换 / 拆分 / 矢量化嵌套入口 | 保留 | 三种用途各自独立，在保留路由下使用局部 tabs；compress/vectorizer 实现和参数见文件、图像与共享交互组。 | R首屏/M |
| `#image`→split 背景估计、容差、minGap | 保留 | 连通组件与同贴纸装饰组聚合有真实作用；适合纯色背景与明显留白；复杂背景不保证分割准确。 | M/E |
| `#image`→split padding、PNG/JPEG/WebP、质量 | 保留/已修 | padding 改区域，格式/质量改实际 blob；PNG 不显示质量参数；设置变更不能下载旧格式结果。 | M/E |
| `#image`→split 原图 overlay、drag/四边控制点、Left/Top/Right/Bottom、±4px、恢复 | 保留/已修 | 自动范围需要人工修正；渲染 revision+source epoch 拒绝旧 blob，拖动/脏 bounds/待编码时阻止导出；失败仍不可下载与可见边框不符的旧 blob。 | M/代码核对 |
| `#image`→split 单张/ZIP、数量/尺寸/大小、忙态/空态/错误 | 保留/已修 | 提供实际素材交付；ZIP async 忙态和来源保护，失败可重试；partial URLs、替换/卸载旧 URLs 释放；24MP/64MB 限制防大图峰值。 | M/E |

### 尚未证明的边界

- Provider fixture 证明 UI/请求/范围契约，不证明当前 GitHub、HuggingFace、NuGet、PyPI、crates.io 的网络可达、额度或外部响应长期稳定；没有注入真实令牌。
- 签名工具仅解析容器和证书元信息，未进行密码学签名、信任链、时间戳、吊销验证；没有把“存在签名”改写为“包可信”。
- CSG/Voronoi/STL 测试证明特定 fixture 的处理与导出路径，不证明所有模型水密、制造尺寸或打印强度。首饰 fixture 字体证明导出换算，不证明所有远端字体都可达或每种字形必然连通。
- SmartGeometry 未实现约束求解；原算法保留，不以新增万能求解器补包装承诺。精确鼠标 gizmo 旋转与复杂辅助线拖动属于本轮未自动化的交互路径，已检查状态/几何链。


## 网络、安全、生成与时间

网络用例使用本地 Mock 或拦截响应；没有真实 provider 凭据。复制、导出和时间任务共用现有页面入口；敏感输入继续保留在组件内存。

| 页面 | 全部功能、参数、子模式 | 决策、理由与已做处理 | 验证 |
|---|---|---|---|
| HTTP 请求 | GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS；URL；JSON 字符串请求头；Raw / Form Data；导入 cURL；状态码/耗时/响应头/响应体；fetch/axios/cURL/Python/Go/Java 导出；CORS 开关与端点；Mock 开关/路径/状态/延迟/正文/增删规则；复制响应和导出 | 保留；修复请求头结构验证、自动代理重试读取旧开关、30 秒超时、主动取消和卸载取消、延迟 Mock 的取消、无正文状态；代码导出按语言转义 URL/正文/表单/请求头，Python JSON 布尔/null，cURL 单引号；非法请求头不再静默丢弃；保留 session 草稿 | ESLint；Mock 取消 E2E；SVG导出实际TS parser与下载命令转义用例；真实服务器/CORS 未联网验证 |
| WebSocket/SSE | 协议切换；真实/本地 Mock；WS URL/子协议/消息发送；SSE URL/default message/ping 自定义事件；心跳开关/间隔/正文；连接/断开；时间线/自动滚动/清除/复制日志 | 保留；修复连接建立期间重复操作、切换协议/Mock 时取消连接、旧连接异步回调回写、卸载关闭；SSE 真实 open 才显示建立；心跳间隔限 1–3600 秒 | 源码/ESLint；本地 Mock 交互原 E2E；真实公网长连接不作成功保证 |
| HTTP 延迟探针（Ping） | 内置目标/自定义 URL；间隔；开始/停止；30 条采样/曲线；均值/最小/最大/相邻采样抖动/失败率；清除/复制数据 | 保留；修复 3 秒超时及不重叠请求，停止/切换/清除后不再接收旧结果，URL query 安全添加；将“丢包率”改为“HTTP 请求失败率”，因为实际为 no-cors HTTP 请求，不是 ICMP | 源码/ESLint；本地请求取消；公网 DNS/请求排队仍包含在浏览器时间内 |
| URL 解析 | 完整 URL 输入；protocol/host/port/path/origin/hash/search 分解；查询参数多值和解码；单项复制；JSON 复制；错误/空状态 | 保留；合并保留 session 草稿；不把重复参数折叠为对象；翻译 aria 的“复制”，用户参数名不翻译 | 既有 utility E2E 重复键/空格/非法 URL |
| User Agent | 编辑 UA；使用当前浏览器；浏览器/系统/设备分类；复制输入 | 保留；无额外 UA 解析依赖；保留轻量规则的能力边界，不声称完整设备数据库 | 源码检查；全目录页面巡检 |
| IP 信息 | 用户点击查询；ipapi 公网 IP/国家/城市/运营商/经纬度/时区；ipify 基础 IP 回退；刷新/重试/复制 IP；公共服务来源说明 | 保留；首屏显式查询，复制成功需等待 clipboard；翻译成功分支来源说明；测试需点击查询再断言，避免恢复自动请求 | 拦截 ipapi 的 E2E；无真实用户 IP 请求；10 秒总预算和卸载/新请求取消已完成，abort不进入fallback |
| 设备信息 | UA/语言/平台/屏幕/窗口/像素比/cookies/online；窗口 resize 更新；环境 JSON 报告复制 | 保留；数据卡片分组和长 UA 断行；环境报告包含浏览器实际字段而不是推断 | 源码/全目录巡检；无权限请求 |
| PX/REM | 根字号输入与 10/16/18/20 预设；PX/REM 任意侧输入；12/14/16/24/32/48 PX 快捷值；CSS/复制；无效根字号反馈 | 保留；修复有限数值检查，零根字号/空值不允许导出；保留双向同步 | utility E2E 双向换算/无效根字号 |
| 颜色转换 | HEX/color picker/RGB/alpha；HSL H/S/L 编辑；HSV；RGBA/HSL/HSV/HEX/CSS variable/Tailwind 文本；色板预设；白/黑/自定义背景对比；AA/AAA 阈值；同色相/饱和度最近亮度建议；复制 | 保留；修复 alpha 合成后的实际对比度，建议也保留相同 alpha 再判断；复制失败不显示成功 | 源码/ESLint；alpha源码合成与候选算法已核对；RGB/色空间换算保留 |
| CSS 可视化生成 | 阴影 X/Y/blur/spread/opacity；线性渐变角度/from/to；圆角四角；毛玻璃 blur/opacity/border；对应预设；实时预览/CSS/复制 | 保留；四模式各自有对应输入和主输出，避免通用表单混淆 | 源码/原 focused E2E 模式输出；CSS 由浏览器渲染 |
| SVG 转 CSS | SVG；background/mask 两用途；本地已清理预览；Data URI CSS/复制；空状态 | 修复；使用完整 URI 编码，保留 SVG 文本中的空格/引号/百分号/非 ASCII，替代会破坏文本的压缩和部分替换 | 新 helper/源码；sanitize 行为保持原实现 |
| SVG 优化 | SVG 输入；多轮开关；SVGO 默认优化；前后大小/节省；预览/代码/对比/审计；对比滑杆；优化后复制/下载；无效输入 | 保留；使用现有 SVGO 无新依赖；预览仍经 sanitize；审计用于解释结构删除 | 源码/全目录巡检；视图输出保留 |
| HTML 转 JSX | HTML 输入 session 草稿；单根/自动多根 Fragment；强制 Fragment；class/for/boolean/属性转换；style 对象；文本/注释；复制/空状态 | 修复；统一 serializer 保留实体解码后的 `<>&{}` 文本、引号/换行属性、CSS URL/自定义变量；HTML 字符串事件处理器不能转换为 React callback，输出带明确手动迁移注释，避免生成错误 onClick 字符串 | 核心 JSX 语法、文本/style/事件/注释用例 |
| SVG 转 React | SVG；组件名；JSX/TSX；forwardRef；移除尺寸；弹性 size；solid paint currentColor；React code/复制/下载 | 修复；保留 SVG localName/tag 大小写、viewBox、aria-/data-、style；组件标识符规范化；避免重复 width/height；保留 gradient/url/none paint；无效 XML 不提供导出，显示错误 | SVG E2E 实际 TS parser 验证、渐变、唯一 width、非法 XML 禁用 |
| MIME | 扩展名/MIME 搜索；全部/text/image/application/video/audio 分类；20 常用映射；匹配数/空状态；逐项复制 | 保留；字体 woff2 可通过全部/搜索找到，未承诺完整 MIME 数据库 | utility E2E SVG 和空结果；源码映射检查 |
| UUID | V4 随机生成；数量 1–100；大写/小写；连字符；单行复制/全部复制；重新生成 | 保留；修复数量取整，显示数量与实际输出保持一致；copy 等待成功 | crypto.randomUUID 原算法；源码/ESLint |
| 随机整数 | min/max；数量 1–500；数字网格/文本切换；生成范围快照；全部复制 | 修复；crypto uint32 拒绝采样消除取模偏差；safe integer/范围 ≤2³² 个结果/整数数量校验 | 核心 surplus word/完整 uint32/无效范围用例 |
| Mock 数据 / 占位 | 用户/商品模板；字段增删/名称；id/uuid/name/phone/email/number(min/max)/text/enum(options)；数量 1–500；SQL 表名；JSON/CSV/SQL/MSW/Express 输出；表格/代码；生成/复制/导出；格式快照 | 保留；修复整数数量/数值范围/非空枚举/字段名唯一校验；`__proto__` 字段使用无原型对象；电话号码固定 11 位；CSV header 转义、SQL identifier 转义；旧导出按已生成格式而非当前 selector | utility E2E 模板/表格/格式快照；`__proto__`/电话号码/数值整数边界 E2E；MSW/Express 为模板，不启动服务器 |
| QR | 文本/URL；WiFi SSID/password/WPA/WEP/nopass；vCard name/phone/email；event title/start/end；尺寸；实时预览/PNG/内容复制；图片解码/复制 | 修复；WiFi/vCard/event delimiter 转义；无 SSID 不生成；真实日历值、时间顺序和 UTC 格式一致；解码切换图片/卸载释放 URL 和旧任务；16M 像素预算防 UI 内存过大 | 核心 QR payload 用例；E2E 不存在闰日拒绝/修正后 PNG 恢复；扫码 PNG 原用例 |
| 数字占卜 | 生日；姓名/拼音；关键词；目标年份；伴侣姓名；生命路径/表达/灵魂渴望/人格/个人年/关系主题；主数字保留；忽略字符提示；计算轨迹/报告预览/复制 | 保留；已有独立 numerology core 与测试；纯娱乐数字解读，保留输入证据和归约过程，未新增决策承诺 | 现有 numerology 单测；源码和路由检查 |
| JWT | encoded；Header/Payload JSON 编辑；时间声明；HS256 secret 验证/重签；本地字典审计/自定义行字典/进度/取消；解析错误和结果 | 保留；credential handling 和 HMAC 算法不改；修复 token/secret 变化清除旧验签/字典结果并停止旧审计；本地 Worker 卸载终止 | 源码/原 JWT E2E；token/secret/header/payload 快照比较已完成；仅接受原实现 HS256，拒绝其他alg误标；新增延迟验签用例 |
| 文本 Hash | UTF8；MD5/SHA1/SHA256/SHA512 实时；字节数；每行复制 | 保留兼容校验用途；修复旧 digest 异步结果不覆盖新输入；复制失败反馈；MD5 提示保留 | 源码/ESLint；Web Crypto 算法未变 |
| HMAC | Secret/message；HMAC-SHA256 十六进制；实时计算/复制；错误 | 保留；修复旧异步计算不能覆盖新 secret/message；共享复制 hook 替代假成功；secret 不持久化 | 源码/ESLint；Web Crypto 算法未变 |
| 密码 | 长度；uppercase/lowercase/numbers/symbols/exclude ambiguous；刷新；字符集/强度/估计破解时间/建议；copy；运行库状态与失败回退 | 保留；已证明 generateUnbiasedPassword 拒绝采样与边界；合并 local SHA256 验证 zxcvbn 运行库；empty charset 不生成；copy 成功后标记 | 现有 passwordCore 单测/加载器单测；无服务器传输 |
| Basic Auth | username/password；UTF8 Base64；Authorization Header；全部复制 | 保留；仅生成本地调试字符串，未改鉴权/存储/密码语义 | 源码；原 utility E2E 参数 |
| PEM/证书 | 多 PEM 块统计；CERTIFICATE/CSR/PKCS#8/SPKI/PKCS#1/SEC1；RSA/EC OID/真实 modulus bits/curve/bytes；可选 private PEM 配对；结构报告复制 | 修复；去掉任意大整数匹配及长度猜算法；Web Crypto 真实导入后比较 RSA n/e 或 EC crv/x/y；异步旧输入结果不回写；明确未校验链/有效期/用途 | 核心 RSA/EC 配对、不同私钥、无效 DER；证书测试使用合成 TBS+真实 SPKI，非信任链验证 |
| 非对称密钥转换 | PEM/JWK/DER hex 输入；RSA/EC public/private；PEM/JWK/DER 输出；真实本地测试密钥；结构/长度/curve/算法报告；暂存载入/送入/复制/下载；格式快照 | 修复；删除无效假样例和体积猜测评级；读取 ASN1 OID，PKCS#1/SEC1 标准封装为 Web Crypto 导入；真实 RSA2048 测试密钥；缺参数/不完整数据显式错误；不宣称综合安全合规 | 核心 RSA 三容器、EC 3 curve、SEC1、坏 PEM/DER；真实密钥转换 E2E |
| OpenPGP | 生成 name/email/passphrase；ECC/RSA2048/RSA4096；公私钥复制；encrypt/decrypt task；plaintext/public/private/passphrase；sign/verify task；detached signature/message/key/passphrase；loading/error/runtime 重试 | 保留；合并 OpenPGP6.3.1 自托管 SHA256 验证加载；每项任务只显示相关输入，秘钥/口令仍仅本页状态；共享复制错误反馈 | 现有 offline crypto/loading 断言；真实 runtime smoke parent统一；未使用外部 key |
| 国密 | SM2 生成/公私钥；encrypt/decrypt（C1C3C2 mode1）；sign/verify DER hash=true；SM3 文本 hash；SM4 ECB/CBC/key/IV/PKCS7 encrypt/decrypt；copy/status/runtime retry | 保留；沿用已验证 sm-crypto0.5.7 本地 SHA256 校验；SM2 crypto/sign 子任务隔开，SM4 参数校验现有；无算法策略变更 | 源码/既有 runtime单测；SM2验证结果按公钥/明文/签名快照失效；算法调用参数与本地库接口核对，保留现有算法不重写 |
| 时间工作室 | 秒/ms 输入与互切；local/UTC/ISO/指定 zone；现在/今日零点/结束/+24h；日期字符串->s/ms；日期跨度 start/end/绝对 days/hours/minutes/seconds；9 世界 zone；Cron 快查5次；实时时间/日进度；逐项复制 | 修复；datetime-local 初始化真正本地时间；空间日期转换为 ISO兼容输入；每日进度按本地两个午夜实际间隔适配 DST；clipboard 成功后才标记；s/ms 切换保留时间瞬间 | 核心 local input/space ISO/day progress；utility E2E 单位切换/任务切换 |
| Cron | Unix 5字段 minute/hour/day/month/weekday；preset/select；直接 expression 编辑；表单生成；每分钟/每小时/每日/工作日；未来5次及local zone；错误/复制 | 修复；字段从 expression 派生，预设/直接输入同步 selector，保留自定义字段 option；拒绝与声明不符的6字段；共享 copy hook | 新 E2E 反向同步、自定义7/11、预设0/9、六字段拒绝 |
| Chmod | owner/group/public 的 read4/write2/execute1；644/755/600/700预设；octal/symbolic/完整chmod命令；复制 | 保留；pure bit math 值明确；修复共享复制反馈 | 原 focused E2E 预设输出；源码检查 |
| 视频下载解析 | URL/源码模式；媒体直链/HTML/JSON扫描；Vimeo/Bilibili尝试；Worker endpoint/token(会话)/health5秒/说明/worker脚本/快捷指令；候选format/resolution/source/referer；播放器候选/资源链接/ffmpeg/复制/暂存 | 保留；upstream会话草稿/端点pref/session-onlytoken/SHA和 worker server边界全部保留；候选不承诺DRM/登录资源；全部fetch链统一30秒AbortController，主动取消和卸载丢弃旧结果；health端点切换也取消旧检查；输入/模式在解析中禁用；复制和暂存失败不显示成功；下载命令单引号转义并去除Referer换行；异步暂存只成功后提示 | parseFromSource现有单元；Worker mock E2E；无真实受限媒体请求 |

### 删除证据

- 删除 dormant `components/tools/TimeTool.tsx`、`TimeTools.tsx`、`time/index.tsx`：对组件/registry/studios/App/scripts/tests/package 的全仓符号、路径、glob/dynamic 入口搜索仅命中其自身；本项目 private app，无 exports 公共 API；全部活跃时间入口明确是 UnixTimeStudio，CronTool 独立入口和旧 route alias 保留。不会删除旧路由兼容层。
- 删除 `SecurityNoteTool`：唯一声明位于 security/index，零导入/注册/动态消费；它是静态无效入口，不占用活跃tab。
- 删除无法证明算法/强度的长度猜测、任意大整数配对、无效测试样例、多次重复赋值与重复复制hook。以受测试的 DER/OID helper 与实际 WebCrypto导入替代，未删除活跃工具。
- 占位正文 buildSentence 仍被 Mock text字段消费，不因顶部未独立显示 Lorem 页面就删除。
- RandomStringTool 此次 main 新激活，归 内容组，不能视为无消费者删除。人民币大写同由 内容组 负责。


## 文件、编码与图像功能

| 注册路由 | 功能 / 参数 / 子模式 | 决定与理由 | 改动 / 已知边界 |
| --- | --- | --- | --- |
| `file-document-studio#pdf` | 添加多份 PDF、缩略图、移动页面、90°旋转、删页/清空、合并下载、暂存、进度与取消 | 保留；都是页面编排需要的操作 | 使用主线本地校验资源；120页/单文件64MB/累计128MB，缩略图限320px；取消立即销毁PDF.js任务，结束前禁止改页；导出旋转叠加原始页面旋转；暂存等待真实保存成功 |
| `file-document-studio#pdf` | PDF转PNG、单页下载/暂存、全部ZIP、重新渲染、进度与取消 | 保留；单页和批量不同用途 | 累计9000万像素；失败/取消清理文档，ZIP延迟加载，不依赖CDN；不支持加密PDF解密或OCR |
| `file-document-studio#file-info` | 多文件属性、扩展名、大小/MIME/时间、按需SHA-256、逐项删除/清空/复制 | 保留；属性和内容校验用途明确 | 顺序计算，64MB单文件上限；用File身份区分同名同尺寸不同内容；浏览器MIME是提示，不代表真实格式验证 |
| `file-document-studio#filename` | 多行路径/URL、文件名/主名/扩展名、TSV或单字段复制、示例/清空 | 保留；批量整理用途明确 | 接入有界草稿；URL忽略query/hash，普通本地路径保留#和.env；保留多重扩展名末尾部分、原始编码，不擅自解码 |
| `encoding-binary-studio#file-base64` | 文件Data URL、纯Base64、复制、大小/字符数 | 保留；任意二进制与图片嵌入页不同 | 16MB上限、读失败反馈；名称从“Base64/文件转换器”改“文件转Base64”，符合实际单向功能 |
| `image-media-studio#image-base64` | 图片预览、Data URL/纯Base64/HTML/CSS、复制/暂存 | 保留；嵌入模板是独立用途 | 16MB/2000万像素；真实解码验证；暂存失败不再显示成功；不加入没有需求的反向解码/下载面板 |
| `image-media-studio#image-colors` | 图片预览、12色采样、相对占比、单色HEX/整板HEX或CSS复制 | 保留；配色需要 | 边长160px采样、透明像素排除；占比明确为所选色板相对占比，属于量化近似；限制输入并反馈读失败 |
| `image-media-studio#image-watermark` | 文字、左下/中心/右下、透明度、相对字号、实时预览、PNG/暂存 | 保留；常用可理解参数 | 当前参数完成渲染才可导出；限制文件/像素；暂存等待成功，不保存失败结果；字体使用浏览器字体，无排版编辑器 |
| `image-media-studio#perler-beads` | 中心方形裁切、32/64格预设、16–96格、2–24色、Worker生成、颜色清单/颗数/PNG | 保留；图案细度与色数必要 | 每次参数任务各自拥有Worker，旧任务终止，禁止导出旧图；颜色是近似RGB色板，不映射商业珠色号；PNG标示5mm仅为设计参考，不承诺打印物理比例 |
| `image-media-studio#background-removal` | 取色抠除、容差/羽化、擦除/还原、画笔大小、背景预览、PNG/换图 | 修正后保留；单色抠除与精修用途成立 | 修复三个未创建的离屏画布与遮罩颜色未转换alpha导致整页无效；输入16MB/1600万像素；读失败/旧图片生命周期；预览背景不烧进透明PNG。它是色键工具，不是AI语义分割 |
| `image-media-studio#visual-centroid` | Alpha阈值、视觉质心/包围盒中心、取色与容差抠除、恢复原图、导出标记 | 保留；透明图的几何分析独立用途 | 16MB/1600万像素、Bitmap释放、失败保留旧图并反馈；质心是可见像素加权几何计算，不代表人类感知/视觉模型 |
| `image-media-studio#image` 内“矢量化” | 黑白预设、阈值/反色、简化度、填充/背景色、SVG预览/代码/复制/下载/暂存 | 保留；轮廓追踪具实际用途 | 限16MB、追踪边长600；旧异步图像禁止覆盖新参数；解码/复制/暂存失败反馈；SVG仍经allowlist清洗。它是灰度轮廓提取，不承诺彩色矢量重建 |

| `image-media-studio#image` 内“压缩/转换” | 网页/平衡/高清预设、目标0.1–64MB、最长边1–8192px、保持/JPEG/PNG/WebP、原图/结果/体积比较、进度/取消、下载/暂存 | 保留并补全；压缩与转换同一产物流程，预设都有真实参数作用 | 64MB/2400万像素，30秒任务预算；本地SHA校验Worker脚本代替默认CDN；输入或参数变化清旧输出；暂存等待成功。PNG保留透明度、JPEG不保留，目标体积不作达成保证；不处理动画帧。离线真实PNG导出60×30px、取消加载、英文已载入状态通过浏览器验证 |

### 全局共享交互

| 功能 | 决定 | 实施与理由 |
| --- | --- | --- |
| 工作室分组、全局搜索、准确工具链接、工作室选择/搜索、前后导航、手机原生选择器 | 保留 | 注册工具目录改由registry生成，删除另一份85项手写清单；当前13工作室84入口，旧链接兼容 |
| 全局暂存、逐项复制/下载/改名/删除、ZIP多选、过期/敏感状态、容量与失败提示 | 保留并补全 | 复用主线ScratchpadCards；ZIP同名去重、延迟加载与重复点击保护；清空需页面内二次确认；敏感项目保持会话内；drawer补dialog/focus trap/返回焦点 |
| 深浅色、中英切换、键盘打开搜索、移动目录遮罩 | 保留 | 复用安全preference存储；渲染时翻译UI，停止DOM遍历改写，编辑器和用户结果不遍历 |
| 工作室/工具加载失败恢复 | 补全 | 主线error boundary同时包工作室和子工具；预加载失败交给可恢复界面，不产生未处理Promise |
| 两个bundle预算脚本 | 删除重复 | package.json/CI只引用新版check-bundle.mjs；旧check-bundle-budget.mjs没有剩余消费者 |
| NuGet证书解析的forge依赖 | 替换 | 依赖、类型包和旧运行时文件均移除；采用锁定 PKIjs/ASN1js 解析 CMS/X.509 与原生 WebCrypto 指纹。保留元数据解析边界，生产依赖审计零漏洞，不屏蔽门禁 |

PDF 模块动态加载改用绝对 URL，防止开发服务给 public ES 模块追加 `?import` 导致整页无法工作；开发模式和生产模式均验证旋转导出。


## 最终验证

验证于 2026-10-03 完成：

| 检查 | 结果 |
| --- | --- |
| 严格 TypeScript / 全仓 ESLint | 通过；零 warnings |
| 路由 / 生成目录 / 导航翻译 | 通过；13工作室、84页面、219入口字符串 |
| 模块边界 / 文档 / 本地资源清单 | 通过；12个运行资源及许可证，旧forge运行时已移除 |
| 单元测试 | 26文件、154项通过，包括19项CMS/X.509解析回归 |
| 生产构建浏览器回归 | 84项通过，包括84页面英文全目录扫描、真实CMS解析与异常输入恢复 |
| 开发模式媒体与暂存回归 | 5项通过，包括本地PDF模块、透明度、真实压缩尺寸与取消 |
| 构建 / 首屏包预算 | 通过；app shell JavaScript为161.0KB gzip，预算240KB；证书解析按需加载 |
| 生产 / 全依赖审计 | 通过；均为零漏洞，审计门禁保留 |

新增永久回归位于 `tests/e2e/content-feature-audit.spec.ts`、`utility-feature-audit.spec.ts`、`repository-cad-media-audit.spec.ts` 和 `media-feature-audit.spec.ts`。既有schema、敏感暂存、Worker取消、旧链接与移动交互回归仍保留。

移除 node-forge 后，从锁文件重新安装依赖并完整执行 `npm run verify`，发布门禁全部通过。生产产物不再包含旧forge运行时；新的证书解析chunk保留上游许可证声明。另已通过真实CMS的两项开发模式浏览器回归。
