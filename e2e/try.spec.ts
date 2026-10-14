import { expect, test, type Page } from "@playwright/test";

const MODEL_TIMEOUT = 60_000;
/** 1×1 PNG. 얼굴이 없는 입력 */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

async function waitForModel(page: Page) {
  await page.goto("/try");
  await expect(page.getByText("준비됐어요")).toBeVisible({ timeout: MODEL_TIMEOUT });
}

test("카메라 권한이 거부되면 업로드 경로를 안내한다", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await waitForModel(page);
  await page.getByRole("button", { name: "카메라로 시작" }).click();
  await expect(page.getByText("카메라 권한이 거부됐어요")).toBeVisible();
  await expect(page.getByLabel("사진 올리기").first()).toBeVisible();
});

test("가짜 카메라로 라이브 단계에 들어간다", async ({ page }) => {
  await waitForModel(page);
  await page.getByRole("button", { name: "카메라로 시작" }).click();
  await expect(page.getByText("얼굴을 찾는 중")).toBeVisible({ timeout: MODEL_TIMEOUT });
  await expect(page.getByRole("button", { name: "측정 시작" })).toBeDisabled();
});

test("얼굴이 없는 사진은 안내 문구를 보여준다", async ({ page }) => {
  await waitForModel(page);
  await page.getByLabel("사진 올리기").first().setInputFiles({ name: "blank.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.getByText("얼굴을 찾지 못했어요")).toBeVisible({ timeout: MODEL_TIMEOUT });
});

test("셀카를 올리면 결과와 립 팔레트가 나오고 결과 카드로 이동한다", async ({ page }) => {
  await waitForModel(page);
  await page.getByLabel("사진 올리기").first().setInputFiles("e2e/fixtures/face.jpg");
  const heading = page.getByRole("heading", { level: 2, name: /(봄|여름|가을|겨울) (웜|쿨)/ });
  await expect(heading).toBeVisible({ timeout: MODEL_TIMEOUT });
  await expect(page.getByText("왜 이렇게 나왔나요")).toBeVisible();
  await page.getByRole("tab", { name: "발라 보기", exact: true }).click();
  // 라디오는 sr-only라 색상 칩(label)을 클릭한다
  // 발라 보기 탭의 fieldset 순서: 팔레트 시즌 전환, 립(기본 선택)
  const firstLip = page.locator("fieldset").nth(1).locator("label[title]").first();
  await firstLip.click();
  await expect(firstLip.getByRole("radio")).toBeChecked();
  await page.getByRole("tab", { name: "결과", exact: true }).click();
  await page.getByRole("link", { name: "결과 카드와 추천 보기" }).click();
  await expect(page).toHaveURL(/\/r\/(spring|summer|autumn|winter)-(light|bright|true|soft|deep)$/);
});

test.describe("폰 화면 폭", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("발라 보기에서 색이 많은 팔레트로 바꿔도 화면이 가로로 넓어지지 않는다", async ({ page }) => {
    await waitForModel(page);
    await page.getByLabel("사진 올리기").first().setInputFiles("e2e/fixtures/face.jpg");
    await expect(page.getByText("왜 이렇게 나왔나요")).toBeVisible({ timeout: MODEL_TIMEOUT });
    await page.getByRole("tab", { name: "발라 보기", exact: true }).click();
    for (const season of ["봄 웜", "여름 쿨", "가을 웜", "겨울 쿨"]) {
      await page.locator("label", { hasText: season }).first().click();
      for (const part of ["립", "블러셔"]) {
        await page.getByRole("tab", { name: part, exact: true }).click();
        const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        expect(scroll, `${season} ${part}`).toBeLessThanOrEqual(client);
      }
    }
  });
});

test("형광등 아래에서 찍어도 사진 속 흰 종이를 찾아 맞추면 자연광과 같은 색으로 읽는다", async ({ page }) => {
  await waitForModel(page);
  const hueAfterWhiteFix = async (file: string) => {
    await page.getByLabel("사진 올리기").first().setInputFiles(file);
    await page.getByRole("button", { name: "찾은 흰색으로 맞추기" }).click({ timeout: MODEL_TIMEOUT });
    await expect(page.getByText("흰색 기준으로 색을 맞췄어요")).toBeVisible();
    const details = page.locator("details", { hasText: "고급" });
    if (!(await details.getAttribute("open"))) await details.locator("summary").click();
    const text = await details.locator("p.font-mono").textContent();
    return Number(/hue ([\d.]+)°/.exec(text ?? "")?.[1]);
  };
  const daylight = await hueAfterWhiteFix("e2e/fixtures/face-paper.jpg");
  await page.getByRole("button", { name: "처음으로" }).click();
  const fluorescent = await hueAfterWhiteFix("e2e/fixtures/face-paper-fluorescent.jpg");
  expect(Math.abs(daylight - fluorescent)).toBeLessThan(2);
});
