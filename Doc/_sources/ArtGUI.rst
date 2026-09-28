.. _chapter-ArtGUI:

ArtGUI user guide
*****************

ArtGUI is a desktop workbench for preparing lattice designs, running Artisan,
and inspecting the resulting meshes. You can open an existing workflow, change
its parameters, and compare the source geometry with the generated model in
one window.

This guide covers **ArtGUI 0.1.0, the Artisan Workbench interface**. It describes
the workbench with a Project panel, a central 3D Workspace and Workflow, and a
Properties panel. The older ribbon-style ArtGUI interface has different controls.

No JSON editing is needed for the first walkthrough. Start with
:doc:`ArtGUI/quickstart`, then use the other chapters as a reference when you
need them.

.. figure:: ArtGUI/images/workbench.png
   :width: 100%
   :alt: ArtGUI workbench with the engine-bracket geometry, project settings and six workflow steps.

   The engine-bracket example open in ArtGUI. Select a project item or workflow
   step to edit its properties on the right.

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
