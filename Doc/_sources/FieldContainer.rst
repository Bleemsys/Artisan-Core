.. _gridfieldcontainer:
Grid Field Container
********************

Artisan provides an infrastructure for managing multiple grid fields within a unified container. Users can perform operations directly on these fields, which can then be reused for lattice construction or various geometric operations. Grid field shares the exactly same data structure with the lattice field. Data points with associated field values can be fitted into a field and stored in the container. These stored fields can then be referenced as variables within field-related expressions.

The example :code:`.\\Test_json\\FieldContainer\\FitField\\FitField.json` demonstrates how to fit a field into the contain variable, perform the mathematical operation, export the field, and re-import the field. 

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[0.0,10.0],[0.0,10.0],[0.0,10.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.1,0.1,0.1],
                "Padding": 2,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
     "WorkFlow":{
          "1": {
                "OP_Fit_GridField":{
                     "inp_ptFieldFile": ".//Test_json//FieldContainer//FitField//cube_points_sdf.csv",
                     "out_gridFieldFile": "SphereSDF"
               }
		   },
          "2":{
                "OP_ExprOperation_GridField":{
                    "expression":"SphereSDF + 10",
                    "out_gridFieldFile": ".//Test_results//OPdGridField.csv"
            }
           },
           "3":{
                "ReadGridField":{
                    "inp_GridFieldFile": ".//Test_results//OPdGridField.csv",
                    "Gridfield_ID": "GridField"
            }
           },
           "4":{
                "OP_ExprOperation_GridField":{
                    "expression":"GridField + 1",
                    "out_gridFieldFile": ".//Test_results//OPdGridField_02.csv"
                }
           }
        },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false, 
                "ExportLazPts": true}
    }

Above JSON workflow includes three keywords :code:`OP_Fit_GridField`, :code:`OP_ExprOperation_GridField` and :code:`ReadGridField`. Above workflow does the following operation.

 - Work item :code:`1` with :code:`ŌP_Fit_GridField` fits the data points into the grid field. 
 - Work item :code:`2` with :code:`OP_ExprOperation_GridField` conducts the mathematical operation on the fitted field, and exports the results field into a file.
 - Work item :code:`3` with :code:`ReadGridField` read the field back to grid field container.  
 - Work item :code:`4` with :code:`OP_ExprOperation_GridField` conduct another mathematical operation and export the field into a new file.

Please note that above keywords in the workflow were for demonstration purpose. The resultant field in these keywords can be ID for future reference. 

The parameters of :code:`ŌP_Fit_GridField` is explained below. 

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`inp_ptFieldFile`
     - A file path string to the data points. 
   * - :code:`out_gridFieldFile`
     - A field id that can be referenced in future and this field saves the fitted data, or a file path string to export the fitted field data.

The parameters of :code:`OP_ExprOperation_GridField` is explained below. 

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`expression`
     - mathematical expression. The field id can referenced in this expression. The supported mathematical functions are :code:`sin`, :code:`cos`, :code:`tan`, :code:`asin`, :code:`acos`, :code:`atan`, :code:`sinh`, :code:`cosh`, :code:`tanh`, :code:`exp`, :code:`log`, :code:`log10`, :code:`sqrt`, :code:`abs`, :code:`arcsin`, :code:`arccos`, :code:`arctan`. The supported constants are :code:`x`, :code:`y`, :code:`z` and :code:`pi`.
   * - :code:`out_gridFieldFile`
     - A fitted field id, or a file path string to export the fitted field data.

The parameter of :code:`ReadGridField` is explained below. 

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`inp_GridFieldFile`
     - A file path string to the grid field file. 
   * - :code:`Gridfield_ID`
     - The required destination name for the loaded field in Artisan's grid-field container. Later operations reference this name.

Two exported field data files were generated, :code:`OPdGridField.csv` and :code:`OPdGridField_02.csv`, as shown below on the left and right, respectively. In :code:`OPdGridField_02.csv`, the field value was added :code:`1` to the value of the field :code:`OPdGridField.png`. This is exactly same as what defined in the workflow. 

.. image:: ./pictures/OPdGridField.png
   :width: 45%
   :align: left

.. image:: ./pictures/OPdGridField_02.png
   :width: 45%
   :align: right

In Artisan 0.2.14, the grid field container introduces support for defining field-driven TPMS lattices. Future development will focus on extending grid field capabilities to other keywords and applications.

HDF5 field snapshots
====================

``Export`` supports mesh output, HDF5 output, or both. Existing workflows with
only a mesh ``outfile`` retain their mesh export and postprocessing behavior.
The ``outfile`` parameter remains required; ``fieldfile`` and ``GridFieldIDs``
are optional. An ``outfile`` ending in ``.h5`` or ``.hdf5`` selects HDF5-only
output. Otherwise, ``fieldfile`` adds HDF5 output alongside the mesh:

.. code-block:: json

    {"Export": {
        "outfile": "./Test_results/part.stl",
        "fieldfile": "./Test_results/part.h5",
        "GridFieldIDs": ["SizeField"]
    }}

HDF5 contains the current lattice scalar field, when present, and the selected
named fields. ``GridFieldIDs`` defaults to an empty list. Selected IDs must exist
at the export step and be distinct. ``lattice`` is reserved for the current
lattice field. An HDF5-only export requires at least one available scalar field;
it can export selected fitted fields before a lattice has been constructed.
``GridFieldIDs`` requires an HDF5 destination. A second ``fieldfile`` is not
accepted when ``outfile`` already selects HDF5.

Each export step captures independent sampled values before later operations
modify them. Workflow outputs are published during postprocessing, so an HDF5
snapshot from the same running workflow cannot be read before postprocessing.
Use a subsequent workflow or SDK call to read the completed file.

The format is ``Artisan.GridField``, version 1. Root attributes record format,
Artisan version, workflow step, UTC creation time, block count and completion.
The layout for a regular grid is:

.. code-block:: text

    /fields/lattice/blocks/000000/x
    /fields/lattice/blocks/000000/y
    /fields/lattice/blocks/000000/z
    /fields/lattice/blocks/000000/values
    /fields/SizeField/blocks/000000/x
    /fields/SizeField/blocks/000000/y
    /fields/SizeField/blocks/000000/z
    /fields/SizeField/blocks/000000/values

``values[i,j,k]`` is associated with the point ``(x[i], y[j], z[k])``.
The dimension order is ``xyz``; C buffers have z varying fastest. Axes retain
their actual coordinates, including nonuniform spacing. Values retain float32
or float64 precision, including NaN and infinity. Scalar datasets use chunks up
to 64 by 64 by 64, gzip level 1, shuffle and Fletcher32 checksums. Finite-value
minimum, maximum and counts, plus NaN and infinity counts, support inspection.
Unknown coordinate/value units are recorded as empty strings rather than
assumed. Field attributes also record source, labels and coordinate space.
Local coordinates require a finite, invertible affine ``grid_to_model`` 4x4
matrix, stored on each block. The reader preserves this transform; it does not
apply it automatically. Consumers requiring model coordinates must explicitly
transform/resample the field first.

For a deformed structured grid, ``grid_kind="structured"`` uses three dense
datasets ``coordinates/x``, ``coordinates/y`` and ``coordinates/z`` alongside
``values``. The writer streams these arrays in chunks instead of flattening
them into a coordinate table. Rectilinear grids use compact axis vectors.
Container IDs are percent-encoded as a single group component; the original
ID is retained in the field's ``field_id`` attribute.

Partitioned runs store one block group per computation partition in a single
file per export step. Blocks are not automatically stitched or resampled:
actual spacing may differ between partitions. For fields on the current lattice
grid, block attributes include ``core_bounds``, ``global_bounds``, requested
padding and spacing, and an ownership rule. Padding values remain in the file.
The core lower boundary is inclusive and upper boundary exclusive, except for
the global upper boundary, which is inclusive. Independent saved grids retain
their own coordinates and do not receive unrelated partition ownership bounds.

HDF5 export works even when there is no zero-level mesh surface. Mesh cleanup
options affect mesh output only. Each HDF5 file is written to a private temporary
file and atomically replaces its destination after all requested blocks are
complete. Failed HDF5 writes preserve the previous HDF5 destination. Mesh and
HDF5 outputs are individually published; they are not a transaction across
multiple files. Reusing a destination in different export steps is rejected
before calculation.

Reading HDF5
------------

``FieldID`` selects the saved field in the HDF5 file. ``Gridfield_ID`` names
the loaded field inside Artisan.

.. list-table:: ReadGridField field identifiers
   :widths: 20 45 15 20
   :header-rows: 1

   * - Parameter
     - Meaning
     - Example
     - Default
   * - ``FieldID``
     - Selects the field saved in the HDF5 file.
     - ``SizeField``
     - ``lattice`` (optional)
   * - ``Gridfield_ID``
     - Names the loaded field in Artisan's grid-field container.
     - ``LoadedSize``
     - Required; no default

.. code-block:: json

    {"ReadGridField": {
        "inp_GridFieldFile": "./Test_results/part.h5",
        "Gridfield_ID": "LoadedSize",
        "FieldID": "SizeField",
        "BlockID": 0
    }}

This example reads the saved ``SizeField`` into the container as ``LoadedSize``.
Later expressions reference ``LoadedSize``, for example ``LoadedSize + 1``.
The two names may be the same. Existing CSV input uses ``Gridfield_ID`` only;
``FieldID`` and ``BlockID`` apply to HDF5 input.

``FieldID`` defaults to ``lattice``. ``BlockID`` may be omitted for a single-block
file and is required for a partitioned file. The selected block is loaded into
memory with its saved coordinates and shape; it is not silently reshaped onto
the current lattice grid. Incomplete files and unsupported formats/layouts are
rejected. Consumers that assume the current lattice grid still require matching
grids. Rectilinear-only consumers reject structured grids, which need explicit
resampling before use. Loading every partition into one dense grid is not part
of this reader.

From ``Src``, run ``Test_json/FieldContainer/HDF5Export/ExportFields.json`` first,
then ``ReadFields.json``. They demonstrate fitted-field storage, combined mesh
and HDF5 export, an independent later snapshot, and HDF5 readback.

Python SDK and packaging
------------------------

Mesh-only SDK ``Export`` keeps its existing Path/None return. HDF5-only SDK
``Export`` returns the HDF5 Path; combined output returns a list of successfully
written mesh/HDF5 Paths. ``API.export_files`` contains the outputs, and workflow
``API.export_results`` includes ``fieldfile`` and ``field_status`` for HDF5.
SDK export captures its currently available grid as one block.

The backend uses h5py, already listed in ``Src/requirements.txt``.
``BuildDist.bat`` explicitly includes h5py in Nuitka's standalone distribution.
Deliver the entire distribution, including h5py extensions and native HDF5
libraries. No separately installed Python interpreter is needed by that
standalone distribution. ArtGUI's Rust reader is a separate frontend change.






