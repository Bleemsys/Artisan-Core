================================
Line Structure 02 - Vector Field
================================

Artisan provides the keyword :code:`Gen_SDFVectorFieldLineMesh` to generate a 3D line mesh by tracing streamlines of a user-defined vector field while taking the input geometry into account. The vector field is defined using mathematical expressions in :code:`x`, :code:`y`, and :code:`z`. Artisan generates a signed distance field (SDF) from the input geometry and uses the SDF to modify the vector field close to the geometry surface.

This feature can be used to generate geometry-aware line structures, such as directional lattice structures, reinforcement paths, and line-based infill patterns.

Basic Example
=============

The following example demonstrates the basic use of :code:`Gen_SDFVectorFieldLineMesh`.

.. code-block:: json

    {
        "Setup": {
            "Type": "Sample",
            "Sample": {
                "Domain": [
                    [-650.0, 650.0],
                    [-650.0, 650.0],
                    [-650.0, 650.0]
                ],
                "Shape": "Box"
            },
            "Geomfile": "Ball_Mesh.STL",
            "Rot": [0.0, 0.0, 0.0],
            "res": [10.0, 10.0, 10.0],
            "Padding": 1,
            "onGPU": false,
            "memorylimit": 1073741824000,
            "JsonWorkDir": true
        },

        "WorkFlow": {
            "1": {
                "Gen_SDFVectorFieldLineMesh": {
                    "inp_meshfile": "Ball_Mesh.STL",
                    "x_expr": "1.0",
                    "y_expr": "sin(x/50)",
                    "z_expr": "0.0",
                    "start_points": [
                        [-640.0, -640.0, -640.0],
                        [-640.0, -640.0, -426.6667],
                        [-640.0, -640.0, -213.3333],
                        [-640.0, -640.0, 0.0]
                    ],
                    "n_points": 900,
                    "step_size": 2.5,
                    "attraction_strength": -10.0,
                    "projection_width": 10.0,
                    "influence_width": 10.0,
                    "out_meshfile": "VectorLine_mesh.inp"
                }
            }
        }
    }

Vector Field Definition
=======================

The vector field is defined using three mathematical expressions:

.. code-block:: json

    "x_expr": "1.0",
    "y_expr": "sin(x/50)",
    "z_expr": "0.0"

These expressions define the three components of the vector field:

.. math::

    \mathbf{V}(x,y,z)
    =
    \left[
    V_x(x,y,z),
    V_y(x,y,z),
    V_z(x,y,z)
    \right]

where:

* :code:`x_expr` defines the X component;
* :code:`y_expr` defines the Y component;
* :code:`z_expr` defines the Z component.

The expressions may use the spatial coordinates :code:`x`, :code:`y`, and
:code:`z`.

For example:

.. code-block:: json

    "x_expr": "y + 0.3*z",
    "y_expr": "x - 0.3*z",
    "z_expr": "-0.3*x + 0.2*y"

defines a spatially varying three-dimensional vector field.

The vector field is evaluated at the current streamline position during
the tracing process.

Starting Points
===============

The :code:`start_points` parameter defines the starting locations of the
streamlines.

Each starting point consists of three coordinates:

.. code-block:: json

    "start_points": [
        [x1, y1, z1],
        [x2, y2, z2],
        [x3, y3, z3]
    ]

For example:

.. code-block:: json

    "start_points": [
        [-640.0, -640.0, -640.0],
        [-640.0, -640.0, -426.6667],
        [-640.0, -640.0, -213.3333],
        [-640.0, -640.0, 0.0]
    ]

One streamline is generated from each starting point.

The distribution of :code:`start_points` therefore has a significant
influence on the resulting line structure.

Streamline Length and Resolution
================================

Two parameters control the streamline tracing:

.. code-block:: json

    "n_points": 900,
    "step_size": 2.5

The :code:`step_size` controls the approximate distance between consecutive
points along a streamline.

The :code:`n_points` parameter defines the maximum number of points
generated for each streamline.

The approximate maximum tracing distance can therefore be estimated as:

.. math::

    L \approx n\_points \times step\_size

For example:

.. math::

    L \approx 900 \times 2.5 = 2250

The actual streamline may be shorter depending on the vector field.

A smaller :code:`step_size` produces more closely spaced points and can
better capture changes in the vector field, but increases the computational
cost.

A larger :code:`step_size` reduces the computational cost but may produce
less accurate paths around rapidly changing vector fields or geometry
features.

Geometry Interaction
====================

The input geometry is used to generate a signed distance field. The SDF
provides information about the position relative to the geometry surface
and is used to modify the vector field.

Two geometry-aware effects can be controlled:

* projection of the vector field toward the geometry surface tangent;
* attraction or repulsion relative to the geometry.

Surface Projection
------------------

The :code:`projection_width` parameter controls the region in which the
vector field is gradually projected onto the tangent plane of the geometry
surface. For example:

.. code-block:: json

    "projection_width": 10.0

Close to the geometry surface, the normal component of the vector field is reduced and the tangential component is retained. This allows streamlines to follow the surface instead of passing directly through it. A larger :code:`projection_width` causes this surface-following behaviour to influence the vector field farther away from the geometry. A smaller value confines the effect to a narrower region around the surface.

Attraction and Repulsion
------------------------

The :code:`attraction_strength` parameter controls the interaction between the streamlines and the geometry. A positive value produces attraction toward the geometry:

.. code-block:: json

    "attraction_strength": 10.0

A negative value produces repulsion from the geometry:

.. code-block:: json

    "attraction_strength": -10.0

A value of zero disables the attraction/repulsion contribution:

.. code-block:: json

    "attraction_strength": 0.0

Influence Width
---------------

The :code:`influence_width` parameter controls the spatial range of the
attraction or repulsion effect. For example:

.. code-block:: json

    "influence_width": 10.0

A smaller value produces a more localized interaction with the geometry, while a larger value allows the geometry to influence the vector field over a larger distance. The :code:`projection_width` and :code:`influence_width` have different
purposes:

+---------------------------+----------------------------------------------+
| Parameter                 | Effect                                       |
+===========================+==============================================+
| :code:`projection_width`  | Surface tangential projection region         |
+---------------------------+----------------------------------------------+
| :code:`influence_width`   | Attraction/repulsion influence range         |
+---------------------------+----------------------------------------------+

Parameter List
==============

The parameters for :code:`Gen_SDFVectorFieldLineMesh` are listed below.

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details

   * - :code:`inp_meshfile`
     - File path of the triangular surface geometry used to generate the
       SDF and define the geometry interaction.

   * - :code:`x_expr`
     - Mathematical expression defining the X component of the vector
       field. The expression can use :code:`x`, :code:`y`, and :code:`z`.

   * - :code:`y_expr`
     - Mathematical expression defining the Y component of the vector
       field. The expression can use :code:`x`, :code:`y`, and :code:`z`.

   * - :code:`z_expr`
     - Mathematical expression defining the Z component of the vector
       field. The expression can use :code:`x`, :code:`y`, and :code:`z`.

   * - :code:`start_points`
     - List of three-dimensional coordinates defining the starting points
       of the streamlines. One streamline is generated from each starting
       point.

   * - :code:`n_points`
     - Maximum number of points generated for each streamline.

   * - :code:`step_size`
     - Approximate distance between consecutive points along a streamline.

   * - :code:`attraction_strength`
     - Controls the interaction with the geometry. Positive values attract
       the streamlines toward the geometry, while negative values produce
       repulsion.

   * - :code:`projection_width`
     - Width of the region around the geometry surface where the vector
       field is projected toward the surface tangent direction.

   * - :code:`influence_width`
     - Controls the spatial range of the attraction or repulsion effect.

   * - :code:`out_meshfile`
     - File path for the generated line mesh.

Output Mesh
===========

The output of :code:`Gen_SDFVectorFieldLineMesh` is a line mesh. Each streamline consists of a sequence of points, and consecutive points are connected by line elements. For example, if a streamline contains:

.. code-block:: text

    P0, P1, P2, P3, P4

the generated mesh contains:

.. code-block:: text

    P0-P1
    P1-P2
    P2-P3
    P3-P4

The output mesh is written using the specified :code:`out_meshfile`.

Generating a Line-Based Lattice
================================

The generated vector-field line mesh can be used as the basis for subsequent Artisan operations. The examples :code:`\Test_json\ParametricGeometry\VectorField_LineStructure.json`
and :code:`\Test_json\ParametricGeometry\VectorField_LineStructure_02.json`
demonstrate complete workflows for generating line structures using a user-defined vector field. In these examples, the vector field is evaluated around a ball geometry, and streamlines are generated from specified starting points. The resulting
line meshes illustrate how different vector-field definitions produce different line-structure patterns.

The first example Sinusoidal Vector Field uses the following vector field:

.. code-block:: json

    "x_expr": "1.0",
    "y_expr": "sin(x/50)", 
    "z_expr": "0.0"


The field has a constant X component, while the Y component varies
sinusoidally with X. The resulting streamlines therefore follow a
predominantly X-directed flow with a sinusoidal variation in the Y
direction.

.. image:: ./pictures/LineStructrue_02_Vector_01.png

.. image:: ./pictures/LineStructrue_02_Vector_02.png


The second example Rotational 3D Vector Field uses a fully three-dimensional vector field:

.. code-block:: json

    "x_expr": "y + 0.3*z",
    "y_expr": "x - 0.3*z",
    "z_expr": "-0.3*x + 0.2*y"

The interaction between the three vector components produces a more complex
three-dimensional streamline pattern around the ball.

.. image:: ./pictures/LineStructrue_02_Vector_03.png

.. image:: ./pictures/LineStructrue_02_Vector_04.png


Practical Recommendations
==========================

**Starting point distribution**

The starting points determine where the line structure begins. A regular
distribution generally produces a more regular line pattern, while a
customized distribution can be used to control the local density of the
generated lines.

**Step size**

The :code:`step_size` should be selected according to the geometric and
vector-field scales. Smaller values are recommended when the vector field
changes rapidly or when the geometry contains small features.

**Number of points**

Increase :code:`n_points` when longer streamlines are required. The
approximate maximum tracing distance is proportional to:

.. math::

    n\_points \times step\_size

**Projection width**

Increase :code:`projection_width` when the generated lines need to follow
the geometry from a greater distance.

**Influence width**

Increase :code:`influence_width` when the geometry needs to influence
streamlines farther away from the surface.

**Attraction strength**

Use positive values when lines should be drawn toward the geometry and
negative values when lines should be pushed away from it.

The combination of these parameters provides control over both the global
direction of the generated lines and their interaction with the geometry.
