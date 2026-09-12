import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';
import { setupParcels } from './parcels.js';
import { setupVacantLots } from './vacant-lots.js';
import { setupExplore } from './explore.js';
import { setupSuggestions } from './suggestions.js';

// Mainland SF's bounding rectangle. Mapbox constrains both the camera and
// zoom-out level to these bounds, including after viewport resizes.
const SF_BOUNDS = [[-122.517, 37.703], [-122.354, 37.833]];
const CITY_VIEW = { center: [-122.435, 37.768], zoom: 12.6, bearing: 0, pitch: 0 };
const status = document.querySelector('#map-status');
const reset = document.querySelector('#reset-view');
const themeToggle = document.querySelector('#theme-toggle');
let theme = 'light';
try {
  if (localStorage.getItem('shopspotter-theme') === 'dark') theme = 'dark';
} catch { /* The switch still works when browser storage is unavailable. */ }
const mapStyle = () => `mapbox://styles/mapbox/${theme}-v11`;
let activeMap;

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  themeToggle.checked = theme === 'dark';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#191e21' : '#ffffff';
}
applyTheme();
themeToggle.addEventListener('change', () => {
  theme = themeToggle.checked ? 'dark' : 'light';
  applyTheme();
  try { localStorage.setItem('shopspotter-theme', theme); } catch { /* Optional persistence. */ }
  activeMap?.setStyle(mapStyle());
});

function showError(message) {
  status.textContent = message;
  status.classList.add('error');
  status.hidden = false;
}

if (!__MAP_BOX_TOKEN__) {
  showError('Add MAP_BOX_TOKEN to .env, then restart the app to load the map.');
} else if (!mapboxgl.supported()) {
  showError('This map needs WebGL. Try a browser with hardware acceleration enabled.');
} else {
  try {
    const map = new mapboxgl.Map({
      container: 'map',
      accessToken: __MAP_BOX_TOKEN__,
      style: mapStyle(),
      ...CITY_VIEW,
      maxBounds: SF_BOUNDS,
      minZoom: 12,
      maxZoom: 18,
      maxPitch: 0,
      renderWorldCopies: false,
      dragRotate: false,
      touchPitch: false,
      attributionControl: true,
    });
    activeMap = map;
    const selection = setupParcels(map);
    setupExplore(map, selection);
    setupSuggestions(map);
    setupVacantLots(map);
    // Styles and layout can settle after Mapbox creates its canvas. Keep the
    // drawing surface in sync with the container, not just window resizes.
    const mapContainer = document.querySelector('#map');
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainer);
    map.on('remove', () => resizeObserver.disconnect());
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'imperial' }), 'bottom-left');

    reset.addEventListener('click', () => {
      map.easeTo({ ...CITY_VIEW, duration: 900 });
    });
    map.on('load', () => {
      status.hidden = true;
      reset.disabled = false;
    });
    map.on('error', (event) => {
      const code = event.error?.status;
      showError(code === 401 || code === 403
        ? 'Map access was denied. Check your public Mapbox token and its allowed URLs.'
        : 'The map could not finish loading. Check your connection and reload the page.');
    });
    map.on('idle', () => {
      if (map.isStyleLoaded() && map.areTilesLoaded()) status.hidden = true;
    });
  } catch {
    showError('The map could not start. Check your browser’s WebGL settings and reload.');
  }
}
