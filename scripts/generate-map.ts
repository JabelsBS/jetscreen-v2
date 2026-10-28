import { mkdir, writeFile } from "node:fs/promises";
import osmtogeojson from "osmtogeojson";
import sharp from "sharp";
import { createMapBounds, projectPosition } from "../src/app/lib/mapGeometry";

async function generateMap() {
  const latitude = Number(process.argv[2] ?? 52.43657424314263);
  const longitude = Number(process.argv[3] ?? 10.595466532451821);
  const radiusKm = Number(process.argv[4] ?? 2);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 85 || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error("Use latitude, longitude and a positive radius in km.");
  }
  const width = 2048;
  const height = 852;
  const bounds = createMapBounds(latitude, longitude, radiusKm, width / height);
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = `[out:json][timeout:120];(way[highway](${bbox});way[building](${bbox});way[natural~"water|wood"](${bbox});way[landuse~"forest|reservoir"](${bbox});way[waterway](${bbox});relation[natural~"water|wood"](${bbox});relation[landuse~"forest|reservoir"](${bbox}););out geom;`;
  let data;
  for (const endpoint of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const response = await fetch(endpoint, {
        method: "POST", body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(180000),
        headers: { "User-Agent": "Jetscreen private map export" },
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      data = await response.json();
      break;
    } catch (error) {
      console.warn(String(error));
    }
  }
  if (!data) throw new Error("Could not download map data. Retry map:generate later.");
  const features = osmtogeojson(data).features;
  const layers: Record<string, string[]> = { forest: [], water: [], buildings: [], roads: [] };
  const path = (coordinates: number[][], close: boolean) => coordinates.map((position, index) => {
    const point = projectPosition(position[1], position[0], bounds);
    return `${index ? "L" : "M"}${(point.x * width).toFixed(1)},${(point.y * height).toFixed(1)}`;
  }).join(" ") + (close ? " Z" : "");
  for (const feature of features) {
    const tags = feature.properties?.tags ?? {};
    const geometry = feature.geometry;
    let drawing = "";
    if (geometry.type === "Polygon") drawing = geometry.coordinates.map(ring => path(ring, true)).join(" ");
    if (geometry.type === "MultiPolygon") drawing = geometry.coordinates.flatMap(polygon => polygon.map(ring => path(ring, true))).join(" ");
    if (geometry.type === "LineString") drawing = path(geometry.coordinates, false);
    if (!drawing) continue;
    if (tags.building) layers.buildings.push(`<path d="${drawing}" fill="#141719" stroke="#1b1e20" stroke-width="0.6"/>`);
    else if (tags.natural === "wood" || tags.landuse === "forest") layers.forest.push(`<path d="${drawing}" fill="#0c1411" stroke="#131d17" stroke-width="1"/>`);
    else if (tags.natural === "water" || tags.landuse === "reservoir") layers.water.push(`<path d="${drawing}" fill="#111c20" stroke="#1b292e" stroke-width="1"/>`);
    else if (tags.waterway) layers.water.push(`<path d="${drawing}" fill="none" stroke="#1b292e" stroke-width="2"/>`);
    else if (tags.highway && !["proposed", "construction"].includes(tags.highway)) {
      const major = ["motorway", "trunk", "primary", "secondary"].includes(tags.highway);
      const minor = ["path", "footway", "cycleway", "track", "service"].includes(tags.highway);
      layers.roads.push(`<path d="${drawing}" fill="none" stroke="${minor ? "#161b1d" : major ? "#333a3c" : "#242a2c"}" stroke-width="${major ? 3 : minor ? 0.9 : 1.7}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  }
  if (!layers.roads.length) throw new Error("No roads returned; refusing to replace the map with a blank export.");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#080b0c"/><g fill-rule="evenodd">${Object.values(layers).flat().join("")}</g></svg>`;
  await mkdir("public", { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile("public/local-map.png");
  await writeFile("public/local-map.json", JSON.stringify({
    center: { latitude, longitude }, radiusKm, bounds, width, height,
    generatedAt: new Date().toISOString(), attribution: "OpenStreetMap contributors", projection: "EPSG:3857",
  }, null, 2));
  console.log(`Map exported: ${features.length} features, ${width} x ${height}, ${radiusKm} km radius.`);
}

generateMap().catch(error => { console.error(error); process.exitCode = 1; });