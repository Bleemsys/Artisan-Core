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

Read the viewport footer to check the active layer and Preview mode. Preview
adapts to the camera and is approximate; wait for detail after moving or zooming.
For a surface check, select the model and choose **Load full detail** when
resources allow. Also disable Section and inspect layers separately. If gaps
remain in full detail, investigate the input mesh, workflow and resolution.

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
full-detail readers rely on available memory and graphics resources; see
:doc:`viewer`.
An unsupported INP structure requires a compatible flat mesh export, not
just a larger memory setting. ArtGUI's engine memory setting does not
reserve memory for the viewer.

Keep an original design and reload a changed result
====================================================

Choose **Save as** beside Save to create another project JSON. Subsequent Save
actions use the new path. Choose a different Export output filename as well if
you want to preserve the earlier mesh or field.

There is no general Undo/Redo command. Use saved project variations before
substantial edits. Use **Load result** or **Preview mesh** to reload a file;
legacy Update view instructions do not apply to this interface.

What should I include when reporting a problem?
===============================================

Record the ArtGUI version from **Help**, the selected backend, the steps that
triggered the problem, and the relevant run-log messages. Include a minimal
workflow and the necessary input files when you can share them. Mention the
working-directory setting, and distinguish a preview problem from an engine
failure. A screenshot of the affected panel is useful for interface issues.

An HDF5 field is unavailable or disappears
==========================================

Check that the Export step requests an HDF5 output and the run completed.
Choose **View field…** and reopen the file. Fields close before each run so
Artisan can overwrite them; this is expected. An arbitrary HDF5 file or an
incomplete snapshot may not be supported. See :doc:`viewer`.

A preview disappears after Clean scratch
========================================

This is expected for layers using ViewScratch. Cleanup closes cached previews
before deleting their temporary files. Reopen the geometry from Project or
choose Preview mesh. The project and original model are retained; preparing
the preview again can take time and disk space.

ViewScratch cannot be written or completely cleaned
===================================================

Keep ArtGUI in a writable folder and check free disk space. ViewScratch is
beside the executable, not beside the workflow JSON. Close other ArtGUI windows
using its files and retry Clean scratch. A reported cleanup failure can leave
some temporary files in place; it does not mean cleanup finished successfully.

Points or a field are hidden behind geometry
============================================

Select the obstructing geometry in Project and change its own Opacity or
visibility. Field opacity and Point opacity affect only the selected data
object. Check Show field or Show points, the object's opacity, coordinate-column
mapping and Section clipping. Use Fit view to frame the visible objects.
