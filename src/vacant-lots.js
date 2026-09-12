const SOURCE = 'vacant-lots';
const LAYERS = ['vacant-lot-fill', 'vacant-lot-outline', 'vacant-lot-points'];

export function setupVacantLots(map) {
  const toggle = document.querySelector('#vacant-toggle');
  const message = document.querySelector('#vacant-message');
  const retry = document.querySelector('#vacant-retry');
  let data;

  function render(styleReady = false) {
    if (!data || (!styleReady && !map.isStyleLoaded())) return;
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: 'geojson', data, attribution: '<a href="https://data.sf.gov/d/wv5m-vpq2" target="_blank" rel="noopener">SF assessor vacant lots</a>' });
      const before = map.getLayer('property-fill') ? 'property-fill' : map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
      map.addLayer({ id: LAYERS[0], type: 'fill', source: SOURCE, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#12b8c4', 'fill-opacity': 0.4 } }, before);
      map.addLayer({ id: LAYERS[1], type: 'line', source: SOURCE, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': '#12b8c4', 'line-width': 2 } }, before);
      // Point fallbacks keep records visible when no active boundary matches.
      map.addLayer({ id: LAYERS[2], type: 'circle', source: SOURCE, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': '#12b8c4', 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } }, before);
    }
    for (const layer of LAYERS) map.setLayoutProperty(layer, 'visibility', toggle.checked ? 'visible' : 'none');
  }

  async function load() {
    retry.hidden = true;
    message.textContent = 'Loading recorded vacant lots…';
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/vacant-lots.geojson`);
      if (!response.ok) throw new Error('Could not load vacant lots');
      data = await response.json();
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.metadata) throw new Error('Invalid vacant-lot data');
      const meta = data.metadata;
      const points = meta.mapped_records - meta.boundary_records;
      message.textContent = `${meta.mapped_records.toLocaleString()} mapped records · ${meta.roll_year} tax roll${points ? ` · ${points} shown as dots` : ''}${meta.missing_geometry ? ` · ${meta.missing_geometry} without a location` : ''}. Current conditions may differ.`;
      toggle.disabled = false;
      render();
    } catch {
      data = undefined;
      message.textContent = 'Vacant lots could not load.';
      retry.hidden = false;
    }
  }

  toggle.addEventListener('change', () => {
    for (const layer of LAYERS) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', toggle.checked ? 'visible' : 'none');
    }
  });
  retry.addEventListener('click', load);
  map.on('style.load', () => render(true));
  // The snapshot may finish loading while the initial map is still loading.
  map.on('idle', () => { if (data && !map.getSource(SOURCE)) render(); });
  load();
}
