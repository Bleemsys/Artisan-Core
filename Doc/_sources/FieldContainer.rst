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
     - A fitted field id for saving the grid field, or a file path string to export the fitted field data.

Two exported field data files were generated, :code:`OPdGridField.csv` and :code:`OPdGridField_02.csv`, as shown below on the left and right, respectively. In :code:`OPdGridField_02.csv`, the field value was added :code:`1` to the value of the field :code:`OPdGridField.png`. This is exactly same as what defined in the workflow. 

.. image:: ./pictures/OPdGridField.png
   :width: 45%
   :align: left

.. image:: ./pictures/OPdGridField_02.png
   :width: 45%
   :align: right

In Artisan 0.2.14, the grid field container introduces support for defining field-driven TPMS lattices. Future development will focus on extending grid field capabilities to other keywords and applications.






