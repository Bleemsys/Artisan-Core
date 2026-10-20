.. _export-guide:

Export
******

Use ``Export`` to save the current lattice surface or sampled scalar fields.
Use ``ExportMeshID`` to save a mesh already stored in the mesh container.
Put these commands in ``WorkFlow`` after the result you want to save.

Export a surface or field
=========================

.. code-block:: json

   {"Export": {"outfile": "./Test_results/part.stl"}}

.. list-table:: Export parameters
   :header-rows: 1
   :widths: 25 75

   * - Keyword
     - Meaning
   * - ``outfile``
     - Required output path. A mesh extension saves the lattice surface;
       ``.h5`` or ``.hdf5`` saves scalar fields only.
   * - ``fieldfile``
     - Optional HDF5 path to save fields alongside a mesh.
   * - ``GridFieldIDs``
     - Optional list of named scalar fields to include in HDF5. Default: ``[]``.
       IDs must exist and be distinct; ``lattice`` is reserved.

Surface formats: ``.stl``, ``.obj``, ``.ply``, ``.off``, ``.vtk``, ``.vtu``,
``.inp``, ``.msh``, ``.mesh`` and ``.med``. These outputs contain triangles,
even when the file extension is commonly used for volume meshes.

See :ref:`HDF5 field snapshots` for field export, the file layout and readback.

Control surface output
======================

Put these options in the top-level ``PostProcess`` section:

.. code-block:: json

   {"PostProcess": {
     "CombineMeshes": true,
     "CleanExportedMesh": true,
     "RemovePartitionMeshFile": true,
     "RemoveIsolatedParts": false,
     "ExportLazPts": false
   }}

.. list-table:: PostProcess options
   :header-rows: 1
   :widths: 35 65

   * - Keyword
     - Meaning
   * - ``CombineMeshes``
     - Combine computation partitions into the requested mesh file.
       If false, retain separate VTU partition files.
   * - ``CleanExportedMesh``
     - Merge identical vertices and remove degenerate triangles and unused
       vertices. Optional; default: false. Does not repair holes.
   * - ``RemovePartitionMeshFile``
     - Delete intermediate partition meshes after successful combination.
       Requires ``CombineMeshes: true``.
   * - ``RemoveIsolatedParts``
     - Remove disconnected parts during combination. Keep false when separate
       components are intentional.
   * - ``ExportLazPts``
     - Required compatibility option; keep false. The current export path
       does not generate LAZ point clouds.

These options affect surface meshes, not HDF5 fields or ``ExportMeshID``.


.. _clean-exported-mesh:

Clean exported surface meshes
-----------------------------

The basic cleanup:

* Merges vertices with exactly identical coordinates.
* Removes triangles with repeated vertices or zero area.
* Removes unused vertices.

For STL, cleanup uses the float32 coordinates that will be written to the file.
It uses no distance or area threshold, so valid thin triangles are preserved.
Numerically ambiguous triangles are retained conservatively. The routine does
not fill holes, repair non-manifold edges, remove duplicate faces, correct
winding, smooth the surface, or detect self-intersections.

Cleanup runs after mesh combination and any requested isolated-part removal.
With ``CombineMeshes: false``, it cleans each retained VTU partition separately;
open edges at partition boundaries are expected. HDF5 fields, mesh-container
snapshots and direct mesher or skeleton exports are unaffected.

The log reports the changes and before/after counts of boundary, non-manifold
and inconsistent-winding edges. These checks do not guarantee a watertight,
fully valid surface. Invalid input or an empty cleaned export fails before
replacing an existing output. Partition files are removed only after a
successful write.

The cleanup also has an independent Python API backed by C++, with no new
third-party mesh-repair library:

.. code-block:: python

   from Artisan.mesh_cleanup import clean_surface_mesh

   vertices, triangles, report = clean_surface_mesh(
       vertices, triangles, float32_coordinates=True)

Use ``float32_coordinates=True`` for STL; the default is ``false`` for float64
coordinates. Input arrays are not modified. Source builds need the updated
Snippetslib extension; older standalone executables must be rebuilt to include
this feature. See :ref:`graded-tet-lattice` for a complete workflow.

Export a stored mesh
====================

.. code-block:: json

   {"ExportMeshID": {
     "MeshID": "TetDomains",
     "out_meshfile": "./Test_results/domains.inp",
     "elem_type": "Tet"
   }}

``MeshID`` selects an existing mesh, ``out_meshfile`` sets the output path,
and ``elem_type`` selects its element type, such as ``Triangle`` or
``Tet``. See :ref:`Mesh Container` for mesh storage and
:doc:`FEAInter` for conformal beam and shell exports.

HDF5 field snapshots
====================

To save a surface and fields together:

.. code-block:: json

    {"Export": {
        "outfile": "./Test_results/part.stl",
        "fieldfile": "./Test_results/part.h5",
        "GridFieldIDs": ["SizeField"]
    }}

For fields only, set ``outfile`` to an ``.h5`` or ``.hdf5`` path and omit
``fieldfile``.

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
