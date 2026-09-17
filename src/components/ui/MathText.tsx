"use client";

import { Fragment, useEffect, useState } from "react";

import {
  katexReady,
  preloadKatex,
  renderLatex,
  splitMath,
  type MathSegment,
  type RenderResult,
} from "@/lib/mathrender";

// KaTeX 的样式（含它引用的字体）。放在**使用它的组件**里，而不是 globals.css：
// 那是全站地基，不该为一个"可能一条公式都没有"的页面承担无关职责。
import "katex/dist/katex.min.css";

type Props = {
  text: string;
  className?: string;
};

/**
 * 一段可能夹着公式的文字。
 *
 * 与直接 `{text}` 的唯一区别是：`$a^2+b^2=c^2$` 这类片段会被 KaTeX 渲染成真正的
 * 数学排版，其余字符**逐字不变**地原样输出（切分的无损保证见 `lib/mathrender.ts`）。
 */
export function MathText({ text, className }: Props) {
  // 提前把 KaTeX 拉起来：有公式时省掉几十毫秒的"先显示原文再变图"。
  useEffect(preloadKatex, []);

  return (
    <span className={className}>
      {splitMath(text).map((seg, i) =>
        seg.type === "text" ? (
          <Fragment key={i}>{seg.value}</Fragment>
        ) : (
          <MathSpan key={i} segment={seg} />
        ),
      )}
    </span>
  );
}

function MathSpan({ segment }: { segment: MathSegment }) {
  const [result, setResult] = useState<RenderResult>(() =>
    renderLatex(segment.latex, segment.display),
  );

  useEffect(() => {
    // KaTeX 是动态 import 的：没加载完时 renderLatex 返回 pending，
    // 加载完要按同一段公式再问一次（命中缓存，不会重复渲染）。
    if (result.status !== "pending") return;
    let alive = true;
    void katexReady().then(() => {
      if (alive) setResult(renderLatex(segment.latex, segment.display));
    });
    return () => {
      alive = false;
    };
  }, [result.status, segment.latex, segment.display]);

  if (result.status === "ok") {
    return (
      <span
        // $$...$$ 独立成行并居中。用 span + block 而不是 div：
        // 正文外层是 <p>，div 嵌在 p 里是非法结构（浏览器会把 <p> 提前闭合）。
        className={segment.display ? "my-2 block text-center" : undefined}
        // 悬停能看到 LaTeX 原文 —— 内联渲染出来的公式复制不走剪贴板，这是补偿
        title={segment.latex}
        // KaTeX 的输出由它自己的 lexer 生成，且 trust:false（禁用 \href / \htmlClass
        // 这类能产出 HTML 的命令），所以这里不含用户可控的标记。
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    );
  }

  // pending（KaTeX 还没加载完，几十毫秒）与 error（KaTeX 不支持的写法）
  // 都按**原文**显示。后者是刻意降级：一段讲解里可能有 8 个公式，
  // 跳出 8 个报错比原文难看得多 —— 与"一个公式失败不影响同批其他公式"是同一取舍。
  return (
    <span title={result.status === "error" ? "这个公式无法渲染，已按原文显示" : undefined}>
      {segment.source}
    </span>
  );
}
