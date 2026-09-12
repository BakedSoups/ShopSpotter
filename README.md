# ShopSpotter

A small, responsive Mapbox app focused on San Francisco.

## Run

1. Set `MAP_BOX_TOKEN` in `.env` (see `.env.example`). Use a public `pk.` token; it is included in the browser bundle. Other environment variables are not exposed.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.

`npm run build` creates the production site in `dist`; `npm run preview` serves it locally.

The map starts over SF, with zoom controls and a button to return to the initial view. Panning and zooming out are constrained using Mapbox's `maxBounds`, with rotation and tilt disabled. The bounds cover mainland San Francisco (longitude -122.517 to -122.354, latitude 37.703 to 37.833). This is a rectangular city-area restriction, not a clip to the municipal coastline; nearby water can appear.

Mapbox documentation: https://docs.mapbox.com/mapbox-gl-js/example/restrict-bounds/

Click a building or vacant lot to highlight its active parcel and see the recorded address, parcel ID, neighborhood, and zoning. The app queries the public DataSF API directly; no additional token is needed. Multiple parcels at the same point appear in a selector. The highlight survives light/dark style changes; the × button clears it. These are parcel boundaries, which can differ from building outlines. Streets and water may have no matching parcel. Data source: https://data.sf.gov/d/acdm-wktn

The left explorer supports block numbers (e.g. `Block 3720`), parcel IDs, and street/address searches. A Salesforce Tower shortcut is included. Results come from active mainland SF parcels; the first 20 matches are shown. Selecting a result focuses the map and loads nearby Wikimedia Commons photos with attribution. Photos show surroundings within 400 m, not verified property photos; availability depends on Commons coverage. The four starter ideas are illustrative concepts, not zoning or feasibility recommendations.

The recorded-vacant-lots overlay uses the latest available assessor tax roll (currently 2025), matched to active parcel boundaries. Included class codes: V, VA15, VCI, VCIX, VG, VPUB, VR, VRX. Street and TDR parcel classes are excluded. The bundled snapshot has 4,980 records: 4,910 boundaries, 43 point fallbacks, and 27 records without usable geometry. Coverage is of classified records, not a live survey of every physically empty site. The map remains constrained to mainland SF. Refresh the snapshot with `python3 scripts/refresh-vacant-lots.py`, then rebuild. Source and download date are stored in the GeoJSON metadata.
