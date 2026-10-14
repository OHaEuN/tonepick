/**
 * 색 분석 임계값. 전부 "재미로 보는" 수준의 휴리스틱이고 카메라·조명에 따라
 * 흔들리므로 한 곳에 모아 튜닝한다. 각 값의 근거는 README 알고리즘 절 참고.
 */

// ---- 픽셀 사전 제거 ----
/** 어느 채널이든 이 값 이상이면 스펙큘러 하이라이트로 보고 버린다 */
export const CLIP_MAX = 250;
/** 인코딩 휘도(0~255)가 이 값 미만이면 그림자·머리카락·눈썹. L* 약 17 이하에 해당 */
export const LUMA_MIN = 40;
/** 사전 제거 후 이 수보다 적게 남으면 패치를 버린다 */
export const MIN_PIXELS = 20;
/** median ± MAD_K × MAD 밖은 버린다. 정규분포 기준 3×MAD ≈ 2σ */
export const MAD_K = 3;

// ---- 샘플링 ----
/** 패치 한 변 = 눈 바깥꼬리(33↔263) 거리 × 이 비율 */
export const PATCH_RATIO = 0.25;
/** 측정 시 모으는 프레임 수. 30fps 기준 약 0.7초 */
export const MEASURE_FRAMES = 20;

// ---- 조명 보정 (배경 기준) ----
/**
 * 얼굴 밖 배경의 평균 선형 RGB가 이 값(조명 중립·적정 노출)이 되도록 피부에 게인을 곱한다.
 * FairFace 동아시아인 사진 1,281장 배경의 중앙값이다. r·g·b는 휘도 1 기준의 색 비율, y는 휘도
 */
export const SCENE_REFERENCE = { r: 1.289, g: 0.936, b: 0.759, y: 0.132 } as const;
/**
 * 보정 세기(로그 공간 비율). 배경 색은 조명뿐 아니라 벽·옷 색도 섞여 있어서 절반만 되돌린다.
 * FairFace에서 0.5일 때 조명 변형에 대한 시즌 일치율이 73% → 84%로 오르면서 사람 간 분산은 늘지 않았다
 */
export const SCENE_STRENGTH = 0.5;
/** 게인 한계. 배경이 거의 검거나 하얗게 날아간 사진에서 결과가 튀지 않게 */
export const SCENE_GAIN_RANGE = [0.5, 2] as const;
// ---- 흰색 기준 보정 (이용자가 사진 속 흰 종이·흰 벽을 누름) ----
/**
 * 누른 흰색이 이 휘도가 되도록 노출을 맞춘다. 카메라는 장면 평균을 반사율 18% 회색으로 맞추고 흰 종이 반사율은 약 85%라,
 * 배경 기준값(SCENE_REFERENCE.y)의 85/18 ≈ 4.7배를 흰색으로 둔다. 배경 보정과 같은 공간에 놓여 같은 임계값을 쓸 수 있다
 */
export const WHITE_TARGET_Y = 0.62;
/** 흰색 게인 한계 */
export const WHITE_GAIN_RANGE = [0.25, 4] as const;
/**
 * 흰색으로 믿는 조건: 인코딩 휘도 하한, 피부보다 밝은 정도, 클리핑 비율 상한, 선형 채도((max−min)/max) 상한.
 * 전구색 아래 흰 종이는 선형 채도가 0.6까지 올라가 채도만으론 피부와 못 가르므로 "피부보다 밝다"를 같이 본다
 */
export const WHITE_MIN_LUMA = 90;
export const WHITE_OVER_SKIN = 1.1;
export const WHITE_MAX_CLIPPED = 0.3;
export const WHITE_MAX_SATURATION = 0.65;
/**
 * 흰색 자동 찾기: 같은 조명 아래 흰색은 피부보다 푸르다. 피부 R/B ÷ 후보 R/B가 이 값 이상이어야 한다.
 * 크림색·베이지 벽과 피부를 거른다
 */
export const WHITE_BLUER_THAN_SKIN = 1.4;
/** 흰색 자동 찾기: 후보 영역이 축소본에서 차지해야 하는 최소 비율과 가장자리에서 떨어진 최소 거리(축소본 픽셀) */
export const WHITE_MIN_AREA = 0.01;
export const WHITE_MIN_DEPTH = 2;
/** 흰색 자동 찾기용 축소본 크기 */
export const WHITE_SEARCH_THUMB = { w: 96, h: 96 } as const;
/** 누른 자리에서 평균 낼 정사각형 한 변 = 이미지 폭 × 이 비율 */
export const WHITE_PATCH_RATIO = 0.03;

/** 배경 평균을 낼 축소 해상도 */
export const SCENE_THUMB = { w: 64, h: 64 } as const;

// ---- 판정 ----
/**
 * 임계값은 FairFace 동아시아인 사진(10세 이상 1,281장, 얼굴 인식 1,075장)을 배경 보정한 뒤 잰 분포의 중앙값이다.
 * 이전 값(웜 57°·ITA 41°·C* 20, 분광측색 문헌 기준)은 카메라 사진에선 한쪽으로 쏠려 55%가 겨울로 나왔다.
 * 지금 값으로 네 시즌이 20~30%씩 고르게 나뉜다
 */
/** 웜/쿨: Lab hue angle(°). 중앙값 50.5°를 중심으로 ±2° 뉴트럴 구간 */
export const HUE_WARM_MIN = 52.5;
export const HUE_COOL_MAX = 48.5;
/** 명/암: ITA°. 배경 보정 공간에서의 중앙값 */
export const ITA_LIGHT_MIN = 17;
/** 선명/뮤트: chroma C*. 중앙값 */
export const CHROMA_CLEAR_MIN = 24;
/**
 * 각 축에서 "충분히 떨어졌다"고 보는 거리. 확신도와 12시즌 세부 타입 판정에 같이 쓴다.
 * 각 지표의 사분위 범위(IQR)의 1/4이다
 */
export const AXIS_MARGIN = { hue: 4, ita: 15, chroma: 3 } as const;

// ---- 조명 체크 ----
export const LIGHT_LUMA_MIN = 70;
export const LIGHT_LUMA_MAX = 200;
export const LIGHT_CLIP_RATIO_MAX = 0.05;
/** gray-world: 프레임 평균 R/G, B/G가 이 범위를 벗어나면 색편향 */
export const CAST_RATIO_MIN = 0.8;
export const CAST_RATIO_MAX = 1.25;
/**
 * 형광등: 프레임 평균 G ÷ (R와 B의 평균)이 이 값 이상. 프레임에 붉은 피부가 섞여 있어 보통 사진은 1보다 작다.
 * FairFace 동아시아인 사진에선 중앙값 0.92, 이 값을 넘는 사진 3%. G를 8~15% 키운 합성 형광등은 20~45%가 걸린다
 */
export const GREEN_CAST_MIN = 1.02;
export const FACE_WIDTH_RATIO_MIN = 0.25;
