"""Run with python -m unittest discover -s tests -p test_operation_catalog.py."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

PROJECT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('generate_operations', PROJECT / 'scripts/generate_operations.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class OperationCatalogTests(unittest.TestCase):
    def test_field_mesher_presets_use_matching_complete_conformal_example(self):
        catalog = json.loads((PROJECT / 'ui/operations.js').read_text(encoding='utf-8').split('window.ARTISAN_OPERATIONS = ')[1].strip().removesuffix(';'))
        commands = {op['keyword']: op for op in catalog}
        scalar = commands['Define_ScalarField_CombineGeometry']
        tet = commands['Gen_TetMesh_SizeField']
        self.assertEqual(scalar['category'], 'Fields')
        self.assertEqual(tet['category'], 'Volume meshing')
        self.assertEqual(tet['params']['size_field'], scalar['params']['field_id'])
        self.assertEqual(tet['params']['export_mesh'], 'TetDomains')
        for operation in (scalar, tet):
            self.assertIn('TetSizeField_Conformal.json', operation['template'])
            self.assertTrue(generator.REQUIRED_PRESET_FIELDS[operation['keyword']] <= operation['params'].keys())

    def test_starter_and_incomplete_example_handling(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'Doc').mkdir()
            examples = root / 'Src/Test_json'
            examples.mkdir(parents=True)
            (examples / 'test.json').write_text(json.dumps({'WorkFlow': {
                '1': {'GeomBuild': {'Geomfile': 'custom.stl'}},
                '2': {'Add_Lattice': {'la_name': 'Cubic'}},
            }}))
            output = root / 'gui/ui'
            generator.generate(root, output)
            report = json.loads((output.parent / 'operations-report.json').read_text())
            catalog = json.loads((output / 'operations.js').read_text().split('window.ARTISAN_OPERATIONS = ')[1].strip().removesuffix(';'))
            commands = {op['keyword']: op for op in catalog}
            self.assertEqual(commands['GeomBuild']['params'], {'Geomfile': 'custom.stl'})
            self.assertNotIn('GeomBuild', report['starterTemplateKeywords'])
            self.assertIn('GeomFill', report['starterTemplateKeywords'])
            self.assertNotIn('Add_Lattice', commands)
            self.assertTrue(any('Skipped incomplete preset' in x['issue'] for x in report['sourceIssues']))

    def test_every_preset_preserves_numeric_types(self):
        catalog = json.loads((PROJECT / 'ui/operations.js').read_text(encoding='utf-8').split('window.ARTISAN_OPERATIONS = ')[1].strip().removesuffix(';'))
        for operation in catalog:
            for preset in operation['presets']:
                with self.subTest(keyword=operation['keyword'], preset=preset['label']):
                    values = json.loads(preset['paramsJson'])
                    self.assertEqual(values, preset['params'])
                    self.assertEqual(generator.numeric_types(values), preset['numberTypes'])

    def test_catalog_has_complete_display_metadata(self):
        catalog = json.loads((PROJECT / 'ui/operations.js').read_text(encoding='utf-8').split('window.ARTISAN_OPERATIONS = ')[1].strip().removesuffix(';'))
        keywords = [operation['keyword'] for operation in catalog]
        self.assertEqual(len(set(keywords)), len(keywords))
        for operation in catalog:
            self.assertNotEqual(operation['category'], 'Uncategorized')
            self.assertNotEqual(operation['description'], 'Configure this Artisan operation.')


if __name__ == '__main__':
    unittest.main()
