import { expect, test, Page } from "@playwright/test";
import sharp from "sharp";
import { createMapBounds } from "../src/app/lib/mapGeometry";

const center = { latitude: 52.43657424314263, longitude: 10.595466532451821 };
const bounds = createMapBounds(center.latitude, center.longitude, 2, 1024 / 426);

async function localOnly(page: Page) {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.route("**/local-map.json", route => route.fulfill({ status: 404, body: "" }));
}

test("demo works without external requests at display and mobile sizes", async ({ page }, testInfo) => {
  await localOnly(page);
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.url().includes("/api/")) apiRequests.push(request.url()); });
  for (const size of [{ width: 1024, height: 600 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto("/?demo=1");
    await expect(page.locator(".aircraft-marker")).toHaveCount(5);
    await expect(page.locator(".display-status")).toContainText("DEMO");
    await expect(page.locator(".map-notice")).toHaveText("Kartenbild noch nicht vorhanden");
    await expect(page.locator(".contact-count")).toHaveText("5 Flieger");
    const initial = await page.locator(".aircraft-marker").first().evaluate(element => element.getBoundingClientRect().x);
    await expect.poll(() => page.locator(".aircraft-marker").first().evaluate(element => element.getBoundingClientRect().x), { timeout: 8000 }).not.toBe(initial);
    await page.locator(".contact-strip button", { hasText: "KLM1784" }).click();
    await expect(page.locator(".flight-identity")).toContainText("KLM1784");
    await expect(page.locator(".aircraft-marker.selected")).toHaveCount(1);
    const geometry = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll(".aircraft-label")).map(element => element.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        outside: labels.some(rect => rect.x < 0 || rect.right > innerWidth || rect.y < 0 || rect.bottom > innerHeight),
        overlap: labels.some((rect, index) => labels.slice(index + 1).some(other => rect.x < other.right && rect.right > other.x && rect.y < other.bottom && rect.bottom > other.y)),
      };
    });
    expect(geometry).toEqual({ overflow: false, outside: false, overlap: false });
    const screenshot = await page.screenshot({ path: testInfo.outputPath(`demo-${size.width}.png`) });
    const pixels = await sharp(screenshot).raw().toBuffer();
    expect(pixels.some(value => value > 150)).toBeTruthy();
  }
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});

test("live contacts survive missing routes and can be selected without callsigns", async ({ page }) => {
  await localOnly(page);
  await page.route("**/api/aircraft", route => route.fulfill({ json: { aircraft: [
    { hex: "abc123", flight: " TEST123 ", lat: center.latitude + 0.003, lon: center.longitude, track: 180, alt_baro: 3000 },
    { hex: "def456", lat: center.latitude, lon: center.longitude + 0.003, alt_geom: 6000 },
  ] } }));
  await page.route("**/api/getroute?*", route => route.fulfill({ status: 503, json: { error: "offline" } }));
  await page.goto("/");
  await expect(page.locator(".aircraft-marker")).toHaveCount(2);
  await page.locator(".contact-strip button", { hasText: "TEST123" }).click();
  await expect(page.locator(".flight-route")).toHaveText("Route nicht verf\u00fcgbar");
  await page.locator(".contact-strip button", { hasText: "DEF456" }).click();
  await expect(page.locator(".flight-identity")).toContainText("DEF456");
  await expect(page.locator(".flight-route")).toHaveText("Ohne Rufzeichen");
});

test("a local raster and its metadata align with the north-up position layer", async ({ page }) => {
  await localOnly(page);
  await page.route("**/local-map.json", route => route.fulfill({ json: { center, radiusKm: 2, bounds, width: 2048, height: 852, projection: "EPSG:3857" } }));
  const image = await sharp({ create: { width: 2048, height: 852, channels: 3, background: "#101819" } }).png().toBuffer();
  await page.route("**/local-map.png", route => route.fulfill({ contentType: "image/png", body: image }));
  await page.goto("/?demo=1");
  await expect(page.locator(".local-map")).toBeVisible();
  await expect(page.locator(".map-notice")).toHaveCount(0);
  const result = await page.locator(".map-frame").evaluate(element => {
    const rect = element.getBoundingClientRect();
    const home = element.querySelector(".home-marker")!.getBoundingClientRect();
    const image = element.querySelector("img")!;
    return { width: rect.width, ratio: rect.width / rect.height, homeX: home.x + home.width / 2 - rect.x, homeY: home.y + home.height / 2 - rect.y, loaded: image.naturalWidth > 0 };
  });
  expect(result.width).toBeCloseTo(1024, 0);
  expect(result.ratio).toBeCloseTo(1024 / 426, 4);
  expect(result.homeX).toBeCloseTo(512, 0);
  expect(result.homeY).toBeCloseTo(213, 0);
  expect(result.loaded).toBeTruthy();
});

test("receiver outages expire old positions rather than show ghosts indefinitely", async ({ page }) => {
  await localOnly(page);
  await page.clock.install();
  let failed = false;
  await page.route("**/api/aircraft", route => route.fulfill(failed ? { status: 503, json: { error: "offline" } } : { json: { aircraft: [{ hex: "abcdef", lat: center.latitude, lon: center.longitude }] } }));
  await page.goto("/");
  await expect(page.locator(".aircraft-marker")).toHaveCount(1);
  failed = true;
  await page.clock.fastForward(32000);
  await expect(page.locator(".aircraft-marker")).toHaveCount(0);
  await expect(page.locator(".display-status")).toContainText("Empf\u00e4nger nicht erreichbar");
});