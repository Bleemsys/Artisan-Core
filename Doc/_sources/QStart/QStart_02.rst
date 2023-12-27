=========
Attractor
=========

The regional thickness variation can be introduced by adding attractor operation. Attractor creates a spherical shape linearly varying field, and naturally merges this field with surrounding lattice structure. Here is an example JSON.

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[0.0,4.0],[0.0,4.0],[0.0,4.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.02,0.02,0.02],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
     "WorkFlow":{
          "1":{"Add_Lattice":{
                    "la_name": "BCCubic", 
                    "size": [1.0,1.0,1.0], "thk":0.1, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }},
          "2":{
          "Add_Attractor": {
                    "la_name": "BCCubic", 
                    "size": [1.0,1.0,1.0], "thk": 0.5, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "pt":[0.0, 0.0, 4.0], "r":3.5, 
                    "Inv": false, "Fill": true, 
                    "Cube_Request": {}
                    }},
          "3":{"Export": {"outfile": ".//Test_results/Test_Sample_Strut_Infill_2lattices.stl"}}
           },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false,
                "ExportLazPts": false}
    }


In above, :code:`"pt":[0.0, 0.0, 4.0]` defined the center and :code:`"r":3.5` defined the radius of the sphere. A corner of the cube has chunky material which caused by very thick beam definition, and the thickness was gradually changed and merged to the surrounding.

.. image:: ../pictures/Fill_box_2Lattices_Attractor.png



