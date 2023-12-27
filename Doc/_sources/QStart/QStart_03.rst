========================
Rotation and Translation
========================

To fit a design purpose, users can apply rotation and translation on the lattice unit orientation. It is important to note that only periodic lattices can be rotated and translated with respect to the global origin and axes. Currently, the following keywords support these two operations: :code:`Add_Lattice`, :code:`Subtract_Lattice`, :code:`HS_Interpolate`, :code:`Lin_Interpolate`, :code:`Add_Attractor`, and :code:`OP_FieldMerge`.

In the example JSON below, the lattice is rotated with respect to the x-axis by :math:`\frac{\pi}{4}` radians.

.. code-block:: json

    {"Setup":{      "Type" : "Sample",
                "Sample": {"Domain" : [[0.0,4.0],[0.0,4.0],[0.0,4.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.025,0.025,0.025],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
    "WorkFlow":{
          "1":{"Add_Lattice":{
                    "la_name": "Cubic", "size": [1.0,1.0,1.0], "thk":0.05, 
                    "Rot":[0.7853981633974483, 0.0, 0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": true, 
                    "Cube_Request": {}
                    }},
          "2":{"Export": {"outfile": ".//Test_results/Test_Sample_Strut_Infill.stl"}}
           },
    "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false,
                "ExportLazPts": false}
    }

The parameter :code:`Rot` in the keywords :code:`Add_Lattice` becomes :code:`[0.7853981633974483, 0.0, 0.0]`. The first element represents the rotation around x-axis in radius unit, and the second and third element defines the y- and z-axis rotation. Same setup applies to the :code:`Trans` that defines the translation movement. It has to note that, Artisan rotates the lattice before translating it. 

.. image:: ../pictures/Rotation_Cubic.png

User may define the parameter :code:`Trans` to get after rotation translation, for instance, move the structure by :code:`0.5` in x direction :code:`"Trans":[0.5, 0.0, 0.0]`.

.. image:: ../pictures/Translation_Cubic.png
