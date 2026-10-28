import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import osmtogeojson from "osmtogeojson";

test("OSM JSON and XML convert to the same GeoJSON", () => {
  const json = {
    elements: [{ type: "node", id: 1, lat: 52, lon: 10, tags: { name: "Example" } }],
  };
  const xml = '<osm version="0.6"><node id="1" lat="52" lon="10"><tag k="name" v="Example"/></node></osm>';
  const require = createRequire(resolve("package.json"));
  const cli = join(dirname(require.resolve("osmtogeojson/package.json")), "osmtogeojson");
  const xmlResult = JSON.parse(execFileSync(process.execPath, [cli, "-f", "xmldom"], {
    input: xml,
    encoding: "utf8",
  }));
  const jsonResult = osmtogeojson(json);

  assert.equal(jsonResult.features.length, 1);
  assert.deepEqual(jsonResult.features[0].geometry, { type: "Point", coordinates: [10, 52] });
  assert.deepEqual(xmlResult, jsonResult);
});
