"""Rebuild the offline icon module from bundled official Lucide SVG assets."""
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

ui = Path(__file__).resolve().parents[1] / 'ui'
assets = ui / 'icons/lucide'
provenance = json.loads((assets / 'provenance.json').read_text(encoding='utf-8'))
icons = {}
for name in provenance['icons']:
    raw = (assets / (name + '.svg')).read_text(encoding='utf-8')
    root = ET.fromstring(raw)
    for element in root.iter():
        if element.tag.split('}')[-1] not in {'svg', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'g'}:
            raise ValueError(f'Unexpected SVG element in {name}')
        if any(key.startswith('on') or 'href' in key for key in element.attrib):
            raise ValueError(f'Unexpected SVG attribute in {name}')
    icons[name] = re.sub(r'<!--.*?-->', '', raw, flags=re.S).strip().replace('<svg', '<svg aria-hidden="true" focusable="false"', 1)
license_text = (assets / 'LICENSE.txt').read_text(encoding='utf-8')
(ui / 'operation-icons.js').write_text(
    f"// Official Lucide SVGs, lucide-static {provenance['version']}. See icons/lucide/LICENSE.txt.\n"
    + 'const icons = ' + json.dumps(icons) + ';\n'
    + 'export const iconLicense = ' + json.dumps(license_text) + ';\n'
    + 'export function operationIcon(name){return icons[name] || icons.box;}\n', encoding='utf-8')
print(f'Bundled {len(icons)} icons with license notices.')
