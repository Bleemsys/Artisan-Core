Getting Started
****************

Nothing is better than a few good examples for a quick start. The examples
below provide a simple introduction to Artisan and show how to start an
Artisan workflow from the command line.

Artisan Command Line
====================

Artisan can be started from the command line using :code:`ArtisanMain.py`
during development, or :code:`ArtisanMain.exe` when using the packaged
distribution.

The general command-line format is::

    ArtisanMain.exe <option> <input>

The main command-line options are:

``-v, --version``
    Display the installed Artisan version number.

``-f, --filename <file>``
    Execute an Artisan workflow using the specified JSON input file.

``-hp, --HighPriority <file>``
    Execute an Artisan workflow using the specified JSON input file with a
    higher process priority.

``-g, --geometry <file>``
    Read and inspect the specified STL geometry and print its geometry
    information to the screen.

``-l, --log``
    Save the geometry information to a log file. This option is used together
    with :code:`-g` and has no effect on the normal workflow options.

Geometry Information
====================

The :code:`-g` option provides a convenient way to inspect an STL geometry
before using it in an Artisan workflow.

For example::

    ArtisanMain.exe -g .//sample-obj//box_2.stl

The geometry information is printed directly to the screen.

.. code-block:: console

    Geometry Information
    --------------------

    File:
      sample-obj\box_2.stl

    Mesh:
      Vertices:  1454
      Triangles: 984

    Bounding Box:
      Min: [-10.000000, -10.000000, -10.000000]
      Max: [10.000000, 10.000000, 10.000000]
      Size: [20.000000, 20.000000, 20.000000]
      Center: [0.000000, 0.000000, 0.000000]

    Surface:
      Area: 4595.142676
      Volume: Not available (mesh is not watertight)

    Mesh Quality:
      Watertight:        False
      Edge manifold:     True
      Vertex manifold:   True
      Self intersecting: True




To also save the geometry information to a log file, use the :code:`-l`
option::

    ArtisanMain.exe -g .//sample-obj//box_2.stl -l

When :code:`-l` is specified, Artisan writes the geometry information to a
log file associated with the STL file. The information is both displayed on
the screen and written to the log file.

The geometry inspection reports information such as the mesh size, bounding
box, surface area, volume (when the mesh is watertight), and mesh quality
information.

Quick Start Examples
====================

The following examples demonstrate complete Artisan workflows and provide
practical starting points for learning how to configure and run Artisan.

.. include:: QStart_00.rst

.. include:: QStart_01.rst

.. include:: QStart_02.rst

.. include:: QStart_03.rst
