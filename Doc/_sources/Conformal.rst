Conformal Lattice
*****************

Conformal lattice in Artisan is considered the mini morphing of the lattice to the given lattice domain. The domain can be a hexahedron or tetrahedron shape. The lattice in definition is therefore considered as the reference status, and the morphed lattice structure is in a deformed status. The mesh used in FEA/CFD computation are utilized for domain discretization, then the task of lattice generation becomes the morphing of the unit lattice into the lattice domain defined by individual element.

============================
Lattice in hexahedron domain
============================

The conformal lattice here is the mesh based conformal lattice. Artisan requires an user input of mesh, e.g. FEA mesh, to generate the conformal lattice. For using lattice in hexahedron domain, please note that,

 - Only the hexahedron element containing 8 nodes and 6 faces are supported at this stage. 
 - The supported mesh file format includes Salome :code:`.med`, Abaqus :code:`.inp` and Nastran :code:`bdf`. 

User may use Salome software to generate the mesh, and export the mesh as MED file. 

The JSON setup is very similar to the mesh lattice. Example below demonstrates the combinations of conformal TPMS and conformal strut lattice. 

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//Parts02//Parts02.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.4,0.4,0.4],
                "Padding": 3,
                "onGPU": false,
                "memorylimit": 16106127360
                },
     "WorkFlow":{
          "1": {"Add_Lattice":{
                    "la_name": ".//Test_json//Parts02_Strut_Infill_LR_conformal.mld", "size": [15.0,15.0,15.0], "thk":1.5, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": false, "Cube_Request": {}
                    }
               },
          "2" :{"HS_Interpolate" : {
                    "la_name": ".//Test_json//Parts02_TPMS_Infill_LR_conformal.mld", 
                    "size": [15.0,15.0,15.0], 
                    "thk": 1.5, "pt":[0.0,0.0,0.0], "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "n_vec":[-1.0,0.0,0.0], "Fill": false, "Cube_Request": {}
                    }},
          "3":{"Export": {"outfile": ".//Test_results/Parts02_Combined_Infill_02.stl"}}
           },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": false}
    }

The lattice file :code:`.//Test_json//Parts02_Strut_Infill_LR_conformal.mld` defines the mesh file and the type of strut lattice. 

.. code-block:: json

    {
     "type": "ConformalLattice",
     "definition": {
            "meshfile": ".//sample-obj//Parts02//Parts02.med",
            "la_name" : "BCCubic"
        }
    }

Similarly, the lattice file :code:`.//Test_json//Parts02_TPMS_Infill_LR_conformal.mld` defines the mesh file and the type of TPMS lattice. You may also apply the customized lattice definition here by changing :code:`la_name` to the customized lattice definition file. Please note that, the customized geometric shape lattice is not supported at this stage. 

.. code-block:: json

    {
      "type": "ConformalLattice",
      "definition": {
           "meshfile": ".//sample-obj//Parts02//Parts02.med",
           "la_name" : "SchwarzPrimitive"
        }
    }

Then, we could generate a combined conformal lattice infill.

.. image:: ./pictures/Conformal_combined_lattice.png


=============================
Lattice in tetrahedron domain
=============================

Tetrahedron mesh is widely used for domain discretization. It can be applied to most of difficult geometric shape, and has much higher chance of generating the mesh. Unlike the hexahedron element generation which often involves manual domain partition, the tetrahedron element requires less efforts on the domain partition. 

We use a sole of shoes to demonstrate how tetrahedron lattice domain infill works on difficult geometry. Here is the main JSON. 

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//Shore//Shoes_02.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.4,0.4,0.4],
		        "Padding": 5,
                "onGPU": true,
                "memorylimit": 16106127360
                },
     "WorkFlow":{
                "1": {"Add_Lattice":{
                    "la_name": ".//Test_json//Shoe_TetConformal_Infill_LR.mld", 
                    "size": [18.0,18.0,18.0], "thk":1.2, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": false, "Cube_Request": {}
                    }
                },
               "2":{
                     "Export": {"outfile": ".//Test_results/Shoe_TetConformal_Infill_LR.stl"}}
                },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false, 
                "ExportLazPts": false}
    }

And the conformal lattice definition :code:`"la_name": ".//Test_json//Shoe_TetConformal_Infill_LR.mld"` is below. 

.. code-block:: json

    {
      "type": "ConformalLattice",
      "definition": {
             "meshfile": ".//sample-obj//Shore//Shoes_02.med",
             "la_name" : "Icosahedral"
             }
    }

The filled geometry has strong visual presentation, as shown below.

.. image:: ./pictures/Sole.png


The custom lattice definition also supported in tetrahedron mesh infill. In general it has exact same parameter meaning as the periodic lattice, but only need to change :code:`"la_domain"` to :code:`"Tet"`. The strut nodes should be defined in a standard tetrahedron domain (covered by 4 nodes, :code:`(0,0,0)`, :code:`(1,0,0)`, :code:`(0,1,0)` and :code:`(0,0,1)`). Artisan will not check whether the coordinates of nodes in the range, anything beyond the tetrahedron can cause irregular lattice distribution. 

Above main JSON can be pushed further that makes the model to be ready for production, as shown below.

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//Shore//Shoes.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.4,0.4,0.4],
		        "Padding": 5,
                "onGPU": false,
                "memorylimit": 16106127360
                },
     "WorkFlow":{
          "1": {"Add_Lattice":{
                    "la_name": ".//Test_json//Shoe_TetConformal_Infill_LR.mld", 
                    "size": [18.0,18.0,18.0], "thk":0.8, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": false, "Cube_Request": {}
                    }
               },
          "2":{"Substract_Surf_Plate":{
                        "Surffile": ".//sample-obj//Shore//Shoes_Top.stl","thk":3.5, 
                        "GeomTrim": false}},
          "3":{"Add_Surf_Plate":{
                        "Surffile": ".//sample-obj//Shore//Shoes_Top.stl","thk":3.51, 
                        "GeomTrim": true}},
          "4":{"Add_Surf_Plate":{
                        "Surffile": ".//sample-obj//Shore//Shoes_Btm.stl","thk":2.0, 
                        "GeomTrim": true}},
          "6":{"Export": {"outfile": ".//Test_results/Shoe_TetConformal_Infill_LR.stl"}}
           },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": false}
    }

The model showed the better presentation. The keywords :code:`Add_Surf_Plate` and :code:`Substract_Surf_Plate` read the geometric surface and apply thickness to create a solid plate, and then perform add or substract operation on the lattice field. The parameter :code:`GeomTrim` controls whether the solid plate to do the cutting operation with the domain geometry. 

.. image:: ./pictures/Sole_Production_TopView.png

.. image:: ./pictures/Sole_Production_TopView_02.png

.. image:: ./pictures/Sole_Production_BtmView.png



=================================
Conformal Geometric Shape Lattice 
=================================

The custom geometric shape lattice is also supported. The example below showed the conformal custom geometric shape lattice infill of the twisted bar. 

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//Twisted_Bar//Twisted_Bar.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[2.0,2.0,2.0],
                "Padding": 3,
                "onGPU": false,
                "memorylimit": 16106127360
                },
     "WorkFlow":{
                "1": {"Add_Lattice":{
                       "la_name": ".//Test_json//Twisted_Bar_ConformalCustomLattice.mld", 
                       "size": [200.0,200.0,200.0], "thk":3.8, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                       "Inv": false, "Fill": false, "Cube_Request": {}
                       }
                    },
          "3":{"Export": {"outfile": ".//Test_results/Twisted_Bar_ConformalCustomLattice.stl"}}
           },
     "PostProcess":{"CombineMeshes": true,
                    "RemovePartitionMeshFile": false,
                    "RemoveIsolatedParts": false, 
                    "ExportLazPts": false}
    }

The custom lattice is defined as below. 

.. code-block:: json

    {
        "type": "ConformalLattice",
        "definition": {
            "meshfile": ".//sample-obj//Twisted_Bar//Twisted_Bar.med",
            "la_name" : ".//Test_json//CustomLattice_Geom.txt"
        }
    }
    

The twisted bar shall be filled by a series of :code:`boxframe.obj` shape. Due to current algorithm limitation, user are required to give the input of thickness parameter :code:`thk` (in this case, :code:`"thk":3.8`). User may try different thickness level at the low resolution model before moving to the high resolution model generation. 

.. image:: ./pictures/Twisted_Bar_Custom_Geom_Conformal.png

=====================
Joint Smooth Blending
=====================

Additional parameter :code:`k` in the conformal lattice defintion can help to define the smooth blending of the multiple beams in strut lattice. User may redefine the :code:`.//Test_json//Parts02_Strut_Infill_LR_conformal.mld` with :code:`k`, which the higher value of :code:`k` leads to more smooth and more material around joint. 

.. code-block:: json

    {
    "type": "ConformalLattice",
    "definition": {
        "meshfile": ".//sample-obj//Shore//Shoes_02.med",
        "la_name": "Tetrahedron",
        "k": 1.8
        }
    }

The example :code:`.//Test_json//ConformalLattice//Shoe_TetConformal_Infill_LR.json` as shown below, we shall have a shoe sole lattice structure with smoothly blended joints.

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//Shore//Shoes_02.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.4,0.4,0.4],
    		    "Padding": 5,
                "onGPU": false,
                "memorylimit": 16106127360
                    },
     "WorkFlow":{
              "1": {"Add_Lattice":{
                        "la_name": ".//Test_json//ConformalLattice//Shoe_TetConformal_Infill_LR.mld", "size": [18.0,18.0,18.0], "thk":1.2,  "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0], "Inv": false, "Fill": false, 
                        "Cube_Request": {}
                        }
                   },
              "2":{"Export": {"outfile": ".//Test_results/Shoe_TetConformal_Infill_LR.stl"}}
               },
     "PostProcess":{"CombineMeshes": true,
                    "RemovePartitionMeshFile": false,
                    "RemoveIsolatedParts": false, 
                    "ExportLazPts": false}
    }


.. image:: ./pictures/Conformal_SmoothBlend_01.png

.. image:: ./pictures/Conformal_SmoothBlend_02.png

