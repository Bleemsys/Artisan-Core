# Artisan API Usage

Use this file when the user wants to call Artisan from Python or C++ rather than only running JSON workflows from the CLI.

## CLI

Run a JSON workflow from the Artisan `Src` directory:

```bash
python ArtisanMain.py -f .//Test_json//Basic//Sample_Box.json
```

Check version:

```bash
python ArtisanMain.py -v
```

Launch GUI:

```bash
python ArtGUI.py
```

If the package is an independent package, in other words, if no ArtisanMain.py exists, check ArtisanMain.exe, and run a JSON workflow from current directory:

```bash
ArtisanMain.exe -f .//Test_json//Basic//Sample_Box.json
```

Check version:

```bash
ArtisanMain.exe -v
```

Launch GUI:

```bash
ArtGUI.exe
```

## Python API

Artisan exposes three main Python access styles from `ArtisanMain.py`.

### Run

Use `Run(filename)` when the workflow is already stored in a JSON file.

Reference examples:

- `Interfaces/Python/Artisan_Example_01.py`
- `Doc/_build/html/_sources/API.rst`

### Execution

Use `Execution(json_string, logfilename)` when the workflow is built as a Python dictionary/string and passed directly.

Reference examples:

- `Interfaces/Python/Artisan_Example_02.py`
- `Doc/_build/html/_sources/API.rst`

### ArtisanModel And WorkItem

Use `ArtisanModel()` for stepwise operations, intermediate geometry extraction, or API integration.

Typical pattern:

1. `Model = ArtisanModel()`
2. `Model.Setup(cmd_setup)`
3. `Model.WorkItem(cmd_workitem)` for each operation
4. `Model.ExtractSurf()` when vertices/faces are needed

Reference examples:

- `Interfaces/Python/Artisan_Example_03.py`
- `Interfaces/Python/Artisan_Example_04.py`

## C++ API

C++ examples embed Python and call Artisan functions from `ArtisanMain.py`.

Reference examples:

- `Interfaces/Cpp/src/Artisan_Example_01.cpp`
- `Interfaces/Cpp/src/Artisan_Example_02.cpp`
- `Interfaces/Cpp/src/Artisan_Example_03.cpp`
- `Interfaces/Cpp/CMakeLists.txt`

Important: C++ builds must link Python and include NumPy headers as shown in the CMake example.
