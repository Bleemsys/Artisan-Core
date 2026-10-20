.. _chapter-ArtGUI:

ArtGUI user guide
*****************

ArtGUI is a desktop workbench for preparing lattice designs, running Artisan,
and inspecting the resulting meshes. You can open an existing workflow, change
its parameters, and compare the source geometry with the generated model in
one window.

This guide covers **ArtGUI 0.1.2, the Artisan Workbench interface**. It describes
the workbench with a Project panel, a central 3D Workspace and Workflow, and a
Properties panel. The older ribbon-style ArtGUI interface has different controls.

No JSON editing is needed for the first walkthrough. Start with
:doc:`ArtGUI/quickstart`, then use the other chapters as a reference when you
need them.

Use **中文 / English** at the top right to switch the interface language.
This guide keeps English button names so you can find the same controls in either
language. Screenshots illustrate the core layout; newer controls are described
in the relevant chapters.

.. figure:: ArtGUI/images/workbench.png
   :width: 100%
   :alt: ArtGUI workbench with the engine-bracket geometry, project settings and six workflow steps.

   The engine-bracket example open in ArtGUI. Select a project item or workflow
   step to edit its properties on the right.

Recent workbench updates
========================

* Use **Save as** beside Save to create a project variation; see
  :doc:`ArtGUI/projects`.
* Select a geometry, field or point cloud to adjust only its own opacity in
  Properties. Geometry display colours and opacity settings are saved with
  the project; see :doc:`ArtGUI/viewer`.
* Import CSV/TSV data through **Point clouds → + Add**, or drag a point file
  into the viewer. Point-cloud Properties controls the points, independently
  of the geometry and HDF5 fields.
* Large-model previews adapt as you move the camera. **Clean scratch** beside
  Reset clears temporary preview files from ``ViewScratch``; see
  :doc:`ArtGUI/viewer`.

What you work with
==================

A **project** is a JSON file containing the setup, ordered operations and
post-processing settings. It can also retain ArtGUI references to supporting
files. The **source geometry** provides the shape used by the workflow. The
**result** is a separate file written by an export operation. Loading or moving
the camera around a result does not change the workflow source.

ArtGUI provides the editor and viewer; the Artisan **backend** performs the
calculation. You need a working backend to generate a model, but you can inspect
an existing result without running the calculation again.

.. toctree::
   :maxdepth: 1
   :caption: ArtGUI help

   ArtGUI/quickstart
   ArtGUI/workspace
   ArtGUI/projects
   ArtGUI/workflows
   ArtGUI/lattices
   ArtGUI/generation
   ArtGUI/viewer
   ArtGUI/troubleshooting

Where to find more detail
=========================

This guide explains everyday work in ArtGUI. The rest of the Artisan manual
provides the mathematical definitions and full parameter reference for
individual operations. Useful next chapters are :doc:`QStart/QStart`,
:doc:`Customization/Customization`, :doc:`Mesh`, :doc:`Conformal`, and
:doc:`TransLattice`.

In the application, choose **Help**, then **Online help manual** to open the
manual. The Help dialog also shows the ArtGUI version and credits.
