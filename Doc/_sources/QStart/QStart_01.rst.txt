============
Two Lattices
============

We certainly can add two lattice together. Artisan provides two simple connections, the hard connection - no transition between two lattice, the linear connection - a linearly changing behavior applied on two lattices. 

The JSON setup below builds a cube filled with two distinct lattices, BCCubic and 

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[0.0,4.0],[0.0,4.0],[0.0,4.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.01,0.01,0.01],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
     "WorkFlow":{
          "1":{"Add_Lattice":{
                    "la_name": "BCCubic", "size": [1.0,1.0,1.0], "thk":0.1, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0], 
                    "Inv": false, "Fill": false, "Cube_Request": {}
                    }},
          "2" :{"HS_Interpolate" : {
                    "la_name": "SchwarzPrimitive", 
                    "size": [1.0,1.0,1.0], 
                    "thk": 0.05, "pt":[2.0, 0.0, 0.0], "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "n_vec":[1.0, 0.0, 0.0], "Fill": true, "Cube_Request": {}
                    }},
          "3":{"Export": {"outfile": ".//Test_results/Test_Sample_Strut_Infill_2lattices.stl"}}
           },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false,
                "ExportLazPts": false}
    }


You will notice it took some time to compute the results as a finer resolution was set, i.e. :code:`"res":[0.01,0.01,0.01]`. The results should looks more smoother. 

.. image:: ../pictures/Fill_box_2Lattices.png

The keywords in :code:`"2"` introduced the heaviside connection between BCCubic and the Schwarz Primitive lattice. The boundary plane is defined through the plane equation that at :code:`"pt":[2.0, 0.0, 0.0]` with the normal :code:`"n_vec":[1.0, 0.0, 0.0]`. The normal can be varying according to the required scenarios, it does not has to be align with axis. You could change the normal vector direction to check how it affect the combination of two lattices. 

The linear varying relationship normally applied to the same lattice topological and size, but varying thickness across the regions. Let's try the JSON below. 

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[0.0,4.0],[0.0,4.0],[0.0,4.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.01,0.01,0.01],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
     "WorkFlow":{
          "1":{"Add_Lattice":{
                    "la_name": "BCCubic", "size": [1.0,1.0,1.0], "thk":0.1, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0], 
                    "Inv": false, "Fill": false, "Cube_Request": {}
                    }},
          "2":{"Lin_Interpolate" : {
                    "la_name": "BCCubic", "size": [1.0,1.0,1.0], "thk": 0.3, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "pt_01":[0.0,0.0,0.0], "n_vec_01":[0.0,0.0,1.0], 
                    "pt_02":[0.0,0.0,4.0], "n_vec_02":[0.0,0.0,-1.0], 
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

The varying thickness was therefore generated from :code:`z=0.0` plane to :code:`z=4.0` plane. There is no restrictions on the plane definition. User may try change the definition and check the results. 

.. image:: ../pictures/Fill_box_2Lattices_Lin.png

There is a trick that the size can be varying as well, as long as the interface topology is kept. For example, the JSON below demonstrates the varying thickness and varying size of unit lattice. 

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[0.0,4.0],[0.0,4.0],[0.0,8.0]], "Shape": "Box"},
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
                    "size": [1.0,1.0,1.0], "thk":0.1, 
                    "Inv": false, "Fill": false, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Cube_Request": {}
                    }},
          "2":{"Lin_Interpolate" : {
                    "la_name": "BCCubic", "size": [1.0,1.0,2.0], "thk": 0.2, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "pt_01":[0.0,0.0,0.0], "n_vec_01":[0.0,0.0,1.0], 
                    "pt_02":[0.0,0.0,8.0], "n_vec_02":[0.0,0.0,-1.0], 
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



The transition cells may not be well preserved, but generally connected and is printable. In the design, user may try to keep the transition region longer, or has less dramatic change, in order to keep the shape integrity of the lattice.

.. image:: ../pictures/Fill_box_2Lattices_Lin_VarSize.png

