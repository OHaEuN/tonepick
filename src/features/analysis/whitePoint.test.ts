import { describe, expect, it } from "vitest";
import type { LinearRgb } from "@/types/analysis";
import { SCENE_REFERENCE, WHITE_TARGET_Y } from "./constants";
import { checkWhitePatch, findWhiteCandidate, whiteGains } from "./whitePoint";

const px = (rgb: [number, number, number], n = 30) => Array.from({ length: n }, () => [...rgb, 255]).flat();

describe("checkWhitePatch", () => {
  it("밝은 무채색은 흰색으로 받는다", () => {
    expect("white" in checkWhitePatch(px([235, 230, 225]))).toBe(true);
  });

  it("전구색 아래 누런 흰 종이도 흰색으로 받는다", () => {
    expect("white" in checkWhitePatch(px([240, 205, 160]))).toBe(true);
  });

  it.each([
    ["어두운 회색", [60, 60, 60], "dark"],
    ["하얗게 날아간 영역", [255, 255, 255], "clipped"],
    ["짙은 색 옷", [200, 60, 60], "colored"],
  ] as const)("%s는 거른다", (_, rgb, error) => {
    expect(checkWhitePatch(px([...rgb]))).toEqual({ error });
  });

  it("피부보다 밝지 않으면(피부를 누름) 거른다", () => {
    expect(checkWhitePatch(px([220, 160, 130]), 175)).toEqual({ error: "dark" });
  });
});

describe("whiteGains", () => {
  it("조명이 달라도 같은 흰 종이·같은 피부는 같은 값으로 돌아온다", () => {
    const skin: LinearRgb = { r: 0.45, g: 0.3, b: 0.22 };
    const paper: LinearRgb = { r: 0.7, g: 0.68, b: 0.65 };
    const results = [
      { r: 1.3, g: 1, b: 0.65 },
      { r: 0.88, g: 1, b: 1.18 },
      { r: 0.55, g: 0.55, b: 0.55 },
    ].map((light) => {
      const g = whiteGains({ r: paper.r * light.r, g: paper.g * light.g, b: paper.b * light.b })!;
      return { r: skin.r * light.r * g.r, g: skin.g * light.g * g.g, b: skin.b * light.b * g.b };
    });
    for (const k of ["r", "g", "b"] as const) {
      expect(results[1][k]).toBeCloseTo(results[0][k], 6);
      expect(results[2][k]).toBeCloseTo(results[0][k], 6);
    }
  });

  it("흰색을 배경 기준 공간의 흰 종이 값으로 맞춘다", () => {
    const g = whiteGains({ r: 0.5, g: 0.5, b: 0.5 })!;
    expect(0.5 * g.g).toBeCloseTo(SCENE_REFERENCE.g * WHITE_TARGET_Y, 6);
  });
});

describe("findWhiteCandidate", () => {
  const W = 40;
  const H = 40;
  const SKIN = { r: 0.5, g: 0.33, b: 0.22 };
  /** 배경 색 bg에 (x0,y0)~(x1,y1) 사각형을 rect 색으로 칠한 축소본 */
  const image = (bg: number[], rect?: { color: number[]; x0: number; y0: number; x1: number; y1: number }) => {
    const a: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = rect && x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1 ? rect.color : bg;
        a.push(c[0], c[1], c[2], 255);
      }
    return a;
  };
  const find = (pixels: number[], include: (x: number, y: number) => boolean = () => true) => findWhiteCandidate({ pixels, width: W, height: H, include, skinLuma: 150, skin: SKIN });

  it("흰 종이 사각형 안쪽 점을 찾는다", () => {
    const p = find(image([80, 90, 70], { color: [235, 235, 230], x0: 4, y0: 10, x1: 16, y1: 30 }));
    expect(p).not.toBeNull();
    expect(p!.u * W).toBeGreaterThan(6);
    expect(p!.u * W).toBeLessThan(14);
    // 세로로 긴 종이의 가운데쯤
    expect(p!.v * H).toBeGreaterThan(17);
    expect(p!.v * H).toBeLessThan(23);
  });

  it("형광등 아래 푸르스름한 초록빛 종이도 찾는다", () => {
    expect(find(image([80, 90, 70], { color: [215, 235, 220], x0: 4, y0: 10, x1: 16, y1: 30 }))).not.toBeNull();
  });

  it("흰색이 없거나 너무 작으면 null", () => {
    expect(find(image([80, 90, 70]))).toBeNull();
    expect(find(image([80, 90, 70], { color: [235, 235, 230], x0: 4, y0: 4, x1: 7, y1: 7 }))).toBeNull();
  });

  it("피부처럼 붉은 밝은 영역(베이지·살구색 벽)은 거른다", () => {
    expect(find(image([80, 90, 70], { color: [245, 215, 190], x0: 4, y0: 10, x1: 16, y1: 30 }))).toBeNull();
  });

  it("찾을 범위 밖은 보지 않는다", () => {
    expect(find(image([80, 90, 70], { color: [235, 235, 230], x0: 4, y0: 10, x1: 16, y1: 30 }), (x) => x >= 20)).toBeNull();
  });
});
