"""Download public SF vacant-lot classifications and join active parcel shapes."""
import json
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
CODES = ['V', 'VA15', 'VCI', 'VCIX', 'VG', 'VPUB', 'VR', 'VRX']


def query(dataset, **params):
    url = f'https://data.sf.gov/resource/{dataset}.json?' + urlencode(params)
    with urlopen(url, timeout=60) as response:
        return json.load(response)


def main():
    year = query('wv5m-vpq2', **{'$select': 'max(closed_roll_year) as year'})[0]['year']
    codes = ','.join(f"'{code}'" for code in CODES)
    rows = []
    offset = 0
    while True:
        page = query('wv5m-vpq2', **{
            '$where': f'closed_roll_year = {int(year)} AND property_class_code in ({codes})',
            '$select': 'parcel_number,property_class_code,property_class_code_definition,the_geom',
            '$order': 'parcel_number', '$limit': 1000, '$offset': offset,
        })
        rows.extend(page)
        if len(page) < 1000:
            break
        offset += 1000
    records = {row['parcel_number']: row for row in rows}
    shapes = {}
    ids = list(records)
    for start in range(0, len(ids), 80):
        batch = ','.join("'" + item.replace("'", "''") + "'" for item in ids[start:start + 80])
        for parcel in query('acdm-wktn', **{
            '$where': f'active = true AND blklot in ({batch})',
            '$select': 'blklot,shape', '$limit': 1000,
        }):
            if parcel.get('shape'):
                shapes[parcel['blklot']] = parcel['shape']
    features = []
    missing = 0
    for parcel_id, row in records.items():
        geometry = shapes.get(parcel_id) or row.get('the_geom')
        if not geometry:
            missing += 1
            continue
        features.append({'type': 'Feature', 'geometry': geometry, 'properties': {
            'parcel_id': parcel_id, 'classification': row['property_class_code_definition'],
            'roll_year': year, 'boundary_available': parcel_id in shapes,
        }})
    result = {'type': 'FeatureCollection', 'features': features, 'metadata': {
        'roll_year': year, 'downloaded_at': datetime.now(timezone.utc).isoformat(),
        'total_records': len(records), 'mapped_records': len(features),
        'boundary_records': len(shapes), 'missing_geometry': missing,
        'included_codes': CODES,
        'source': 'https://data.sf.gov/d/wv5m-vpq2',
    }}
    if not features:
        raise RuntimeError('No vacant lots returned; existing snapshot was not changed.')
    target = ROOT / 'public/data/vacant-lots.geojson'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, separators=(',', ':')))
    print(json.dumps(result['metadata'], indent=2))


if __name__ == '__main__':
    main()
