const ENDPOINT = 'https://data.sf.gov/resource/acdm-wktn.json';
const SOURCE = 'selected-property';
const empty = () => ({ type: 'FeatureCollection', features: [] });

export function parcelLookupUrl(lng, lat) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('Invalid coordinates');
  const url = new URL(ENDPOINT);
  url.searchParams.set('$where', `active = true AND intersects(shape, 'POINT (${lng} ${lat})')`);
  url.searchParams.set('$select', 'blklot,block_num,lot_num,from_address_num,to_address_num,street_name,street_type,zoning_code,analysis_neighborhood,shape');
  url.searchParams.set('$order', 'blklot');
  url.searchParams.set('$limit', '50');
  return url;
}

export function parcelAddress(parcel) {
  const from = parcel.from_address_num;
  const to = parcel.to_address_num;
  const number = from && from !== '0' ? (to && to !== '0' && to !== from ? `${from}–${to}` : from) : '';
  return [number, parcel.street_name, parcel.street_type].filter(Boolean).join(' ') || 'Property without a listed address';
}

export function setupParcels(map) {
  const panel = document.querySelector('#property-panel');
  const heading = document.querySelector('#property-heading');
  const message = document.querySelector('#property-message');
  const details = document.querySelector('#property-details');
  const clear = document.querySelector('#clear-property');
  const choices = document.querySelector('#property-choices');
  let selected = empty();
  let request;
  let parcels = [];

  function renderSelection(styleReady = false) {
    const source = map.getSource(SOURCE);
    if (source) {
      source.setData(selected);
      return;
    }
    if (!styleReady && !map.isStyleLoaded()) return;
    map.addSource(SOURCE, { type: 'geojson', data: selected, attribution: '<a href="https://data.sf.gov/d/acdm-wktn" target="_blank" rel="noopener">SF parcel data</a>' });
    const before = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
    map.addLayer({ id: 'property-fill', type: 'fill', source: SOURCE, paint: { 'fill-color': '#e9a43b', 'fill-opacity': 0.3 } }, before);
    map.addLayer({ id: 'property-outline', type: 'line', source: SOURCE, paint: { 'line-color': '#e9a43b', 'line-width': 3 } }, before);
  }

  function showParcel(parcel) {
    selected = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: parcel.shape, properties: {} }] };
    renderSelection();
    heading.textContent = parcelAddress(parcel);
    message.textContent = 'Property boundary highlighted';
    document.querySelector('#property-id').textContent = parcel.blklot || 'Not listed';
    document.querySelector('#property-neighborhood').textContent = parcel.analysis_neighborhood || 'Not listed';
    document.querySelector('#property-zoning').textContent = parcel.zoning_code || 'Not listed';
    document.querySelector('#property-block').textContent = parcel.block_num || 'Not listed';
    document.querySelector('#property-description').textContent = `A recorded property in ${parcel.analysis_neighborhood || 'San Francisco'}, on block ${parcel.block_num || '—'}. Explore its surroundings and possible future uses below.`;
    details.hidden = false;
    document.dispatchEvent(new CustomEvent('property-selected', { detail: parcel }));
  }

  function resetSelection() {
    request?.abort();
    request = undefined;
    selected = empty();
    parcels = [];
    renderSelection();
    heading.textContent = 'Explore a property';
    message.textContent = 'Click a building or empty lot to highlight its parcel.';
    details.hidden = true;
    choices.hidden = true;
    clear.hidden = true;
    panel.setAttribute('aria-busy', 'false');
    document.dispatchEvent(new CustomEvent('property-cleared'));
  }

  clear.addEventListener('click', resetSelection);
  choices.addEventListener('change', () => showParcel(parcels[Number(choices.value)]));
  // Mapbox replaces custom sources when switching between light and dark styles.
  map.on('style.load', () => renderSelection(true));
  map.on('click', async (event) => {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 15000);
    selected = empty();
    renderSelection();
    details.hidden = true;
    document.dispatchEvent(new CustomEvent('property-cleared'));
    choices.hidden = true;
    clear.hidden = false;
    heading.textContent = 'Finding property…';
    message.textContent = 'Looking up SF’s public parcel records.';
    panel.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(parcelLookupUrl(event.lngLat.lng, event.lngLat.lat), { signal: controller.signal });
      if (!response.ok) throw new Error('Parcel lookup failed');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Unexpected parcel response');
      if (request !== controller) return;
      parcels = rows.filter(row => ['Polygon', 'MultiPolygon'].includes(row.shape?.type));
      if (!parcels.length) {
        heading.textContent = 'No parcel at this spot';
        message.textContent = 'Try inside a building or lot. Streets and water may have no parcel.';
        return;
      }
      choices.replaceChildren(...parcels.map((parcel, index) => new Option(`Parcel ${parcel.blklot || index + 1}`, String(index))));
      choices.hidden = parcels.length < 2;
      showParcel(parcels[0]);
    } catch {
      if (request !== controller) return;
      heading.textContent = 'Property lookup unavailable';
      message.textContent = 'The city’s data service did not respond. Click the property to try again.';
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = undefined;
        panel.setAttribute('aria-busy', 'false');
      }
    }
  });
  map.on('remove', () => request?.abort());
  return {
    select(parcel) {
      resetSelection();
      clear.hidden = false;
      showParcel(parcel);
    },
  };
}
