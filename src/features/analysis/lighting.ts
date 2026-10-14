import type { LightingInput, LightingIssue } from "@/types/analysis";
import {
  CAST_RATIO_MAX,
  CAST_RATIO_MIN,
  FACE_WIDTH_RATIO_MIN,
  GREEN_CAST_MIN,
  LIGHT_CLIP_RATIO_MAX,
  LIGHT_LUMA_MAX,
  LIGHT_LUMA_MIN,
} from "./constants";

/**
 * 측정 전 조명 점검. gray-world(장면 평균은 회색에 가깝다) 가정으로 색편향을 본다.
 * 전구색 조명이면 R/G가 커지고, 창가 그늘·주광색 LED면 B/G가 커진다.
 * 형광등은 G가 R·B보다 도드라진다. 이때 R/G·B/G가 같이 작아지는데 그걸 전구색·푸른빛으로 잘못 읽지 않게 먼저 거른다
 */
export function checkLighting(input: LightingInput): LightingIssue[] {
  const issues: LightingIssue[] = [];
  if (input.faceLuma < LIGHT_LUMA_MIN) issues.push("dark");
  if (input.faceLuma > LIGHT_LUMA_MAX || input.clippedRatio > LIGHT_CLIP_RATIO_MAX) issues.push("bright");

  const { r, g, b } = input.frameMean;
  if (g > 0) {
    const rg = r / g;
    const bg = b / g;
    if (g / ((r + b) / 2) >= GREEN_CAST_MIN) issues.push("greenCast");
    else {
      if (rg > CAST_RATIO_MAX || bg < CAST_RATIO_MIN) issues.push("warmCast");
      if (bg > CAST_RATIO_MAX || rg < CAST_RATIO_MIN) issues.push("coolCast");
    }
  }
  if (input.faceWidthRatio < FACE_WIDTH_RATIO_MIN) issues.push("faceSmall");
  return issues;
}

export const LIGHTING_MESSAGES: Record<LightingIssue, string> = {
  dark: "조금 어두워요. 밝은 곳으로 이동해 보세요",
  bright: "너무 밝거나 역광이에요",
  warmCast: "주황빛 조명이에요. 자연광이 가장 정확해요",
  coolCast: "푸른빛 조명이에요. 자연광이 가장 정확해요",
  greenCast: "형광등 같은 초록빛 조명이에요. 흰 종이를 얼굴 옆에 들고 찍으면 정확해져요",
  faceSmall: "얼굴을 조금 더 가까이 비춰 주세요",
};

/** 결과 화면에 붙는 짧은 라벨 */
export const LIGHTING_LABELS: Record<LightingIssue, string> = {
  dark: "어두운 조명",
  bright: "밝은 조명·역광",
  warmCast: "주황빛 조명",
  coolCast: "푸른빛 조명",
  greenCast: "형광등 초록빛",
  faceSmall: "얼굴이 작게 잡힘",
};
