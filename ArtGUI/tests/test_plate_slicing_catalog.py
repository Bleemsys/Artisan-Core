import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

PROJECT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('plate_catalog_generator', PROJECT / 'scripts/generate_operations.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def catalog(path):
    text = path.read_text(encoding='utf-8')
    return {op['keyword']: op for op in json.loads(text.split('window.ARTISAN_OPERATIONS = ', 1)[1].strip().removesuffix(';'))}


class PlateSlicingCatalogTests(unittest.TestCase):
    def test_downloadable_workflow_supplies_nested_and_empty_presets(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'Src/Test_json').mkdir(parents=True)
            examples = root / 'Doc/examples'
            examples.mkdir(parents=True)
            source = PROJECT / 'tests/fixtures/plate-slicing.json'
            (examples / 'PlateSlicing_Full.json').write_bytes(source.read_bytes())
            generator.generate(root, root / 'gui/ui')
            commands = catalog(root / 'gui/ui/operations.js')
            workflow = json.loads(source.read_text())['WorkFlow']
            for step in workflow.values():
                for keyword, params in step.items():
                    self.assertTrue(any(preset['params'] == params for preset in commands[keyword]['presets']), keyword)
            self.assertEqual(commands['Clear_LatticeField']['params'], {})
            self.assertTrue(any(preset['params']['Cutters']['A'] == 'H01_V01_cut_H'
                                for preset in commands['Gen_SlotCutters']['presets']))

    def test_standalone_clear_and_store_are_not_dropped(self):
        for keyword, params in [('Clear_LatticeField', {}), ('Store_LatticeMesh', {'MeshID': 'Plate'})]:
            self.assertEqual(list(generator.operations_in({keyword: params}, {})), [(keyword, params, None)])

    def test_refresh_preserves_other_commands_and_adds_field_variants(self):
        commands = catalog(PROJECT / 'ui/operations.js')
        slices = commands['Proc_BoxSlices']['presets']
        self.assertTrue(any('outfile' in preset['params'] for preset in slices))
        self.assertTrue(any(preset['params'].get('Target') == 'FieldContainer' and
                            all('FieldID' in box for box in preset['params']['Boxes']) for preset in slices))
        for keyword in ('Add_Geometry', 'Subtract_Geometry'):
            presets = commands[keyword]['presets']
            self.assertTrue(any('Name' in preset['params'] for preset in presets))
            self.assertTrue(any(preset['params'].get('Source', {}).get('Type') == 'Field' for preset in presets))
        for keyword in ('Gen_SlotCutters', 'Clear_LatticeField', 'Store_LatticeMesh'):
            self.assertIn('PlateSlicing_TwoPlates.json', commands[keyword]['template'])
            self.assertNotEqual(commands[keyword]['category'], 'Uncategorized')


if __name__ == '__main__':
    unittest.main()
