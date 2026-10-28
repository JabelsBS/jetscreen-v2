# Jetscreen

Jetscreen shows multiple nearby aircraft on a quiet, north-up local map. The
1024 x 600 display uses custom aircraft silhouettes, short trails, and compact
selected-flight information. A dark, label-free online map uses OpenStreetMap
vector tiles; aircraft positions update from your ADS-B receiver independently
of route availability.

## Local Preview and Online Map

Use Node.js 22 LTS. Existing dependencies can be installed with `npm ci` on a
machine with internet access. Copy `.env.example` to `.env.local` and set
`LOCAL_ADSB_URL` to your receiver's `aircraft.json` endpoint.

```bash
npm run dev
```

Open `http://localhost:3000/?demo=1` for an explicitly labelled, simulated view.
The demo loads map tiles online but does not fetch aircraft or routes.
`http://localhost:3000/` uses the real receiver; it never silently substitutes
demo flights. Select a marker or callsign for details; Auto follows the nearest
in-range aircraft.

Defaults: latitude `52.43657424314263`, longitude `10.595466532451821`, radius
`2` km. Configure the center and radius in `.env.local`; the map and aircraft
positions use the same Web Mercator bounds. The map uses MapLibre GL JS and,
by default, OpenStreetMap's Shortbread vector tile service, without an API key.
It requires internet access and a browser with WebGL support. If the service or
WebGL is unavailable, the display reports the map error and continues to show
aircraft. Tile service errors are retried after 30 seconds. The tile provider
receives your IP address and approximate map area; aircraft positions are not
sent to it.

`NEXT_PUBLIC_MAP_TILEJSON_URL` optionally selects another Shortbread-compatible
TileJSON endpoint; check its terms and attribution requirements before use.
OpenStreetMap's vector service is best-effort and subject to its
[usage policy](https://operations.osmfoundation.org/policies/vector/).
OpenStreetMap attribution remains visible on the map; see
[OSM copyright](https://www.openstreetmap.org/copyright).

The older `npm run map:generate` script is still available for producing a
local raster export, but the online display does not use that export.

The live display polls every two seconds without overlapping requests. Last
known positions fade after ten seconds and expire after thirty seconds; route
failures do not remove aircraft. Identifiers without callsigns use the receiver's
hex ID. Standard dump1090/readsb `alt_geom`, `alt_baro`, or legacy `altitude`
numeric values are converted from feet to meters, with geometric altitude
preferred. These values are not height above ground. Unknown height remains
unknown; verify the actual receiver schema before relying on altitude values.

## Verification

```bash
npm test
npm run lint
npm run build
```

Browser tests require a running server on port 3000 and a browser that permits
Playwright automation. On Windows they use installed Edge, without a browser
download. On other systems, provision Playwright's Chromium separately.
Set `PLAYWRIGHT_BASE_URL` to use a server on another local port.

```bash
npm run test:display
```

Tests use local tile fixtures, block external browser requests, and cover the
1024 x 600 and mobile layouts, selection, map loading and failure, missing routes
and position expiry. The tile fixture does not contain real neighborhood data.
`PLAYWRIGHT_CHANNEL` can select another already provisioned browser.

The inherited Next.js 13 dependency set has known security advisories. The
display change does not upgrade the framework. Keep this development instance
local and review a supported-version migration before public exposure.

## Requirements
To run Jetscreen, you'll need the following hardware:
- A Raspberry Pi (tested on a 3B+)
- A monitor (the demo uses [WaveShare's 7.9in display](https://www.waveshare.com/wiki/7.9inch_HDMI_LCD))
- A USB ADS-B receiver (the demo uses the [FlightAware Pro Stick Plus](https://uk.flightaware.com/adsb/prostick/))

### 1. Set up the Raspberry Pi
Ensure your Raspberry Pi is configured with an operating system like Raspbian, and connected to a monitor and keyboard. You'll also need an internet connection via Wi-Fi or Ethernet.

First, update the system by running:
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Setup ADS-B Receiver
Follow the instructions for your specific USB ADS-B receiver (like the [FlightAware Pro Stick Plus](https://uk.flightaware.com/adsb/prostick/)) to install the required software. This should expose a local URL where you can access the live ADS-B data stream (for the FlightAware Pro Stick Plus, it's `http://[local IP]:8080/data/aircraft.json`).


### 3. Install Node.js and npm
Jetscreen is built on Next.js, which requires Node.js and npm to run. Install them using the following commands:

```bash
sudo apt install nodejs npm -y
```

To verify the installation:
```bash
node -v
npm -v
```

Ensure you have the latest versions.

### 4. Clone the Jetscreen Repository
Clone the **Jetscreen** repository from GitHub:

```bash
git clone https://github.com/oliverrees/jetscreen-v2.git
```

Navigate into the project folder:
```bash
cd jetscreen-v2
```

### 5. Install Dependencies
Run the following command to install the necessary packages:

```bash
npm install
```

### 6. Create the `.env.local` File
Inside the root directory of the project, create a `.env.local` file to store environment variables:

```bash
touch .env.local
```

Edit this file to include the following variables:
```bash
LOCAL_ADSB_URL=http://192.168.1.100:8080/data/aircraft.json
NEXT_PUBLIC_FLIGHT_DETAILS_URL=https://api.adsbdb.com/v0/callsign/
NEXT_PUBLIC_CENTER_LAT=52.43657424314263
NEXT_PUBLIC_CENTER_LON=10.595466532451821
NEXT_PUBLIC_RADIUS_KM=2
NEXT_TELEMETRY_DISABLED=1
```

#### Explanation of Environment Variables:
- `LOCAL_ADSB_URL`: The URL of your local ADS-B data stream (replace with your actual IP and port).
- `NEXT_PUBLIC_FLIGHT_DETAILS_URL`: The adsbdb API URL to fetch flight details by callsign - [hexdb.io](https://hexdb.io) is another option.
- `NEXT_PUBLIC_CENTER_LAT`: The latitude of the center point of the map where you're tracking planes (replace with your location).
- `NEXT_PUBLIC_CENTER_LON`: The longitude of the center point (replace with your location).
- `NEXT_PUBLIC_RADIUS_KM`: The radius (in kilometers) for which you want to track planes around your center point.
- `NEXT_TELEMETRY_DISABLED`: Set to `1` to disable Next.js telemetry.

### 7. Start the Development Server
To start the server in development mode, run the following command:

```bash
npm run dev
```

This will start the server, and you can view Jetscreen by navigating to `http://localhost:3000` in your browser.

### 8. Optional: Run Jetscreen in Production
For production mode, first build the app:

```bash
npm run build
```

Then, start the production server:

```bash
npm start
```

Now, you can access Jetscreen from any device on the same network by navigating to the Raspberry Pi's IP address and port `3000` in a browser.


### 9. Set up the browser on the Raspberry Pi
To run Jetscreen in full-screen mode on the Raspberry Pi, you can use a browser like Chromium. Install it using the following command:

```bash
sudo apt install chromium-browser -y
```

To open Jetscreen in full-screen mode, run:

```bash
chromium-browser --kiosk http://localhost:3000
```


