"""Build ArtGUI's catalog from source RST manuals and example workflows.

Run with the Artisan Python environment; only the standard library is needed.
Python's JSON decoder distinguishes 5.0 (float) from 5 (int). Each preset stores
both a JSON text copy and numeric type metadata, since JavaScript numbers do not.
"""
import argparse
import json
import re
import textwrap
from collections import defaultdict
from pathlib import Path

COMMAND = re.compile(r'^(?:Add_|Subtract_|Substract_|Intersect_|Check_|Define_|Gen_|Proc_Mesh_|OP_|HS_|Lin_|Field_|Inv_)[A-Za-z0-9_]+$')
STANDALONE = {'Export', 'ExportMeshID', 'ReadMesh', 'RemoveMesh', 'ReadGridField', 'Evaluate_Points', 'GeomFill'}


def numeric_types(value, pointer=''):
    if type(value) in (int, float):
        return {pointer: 'float' if type(value) is float else 'integer'}
    result = {}
    entries = enumerate(value) if isinstance(value, list) else value.items() if isinstance(value, dict) else []
    for key, child in entries:
        escaped = str(key).replace('~', '~0').replace('/', '~1')
        result.update(numeric_types(child, pointer + '/' + escaped))
    return result


def operations_in(obj, known):
    if not isinstance(obj, dict):
        return
    if isinstance(obj.get('WorkFlow'), dict):
        for step, commands in obj['WorkFlow'].items():
            if isinstance(commands, dict):
                for keyword, params in commands.items():
                    if isinstance(params, dict) and not keyword.isdecimal():
                        yield keyword, params, str(step)
    elif obj and all(str(k).isdecimal() for k in obj):
        yield from operations_in({'WorkFlow': obj}, known)
    else:
        for keyword, params in obj.items():
            if isinstance(params, dict) and (keyword in known or keyword in STANDALONE or COMMAND.fullmatch(keyword)):
                yield keyword, params, None


def rst_blocks(path):
    lines = path.read_text(encoding='utf-8-sig').expandtabs(4).splitlines()
    for i, line in enumerate(lines):
        if not re.match(r'^\s*\.\.\s+(?:code-block|code)::\s*json\s*$', line):
            continue
        j = i + 1
        while j < len(lines) and (not lines[j].strip() or lines[j].lstrip().startswith(':')):
            j += 1
        start, base = j, len(line) - len(line.lstrip())
        while j < len(lines) and (not lines[j].strip() or len(lines[j]) - len(lines[j].lstrip()) > base):
            j += 1
        yield i + 1, textwrap.dedent('\n'.join(lines[start:j])).strip()


def decode_block(text):
    try:
        return [json.loads(text)], 'complete'
    except ValueError:
        pass
    # RST often shows a property or numbered step without its outer braces.
    try:
        return [json.loads('{' + text + '}')], 'property fragment'
    except ValueError:
        pass
    # Ignore trailing commas only outside quoted strings; never alter the source.
    cleaned = re.sub(r'("(?:\\.|[^"\\])*")|,(?=\s*[}\]])', lambda m: m[1] or '', text)
    if cleaned != text:
        try:
            return [json.loads(cleaned)], 'trailing comma removed for extraction'
        except ValueError:
            pass
    # Recover complete objects from an incomplete illustrative workflow.
    # The caller accepts only operation/step/workflow objects, not arbitrary params.
    objects, decoder = [], json.JSONDecoder()
    for token in re.finditer(r'"(?:\\.|[^"\\])*"|\{', cleaned):
        if token[0] == '{':
            try:
                obj, _ = decoder.raw_decode(cleaned, token.start())
                objects.append(obj)
            except ValueError:
                pass
    return objects, 'complete objects recovered' if objects else 'unreadable illustration'


def load_categories():
    definitions = json.loads(Path(__file__).with_name('operation_categories.json').read_text(encoding='utf-8'))['categories']
    by_keyword = {}
    for definition in definitions:
        for keyword in definition['keywords']:
            if keyword in by_keyword:
                raise ValueError(f'Duplicate category assignment: {keyword}')
            by_keyword[keyword] = definition['name']
    return definitions, by_keyword


def generate(root, output):
    category_definitions, category_by_keyword = load_categories()
    labels = json.loads(Path(__file__).with_name('operation_labels.json').read_text(encoding='utf-8'))
    metadata = json.loads(Path(__file__).with_name('operation_metadata.json').read_text(encoding='utf-8'))
    candidates = defaultdict(list)
    issues, example_files, doc_files = [], [], []
    block_count = 0

    def add(obj, source, kind, mode='complete'):
        for keyword, params, step in operations_in(obj, candidates):
            candidates[keyword].append({'params': params, 'source': source, 'kind': kind, 'step': step, 'extraction': mode})

    for path in sorted((root / ('Src/Test_json' if (root / 'Src/Test_json').is_dir() else 'Test_json')).rglob('*.json')):
        source = path.relative_to(root).as_posix()
        example_files.append(source)
        try:
            add(json.loads(path.read_text(encoding='utf-8-sig')), source, 'example')
        except (ValueError, OSError) as error:
            issues.append({'source': source, 'issue': str(error)})

    for path in sorted((root / 'Doc').rglob('*.rst')):
        if '_build' in path.relative_to(root / 'Doc').parts:
            continue  # Do not include stale copies of the same manual.
        doc_files.append(path.relative_to(root).as_posix())
        for line, block in rst_blocks(path):
            block_count += 1
            source = path.relative_to(root).as_posix() + ':' + str(line)
            objects, mode = decode_block(block)
            for obj in objects:
                add(obj, source, 'manual', mode)
            if mode not in ('complete', 'property fragment'):
                issues.append({'source': source, 'issue': mode})

    def rank(candidate):
        # A complete tutorial/manual example is a starting preset, not a claim
        # about engine defaults. Retain alternatives rather than mixing schemas.
        return (candidate['extraction'] != 'complete', candidate['kind'] != 'manual',
                '/QStart/' not in candidate['source'], candidate['source'], candidate['step'] or '')

    catalog, conflicts = [], []
    for keyword, items in sorted(candidates.items()):
        unique, observations = {}, defaultdict(set)
        for item in sorted(items, key=rank):
            params = item['params']
            encoded = json.dumps(params, ensure_ascii=False, sort_keys=True, allow_nan=False)
            types = numeric_types(params)
            source = item['source'] + (f" · step {item['step']}" if item['step'] else '')
            if encoded not in unique:
                unique[encoded] = {'label': source, 'params': params, 'paramsJson': json.dumps(params, ensure_ascii=False, allow_nan=False), 'numberTypes': types, 'sources': []}
            if source not in unique[encoded]['sources']:
                unique[encoded]['sources'].append(source)
            for pointer, number_type in types.items():
                observations[pointer].add(number_type)
        presets = list(unique.values())
        first = presets[0]
        source_list = sorted({item['source'] for item in items})
        catalog.append({**metadata.get(keyword, {'icon': 'box', 'description': 'Configure this Artisan operation.', 'searchTerms': []}), 'keyword': keyword, 'label': labels.get(keyword, keyword.replace('_', ' ')), 'category': category_by_keyword.get(keyword, 'Uncategorized'), 'template': first['label'],
                        'params': first['params'], 'paramsJson': first['paramsJson'], 'numberTypes': first['numberTypes'],
                        'sources': source_list, 'presets': presets})
        for pointer, types in observations.items():
            if len(types) > 1:
                conflicts.append({'keyword': keyword, 'parameter': pointer, 'types': sorted(types), 'resolution': 'Preserve the type of each source preset; no global coercion.'})

    category_order = {definition['name']: index for index, definition in enumerate(category_definitions)}
    catalog.sort(key=lambda item: (category_order.get(item['category'], len(category_order)), item['keyword'].lower()))
    categories = [{key: definition[key] for key in ('name', 'description', 'references')} | {
        'count': sum(op['category'] == definition['name'] for op in catalog)
    } for definition in category_definitions]
    unclassified = [op['keyword'] for op in catalog if op['category'] == 'Uncategorized']
    if unclassified:
        categories.append({'name': 'Uncategorized', 'description': 'New operations awaiting a category assignment.', 'references': [], 'count': len(unclassified)})
    info = {'operationCount': len(catalog), 'exampleFiles': len(example_files), 'manualFiles': len(doc_files),
            'manualJsonBlocks': block_count, 'presetCount': sum(len(op['presets']) for op in catalog),
            'numericPolicy': 'Decimal/exponent JSON tokens are floats; integer tokens stay integers. Presets retain their own types.',
            'categories': categories}
    output.mkdir(parents=True, exist_ok=True)
    (output / 'operations.js').write_text('// Generated by scripts/generate_operations.py. Do not edit by hand.\nwindow.ARTISAN_CATALOG_INFO = ' + json.dumps(info, indent=2) + ';\nwindow.ARTISAN_OPERATIONS = ' + json.dumps(catalog, ensure_ascii=False, indent=2, allow_nan=False) + ';\n', encoding='utf-8')
    report = {**info, 'keywords': [op['keyword'] for op in catalog], 'sourceIssues': issues, 'numericTypeVariations': conflicts,
              'manualSources': doc_files, 'exampleSources': example_files,
              'unclassifiedKeywords': unclassified,
              'categoryAssignmentsWithoutSource': sorted(set(category_by_keyword) - set(candidates))}
    (output.parent / 'operations-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return info


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artisan-root', type=Path, default=next((p for p in Path(__file__).resolve().parents if (p / 'Doc').is_dir() and ((p / 'Src/Test_json').is_dir() or (p / 'Test_json').is_dir())), Path(__file__).resolve().parents[3]))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'ui')
    args = parser.parse_args()
    if not (args.artisan_root / 'Doc').is_dir() or not ((args.artisan_root / 'Src/Test_json').is_dir() or (args.artisan_root / 'Test_json').is_dir()):
        parser.error('--artisan-root must contain Doc and either Test_json or Src/Test_json')
    print(json.dumps(generate(args.artisan_root, args.output), indent=2))
