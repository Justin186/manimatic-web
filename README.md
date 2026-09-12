# Manimatic · Web 前端

> **配套项目**：后端渲染服务在 `../MathStoryboard`（Python / Manim）。
> SSE 事件定义见 `../MathStoryboard/docs/前端接入-后端改造清单.md`。
>
> 少了这两行，AI 辅助开发时会在错误的一侧找答案 —— 这是分仓库唯一真正的代价。

Web 优先的**对话式讲解动画创作台**：用自然语言提题 → AI 先文字回答 → 给出分镜大纲 →
确认 → 逐分镜渲染 → 渲好一段播一段 → 可在对话里继续修正。

---

## 一、当前状态：前端已完成，后端还是 Mock

**后端那层 HTTP 服务（FastAPI）还没接**（见 `../MathStoryboard/docs/前端接入-后端改造清单.md`）。
所以本项目自带一套 **Next.js Route Handler 版的 Mock 后端**，它就长在 `src/app/api/` 下：

| 路由 | 事件 |
|---|---|
| `POST /api/chat` | `text_delta` → `plan` → `done` |
| `POST /api/render/confirm` | `tool_call` → `tool_progress` → `tool_result`(顺序 1→N) → `tool_done` |
| `POST /api/render/retry` | 单分镜重渲 → `tool_result` → `tool_done` |
| `POST /api/storyboard/replace-scene` | 整分镜替换 → `tool_result` → `tool_done` |

Mock 的事件序列**刻意保留了两个真实特性**，因为它们直接决定前端的设计：

1. **片段按 1→N 顺序到达** —— 后端已是「一个 Scene 演到底 + 边渲边切」，
   `@@ {"section": N}` 严格递增，所以前端不需要乱序缓冲编排器。
   > 2026-09-12 更正：早期版本 Mock 刻意打乱完成顺序（模拟多进程并行渲染），
   > 但后端实测否决了多进程（瓶颈是内存带宽，8 分镜 18.0s vs 默认 12.3s），
   > 乱序在真实链路上永远不会发生 —— 继续乱序发只会让前端保留一段死代码。
2. **单分镜失败** —— 打开「模拟渲染失败」开关，第 3 个分镜会失败并可单独重试。

另外 Mock 的 `tool_result.durationSec` 给的是**真实帧时长**（从 `public/demo/*.mp4`
用 ffprobe 量出来，见 `src/lib/mock-data.ts` 的 `segmentDurations`），语义等价于后端
`sections/index.json` 的 `duration`，**不是大纲里的估算值**。

演示视频用的是**你们自己渲出来的真画面**：`public/demo/` 下是从
`../MathStoryboard/output/` 拷过来的 `free_derivative` 分镜片段与成片，不是占位素材。

### 切到真后端

只改一个环境变量，不动任何组件：

```bash
# .env.local
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 二、跑起来

```bash
npm install
npm run dev       # http://localhost:3000
npm run build && npm run start
npm run lint
```

默认进 `/app`，重定向到 `/app/t/demo`（预置了一条已出片的会话，打开就能看到成片）。

页面：`/`（落地页）· `/app/t/[threadId]`（三栏创作台）· `/login` · `/settings` · `/pricing` · `/share/[slug]`

---

## 三、目录结构

```
src/
├── app/
│   ├── api/                    # Mock 后端（真后端就绪后整块可删）
│   │   ├── _stream.ts          # SSE 封装 + Mock 的会话记忆
│   │   ├── chat/               # 对话
│   │   ├── render/confirm|retry/
│   │   └── storyboard/replace-scene/
│   ├── app/t/[threadId]/       # 三栏创作台
│   └── ...
├── components/
│   ├── ui/                     # 基础组件（shadcn 风格：代码进仓库，可任意改）
│   └── workbench/              # 自研核心组件
│       ├── Workbench.tsx       # 三栏外壳 + 状态机 + SSE 事件分发
│       ├── ChatStream.tsx      # 对话流（流式滚底，用户上滑后停止跟随）
│       ├── StoryboardPlanCard  # 大纲卡片（可改顺序/时长/删步骤 + 确认生成）
│       ├── RenderProgress      # 分镜级进度 + 单分镜重试；出片后收起为一行摘要
│       ├── VideoPlayer         # ⭐ 三处共用的播放器（画面 + 悬浮控件层）
│       ├── TimelineScrubber    # 整片进度条（浅色/深色两套主题）
│       ├── ShareDialog         # 分享弹窗（复制链接 + 下载 MP4）
│       ├── VideoSegmentCard    # 对话流内联卡片（VideoPlayer 的 inline 形态）
│       └── ArtifactPanel       # ⭐ 右栏：产物缩略图列表 + 二级详情
└── lib/
    ├── types.ts                # 前后端契约（与架构文档 §5 一一对应）
    ├── api.ts                  # 接口封装 + Mock/真后端开关
    ├── sse.ts                  # 极简 SSE 客户端
    ├── timeline.ts             # 虚拟整片时间轴（按真实帧时长铺格）
    ├── playback.ts             # 单 video + 虚拟时间轴 → 看起来是一条整片
    ├── fullscreen.ts           # 真全屏（容器级）+ 不支持时的探测
    └── store.ts                # Zustand：会话 / 消息 / 渲染状态
```

**契约同步**：事件类型就 8 个，目前手工对齐（`src/lib/types.ts`）。
等超过 15 个再上 `openapi-typescript` 自动生成。

---

## 四、几个不显然但重要的设计

- **中栏最小宽度 480px**，不按比例压缩 —— 否则两侧全展开时对话区会被挤成一条。
- **收起状态持久化**，且存的是 `null | boolean`：null 表示"用户没手动改过"，
  此时按屏幕宽度自动决定，手机上默认收起。
- **进度条用 rAF 推进，不用 `timeupdate`**：后者规范只要求每 15–250ms 发一次，
  浏览器普遍按 ~4Hz 发，直接拿它渲染就是"一跳一跳"的。现在播放中由
  `requestAnimationFrame` 读 `video.currentTime`（约 60fps），暂停即停，不空转。
  配套地，`TimelineScrubber` 的已播填充**故意不加 CSS transition** ——
  60fps 更新再叠一层 150ms 补间反而像"追不上"。
- **音量 / 倍速由 `playback.ts` 单一持有**：按规范的媒体加载算法，
  `video.load()` 会把 `playbackRate` 重置回 `defaultPlaybackRate`、音量重置为 1。
  所以每次 `load()` 之后都必须重新写一遍（`applyPrefs`），并同时设
  `defaultPlaybackRate`（它才是 `load()` 之后 `playbackRate` 的落点）。
  之前组件和 hook 各写一次 `videoEl.muted` 会互相覆盖（谁后跑谁赢），
  现在组件只传"起播是否静音"。
  > 这条踩过两次：一次是音量在切段后跳回最大，一次是**倍速在过了分镜交界线后变回 1×**。
- **播放用双缓冲（A/B 两路 `<video>` 交替）**：这是"切段不黑屏"的关键。
  换源要调 `load()`，而它会**立即清空当前画面**，随后才取新数据、重建解码器 ——
  这段空白就是黑帧。所以常备两路：一路在播，另一路提前把**下一段**载好
  （`preload="auto"` 且强制静音）。切段时把画面切到已就绪的那一路，
  全程没有 `load()` 打在正在看的元素上。画面切换用 **z-index 而不是 opacity**
  （活跃那路压在上面），这样万一它还没吐出首帧，透出来的是下层上一段的最后一帧。
  > ⚠️ 预载时必须用 **`activeSideRef`（同步）** 判断"谁是备用路"，不能用 `activeSide`（state）。
  > 换路靠 `promote()` 完成，它同步更新 ref，但 state 要下一轮才生效；按 state 算会在
  > "播完 → 换路"的同一轮里把**刚接手播放的那一路**当成备用路去 `load()`，
  > 正在播的元素被换源 —— 症状就是"交界处卡一下 + 倍速被重置"。
- **全屏是容器级真全屏**：`requestFullscreen` 的对象是「video + 控件层」整个容器，
  不是裸 `<video>`（那样会丢掉兄弟节点里的进度条/倍速/分享）。
  浏览器不支持容器全屏时降级为"就地铺满视口"，**不退回 Dialog** ——
  居中弹窗那种"伪全屏"正是被否掉的形态。
  > 不要在渲染期探测 `document.fullscreenEnabled` 来决定文案：服务端为 false、
  > 客户端为 true，两边不一致就是一条 hydration mismatch。能力以调用结果为准。
- **时间数字一律是整片全局时间**（`globalTime / timeline.total`），不显示"第 3/8 段"。
  分片是后端为了"边渲边交付"才切的实现细节，不该漏给用户；而且按分段显示时
  换段数字会跳回去，观感上像倒带。
- **分镜交界处不能有闪烁**，一共三处针对性处理（全是真实反馈修出来的，缺一个都还会闪）：
  1. **播到结尾会先派发 `pause`、再派发 `ended`**（`paused` 先变 true）。若把那个 pause
     当成"用户暂停"，`playing` 会瞬间变 false → 控件层与按钮闪现。
     判据是 `el.ended`：**播完的暂停不算暂停**。
  2. 换源/换路的窗口期内 `pause` 也是副作用，用一个窗口标记（`switchingRef`）吞掉，
     等 `play` 事件到达再复位；用户主动点按钮时立即失效该窗口，别吞掉真实暂停。
  3. 换段那一帧 `activeSlot` 已是新段，而元素还在放上一段，`currentTime` 是旧段末尾值；
     直接算会被 `min(旧末尾, 新段时长)` 截断，进度条先跳末尾再弹回起点。所以读数前要先用
     元素上的 `dataset.key` 确认"装的确实是这一段"。
- **跳段的进度读数要用「待应用的 seek 落点」顶着**：跨段跳转时元素还没换/还没 seek 完，
  若回退到段起点，进度条会先闪到该分段的开头、下一帧才挪到落点。
  所以"待应用目标"（`pendingSeekRef`，带目标段号）在读数里**优先于** `currentTime`，
  直到 seek 真正落到元素上才清空 —— 早清一帧就会闪，晚清则进度条卡住。
- **三处视频展示共用同一个 `VideoPlayer`，控件完全一致**（播放/暂停、进度条、时间、
  倍速、音量、重播、全屏、分享）。形态差异只有两点：起播是否静音（autoplay 策略）、
  是否给"进详情"的入口。**不要按摆放位置裁剪控件** —— 曾经让内联小窗少了倍速和音量，
  结果是"同一个播放器嵌在对话里就少几个按钮"，用户没理由理解这种差异。
  要精简也只按屏幕宽度精简。
- **内联播放器必须 muted**，这是浏览器 autoplay 策略；进入全屏会自动取消静音
  （用户手动静音过则不打扰）。
- **时间轴用真实帧时长**：`tool_result.durationSec` 来自后端 `sections/index.json`
  （manim 按真实帧数算），比大纲 `durationSec` 准。确认阶段先用设计值占位，
  片段到达后覆盖 —— 因为片段严格顺序到达，已就绪的格子位置不会被后面改动带漂。
- **右栏是「产物列表 + 二级详情」**：一条会话里每次"AI 改分镜"都会追加一条新消息
  （v1/v2/v3 并列），所以有多个成片是常态。一级列表让人看得见"这条会话出过哪些版本"，
  点进去才是详情（播放器 + 分镜 + 信息）。
- **失败绝不整条重来**：单分镜自动重试 1 次，仍失败就显示该分镜的重试按钮，
  已完成的分镜照常播放。
- **进度卡片出片后收起为一行摘要**（可点开），但**失败时不收起** ——
  失败是需要用户处理的状态，藏起来等于把问题藏起来。
- **每次修正生成一条新消息**（v1/v2/v3 并列），不是原地覆盖 —— 保留不同方向的尝试。

### ⚠️ 关于"交界处卡顿"的归因（别搞错功劳）

曾经以为"交界处卡一下"是双缓冲不够快，实测归因是**另一个 bug**：
预载 effect 拿 `activeSide`（state）算备用路，而 `promote()` 只同步更新 ref、
state 要下一轮才生效 —— 于是"播完 → 换路"那一轮把**刚接手播放的那一路**当成备用路，
对它 `load()` 了下一段。正在播的元素被换源（画面清空 + 重新加载 + 重新起播），
那才是真正被感知到的卡。（所以预载一律走 `activeSideRef`。）

修掉之后，双缓冲的实际收益是：**换段时一个像素都不用重画**，
即消除了"换 `src` 会立即清空画面"这块必黑的黑帧。

**它的天花板仍在**（不夸大）：切换只能在 `ended` 之后发起，此时旧元素已经停了，
"启动另一路播放管线"本身有几十毫秒开销（解码器启动、首帧上屏），段越短占比越大。
要做到真正零间隔只有一条路：**单个解码器连续播放** —— 后端别给多个独立 mp4，
而是输出 **fMP4/HLS**（或一条持续增长的整片），前端用 `MediaSource` 把分片按
`timestampOffset` 串到一个 `<video>` 上。那是后端契约变更，前端单方面到顶了。

> 权衡记录：双缓冲让核心逻辑多了约 200 行（A/B 两路、预载时机、ref/state 同步），
> 也已因此踩过两个 bug。如果哪天判断"这点复杂度不值那一次黑帧"，
> 退化回单元素是可行的 —— 代价是每次交界黑一帧。

这是**后端契约变更**，不是前端能单方面解决的。当前实现已经是"后端给独立 mp4"
这个前提下的最好结果。
- **修正是整分镜替换**，不是文本 patch：分镜内 `duration` 与 `timeline.run_time` 耦合，
  只改一处会改出"动画演完干等"的半吊子结果。

---

## 五、还没做

- 接真后端（FastAPI，见配套文档 §1–§7）
- 真实登录 / 支付 / 配额（现在是测试账号 + 假支付页）
- 分享链接落地（现在复制的是本地 URL，`/share/[slug]` 只有静态演示页）
- Capacitor 出 iOS/Android 包
- 边生成边渲染流水线（v2，首段 41s → 11s，但别和 v1 一起做）
- 产物持久化：右栏的产物是从当前会话的消息里派生的，刷新后仍在（store 里有消息），
  但没有服务端存储 —— 真后端要做成 `GET /api/artifacts?thread_id=`
