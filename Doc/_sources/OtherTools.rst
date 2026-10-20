Tools
*****

======
ArtGUI
======

ArtGUI is the desktop workbench for designing lattices with Artisan. It brings
together a Project panel, an editable Workflow, a Properties panel and a 3D
Workspace. You can open and save JSON workflows, add operations, edit parameters,
define custom unit cells, and compare source geometry with generated results.
The interface supports English and Chinese. HDF5 field snapshots can also be
inspected using slices and a value probe.

Start the application with ``ArtGUI.exe``. ArtGUI provides the editor and viewer;
the Artisan backend performs the calculations. Select a compatible backend
through **Backend…** before generating a model. Existing mesh results and field
snapshots can be inspected without rerunning Artisan.

The current **ArtGUI 0.1.1** workbench uses Tauri and a web-based 3D viewer.
For a short walkthrough, see :doc:`ArtGUI/quickstart`. The full
:ref:`ArtGUI user guide <chapter-ArtGUI>` covers projects, workflow editing,
lattice definitions, generation and viewing results.
