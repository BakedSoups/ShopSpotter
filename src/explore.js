import { parcelAddress } from './parcels.js';

export function geometryBounds(geometry) {
  const points = geometry.type === 'Point' ? [geometry.coordinates] : geometry.coordinates.flat(geometry.type === 'MultiPolygon' ? 2 : 1);
  return [[Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))], [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]];
}

export function searchUrl(text) {
  const normalized = text.trim().toUpperCase().replace(/\s+/g, ' ');
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  let where;
  if (normalized.includes('SALESFORCE')) where = "blklot = '3720009'";
  else if (/^(BLOCK\s+)?\d{1,4}$/.test(normalized)) {
    const block = normalized.replace('BLOCK ', '').padStart(4, '0');
    where = `block_num = ${quote(block)}`;
  } else if (/^(PARCEL\s+)?\d{4}[A-Z]?[- ]?\d{3}[A-Z]?$/.test(normalized)) {
    where = `blklot = ${quote(normalized.replace('PARCEL ', '').replace(/[- ]/g, ''))}`;
  } else {
    const match = normalized.match(/^(\d+)\s+(.+)$/);
    const street = (match ? match[2] : normalized).replace(/\s+(STREET|ST|AVENUE|AVE|BOULEVARD|BLVD|ROAD|RD|WAY|DRIVE|DR)$/, '').replace(/^(\d)(ST|ND|RD|TH)$/, '0$1$2');
    where = `${match ? `from_address_num = ${quote(match[1])} AND ` : ''}starts_with(upper(street_name), ${quote(street)})`;
  }
  const url = new URL('https://data.sf.gov/resource/acdm-wktn.json');
  // Restrict results to the same mainland SF area as the map.
  url.searchParams.set('$where', `active = true AND (${where}) AND within_box(shape, 37.833, -122.517, 37.703, -122.354)`);
  url.searchParams.set('$select', 'blklot,block_num,lot_num,from_address_num,to_address_num,street_name,street_type,zoning_code,analysis_neighborhood,shape');
  url.searchParams.set('$order', 'blklot');
  url.searchParams.set('$limit', '20');
  return url;
}

export function setupExplore(map, selection) {
  const form = document.querySelector('#property-search');
  const input = document.querySelector('#search-input');
  const results = document.querySelector('#search-results');
  const searchMessage = document.querySelector('#search-message');
  const photoGrid = document.querySelector('#property-photos');
  const photoMessage = document.querySelector('#photo-message');
  let searchRequest;
  let photoRequest;
  let debounce;

  function focus(geometry) {
    map.fitBounds(geometryBounds(geometry), { padding: 70, maxZoom: 17, duration: 900 });
  }

  async function search() {
    searchRequest?.abort();
    if (input.value.trim().length < 2) {
      results.replaceChildren();
      searchMessage.textContent = 'Try “Block 3720”, “101 1st St”, or a parcel ID.';
      return;
    }
    const controller = new AbortController();
    searchRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    results.replaceChildren();
    searchMessage.textContent = 'Searching San Francisco…';
    try {
      const response = await fetch(searchUrl(input.value), { signal: controller.signal });
      if (!response.ok) throw new Error('Search unavailable');
      const rows = await response.json();
      if (searchRequest !== controller) return;
      if (!Array.isArray(rows)) throw new Error('Unexpected response');
      const parcels = rows.filter(row => row.shape);
      searchMessage.textContent = parcels.length ? `${parcels.length === 20 ? 'First 20' : parcels.length} properties found${parcels.length === 20 ? ' · narrow your search for more specific results' : ''}` : 'No properties found. Try a street, block number, or parcel ID.';
      for (const parcel of parcels) {
        const button = document.createElement('button');
        button.type = 'button';
        const title = document.createElement('strong');
        title.textContent = parcelAddress(parcel);
        const subtitle = document.createElement('span');
        subtitle.textContent = `Block ${parcel.block_num} · Parcel ${parcel.blklot}`;
        button.append(title, subtitle);
        button.addEventListener('click', () => {
          selection.select(parcel);
          focus(parcel.shape);
          results.replaceChildren();
          searchMessage.textContent = 'Selected property shown below.';
          document.querySelector('#sidebar').scrollTop = 0;
        });
        results.append(button);
      }
    } catch {
      if (searchRequest === controller) searchMessage.textContent = 'Search is unavailable. Please try again.';
    } finally { clearTimeout(timeout); }
  }

  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(debounce); search(); });
  input.addEventListener('input', () => { searchRequest?.abort(); searchRequest = undefined; clearTimeout(debounce); debounce = setTimeout(search, 400); });
  document.querySelector('#example-search').addEventListener('click', () => { input.value = 'Salesforce Tower'; search(); });
  document.querySelector('#sidebar-toggle').addEventListener('click', event => {
    const collapsed = document.querySelector('.app').classList.toggle('sidebar-collapsed');
    event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    event.currentTarget.textContent = collapsed ? 'Explore properties' : 'Hide panel';
  });

  document.addEventListener('property-cleared', () => {
    photoRequest?.abort();
    photoRequest = undefined;
    photoGrid.replaceChildren();
    photoMessage.textContent = 'Select a property to see photos of its surroundings.';
  });
  document.addEventListener('property-selected', async event => {
    photoRequest?.abort();
    const controller = new AbortController();
    photoRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    photoGrid.replaceChildren();
    photoMessage.textContent = 'Finding nearby photos…';
    const bounds = geometryBounds(event.detail.shape);
    const lng = (bounds[0][0] + bounds[1][0]) / 2;
    const lat = (bounds[0][1] + bounds[1][1]) / 2;
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'geosearch', ggsprimary: 'all', ggsnamespace: '6', ggsradius: '400', ggscoord: `${lat}|${lng}`, ggslimit: '12', prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '400' });
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Photos unavailable');
      const payload = await response.json();
      if (payload.error) throw new Error('Photos unavailable');
      if (photoRequest !== controller) return;
      const photos = Object.values(payload.query?.pages || {}).filter(page => page.imageinfo?.[0]?.thumburl && /image\/(jpeg|png|webp)/.test(page.imageinfo[0].mime)).slice(0, 4);
      photoMessage.textContent = photos.length ? 'Within 400 m · nearby views, not verified photos of this property.' : 'No nearby public photos found for this property.';
      const plainText = html => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.trim();
      for (const photo of photos) {
        const info = photo.imageinfo[0];
        const figure = document.createElement('figure');
        const link = document.createElement('a');
        link.href = info.descriptionurl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const img = document.createElement('img');
        img.src = info.thumburl;
        img.alt = photo.title.replace(/^File:/, '');
        img.loading = 'lazy';
        img.addEventListener('error', () => { img.replaceWith(document.createTextNode('Photo unavailable — view source')); });
        link.append(img);
        const caption = document.createElement('figcaption');
        caption.textContent = `${plainText(info.extmetadata?.Artist?.value) || 'Wikimedia Commons'} · ${plainText(info.extmetadata?.LicenseShortName?.value) || 'See source license'}`;
        figure.append(link, caption);
        photoGrid.append(figure);
      }
    } catch {
      if (photoRequest === controller) photoMessage.textContent = 'Nearby photos are unavailable right now.';
    } finally { clearTimeout(timeout); }
  });
}
