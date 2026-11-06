Primitive and mesh region definitions
-------------------------------------

Each ``regions[].geometry`` accepts an existing mesh-file path or mesh-container
ID, or an object with ``type`` equal to ``Box``, ``Cylinder``, ``Sphere`` or
``Mesh``. Type names are case-sensitive. Existing string-based workflows remain
valid. The SDK also accepts ``PathLike`` mesh references.

Primitive distances are evaluated analytically on the existing sampling grid;
no tessellation or intermediate mesh file is needed. All lengths use the model
coordinate units. Thus a radius of 8 means 8 mm when the model is in mm.
The resulting field contains the specified regional/background values, not
the primitive's signed distances.

.. list-table:: Geometry objects
   :header-rows: 1
   :widths: 18 42 40

   * - Type
     - Required parameters
     - Optional parameters
   * - ``Box``
     - ``center`` (XYZ), ``size`` (full XYZ dimensions)
     - ``rotation_axis`` (default [0, 0, 1]), ``rotation_degrees`` (default 0)
   * - ``Cylinder``
     - ``center`` (XYZ), ``radius``, ``height`` (full height)
     - ``axis`` (default [0, 0, 1])
   * - ``Sphere``
     - ``center`` (XYZ), ``radius``
     - None
   * - ``Mesh``
     - ``source`` (mesh-file path or existing mesh ID)
     - None

Dimensions, radius and height must be strictly positive. Coordinates and angles
must be finite. Axis vectors must be finite and nonzero; their magnitude is
ignored. Unknown parameters inside a geometry object are rejected, so a typo
or a parameter belonging to a different shape cannot silently change a region.

A box starts aligned with the model axes. Its optional right-hand axis-angle
rotation is applied about its center. ``size`` always describes the full lengths
along the box's own axes. These controls place the selection volume; they do not
move the input body or replace ``Proc_Field_Morph`` movement parameters.

A cylinder is finite and capped. Its center is halfway between its end caps;
the caps lie at plus/minus half the height along the normalized axis. A sphere
has no orientation parameter.

For example, this box replaces the fixed-region mesh in the bar morph example:

.. code-block:: json

   {
     "Define_ScalarField_CombineGeometry": {
       "field_id": "FixedRegion",
       "default_value": 0.0,
       "overlap": "Maximum",
       "regions": [
         {
           "name": "Fixed base",
           "geometry": {
             "type": "Box",
             "center": [0.0, 0.0, 4.0],
             "size": [16.0, 16.0, 12.0]
           },
           "value": 1.0,
           "transition_width": 0.0
         }
       ]
     }
   }

It spans X/Y = -8 to 8 and Z = -2 to 10. Other geometry objects include:

.. code-block:: json

   {"type": "Box", "center": [0, 0, 4], "size": [16, 16, 12],
    "rotation_axis": [0, 0, 1], "rotation_degrees": 30}

   {"type": "Cylinder", "center": [0, 0, 54],
    "axis": [0, 0, 1], "radius": 8, "height": 16}

   {"type": "Sphere", "center": [0, 0, 54], "radius": 8}

   {"type": "Mesh", "source": "fixed.inp"}

The last object is equivalent to ``"geometry": "fixed.inp"`` when assigned to
a region's ``geometry`` key. ``source`` may instead be a loaded mesh ID.
Mesh surface validity requirements are unchanged.

All four types can coexist in one ``regions`` list. With ``Minimum`` or
``Maximum``, regions can have different values and transition widths and combine
with the background value. A zero
transition width includes sampled boundary points and changes sharply outside;
a positive width blends outwards over the specified model distance. Curved or
rotated boundaries are still represented at the sampling grid's resolution.

``Linear``, ``Smoothstep`` and ``InverseDistance`` also accept these geometry
types. They require separate, non-touching regions and transition width 0.
They fill the entire exterior from regional distances without a background
falloff; see the interpolation rules in :ref:`scalar-field-combine-geometry`.

For morphing masks use background 0, regional values 1, overlap ``Maximum``
and transition width 0. Creating a larger primitive does not enlarge
``Setup.Sample.Domain``; ensure the sampling grid covers it. A later morph still
requires compatible mask grids and enough space between fixed/moving regions.

Complete runnable examples are in ``Test_json/FieldContainer/PrimitiveRegions``:

* ``ScalarField_Primitives.json`` combines a rotated box, tilted cylinder,
  sphere and mesh into a generic scalar field, exported as HDF5.
* ``FieldMorph_PrimitiveMasks.json`` creates the deformation, fixed and moving
  masks from boxes and moves the bar's upper region 10 model units along X.
  Only the body's ``body.inp`` is required; there are no mask mesh files.

