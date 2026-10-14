import type { LinearRgb } from "@/types/analysis";
import { linearize, luma, relativeLuminance } from "./color";
import {
  CLIP_MAX,
  SCENE_REFERENCE,
  WHITE_BLUER_THAN_SKIN,
  WHITE_GAIN_RANGE,
  WHITE_MAX_CLIPPED,
  WHITE_MIN_AREA,
  WHITE_MIN_DEPTH,
  WHITE_MAX_SATURATION,
  WHITE_MIN_LUMA,
  WHITE_OVER_SKIN,
  WHITE_TARGET_Y,
} from "./constants";

export type WhiteCheck = { white: LinearRgb } | { error: "dark" | "clipped" | "colored" };

/**
 * 이용자가 누른 자리의 픽셀이 흰색·밝은 회색인지 보고 평균 선형 RGB를 낸다.
 * 어둡거나(피부보다 밝지 않으면 포함), 하얗게 날아갔거나, 색이 짙으면(옷·피부) 기준으로 쓰지 않는다.
 * skinLuma는 같은 사진 피부의 인코딩 휘도
 */
export function checkWhitePatch(pixels: ArrayLike<number>, skinLuma = 0): WhiteCheck {
  let r = 0;
  let g = 0;
  let b = 0;
  let y = 0;
  let n = 0;
  let clipped = 0;
  for (let i = 0; i + 2 < pixels.length; i += 4) {
    const pr = pixels[i];
    const pg = pixels[i + 1];
    const pb = pixels[i + 2];
    n++;
    if (pr >= CLIP_MAX || pg >= CLIP_MAX || pb >= CLIP_MAX) {
      clipped++;
      continue;
    }
    r += linearize(pr);
    g += linearize(pg);
    b += linearize(pb);
    y += luma(pr, pg, pb);
  }
  const kept = n - clipped;
  if (n === 0 || clipped / n > WHITE_MAX_CLIPPED || kept === 0) return { error: "clipped" };
  if (y / kept < Math.max(WHITE_MIN_LUMA, skinLuma * WHITE_OVER_SKIN)) return { error: "dark" };
  const white = { r: r / kept, g: g / kept, b: b / kept };
  const max = Math.max(white.r, white.g, white.b);
  if ((max - Math.min(white.r, white.g, white.b)) / max > WHITE_MAX_SATURATION) return { error: "colored" };
  return { white };
}

const clamp = (v: number) => Math.min(WHITE_GAIN_RANGE[1], Math.max(WHITE_GAIN_RANGE[0], v));

/**
 * 누른 흰색을 기준으로 조명을 완전히 되돌리는 게인. 흰색이 배경 보정 공간의 "흰 종이"
 * (SCENE_REFERENCE 색 비율 × WHITE_TARGET_Y)가 되게 해서 같은 임계값으로 판정한다
 */
export function whiteGains(white: LinearRgb): LinearRgb | null {
  const y = relativeLuminance(white.r, white.g, white.b);
  if (!(y > 0) || white.r <= 0 || white.g <= 0 || white.b <= 0) return null;
  const g = (k: "r" | "g" | "b") => clamp((SCENE_REFERENCE[k] * WHITE_TARGET_Y) / white[k]);
  return { r: g("r"), g: g("g"), b: g("b") };
}

export interface WhiteSearchInput {
  /** 축소본 RGBA 픽셀 */
  pixels: ArrayLike<number>;
  width: number;
  height: number;
  /** 찾을 범위(얼굴 밖 등). 축소본 좌표 */
  include: (x: number, y: number) => boolean;
  /** 같은 사진 피부의 인코딩 휘도 */
  skinLuma: number;
  /** 같은 사진 피부의 평균 선형 RGB */
  skin: LinearRgb;
}

/**
 * 사진에서 흰 종이·흰 벽으로 보이는 가장 넓은 영역을 찾아 그 안쪽 한 점(정규화 좌표)을 돌려준다.
 * 흰색 조건(checkWhitePatch와 같음)에 더해, 같은 조명 아래 흰색은 피부보다 푸르다는 점으로 베이지 벽·피부를 거른다.
 * 자동으로 바로 쓰지 않고 이용자에게 보여 주고 고르게 한다(베이지·크림색 벽은 여전히 섞일 수 있어서)
 */
export function findWhiteCandidate({ pixels, width, height, include, skinLuma, skin }: WhiteSearchInput): { u: number; v: number } | null {
  const n = width * height;
  const ok = new Uint8Array(n);
  const minLuma = Math.max(WHITE_MIN_LUMA, skinLuma * WHITE_OVER_SKIN);
  const skinRb = skin.r / Math.max(1e-6, skin.b);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!include(x, y)) continue;
      const pr = pixels[i * 4];
      const pg = pixels[i * 4 + 1];
      const pb = pixels[i * 4 + 2];
      if (pr >= CLIP_MAX || pg >= CLIP_MAX || pb >= CLIP_MAX || luma(pr, pg, pb) < minLuma) continue;
      const r = linearize(pr);
      const g = linearize(pg);
      const b = linearize(pb);
      const max = Math.max(r, g, b);
      if ((max - Math.min(r, g, b)) / max > WHITE_MAX_SATURATION) continue;
      if (skinRb / (r / Math.max(1e-6, b)) < WHITE_BLUER_THAN_SKIN) continue;
      ok[i] = 1;
    }
  }

  // 4-이웃 연결 영역 중 가장 넓은 것
  const label = new Int32Array(n).fill(-1);
  let best = -1;
  let bestSize = 0;
  const stack: number[] = [];
  for (let s = 0; s < n; s++) {
    if (!ok[s] || label[s] !== -1) continue;
    let size = 0;
    label[s] = s;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % width;
      for (const j of [i - width, i + width, x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < n && ok[j] && label[j] === -1) {
          label[j] = s;
          stack.push(j);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = s;
    }
  }
  if (best < 0 || bestSize < n * WHITE_MIN_AREA) return null;

  // 가장자리에서 가장 먼 점(체스판 거리). 그 둘레 평균에 영역 밖 색이 섞이지 않게
  const dist = new Int32Array(n);
  for (let i = 0; i < n; i++) dist[i] = label[i] === best ? n : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : dist[y * width + x]);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (dist[i]) dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1, at(x + 1, y - 1) + 1);
    }
  let cx = 0;
  let cy = 0;
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1, at(x - 1, y + 1) + 1);
      cx += x;
      cy += y;
    }
  cx /= bestSize;
  cy /= bestSize;
  // 가장 깊은 점이 여럿이면(긴 종이) 영역 가운데에 가까운 쪽
  let pick = -1;
  let pickD = Infinity;
  for (let i = 0; i < n; i++) {
    if (!dist[i] || (pick >= 0 && dist[i] < dist[pick])) continue;
    const d = ((i % width) - cx) ** 2 + (Math.floor(i / width) - cy) ** 2;
    if (pick < 0 || dist[i] > dist[pick] || d < pickD) {
      pick = i;
      pickD = d;
    }
  }
  if (pick < 0 || dist[pick] < WHITE_MIN_DEPTH) return null;
  return { u: ((pick % width) + 0.5) / width, v: (Math.floor(pick / width) + 0.5) / height };
}
