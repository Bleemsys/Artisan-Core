Projects, geometry and file paths
*********************************

Open and save a project
=======================

Choose **Open** to load a workflow JSON file. ArtGUI reads ``Setup``, numbered
``WorkFlow`` steps and ``PostProcess`` into the interface. **New** starts an
empty workflow. New and Open ask before discarding unsaved changes.

**Save** writes the current project. A new project opens a file dialog so you
can choose its name and folder. An opened project saves back to its existing
path. To create a variation of an existing design, make a copy in your file
manager and open that copy before editing.

Project attachments are saved as file references in an additional ``ArtGUI``
section. ArtGUI excludes that section from the workflow sent to the backend.
Geometry and supporting files are not embedded in the JSON; keep them with the
project when sharing or moving it.

Choose the right way to add a file
==================================

.. list-table:: File actions
   :widths: 30 70
   :header-rows: 1

   * - Action
     - Effect
   * - **Load source**
     - Selects the workflow geometry, sets Type to Geometry and updates
       ``Setup.Geomfile``. Use this when changing the shape used for generation.
   * - **Geometry → + Add**
     - Adds reference geometry without replacing the workflow source.
   * - **Load result**
     - Loads an output as a result layer and records it in Geometry.
       It does not change ``Setup.Geomfile``.
   * - **Supporting files → + Add**
     - Attaches field data, point clouds, cell files or other inputs for
       organisation. Set the consuming operation's file parameter separately.
   * - **Preview mesh**
     - Loads or reloads the selected supported mesh in the viewer.
   * - **Remove from project**
     - Removes an attachment and its preview. The file remains on disk.

Click a geometry entry to inspect it. Properties show its path and, after
loading, mesh counts and original-coordinate bounds. A loaded mesh also has
a visibility checkbox. Supported meshes attached as supporting files can be
previewed too.

On reopening a project, the source loads automatically when available. Select
other attached geometries to load them as needed. A reference mesh does not
participate in generation simply because it is visible in the scene.

Understand the working directory
================================

An **absolute path**, such as ``C:/Models/bracket.stl``, identifies a file
directly. A **relative path**, such as ``sample-obj/EngineBracket.STL``, is
interpreted from a starting folder. Choose that starting folder deliberately.

.. list-table:: JSON working directory (``Setup.JsonWorkDir``)
   :widths: 22 43 35
   :header-rows: 1

   * - Value
     - Starting folder for Artisan relative paths
     - Use when
   * - ``false`` / Disabled
     - The selected backend's working directory.
     - Using a package example arranged around ``ArtisanMain.exe``.
   * - ``true`` / Enabled
     - The folder containing the saved project JSON.
     - Keeping each project and its inputs in a self-contained folder.
   * - Directory string
     - A custom working directory interpreted by Artisan.
     - Maintaining an advanced workflow that already specifies a directory.

For example, keep the supplied engine-bracket JSON in ``Test_json`` with
``false`` and select the backend in the parent ``Artisan_Dist`` folder. To
switch that same JSON to ``true``, update its relative paths accordingly::

   Geomfile: ../sample-obj/EngineBracket.STL
   outfile:  ../Test_results/EngineBracket_trial.stl

These two lines illustrate path values; they are not a complete JSON object.
Alternatively, browse to absolute input and output paths. Absolute paths are
easy to check locally but usually need updating on another computer.

.. important::

   A successful viewer preview is not proof that every engine path is correct.
   Check the working-directory setting and all inputs, including files inside
   imported definitions and operation presets. The viewer can locate files
   using additional search locations.

Set up a new design
===================

#. Choose **New**, then **Load source** to select your geometry.
#. Select **Project settings** and set the resolution and compute options.
#. Save the project in its intended folder and decide whether relative paths
   should start there.
#. Add your operations, keeping inputs and definitions before their uses.
#. Add an **Export model** operation with a distinct output filename.
#. Save, generate and load the output to inspect it.

For a design defined by a box domain rather than an input file, choose
**Type = Sample**. Set lower and upper X, Y and Z bounds; every upper value
must be greater than its corresponding lower value. Sample mode uses the
workflow's ``Sample`` settings. Additional settings not shown by the form can
be edited through **JSON**.

Resolution and post-processing
==============================

Resolution controls the spacing used to sample the implicit model, not the
lattice unit-cell size. Smaller spacing can resolve finer details but increases
calculation and memory demands. Keep an established example's settings until
you have a successful baseline.

**Use GPU** requests engine GPU use; it does not install or configure GPU
support. **Memory limit (bytes)** is passed to Artisan as its computation
setting, not a cap on the whole ArtGUI application's memory.

The **Post process** section exposes the workflow's post-processing options.
In the engine-bracket example, **Combine Meshes** and **Remove Isolated Parts**
are enabled. Removing isolated parts can remove disconnected components, so
review the result if the design intentionally contains separate pieces.
