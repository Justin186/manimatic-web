/**
 * 把一段文字切成「普通文本 / 公式」两种片段，交给 KaTeX 在浏览器里渲染。
 *
 * ============================================================================
 * 契约：数学由**产出方**标记，不由**显示方**猜
 * ============================================================================
 * 只认 `$...$`（行内）和 `$$...$$`（独立成行），`\$` 是转义的美元符号。
 * 没有标记的一律当普通文字 —— **不猜**。
 *
 * 为什么不猜（这是踩过一次才定的）：
 *   模型原来的回答是 `f'(x)=3x²−3=3(x−1)(x+1)` —— unicode 上标、unicode 减号，
 *   一个 `$` 都没有。靠"哪些字符像公式"去反推，必然在 `²` 这种字符上把一句话
 *   切成好几段（公式字体 → 正文字体 → 公式字体），界面上看着就是"公式断成几截"。
 *   而猜错方向更糟：把正文当成公式会**改变用户看到的文字**。
 *
 *   正解在产出那一端：提示词要求数学一律写 LaTeX 并用 `$` 包起来
 *   （见 `MathStoryboard/storyboard/llm.py` 的「## 数学写法」一节）。
 *   契约清楚了，这里就只是个字符串扫描器。
 *
 * ============================================================================
 * 唯一的不变量：切分必须**无损**
 * ============================================================================
 * 把所有片段按序拼回去，必须逐字符等于原文。认错了顶多是没渲染（显示原文），
 * 丢字符就是改坏了用户的内容。
 */

export type TextSegment = { type: "text"; value: string };

export type MathSegment = {
  type: "math";
  /** 这一段在原文里的样子（含两侧的 `$`）── 渲染失败时按它原样显示 */
  source: string;
  /** 交给 KaTeX 的内容（已去掉 `$` 标记、两端空白） */
  latex: string;
  /** true = `$$...$$`，独立成行并居中 */
  display: boolean;
};

export type Segment = TextSegment | MathSegment;

const CJK = /[⺀-鿿　-〿＀-￯]/;

/**
 * `$` 之间的东西是不是公式。
 *
 * 契约上 `$` 只用来包数学，但**用户的输入**不受这个约束（粘贴一段带 `$` 的
 * 外文也不稀奇），所以留一道便宜的闸门：夹着中文的一律不算 ——
 * `这件商品 $5，那件 $10` 的两个 `$` 之间正好是中文。
 */
function looksLikeMath(latex: string): boolean {
  const s = latex.trim();
  if (!s || CJK.test(s)) return false;
  if (/[\\^_{}<>|=+\-*/]/.test(s)) return true; // 有数学记号 / 运算符
  // 不含空白、含字母的短标识符也算（`$x$`、`$2x$` 这种单个变量）
  return !/\s/.test(s) && /[A-Za-z]/.test(s) && s.length <= 12;
}

/**
 * 找 `$` 的配对位置。
 *
 * 行内公式**不允许跨行** —— 漏写一个收尾 `$` 时，`$x>0` 会把后面整段文章吞成
 * "公式"。宁可不渲染，也不能让一段正文消失。
 */
function findClose(text: string, from: number, display: boolean): number {
  const n = text.length;
  let j = from;
  while (j < n) {
    const ch = text[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (!display) return -1;
      j += 1;
      continue;
    }
    if (ch === "$") {
      if (display && text[j + 1] !== "$") {
        j += 1; // display 里的单个 $ 只是普通字符
        continue;
      }
      return j;
    }
    j += 1;
  }
  return -1;
}

export function splitMath(text: string): Segment[] {
  const out: Segment[] = [];
  const n = text.length;
  let buf = "";
  let i = 0;

  const flushText = () => {
    if (buf) {
      out.push({ type: "text", value: buf });
      buf = "";
    }
  };

  while (i < n) {
    const ch = text[i];

    // `\$` 是转义的美元符号，当普通字符
    if (ch === "\\" && text[i + 1] === "$") {
      buf += "\\$";
      i += 2;
      continue;
    }

    if (ch === "$") {
      const display = text[i + 1] === "$";
      const openLen = display ? 2 : 1;
      const closeAt = findClose(text, i + openLen, display);
      if (closeAt >= 0 && looksLikeMath(text.slice(i + openLen, closeAt))) {
        flushText();
        out.push({
          type: "math",
          source: text.slice(i, closeAt + openLen),
          latex: text.slice(i + openLen, closeAt).trim(),
          display,
        });
        i = closeAt + openLen;
        continue;
      }
      // 没配上、或不像公式：这个 `$` 就是个普通字符
      buf += ch;
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }

  flushText();
  return out;
}

/* ---------------------------------------------------------------------------
 * 渲染（KaTeX）
 * ------------------------------------------------------------------------ */

/** 只声明用到的那一个函数：katex 是 CJS 包，ESM 动态 import 的互操作形态随打包器
 *  而异（有时是 namespace 本身、有时挂在 `.default` 上），写具体类型反而会错。 */
type KatexLike = { renderToString: (latex: string, options: Record<string, unknown>) => string };

let mod: KatexLike | null = null;
let loading: Promise<void> | null = null;

/** 动态 import：KaTeX 带字体和 CSS，不该为了"可能没有公式"拖慢首屏。 */
function ensureKatex(): Promise<void> {
  if (mod) return Promise.resolve();
  if (!loading) {
    loading = import("katex")
      .then((m) => {
        const candidate = (m as { default?: KatexLike }).default ?? (m as unknown as KatexLike);
        if (typeof candidate?.renderToString === "function") mod = candidate;
      })
      .catch(() => {
        // 加载失败就**永远**降级显示原文。这里刻意不重试 —— 环境里没这个包时，
        // 重试只会变成一串注定失败的请求。
      });
  }
  return loading;
}

/** 提前把 KaTeX 拉起来（首屏有公式时省掉几十毫秒的"先显示原文"）。 */
export function preloadKatex(): void {
  void ensureKatex();
}

/** KaTeX 加载完成的承诺（失败也会 resolve —— 调用方拿到的是"可以再问一次"）。 */
export function katexReady(): Promise<void> {
  return ensureKatex();
}

export type RenderResult =
  /** 还没加载完 —— 几十毫秒后会变，先显示原文 */
  | { status: "pending" }
  | { status: "ok"; html: string }
  /** 解析失败（KaTeX 不支持的命令等）—— 降级显示原文 */
  | { status: "error" };

/** 同一段公式只渲一次：流式输出每来一个 token 都会重切整段文字。 */
const cache = new Map<string, { status: "ok"; html: string } | { status: "error" }>();
const CACHE_MAX = 500;

export function renderLatex(latex: string, display: boolean): RenderResult {
  const key = (display ? "d:" : "i:") + latex;
  const hit = cache.get(key);
  if (hit) return hit;

  if (!mod) {
    void ensureKatex();
    return { status: "pending" };
  }

  let result: { status: "ok"; html: string } | { status: "error" };
  try {
    result = {
      status: "ok",
      html: mod.renderToString(latex, {
        displayMode: display,
        throwOnError: true, // 失败要能接住，而不是渲染出一段红色的报错文本
        strict: "ignore", // 不认识的写法照渲染，别往控制台刷警告
        trust: false, // 禁用 \href / \htmlClass 这类能产出 HTML 的命令
        output: "htmlAndMathml", // 带 MathML：可选中、可复制、读屏能读
      }),
    };
  } catch {
    result = { status: "error" };
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, result);
  return result;
}
