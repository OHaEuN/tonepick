export interface Lab {
  L: number;
  a: number;
  b: number;
}

/** 랜드마커가 주는 정규화 좌표(0~1). */
export interface Point {
  x: number;
  y: number;
}

/** 선형 RGB(0~1) 삼원색. 조명 보정 게인이나 기준 흰색에 쓴다 */
export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Undertone = "warm" | "cool" | "neutral";
export type Depth = "light" | "deep";
export type ChromaLevel = "clear" | "muted";
export type Confidence = "high" | "mid" | "low";
/** 12시즌 세부 타입. 시즌마다 셋만 허용된다 (봄: light·bright·true 등) */
export type Subtype = "light" | "bright" | "true" | "soft" | "deep";
/** 결과 URL 슬러그. 시즌마다 허용되는 세부 타입 셋만 존재한다 */
export type ToneSlug =
  | "spring-light"
  | "spring-bright"
  | "spring-true"
  | "summer-light"
  | "summer-soft"
  | "summer-true"
  | "autumn-soft"
  | "autumn-deep"
  | "autumn-true"
  | "winter-deep"
  | "winter-bright"
  | "winter-true";

export interface ToneResult {
  season: Season;
  subtype: Subtype;
  tone: ToneSlug;
  undertone: Undertone;
  depth: Depth;
  chroma: ChromaLevel;
  confidence: Confidence;
  lab: Lab;
  ita: number;
  hue: number;
  /** 배경 색으로 조명(색온도·노출)을 보정했는지 */
  corrected?: boolean;
}

export type LightingIssue =
  | "dark"
  | "bright"
  | "warmCast"
  | "coolCast"
  | "greenCast"
  | "faceSmall";

export interface LightingInput {
  /** 얼굴 패치 평균 휘도(0~255) */
  faceLuma: number;
  /** 얼굴 패치 중 클리핑된 픽셀 비율(0~1) */
  clippedRatio: number;
  /** 프레임 전체 평균 RGB */
  frameMean: { r: number; g: number; b: number };
  /** 얼굴 bbox 폭 / 프레임 폭 */
  faceWidthRatio: number;
}
