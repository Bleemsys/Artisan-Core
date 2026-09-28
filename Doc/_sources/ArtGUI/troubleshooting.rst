Troubleshooting and common questions
************************************

The source geometry does not appear
===================================

Check the path in **Project settings → Geomfile**, then use **Load source**
to browse to the intended file. Use **Fit view** and check Visibility. If a
load is still in progress, wait for it to finish or choose Cancel before
trying another file.

For a relative path, check :doc:`projects`. In the supplied engine-bracket
example, select the backend in ``Artisan_Dist`` and keep JSON working
directory disabled. A preview-load error and an engine input error may
have different path causes; check the actual message.

Generate does not start
=======================

Check the engine indicator and choose **Backend…** if it is not connected.
Add at least one workflow operation. Correct any invalid Sample bounds or
lattice-definition errors shown by the interface. Make sure the project
can be saved; cancelling the initial save also cancels generation.

For a Python backend, select the interpreter from the environment where
Artisan works. A missing module or failed executable launch is reported
in the run messages; selecting a script alone does not install its dependencies.

The run reports a missing file
==============================

Read the first relevant error in **Show log** or **Open log**. Check the
working directory, source path, definition files and supporting inputs.
Example presets may refer to files from their original examples. Merely
attaching a file under Supporting files does not update the operation that
should read it.

Generation succeeded but the viewer is unchanged
================================================

Choose **Load result** and open the file named by the Export operation.
An already loaded result is not automatically replaced after a run, even
when the output filename is unchanged. Check the export path and modification
time if several similarly named files exist.

Only the original solid bracket is visible
==========================================

Open **Visibility** and hide the source. A solid source surface can cover
an internal lattice result. Confirm that the result layer is loaded and
visible, then choose **Fit view**.

The model looks patchy or has apparent holes
============================================

Read the viewport footer. If it says **Quick Preview**, select that layer
with **Make active** and choose **Load full detail**. Sampled triangles do
not form a complete surface. Also disable Section and inspect layers
separately. If gaps remain in full detail, investigate the input mesh,
workflow and resolution rather than assuming they are a viewer effect.

Measurements are unavailable or have the wrong units
====================================================

The selected mesh must be visible and loaded in Full Detail. Choose the
intended model in Measure, then select the distance or angle tool. Check
**More → Unit label** against the units used to create the file. Unit labels
do not rescale coordinates.

A definition cannot be removed or generation rejects its order
==============================================================

Change or remove operations that still refer to the definition before
removing it. Move a definition earlier than every step that uses its name.
Any mesh variable, grid field or custom unit cell needed by the definition
must also be available first. Apply the current definition form before
switching to a different item.

Progress pauses for a long time
===============================

The percentage is operation-based, so a long operation can leave it unchanged.
Check elapsed time and the log for continued work or an error. If you choose
**Stop**, partial output files remain. Do not treat a cancelled run's files
as confirmed final output.

A large file will not load
==========================

Try Quick Preview for a large STL and close unneeded viewer layers. The
full-detail STL and INP readers have different limits; see :doc:`viewer`.
An unsupported INP structure requires a compatible flat mesh export, not
just a larger memory setting. ArtGUI's engine memory setting does not
override viewer limits.

Where are Save As, Undo and the old Update view button?
=======================================================

This workbench version uses **Save** for the opened path and does not expose
a general Undo/Redo command. Make project copies before substantial changes.
Use **Load result** or **Preview mesh** to reload a file; the legacy ArtGUI
instructions for Update view do not apply to this interface.

What should I include when reporting a problem?
===============================================

Record the ArtGUI version from **Help**, the selected backend, the steps that
triggered the problem, and the relevant run-log messages. Include a minimal
workflow and the necessary input files when you can share them. Mention the
working-directory setting, and distinguish a preview problem from an engine
failure. A screenshot of the affected panel is useful for interface issues.
