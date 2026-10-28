"use client";
import { useEffect, useRef, useState } from "react";
import { Aircraft } from "../lib/aircraft";
import { compassDirection } from "../lib/mapGeometry";

type Airport = { municipality?: string; name?: string; iata_code?: string; icao_code?: string };
type FlightRoute = { origin: Airport; destination: Airport };
type RouteState = { callsign: string; route: FlightRoute | null; loading: boolean };

export default function SlideHolder({ aircraft, demo }: { aircraft: Aircraft | null; demo: boolean }) {
  const [state, setState] = useState<RouteState | null>(null);
  const cache = useRef(new Map<string, { route: FlightRoute | null; expiresAt: number }>());
  const callsign = aircraft?.callsign ?? null;

  useEffect(() => {
    if (!callsign || demo) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    const load = async () => {
      const cached = cache.current.get(callsign);
      if (cached && cached.expiresAt > Date.now()) {
        setState({ callsign, route: cached.route, loading: false });
        if (!cached.route) timer = setTimeout(load, cached.expiresAt - Date.now());
        return;
      }
      setState({ callsign, route: null, loading: true });
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 5000);
      try {
        const response = await fetch(`/api/getroute?callsign=${encodeURIComponent(callsign)}`, { signal: requestController.signal });
        const payload = response.ok ? await response.json() : null;
        const candidate = payload?.response?.flightroute;
        const route = candidate?.origin && candidate?.destination ? candidate as FlightRoute : null;
        if (stopped) return;
        if (cache.current.size >= 100) cache.current.clear();
        cache.current.set(callsign, { route, expiresAt: Date.now() + (route ? 3600000 : 60000) });
        setState({ callsign, route, loading: false });
        if (!route) timer = setTimeout(load, 60000);
      } catch {
        if (!stopped) { setState({ callsign, route: null, loading: false }); timer = setTimeout(load, 60000); }
      } finally {
        window.clearTimeout(timeout);
      }
    };
    load();
    return () => { stopped = true; controller?.abort(); clearTimeout(timer); };
  }, [callsign, demo]);

  if (!aircraft) return <section className="flight-detail empty-detail" aria-live="polite"><span>Keine aktuellen Flugzeugpositionen.</span></section>;
  const route = !demo && state?.callsign === callsign ? state.route : null;
  const airportName = (airport: Airport) => airport.municipality || airport.iata_code || airport.icao_code || airport.name || "Unbekannt";

  return <section className="flight-detail" aria-label="Ausgew&#228;hltes Flugzeug">
    <div className="flight-identity"><span className="detail-caption">{demo ? "DEMOKONTAKT" : "IM BLICK"}</span><strong>{aircraft.callsign ?? aircraft.id.toUpperCase()}</strong></div>
    <div className="flight-route">
      {route ? <><span title={route.origin.name}>{airportName(route.origin)}</span><span className="route-arrow" aria-label="nach">&#8594;</span><span title={route.destination.name}>{airportName(route.destination)}</span></> :
        <span className="route-unavailable">{demo ? "Simulierte Position" : !callsign ? "Ohne Rufzeichen" : state?.callsign === callsign && state.loading ? "Route wird geladen" : "Route nicht verf\u00fcgbar"}</span>}
    </div>
    <div className="flight-measure"><span className="detail-caption">ENTFERNUNG</span><strong>{aircraft.distanceKm.toFixed(1)} <small>km</small></strong></div>
    <div className="flight-measure"><span className="detail-caption">RICHTUNG</span><strong>{compassDirection(aircraft.bearing)} <small>{Math.round(aircraft.bearing)}&#176;</small></strong></div>
    <div className="flight-measure altitude-measure" title={aircraft.altitudeMeters === null ? "H\u00f6he unbekannt" : aircraft.altitudeSource === "barometric" ? "Barometrische H\u00f6he, nicht H\u00f6he \u00fcber Grund" : "Geometrische H\u00f6he, nicht H\u00f6he \u00fcber Grund"}><span className="detail-caption">H&#214;HE</span><strong>{aircraft.altitudeMeters === null ? "--" : aircraft.altitudeMeters.toLocaleString("de-DE")} <small>m</small></strong></div>
  </section>;
}
