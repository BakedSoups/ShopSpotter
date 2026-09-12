import { geometryBounds } from './explore.js';

export const IDEAS = [
  { title: 'Neighborhood restaurant', icon: 'M7 3v7m-3-7v5a3 3 0 0 0 6 0V3M7 11v10M20 21V3c-4 2-5 7-3 10h3', tag: 'Food & community', reason: 'A neighborhood kitchen could give residents and workers a place to eat and meet throughout the day.', check: 'Validate meal-time demand, nearby menus, kitchen ventilation, and food-service permissions.' },
  { title: 'Café & work lounge', icon: 'M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2', tag: 'Everyday gathering', reason: 'Coffee, seating, and workspace could support short visits as well as longer stays near this block.', check: 'Check existing café capacity, morning foot traffic, accessible seating, and utility needs.' },
  { title: 'Community garden', icon: 'M12 21v-9M12 16C4 16 3 10 3 6c6 0 9 4 9 10Zm0-4c0-6 3-9 9-9 0 6-3 9-9 9Z', tag: 'Green space', reason: 'Shared growing beds could turn an underused outdoor site into a place for neighbors to spend time together.', check: 'Confirm sunlight, soil quality, water access, stewardship, and permission to use the land.' },
  { title: 'Pop-up market', icon: 'M4 11v10h16V11M2 7l3-4h14l3 4v4H2V7Zm6 14v-6h8v6M2 7h20', tag: 'Local business', reason: 'Flexible stalls could let local makers test demand before committing to a permanent storefront.', check: 'Validate vendor interest, pedestrian access, event permits, power, and waste collection.' },
  { title: 'Neighborhood grocery', icon: 'M4 8h16l-2 13H6L4 8Zm4 0 4-6 4 6M9 12v5m6-5v5', tag: 'Daily essentials', reason: 'A small food shop could provide convenient essentials for people already spending time nearby.', check: 'Measure actual grocery access, household demand, delivery access, refrigeration, and existing competition.' },
  { title: 'Bike repair shop', icon: 'M14 6a5 5 0 0 0-6 6l-5 5a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z', tag: 'Local services', reason: 'Repair and maintenance services could support everyday trips through the surrounding streets.', check: 'Count local cycling trips and existing repair services; assess workshop space and safe access.' },
  { title: 'Creative studio', icon: 'm4 16 12-12 4 4L8 20H4v-4Zm9-9 4 4M4 23h16', tag: 'Arts & making', reason: 'Shared studios or workshops could provide space for local makers, classes, and small events.', check: 'Interview potential users and check rent affordability, noise limits, and workshop requirements.' },
  { title: 'Fitness & movement', icon: 'M6 5v14m12-14v14M3 8v8m18-8v8M6 12h12', tag: 'Health & wellbeing', reason: 'A flexible movement studio could host small classes at different times of day.', check: 'Validate class demand, competing studios, floor area, sound isolation, and accessibility.' },
];

export function randomSample(items, count, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function nearbyBusinessUrl(lng, lat) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('Invalid location');
  const url = new URL('https://data.sf.gov/resource/g8m3-pdis.json');
  url.searchParams.set('$where', `location_end_date IS NULL AND dba_end_date IS NULL AND administratively_closed IS NULL AND upper(city) = 'SAN FRANCISCO' AND within_circle(location, ${lat}, ${lng}, 350)`);
  url.searchParams.set('$select', 'uniqueid,dba_name,full_business_address,location');
  url.searchParams.set('$order', 'uniqueid');
  url.searchParams.set('$limit', '500');
  return url;
}

export function setupSuggestions(map) {
  const grid = document.querySelector('#suggestion-grid');
  const list = document.querySelector('#nearby-businesses');
  const message = document.querySelector('#nearby-message');
  const resample = document.querySelector('#resample-ideas');
  const context = document.querySelector('#suggestion-context');
  let parcel;
  let businesses = [];
  let sample = [];
  let request;
  let businessStatus = 'idle';
  let ideaChoices = randomSample(IDEAS, 4);
  let dots = { type: 'FeatureCollection', features: [] };
  let renderedDots;

  function renderMap(styleReady = false) {
    if (!styleReady && !map.isStyleLoaded()) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const buildings = map.getStyle().layers.filter(layer => layer['source-layer'] === 'building' && layer.type === 'fill');
    for (const building of buildings) {
      map.setPaintProperty(building.id, 'fill-color', dark ? '#53665b' : '#b3c2b8');
      map.setPaintProperty(building.id, 'fill-opacity', 0.9);
      map.setPaintProperty(building.id, 'fill-outline-color', dark ? '#849d8d' : '#819989');
    }
    if (!map.getSource('nearby-business-sample')) {
      map.addSource('nearby-business-sample', { type: 'geojson', data: dots, attribution: '<a href="https://data.sf.gov/d/g8m3-pdis" target="_blank" rel="noopener">SF registered businesses</a>' });
      map.addLayer({ id: 'nearby-business-dots', type: 'circle', source: 'nearby-business-sample', paint: { 'circle-radius': 12, 'circle-color': '#395fba', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
      map.addLayer({ id: 'nearby-business-numbers', type: 'symbol', source: 'nearby-business-sample', layout: { 'text-field': ['to-string', ['get', 'number']], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } });
    } else map.getSource('nearby-business-sample').setData(dots);
    renderedDots = dots;
  }

  function renderIdeas() {
    const expanded = new Set([...grid.querySelectorAll('details[open]')].map(card => card.dataset.title));
    grid.replaceChildren();
    context.textContent = parcel ? `Ideas for block ${parcel.block_num || '—'} · random prototype, not a retail-gap assessment.` : 'Select a lot to explore four possibilities for its block.';
    for (const [index, idea] of ideaChoices.entries()) {
      const card = document.createElement('details');
      card.className = 'suggestion-card';
      card.dataset.title = idea.title;
      card.open = expanded.has(idea.title);
      const summary = document.createElement('summary');
      const icon = document.createElement('span');
      icon.className = 'suggestion-icon';
      const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      drawing.setAttribute('viewBox', '0 0 24 24');
      drawing.setAttribute('fill', 'none');
      drawing.setAttribute('stroke', 'currentColor');
      drawing.setAttribute('stroke-width', '1.6');
      drawing.setAttribute('stroke-linecap', 'round');
      drawing.setAttribute('stroke-linejoin', 'round');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', idea.icon);
      drawing.append(path);
      icon.append(drawing);
      icon.setAttribute('aria-hidden', 'true');
      const title = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = idea.title;
      const tag = document.createElement('small');
      tag.textContent = idea.tag;
      title.append(name, tag);
      const affordance = document.createElement('span');
      affordance.className = 'suggestion-expand';
      affordance.textContent = '+';
      summary.append(icon, title, affordance);
      const body = document.createElement('div');
      body.className = 'suggestion-reasoning';
      const sections = [
        ['The idea', idea.reason],
        ['Nearby context', !parcel ? 'Choose a lot to see a random sample of registered businesses around it.' : businessStatus === 'loading' ? 'Loading nearby registered businesses…' : sample.length ? `The sample includes ${sample.slice(0, 2).map(item => item.dba_name).join(' and ')} within 350 m. These are context examples, not evidence of unmet demand.` : businessStatus === 'error' ? 'Business records could not be loaded. This concept has no verified nearby-business context.' : 'No matching business records were returned. This does not establish a retail gap.'],
        ['What to validate', idea.check],
      ];
      for (const [label, text] of sections) {
        const heading = document.createElement('h3');
        heading.textContent = label;
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        body.append(heading, paragraph);
      }
      const note = document.createElement('p');
      note.className = 'prototype-note';
      note.textContent = 'Random concept with a template rationale. Retail Gap Attention scoring is not connected yet.';
      body.append(note);
      card.append(summary, body);
      card.dataset.idea = String(index);
      grid.append(card);
    }
  }

  function renderBusinesses() {
    list.replaceChildren();
    dots = { type: 'FeatureCollection', features: sample.map((item, index) => ({ type: 'Feature', geometry: item.location, properties: { number: index + 1, name: item.dba_name } })) };
    for (const [index, item] of sample.entries()) {
      const row = document.createElement('li');
      const badge = document.createElement('span');
      badge.className = 'business-number';
      badge.textContent = String(index + 1);
      const text = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = item.dba_name;
      const address = document.createElement('span');
      address.textContent = item.full_business_address || 'Address not listed';
      text.append(name, address);
      row.append(badge, text);
      list.append(row);
    }
    renderMap();
  }

  resample.addEventListener('click', () => {
    sample = randomSample(businesses, 6);
    ideaChoices = randomSample(IDEAS, 4);
    renderBusinesses();
    renderIdeas();
  });
  document.addEventListener('property-cleared', () => {
    request?.abort();
    request = undefined;
    parcel = undefined;
    businesses = [];
    sample = [];
    businessStatus = 'idle';
    message.textContent = 'Select a lot to see existing businesses within 350 m.';
    resample.disabled = true;
    renderBusinesses();
    renderIdeas();
  });
  document.addEventListener('property-selected', async event => {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    parcel = event.detail;
    businesses = [];
    sample = [];
    businessStatus = 'loading';
    ideaChoices = randomSample(IDEAS, 4);
    resample.disabled = true;
    message.textContent = 'Finding registered businesses within 350 m…';
    renderBusinesses();
    renderIdeas();
    const bounds = geometryBounds(parcel.shape);
    const center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(nearbyBusinessUrl(...center), { signal: controller.signal });
      if (!response.ok) throw new Error('Businesses unavailable');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid businesses');
      if (request !== controller) return;
      // A business may have several registrations at the same address.
      businesses = [...new Map(rows.filter(row => row.dba_name && row.location?.type === 'Point').map(row => [`${row.dba_name}|${row.full_business_address}`, row])).values()];
      sample = randomSample(businesses, 6);
      businessStatus = 'loaded';
      message.textContent = sample.length ? `Random sample of ${sample.length} from ${businesses.length}${rows.length === 500 ? '+' : ''} matching registrations within 350 m. Registry status does not guarantee a currently open storefront.` : 'No matching registrations nearby. This is not proof that there are no businesses.';
      renderBusinesses();
    } catch {
      if (request !== controller) return;
      businessStatus = 'error';
      message.textContent = 'Nearby business data is unavailable. Select the lot again to retry.';
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = undefined;
        resample.disabled = false;
        renderIdeas();
      }
    }
  });
  map.on('style.load', () => renderMap(true));
  map.on('idle', () => { if (!map.getSource('nearby-business-sample') || renderedDots !== dots) renderMap(); });
  renderIdeas();
}
