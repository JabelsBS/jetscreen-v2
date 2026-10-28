"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { MapBounds } from "../lib/mapGeometry";

const tileSource = process.env.NEXT_PUBLIC_MAP_TILEJSON_URL || "https://vector.openstreetmap.org/shortbread_v1/tilejson.json";

const style: StyleSpecification = {
  version: 8,
  sources: { osm: { type: "vector", url: tileSource } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#080b0c" } },
    { id: "land", type: "fill", source: "osm", "source-layer": "land", paint: {
      "fill-color": ["match", ["get", "kind"], ["forest", "wood", "park", "grass", "scrub"], "#101b15", "#101416"],
    } },
    { id: "sites", type: "fill", source: "osm", "source-layer": "sites", paint: { "fill-color": "#101514" } },
    { id: "water", type: "fill", source: "osm", "source-layer": "water_polygons", paint: { "fill-color": "#14242a" } },
    { id: "ocean", type: "fill", source: "osm", "source-layer": "ocean", paint: { "fill-color": "#14242a" } },
    { id: "waterways", type: "line", source: "osm", "source-layer": "water_lines", paint: { "line-color": "#263a3f", "line-width": 1.5 } },
    { id: "buildings", type: "fill", source: "osm", "source-layer": "buildings", paint: { "fill-color": "#202626", "fill-outline-color": "#2a3030" } },
    { id: "street-areas", type: "fill", source: "osm", "source-layer": "street_polygons", paint: { "fill-color": "#252d2e" } },
    { id: "streets", type: "line", source: "osm", "source-layer": "streets", filter: ["!=", ["get", "rail"], true], layout: { "line-cap": "round", "line-join": "round" }, paint: {
      "line-color": ["match", ["get", "kind"], ["motorway", "trunk", "primary", "secondary"], "#68736f", "tertiary", "#4e5955", ["footway", "path", "cycleway", "track", "service"], "#293231", "#394241"],
      "line-width": ["interpolate", ["linear"], ["zoom"],
        10, ["match", ["get", "kind"], ["motorway", "trunk", "primary", "secondary"], 1.1, "tertiary", 0.8, ["footway", "path", "cycleway", "track", "service"], 0.4, 0.6],
        14, ["match", ["get", "kind"], ["motorway", "trunk", "primary", "secondary"], 2.7, "tertiary", 2, ["footway", "path", "cycleway", "track", "service"], 1, 1.5],
        17, ["match", ["get", "kind"], ["motorway", "trunk", "primary", "secondary"], 5.4, "tertiary", 4, ["footway", "path", "cycleway", "track", "service"], 2.1, 3],
      ],
    } },
    { id: "railways", type: "line", source: "osm", "source-layer": "streets", filter: ["==", ["get", "rail"], true], layout: { "line-cap": "butt", "line-join": "round" }, paint: {
      "line-color": "#c5ae96",
      "line-opacity": 0.45,
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 14, 1.4, 17, 2.6],
      "line-dasharray": [2, 5],
    } },
  ],
};

type Props = { bounds: MapBounds; width: number; height: number };

export function OnlineMap({ bounds, width, height }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState("Karte wird geladen");
  const { west, south, east, north } = bounds;

  useEffect(() => {
    let disposed = false;
    let failed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // A changed map bounds starts a fresh load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("Karte wird geladen");
    const initialize = async () => {
      try {
        const { Map, setWorkerUrl } = await import("maplibre-gl");
        if (disposed || !container.current) return;
        setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        const instance = new Map({
          container: container.current,
          style,
          interactive: false,
          attributionControl: false,
          renderWorldCopies: false,
          bounds: [[west, south], [east, north]],
          fitBoundsOptions: { padding: 0 },
        });
        map.current = instance;
        instance.on("error", event => {
          failed = true;
          console.error("Kartenfehler:", event.error);
          setStatus("Online-Karte nicht verf\u00fcgbar");
          if (!retry) retry = setTimeout(() => {
            retry = undefined;
            if (disposed) return;
            failed = false;
            setStatus("Karte wird geladen");
            instance.setStyle(style, { diff: false });
          }, 30000);
        });
        instance.on("idle", () => {
          if (!failed) setStatus("");
        });
      } catch (error) {
        if (!disposed) {
          console.error("Karteninitialisierung fehlgeschlagen:", error);
          setStatus("Online-Karte nicht verf\u00fcgbar");
        }
      }
    };
    initialize();
    return () => {
      disposed = true;
      clearTimeout(retry);
      map.current?.remove();
      map.current = null;
    };
  }, [west, south, east, north]);

  useEffect(() => {
    if (!map.current || width <= 0 || height <= 0) return;
    map.current.resize();
    map.current.fitBounds([[west, south], [east, north]], { padding: 0, duration: 0 });
  }, [west, south, east, north, width, height]);

  return <>
    <div className="online-map" ref={container} aria-hidden="true" />
    {status && <span className="map-notice" role="status">{status}</span>}
    <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&#169; OpenStreetMap contributors</a>
  </>;
}
