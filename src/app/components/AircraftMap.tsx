"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Aircraft, Site } from "../lib/aircraft";
import { MapBounds, projectPosition } from "../lib/mapGeometry";
import { AircraftGlyph } from "./AircraftGlyph";

type Props = {
  aircraft: Aircraft[];
  selectedId: string | null;
  site: Site;
  bounds: MapBounds;
  aspect: number;
  mapAvailable: boolean;
  mapStatus: string;
  onMapError: () => void;
  onSelect: (id: string) => void;
};
type Point = { x: number; y: number };

export function AircraftMap({ aircraft, selectedId, site, bounds, aspect, mapAvailable, mapStatus, onMapError, onSelect }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1024, height: 600 });
  const [trails, setTrails] = useState<Record<string, Point[]>>({});

  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const fittedWidth = Math.min(width, height * aspect);
      setSize({ width: fittedWidth, height: fittedWidth / aspect });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [aspect]);

  useEffect(() => {
    setTrails(current => {
      const next: Record<string, Point[]> = {};
      for (const plane of aircraft) {
        const point = projectPosition(plane.latitude, plane.longitude, bounds);
        const previous = current[plane.id] ?? [];
        const last = previous[previous.length - 1];
        next[plane.id] = last && Math.hypot(last.x - point.x, last.y - point.y) < 0.00001 ? previous : [...previous, point].slice(-12);
      }
      return next;
    });
  }, [aircraft, bounds]);

  const home = projectPosition(site.latitude, site.longitude, bounds);
  const placements: { id: string; x: number; y: number; width: number; height: number }[] = [];
  const labelWidth = Math.min(120, size.width * 0.32);
  const planePoints = aircraft.map(plane => ({ plane, point: projectPosition(plane.latitude, plane.longitude, bounds) }));
  for (const { plane, point } of [...planePoints].sort((first, second) => Number(second.plane.id === selectedId) - Number(first.plane.id === selectedId))) {
    const anchorX = point.x * size.width;
    const anchorY = point.y * size.height;
    for (const [offsetX, offsetY] of [[22, -18], [-labelWidth - 22, -18], [22, 25], [-labelWidth - 22, 25], [22, -64], [-labelWidth - 22, -64]]) {
      const x = Math.max(8, Math.min(size.width - labelWidth - 8, anchorX + offsetX));
      const y = Math.max(8, Math.min(size.height - 48, anchorY + offsetY));
      const overlaps = placements.some(label => x < label.x + label.width + 6 && x + labelWidth + 6 > label.x && y < label.y + label.height + 6 && y + 44 > label.y);
      const coversMarker = planePoints.some(other => other.point.x * size.width > x - 12 && other.point.x * size.width < x + labelWidth + 12 && other.point.y * size.height > y - 12 && other.point.y * size.height < y + 48);
      const coversHome = home.x * size.width > x - 18 && home.x * size.width < x + labelWidth + 18 && home.y * size.height > y - 18 && home.y * size.height < y + 48;
      if (!overlaps && !coversMarker && !coversHome) {
        placements.push({ id: plane.id, x, y, width: labelWidth, height: 38 });
        break;
      }
    }
  }

  return <section className="map-viewport" ref={viewport} aria-label="Flugzeuge rund um den Standort, Norden oben">
    <div className="map-frame" style={{ width: size.width, height: size.height }}>
      {mapAvailable && <Image className="local-map" src="/local-map.png" width={1024} height={600} unoptimized alt="Dunkle Umgebungskarte" onError={onMapError} draggable={false} />}
      <svg className="flight-trails" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
        {aircraft.map(plane => <polyline key={plane.id} points={(trails[plane.id] ?? []).map(point => `${point.x * size.width},${point.y * size.height}`).join(" ")} className={plane.id === selectedId ? "selected-trail" : ""} />)}
        {placements.map(label => {
          const point = planePoints.find(item => item.plane.id === label.id)!.point;
          return <line key={label.id} x1={point.x * size.width} y1={point.y * size.height} x2={label.x + (label.x < point.x * size.width ? label.width : 0)} y2={label.y + 12} />;
        })}
      </svg>
      <span className="home-marker" style={{ left: `${home.x * 100}%`, top: `${home.y * 100}%` }} title="Dein Standort"><span /><span className="home-label">ZUHAUSE</span></span>
      {planePoints.map(({ plane, point }) => <button key={plane.id} className={`aircraft-marker ${plane.id === selectedId ? "selected" : ""} ${Date.now() - plane.observedAt > 10000 ? "stale" : ""}`}
        style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        aria-label={`${plane.callsign ?? plane.id}, ${plane.distanceKm.toFixed(1)} Kilometer entfernt`}
        aria-pressed={plane.id === selectedId} onClick={() => onSelect(plane.id)}
        title={`${plane.callsign ?? plane.id} | ${plane.altitudeMeters === null ? "H\u00f6he unbekannt" : `${plane.altitudeMeters} m`} | ${plane.track === null ? "Flugrichtung unbekannt" : `Kurs ${Math.round(plane.track)} Grad`}`}>
        <span className="aircraft-rotation" style={{ transform: `rotate(${plane.track ?? 0}deg)` }}><AircraftGlyph category={plane.category} /></span>
      </button>)}
      {placements.map(label => {
        const plane = aircraft.find(item => item.id === label.id)!;
        return <button key={label.id} className={`aircraft-label ${plane.id === selectedId ? "selected" : ""}`} style={{ left: label.x, top: label.y, width: label.width }} onClick={() => onSelect(plane.id)}>
          <strong>{plane.callsign ?? plane.id.toUpperCase()}</strong><span>{plane.distanceKm.toFixed(1)} km <span className="label-dot">/</span> {plane.altitudeMeters === null ? "--" : plane.altitudeMeters.toLocaleString("de-DE")} m</span>
        </button>;
      })}
    </div>
    <div className="north-marker" title="Norden oben"><span>N</span><span className="north-needle" /></div>
    {mapStatus && <span className="map-notice" role="status">{mapStatus}</span>}
    {mapAvailable && <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&#169; OpenStreetMap contributors</a>}
  </section>;
}