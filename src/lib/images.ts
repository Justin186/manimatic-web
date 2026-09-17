import type { ImageAttachment } from "./types";
import { uid } from "./utils";

/**
 * 图片附件的前端工具层。
 *
 * ==============================================================================
 * 这一层只做"把关"，不做"加工"
 * ==============================================================================
 * 压缩/降采样/EXIF 转正/透明底合成**全部在后端**（`storyboard/vision.py`，
 * 用 Pillow）。前端**故意不压缩**，理由：
 *
 *   1. 浏览器 canvas 重编码在不同平台（Chrome/Edge/Safari、不同 GPU 后端）对同一张图
 *      可能给出不同结果，"压完多大"不可预测；
 *   2. 一旦前端压一次、后端再压一次，出问题就不知道看哪边 ——
 *      **"压多少"这一件事只能有一处实现**。
 *
 * 所以这里只回答两个问题：**这张图能不能收**（格式/张数/体积），
 * 以及**怎么把它读成 data URL**（读文件这一步没法交给后端）。
 *
 * ⚠️ 上限必须与后端 `MSB_VI_MAX_IMAGES` 保持一致。
 *    前端拦一道是为了**在选图那一刻**就给反馈（不让用户等一次请求往返），
 *    后端仍然是权威 —— 它会再拦一次，且比这里严格（还会管像素数、解码失败等）。
 */
export const MAX_IMAGES = 4;

/**
 * 单张图的体积上限（字节）。
 *
 * 这里**放宽到 12MB**，而不是后端的 4MB：后端拿到图之后会降采样 + 压到 4MB 以内
 * （手机原图 3~8MB 是常态，卡 4MB 会把大量正常照片挡在门外）。
 * 这一条只拦"明显不该传"的巨无霸（比如 RAW 导出、扫描件），
 * 让用户在选图那一刻就得到反馈，而不是传上去再吃后端的拒绝。
 */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** 只认这几种。HEIC 不在其中（后端也不支持，且错误信息里会明确提示先转 JPEG）。 */
const ACCEPTED = /^image\/(png|jpeg|jpg|webp|gif|bmp)$/i;

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.test(file.type);
}

/** 人类可读的体积（"3.2 MB"），用于错误信息与缩略图角标 */
export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * 一次"要不要收这张图"的判定。返回 null = 可以收，否则返回给用户看的原因。
 *
 * 为什么把张数判断也放进来：选文件和粘贴截图两条入口都要判，
 * 各写一遍迟早漂移（一处记得判张数、另一处忘了）。
 */
export function rejectReason(file: File, current: number): string | null {
  if (!isAcceptedImage(file)) {
    return `${file.name || "这张图"} 不是支持的格式（只认 PNG / JPEG / WEBP / GIF / BMP）。iPhone 的 HEIC 请先转成 JPEG 再上传`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name || "这张图"} 有 ${humanSize(file.size)}，太大了（单张上限 ${humanSize(MAX_IMAGE_BYTES)}）`;
  }
  if (current >= MAX_IMAGES) {
    return `一次最多 ${MAX_IMAGES} 张图片。题目照片通常 1 张就够，请精简后重试`;
  }
  return null;
}

/**
 * File → data URL。
 *
 * 用 `FileReader.readAsDataURL` 而不是 `URL.createObjectURL`：
 * 后者给的是 `blob:` 地址，**后端拿不到**（它只是个浏览器内部的句柄），
 * 而我们要把内容本身放进请求体。
 *
 * 也不用 `arrayBuffer + btoa`：手机照片几 MB，手工转 base64 要先构造一个大字符串，
 * 而 FileReader 由浏览器原生实现，更省内存也不容易踩编码坑。
 */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`读取 ${file.name || "图片"} 失败`));
    reader.readAsDataURL(file);
  });
}

/**
 * 剪贴板里的图片 → File[]。
 *
 * ⚠️ 粘贴是**主要入口**：截图解题的人按 Ctrl+V，不会去点"选择文件"。
 *    所以这条路的容错要做好 —— 从 `clipboardData.items` 里挑出图片项，
 *    非图片的内容（比如同时粘了一段文字）原样留给调用方，别在这里 preventDefault。
 */
export function imageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isAcceptedImage(file)) out.push(file);
  }
  return out;
}

/** 把一批 File 读成附件。读失败的**跳过并回报**，不让一张坏图拖垮整次选择 */
export async function toAttachments(files: File[]): Promise<{
  attachments: ImageAttachment[];
  errors: string[];
}> {
  const attachments: ImageAttachment[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      attachments.push({
        id: uid("img"),
        dataUrl: await readAsDataUrl(file),
        name: file.name || "粘贴的截图",
        bytes: file.size,
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { attachments, errors };
}
