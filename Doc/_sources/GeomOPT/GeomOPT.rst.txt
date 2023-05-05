Guide - Basics 02
*****************
Now we focus on how to fill geometric shape with lattices. 

========
Geometry
========

Artisan can definitely fill a geometry with lattice. The input geometry file can be :code:`stl`, :code:`ply`` or :code:`obj` files. The surface mesh must be composed by none-self-intersected and none-overlap triangles. 

The following example JSON setup fills the crank handle geometry with Cubic lattice. In the :code:`Setup` section, the two keywords were changed, :code:`"Type": "Geometry"` and :code:`"Geomfile": ".//sample-obj//crank_handle.stl"`. Former defines the type of computing task - filling a geometry, latter tells Artisan the path to the geometry file.

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//crank_handle.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.1,0.1,0.1],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824
                },
     "WorkFlow":{
          "1":{"Add_Lattice":{
                    "la_name": "Cubic", "size": [3.0,3.0,3.0], "thk":0.35, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": true, "Cube_Request": {}
                    }},
           "2":{"Export": {"outfile": ".//Test_results/crank_handle_infill.ply"}}
           },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false,
                "ExportLazPts": false}
    }

The periodical lattices were cut by the shape of crank handle. Please note the exterior transparent layer is only for a visualization and demonstration purpose, the model does not include the external layer.

.. image:: ../pictures/crank_handle_fill.png

It is often the filled lattice with a layer of external shell. The following demonstrates how to add the thin layer of external shell.

.. code-block:: json

    {"Setup":{ "Type": "Geometry", 
                "Geomfile": ".//sample-obj//crank_handle.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":  [0.1,0.1,0.1],
                "Padding": 1,
                "onGPU": true,
                "memorylimit": 1073741824
                },
     "WorkFlow":{
          "1":{"Add_Lattice":{
                    "la_name": "BC", "size": [3.0,3.0,3.0], "thk":0.35, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": true, "Cube_Request": {}
                    }},
          "2":{"Add_Shell" :{"Geomfile":"", "thk": 1.0}},
          "3":{"Export": {"outfile": ".//Test_results/crank_handle_Shell_infill.stl"}}
           },
     "PostProcess":{"CombineMeshes": true,
               "RemovePartitionMeshFile": false,
               "RemoveIsolatedParts": false,
               "ExportLazPts": true
                }
    }

The lattice structure now has a shell layer with 1 mm thickness. The parameter :code:`"Geomfile"` is blank which meant the setup input geometry will be used to generate this shell. 

.. image:: ../pictures/crank_handle_fill_wShell.png

=================
Lattice Operation
=================

The lattice field is operable. User may add or subtract the lattice fields as many times as they want. For example, a BCCubic lattice can be generated through combining BC and Cubic lattice. Below JSON showed the combination of BC and Cubic lattices with different thickness. 

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//crank_handle.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.1,0.1,0.1],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824
                },
     "WorkFlow":{
           "1":{"Add_Lattice":{
                    "la_name": "Cubic", "size": [3.0,3.0,3.0], "thk":0.35, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": true, "Cube_Request": {}
                    }},
           "2":{"Add_Lattice":{
                    "la_name": "BC", "size": [3.0,3.0,3.0], "thk":0.2, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": true, "Cube_Request": {}
                    }},
           "3":{"Export": {"outfile": ".//Test_results/crank_handle_infill.ply"}}
           },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true,
                "ExportLazPts": false}
    }

.. image:: ../pictures/crank_handle_fill_add.png

Details of the results:

.. image:: ../pictures/crank_handle_fill_add_details.png

User may apply the operation with the keywords :code:`Subtract_Lattice` to subtract the lattice. :code:`Subtract_Lattice` has exactly same parameters as :code:`Add_Lattice`. These operations aim to provide some flexibilities for creating the anisotropic lattice. 

The parameter :code:`Inv` operates the inverse of lattice. When :code:`true`, the none-fill region mesh will be generated. For example, we could have an interesting none-fill region mesh (or you may consider this some sort of infill) using the JSON below. 

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//crank_handle.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.1,0.1,0.1],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824
                },
     "WorkFlow":{
          "1":{"Add_Lattice":{
                    "la_name": "Cubic", "size": [3.0,3.0,3.0], "thk":0.35, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": true, "Fill": true, "Cube_Request": {}
                    }},
           "2":{"Export": {"outfile": ".//Test_results/crank_handle_infill.ply"}}
           },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false,
                "ExportLazPts": false}
    }

None-fill region mesh was generated as below.

.. image:: ../pictures/crank_handle_fill_inverse.png

The parameter :code:`Fill` controls whether the cutting operation with geometry should be conducted. It is often set as :code:`true` when the keywords is last lattice operation. If fill operation has never performed, the results should be a block of lattice covers the bounding box region of the given geometry. 

==================
Boundary Inflation
==================

The term of "boundary inflation" meant the thickness of the lattice on the closing geometry surface layer gradually merged with the inner lattices. This may be useful for lightweight design that external structure provides supports to the overall design. Here is an example that adds the boundary inflation on the crank handle infill.

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//crank_handle.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.1,0.1,0.1],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824
                },
     "WorkFlow":{
           "1":{"Add_Lattice":{
                    "la_name": "BCCubic", "size": [3.0,3.0,3.0], "thk":0.1, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": true, "Cube_Request": {}
                    }},
           "2":{"Boundary_Inflation": {"offset":0.4, "scale_range": [0.8,0.01]}},	
           "3":{"Export": {"outfile": ".//Test_results/crank_handle_infill.ply"}}
           },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false,
                "ExportLazPts": false}
    }

Below shows the cross-section details of the beam thickness across from inner center to the exterior surface. One has to note that, it manipulates the surface boundary offset on the the current stage of lattice field without recomputing the entire operation of lattice generation. 

.. image:: ../pictures/crank_handle_BD_Inflation.png

