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

For HDF5 export, file layout and readback, see
:ref:`HDF5 field snapshots` in the :ref:`export-guide` chapter.

.. _scalar-field-combine-geometry:

Scalar Fields from Geometry Regions
====================================

``Define_ScalarField_CombineGeometry`` creates a named scalar field using
geometry regions. It samples the current lattice grid defined by ``Setup``;
there is no separate ``grid_spacing``. It does not change the lattice surface
field.

.. code-block:: json

   {
     "Define_ScalarField_CombineGeometry": {
       "field_id": "CellSize",
       "default_value": 8.0,
       "regions": [
         {
           "name": "Heel",
           "geometry": "HeelRegion",
           "value": 4.0,
           "transition_width": 12.0
         }
       ],
       "overlap": "Minimum"
     }
   }

Here the field is 4 inside ``HeelRegion``. Outside the region it smoothly
returns to 8 over a distance of 12, in the model's units. ``HeelRegion`` must
already be loaded as a mesh-container ID, or be replaced with a mesh-file path.

.. list-table:: Scalar-field parameters
   :header-rows: 1
   :widths: 28 72

   * - Parameter
     - Meaning
   * - ``field_id``
     - Required name for the stored field, such as ``CellSize``. A successful
       operation replaces any field with the same name.
   * - ``default_value``
     - Required finite value used away from the regions.
   * - ``regions``
     - Required list of regions. An empty list creates a constant field.
   * - ``geometry`` / ``value``
     - Required for each region: its surface mesh and the finite value inside it.
   * - ``name``
     - Optional region label used in messages.
   * - ``transition_width``
     - Outward transition distance. Default 0 gives a sharp change at grid
       points; interpolation can spread that change across a grid cell.
   * - ``overlap``
     - ``Minimum`` (default) or ``Maximum``. Combines the default and all
       regional values at each grid point, independently of region order.

``Minimum`` can only reduce the default; ``Maximum`` can only increase it.
Each positive-width transition uses a smoothstep blend. Choose ``Setup.res``
fine enough to resolve the regions and transitions.

Geometry is handled by MeshInterface. Supply a mesh-file path or a named mesh
container containing a closed, manifold, non-self-intersecting triangle surface.
Exact duplicate vertices are welded; open surfaces and degenerate triangles
are rejected. Volume elements are not automatically converted to surfaces.

This is a generic scalar field, so zero and negative values are allowed.
For :ref:`tet-mesh-size-field`, every value must be strictly positive and
represents a target edge length. Connect it explicitly with
``"size_field": "CellSize"``. The field name alone does not select its use.

Save and reuse the field
-------------------------

Use ``Export`` to save the values and grid coordinates in HDF5:

.. code-block:: json

   {
     "Export": {
       "outfile": ".//Test_results//CellSize.h5",
       "GridFieldIDs": ["CellSize"]
     }
   }

In a later workflow, load the saved field before the mesher step:

.. code-block:: json

   {
     "ReadGridField": {
       "inp_GridFieldFile": ".//Test_results//CellSize.h5",
       "FieldID": "CellSize",
       "Gridfield_ID": "CellSize"
     }
   }

``FieldID`` selects the saved field; ``Gridfield_ID`` names the loaded field.
A partitioned file also needs ``BlockID``. Loading one partial block does not
provide the complete field required to mesh an entire solid.

The standalone field example is
``Test_json/FieldContainer/CombineGeometry/CombineGeometry.json``.
For field creation, tet meshing and conformal infill together, see
:ref:`graded-tet-lattice`.
