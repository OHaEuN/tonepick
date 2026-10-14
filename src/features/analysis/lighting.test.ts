import { describe, expect, it } from "vitest";
import { checkLighting } from "./lighting";

const GOOD = {
  faceLuma: 140,
  clippedRatio: 0.01,
  frameMean: { r: 120, g: 120, b: 120 },
  faceWidthRatio: 0.4,
};

describe("checkLighting", () => {
  it("정상 조건이면 이슈 없음", () => {
    expect(checkLighting(GOOD)).toEqual([]);
  });

  it("어두우면 dark", () => {
    expect(checkLighting({ ...GOOD, faceLuma: 50 })).toEqual(["dark"]);
  });

  it("너무 밝거나 클리핑이 많으면 bright", () => {
    expect(checkLighting({ ...GOOD, faceLuma: 220 })).toEqual(["bright"]);
    expect(checkLighting({ ...GOOD, clippedRatio: 0.2 })).toEqual(["bright"]);
  });

  it("R/G가 크면 warmCast, B/G가 크면 coolCast", () => {
    expect(checkLighting({ ...GOOD, frameMean: { r: 160, g: 120, b: 110 } })).toEqual(["warmCast"]);
    expect(checkLighting({ ...GOOD, frameMean: { r: 110, g: 120, b: 160 } })).toEqual(["coolCast"]);
  });

  it("G가 R·B보다 도드라지면(형광등) greenCast만. 전구색·푸른빛으로 같이 잡지 않는다", () => {
    expect(checkLighting({ ...GOOD, frameMean: { r: 100, g: 125, b: 95 } })).toEqual(["greenCast"]);
    expect(checkLighting({ ...GOOD, frameMean: { r: 140, g: 120, b: 105 } })).toEqual([]);
  });

  it("얼굴이 작으면 faceSmall", () => {
    expect(checkLighting({ ...GOOD, faceWidthRatio: 0.1 })).toEqual(["faceSmall"]);
  });
});
