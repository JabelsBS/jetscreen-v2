import { expect, test, Page } from "@playwright/test";
import sharp from "sharp";

const center = { latitude: 52.43657424314263, longitude: 10.595466532451821 };

function vectorTileFixture() {
  const varint = (value: number) => {
    const bytes: number[] = [];
    do {
      const byte = value % 128;
      value = Math.floor(value / 128);
      bytes.push(byte | (value ? 128 : 0));
    } while (value);
    return Buffer.from(bytes);
  };
  const integer = (field: number, value: number) => Buffer.concat([varint(field * 8), varint(value)]);
  const data = (field: number, value: Buffer) => Buffer.concat([varint(field * 8 + 2), varint(value.length), value]);
  const line = (y: number, type: number) => Buffer.concat([
    data(2, Buffer.from([0, type === 2 ? 1 : 0, 1, type === 1 ? 2 : 3])), integer(3, 2),
    data(4, Buffer.concat([varint(9), varint(0), varint(y * 2), varint(10), varint(8192), varint(0)])),
  ]);
  const layer = Buffer.concat([
    data(1, Buffer.from("streets")), ...Array.from({ length: 16 }, (_, index) => data(2, line(128 + index * 256, index % 3))),
    data(3, Buffer.from("rail")), data(3, Buffer.from("kind")),
    data(4, integer(7, 0)), data(4, integer(7, 1)),
    data(4, data(1, Buffer.from("primary"))), data(4, data(1, Buffer.from("residential"))),
    integer(5, 4096), integer(15, 2),
  ]);
  return data(3, layer);
}

async function localOnly(page: Page, tile = Buffer.alloc(0)) {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.route("https://vector.openstreetmap.org/**", route => {
    if (route.request().url().endsWith("tilejson.json")) {
      return route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: {
        tilejson: "3.0.0", tiles: ["https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt"], minzoom: 0, maxzoom: 14,
      } });
    }
    return route.fulfill({ headers: { "access-control-allow-origin": "*" }, contentType: "application/vnd.mapbox-vector-tile", body: tile });
  });
}

test("demo works with local tile fixtures at display and mobile sizes", async ({ page }, testInfo) => {
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
    await expect(page.locator(".map-notice")).toHaveCount(0, { timeout: 20000 });
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
    const pixels: Buffer = await sharp(screenshot).raw().toBuffer();
    expect(pixels.some(value => value > 150)).toBeTruthy();
  }
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});

test("railways and road classes are distinct and the map stays fixed", async ({ page }) => {
  await localOnly(page, vectorTileFixture());
  await page.clock.install();
  await page.goto("/?demo=1");
  await expect(page.locator(".map-notice")).toHaveCount(0, { timeout: 20000 });
  await page.addStyleTag({ content: ".flight-trails,.home-marker,.aircraft-marker,.aircraft-label,.north-marker,.map-attribution { visibility: hidden !important; }" });
  const map = page.locator(".online-map");
  const before = await map.screenshot();
  const { data: pixels, info } = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let minorRoads = 0;
  let majorRoads = 0;
  let railways = 0;
  for (let index = 0; index < pixels.length; index += info.channels) {
    const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
    if (red > 35 && red < 75 && green > red && Math.abs(green - blue) < 5) minorRoads++;
    if (red >= 75 && green > red && Math.abs(green - blue) < 5) majorRoads++;
    if (red > 55 && red > green + 3 && green > blue + 3) railways++;
  }
  expect(minorRoads).toBeGreaterThan(20);
  expect(majorRoads).toBeGreaterThan(20);
  expect(railways).toBeGreaterThan(20);
  const aircraftBefore = await page.locator(".aircraft-marker").first().getAttribute("style");
  await page.clock.fastForward(600000);
  await expect.poll(() => page.locator(".aircraft-marker").first().getAttribute("style")).not.toBe(aircraftBefore);
  const after = await map.screenshot();
  expect(after.equals(before)).toBeTruthy();
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

test("live contacts are shown across the full map width", async ({ page }) => {
  await localOnly(page);
  await page.route("**/api/aircraft", route => route.fulfill({ json: { aircraft: [
    { hex: "east", lat: center.latitude, lon: center.longitude + 0.045 },
    { hex: "west", lat: center.latitude, lon: center.longitude - 0.045 },
    { hex: "outside", lat: center.latitude + 0.03, lon: center.longitude },
  ] } }));
  await page.goto("/");
  await expect(page.locator(".aircraft-marker")).toHaveCount(2);
  await expect(page.locator(".contact-strip button", { hasText: "EAST" })).toBeVisible();
  await expect(page.locator(".contact-strip button", { hasText: "WEST" })).toBeVisible();
  await expect(page.locator(".contact-strip button", { hasText: "OUTSIDE" })).toHaveCount(0);
});

test("online tiles load with a north-up position layer and attribution", async ({ page }) => {
  await localOnly(page);
  const tileRequests: string[] = [];
  page.on("request", request => { if (request.url().endsWith(".mvt")) tileRequests.push(request.url()); });
  await page.goto("/?demo=1");
  await expect(page.locator(".online-map canvas")).toBeVisible();
  await expect(page.locator(".map-notice")).toHaveCount(0, { timeout: 20000 });
  expect(tileRequests.length).toBeGreaterThan(0);
  await expect(page.locator(".map-attribution")).toContainText("OpenStreetMap");
  const result = await page.locator(".map-frame").evaluate(element => {
    const rect = element.getBoundingClientRect();
    const home = element.querySelector(".home-marker")!.getBoundingClientRect();
    const canvas = element.querySelector(".online-map canvas")!.getBoundingClientRect();
    return { width: rect.width, height: rect.height, ratio: rect.width / rect.height, homeX: home.x + home.width / 2 - rect.x, homeY: home.y + home.height / 2 - rect.y, canvasWidth: canvas.width, canvasHeight: canvas.height };
  });
  expect(result.width).toBeCloseTo(1024, 0);
  expect(result.ratio).toBeCloseTo(1024 / 426, 4);
  expect(result.homeX).toBeCloseTo(512, 0);
  expect(result.homeY).toBeCloseTo(213, 0);
  expect(result.canvasWidth).toBeCloseTo(result.width, 0);
  expect(result.canvasHeight).toBeCloseTo(result.height, 0);
});

test("map service failures are visible without hiding aircraft and recover", async ({ page }) => {
  await localOnly(page);
  await page.clock.install();
  let failed = true;
  await page.route("**/tilejson.json", route => route.fulfill(failed
    ? { status: 503, headers: { "access-control-allow-origin": "*" }, body: "offline" }
    : { headers: { "access-control-allow-origin": "*" }, json: {
      tilejson: "3.0.0", tiles: ["https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt"], minzoom: 0, maxzoom: 14,
    } }));
  await page.goto("/?demo=1");
  await expect(page.locator(".map-notice")).toHaveText("Online-Karte nicht verf\u00fcgbar");
  await expect(page.locator(".aircraft-marker")).toHaveCount(5);
  failed = false;
  await page.clock.fastForward(31000);
  await expect(page.locator(".map-notice")).toHaveCount(0, { timeout: 20000 });
});

test("receiver outages expire old positions rather than show ghosts indefinitely", async ({ page }) => {
  await localOnly(page);
  await page.clock.install();
  let failed = false;
  await page.route("**/api/aircraft", route => route.fulfill(failed ? { status: 503, json: { error: "offline" } } : { json: { aircraft: [{ hex: "abcdef", lat: center.latitude, lon: center.longitude }] } }));
  await page.goto("/");
  await expect(page.locator(".aircraft-marker")).toHaveCount(1);
  failed = true;
  await page.clock.fastForward(11000);
  await expect(page.locator(".aircraft-marker")).toHaveClass(/stale/);
  await page.clock.fastForward(21000);
  await expect(page.locator(".aircraft-marker")).toHaveCount(0);
  await expect(page.locator(".display-status")).toContainText("Empf\u00e4nger nicht erreichbar");
});