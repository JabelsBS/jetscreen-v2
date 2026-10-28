"use client";
import { useEffect, useState } from "react";
import { AircraftMap } from "./components/AircraftMap";
import SlideHolder from "./components/SlideHolder";
import { Aircraft, demoAircraft, normalizeAircraft, POSITION_LIFETIME_MS, Site } from "./lib/aircraft";
import { createMapBounds } from "./lib/mapGeometry";

const site: Site = {
  latitude: Number(process.env.NEXT_PUBLIC_CENTER_LAT || "52.43657424314263"),
  longitude: Number(process.env.NEXT_PUBLIC_CENTER_LON || "10.595466532451821"),
  radiusKm: Number(process.env.NEXT_PUBLIC_RADIUS_KM || "2"),
};
const validSite = Number.isFinite(site.latitude) && Math.abs(site.latitude) <= 85 &&
  Number.isFinite(site.longitude) && Math.abs(site.longitude) <= 180 && Number.isFinite(site.radiusKm) && site.radiusKm > 0;
const MAP_ASPECT = 1024 / 426;
const bounds = createMapBounds(site.latitude, site.longitude, site.radiusKm, MAP_ASPECT);
const POLL_MS = 2000;

export default function Home() {
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedStatus, setFeedStatus] = useState("Verbindung wird hergestellt");
  const [feedOkay, setFeedOkay] = useState(false);
  const [clock, setClock] = useState({ text: "", now: 0 });

  useEffect(() => {
    // The URL is only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(new URLSearchParams(window.location.search).get("demo") === "1" ? "demo" : "live");
    const updateClock = () => {
      const now = Date.now();
      setClock({ text: new Date(now).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }), now });
      setAircraft(current => current.filter(plane => now - plane.observedAt <= POSITION_LIFETIME_MS));
    };
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mode || !validSite) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    const startedAt = Date.now();
    const poll = async () => {
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 5000);
      try {
        if (mode === "demo") {
          setAircraft(demoAircraft(site, bounds, (Date.now() - startedAt) / 1000));
          setFeedStatus("Simulierte Fl\u00fcge");
          setFeedOkay(true);
        } else {
          const response = await fetch("/api/aircraft", { signal: requestController.signal, cache: "no-store" });
          if (!response.ok) throw new Error("Empf\u00e4nger nicht erreichbar");
          const planes = normalizeAircraft(await response.json(), site, bounds);
          if (stopped) return;
          setAircraft(planes);
          setFeedStatus(planes.length ? "Live" : "Keine Flieger im Kartenausschnitt");
          setFeedOkay(true);
        }
      } catch {
        if (!stopped) { setFeedStatus("Empf\u00e4nger nicht erreichbar"); setFeedOkay(false); }
      } finally {
        window.clearTimeout(timeout);
        if (!stopped) timer = setTimeout(poll, POLL_MS);
      }
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [mode]);

  const selected = aircraft.find(plane => plane.id === selectedId) ?? aircraft[0] ?? null;

  return <main className="flight-display">
    <header className="display-header">
      <div className="display-heading"><span className="wordmark">JETSCREEN</span><span className="header-divider" /><span>&#177;{site.radiusKm} km Nord/S&#252;d</span></div>
      <div className="display-status"><span className={`status-light ${feedOkay ? "connected" : ""}`} /><span role="status">{mode === "demo" ? "DEMO" : feedStatus}</span><time>{clock.text}</time></div>
    </header>
    {validSite ? <>
      <AircraftMap aircraft={aircraft} selectedId={selected?.id ?? null} site={site} now={clock.now}
        bounds={bounds} aspect={MAP_ASPECT} onSelect={setSelectedId} />
      <SlideHolder aircraft={selected} demo={mode === "demo"} />
      <nav className="contact-strip" aria-label="Flugzeugauswahl">
        <button className={selectedId === null || !aircraft.some(plane => plane.id === selectedId) ? "active" : ""} onClick={() => setSelectedId(null)} title="Automatisch den n&#228;chsten Flieger ausw&#228;hlen">Auto</button>
        {aircraft.map(plane => <button key={plane.id} className={plane.id === selected?.id ? "active" : ""}
          aria-pressed={plane.id === selected?.id} onClick={() => setSelectedId(plane.id)}>
          {plane.callsign ?? plane.id.toUpperCase()}<span>{plane.distanceKm.toFixed(1)} km</span>
        </button>)}
        <span className="contact-count">{aircraft.length} Flieger</span>
      </nav>
    </> : <div className="configuration-error" role="alert">Standort und Radius ung&#252;ltig</div>}
  </main>;
}
