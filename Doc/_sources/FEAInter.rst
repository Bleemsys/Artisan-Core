Interface to FEA
****************

Computer-aided engineering, particularly finite element analysis (FEA), plays a critical role in digitally verifying product performance before conducting physical tests and initiating production. In lattice design, creating the geometry and mesh presents significant challenges for FEA. Artisan offers basic outputs for lattice mesh and can also calculate the signed distance field value for given spatial points. This capability significantly enhances the efficiency of assembling FEA models and supports the customized development of FEA applications for lattice structures. 

===========
Mesh Export
===========

The exporting mesh in the current version supports the strut and TPMS based conformal lattice. User may export the shell elements for TPMS type lattice, or the beam element for strut lattice. No additional keywords are required, only need additional setup in the conformal lattice definition file. Here is an example (the example file: :code:`.//Test_json//FEAMesh//GenSphericalConformalMesh.json`) below showing the exports of the beam elements for a conformal lattice infilled structure. 

.. code-block:: json

    {
    "Setup": {
        "Type": "Sample",
        "Sample": {
            "Domain": [
                [
                    -10.0,
                    10.0
                ],
                [
                    -10.0,
                    10.0
                ],
                [
                    -10.0,
                    10.0
                ]
            ],
            "Shape": "Box"
        },
        "Geomfile": "",
        "Rot": [
            0.0,
            0.0,
            0.0
        ],
        "res": [
            0.1,
            0.1,
            0.1
        ],
        "Padding": 1,
        "onGPU": false,
        "memorylimit": 1073741824000
    },
    "WorkFlow": {
        "1": {
            "Gen_SphericalMesh": {
                "num_elem": [
                    3,
                    10,
                    4
                ],
                "r_range": [
                    3.0,
                    8.0
                ],
                "theta_range": [
                    0.3,
                    0.7
                ],
                "ori": [
                    0.0,
                    0.0,
                    0.0
                ],
                "Normal": [
                    1.0,
                    1.0,
                    0.0
                ],
                "Mesh_file": ".//Test_json//FEAMesh//SphericalMesh.med",
                "phi_range": [
                    0.2,
                    0.8
                ]
            }
        },
        "2": {
            "Add_Lattice": {
                "la_name": ".//Test_json//FEAMesh//GenSphericalConformalMesh.mld",
                "size": [
                    3.0,
                    3.0,
                    3.0
                ],
                "thk": 0.2,
                "Rot": [
                    0.0,
                    0.0,
                    0.0
                ],
                "Trans": [
                    0.0,
                    0.0,
                    0.0
                ],
                "Inv": false,
                "Fill": false,
                "Cube_Request": {}
            }
        },
        "100000": {
            "Export": {
                "outfile": ".//Test_results/SphericalMesh_ConformalLattice.stl"
            }
        }
    },
    "PostProcess": {
        "CombineMeshes": true,
        "RemovePartitionMeshFile": false,
        "RemoveIsolatedParts": true,
        "ExportLazPts": true
    }
    }

And the definition file of the conformal lattice, :code:`GenSphericalConformalMesh.mld`, is as below.

.. code-block:: json

    {
     "type": "ConformalLattice",
     "definition": {
        "meshfile": ".//Test_json//FEAMesh//SphericalMesh.med",
        "ExportFEAMeshFile": ".//Test_json//FEAMesh//SpherieFEAMesh.inp",
        "la_name": "BCCubic"
        }
    }

The parameter :code:`ExportFEAMeshFile` defines the export mesh file. In this case, the mesh is exported in Abaqus inp file format. This is a text file, and user can use any text editor open and edit the content. In geneal the lattice structure shall look like the one below. 

.. image:: ./pictures/FEA_LatticeGeom.png

Then we could import the inp file into the Ansys workbench, for example, and conduct further analysis. For example, one below shows the axial forces on the beam elements subject the load force on top end and fixed bottom end boundary conditions. 

.. image:: ./pictures/FEA_Strut_Results.png


Similarly, user may find the TPMS example (the example file: :code:`.//Test_json//FEAMesh//Parts02_Export_TPMS_conformal.json`). Same as the strut lattice, the TPMS shell elements can be imported into any major FEA solver for further analysis. Below shows a simple compression case that the bottom edges were fixed and the load applied on top edges. 

.. image:: ./pictures/FEA_TPMS_Results.png

==========
SDF Export
==========

Users can calculate the signed distance field (SDF) for specified spatial points. The provided spatial coordinates are used to evaluate the SDF values, which represent the minimum distance between each point and the nearest geometry surface. A negative value indicates that the point is inside the geometry, while a positive value indicates that it is outside. A value of zero denotes that the point lies precisely on the geometry surface. In practical applications, these points can either be nodes within a mesh or specified in a CSV file format - users may refer to the relevant documentation on field operations.

.. code-block:: json

    {
        "Setup": {
            "Type": "Sample",
            "Sample": {
                "Domain": [
                    [
                        -10.0,
                        10.0
                    ],
                    [
                        -10.0,
                        10.0
                    ],
                    [
                        -10.0,
                        10.0
                    ]
                ],
                "Shape": "Box"
            },
            "Geomfile": "",
            "Rot": [
                0.0,
                0.0,
                0.0
            ],
            "res": [
                0.1,
                0.1,
                0.1
            ],
            "Padding": 1,
            "onGPU": false,
            "memorylimit": 1073741824000
        },
        "WorkFlow": {
            "1": {
                "Gen_SphericalMesh": {
                    "num_elem": [
                        3,
                        10,
                        4
                    ],
                    "r_range": [
                        3.0,
                        8.0
                    ],
                    "theta_range": [
                        0.3,
                        0.7
                    ],
                    "ori": [
                        0.0,
                        0.0,
                        0.0
                    ],
                    "Normal": [
                        1.0,
                        1.0,
                        0.0
                    ],
                    "Mesh_file": ".//Test_json//FEAMesh//SphericalMesh.med",
                    "phi_range": [
                        0.2,
                        0.8
                    ]
                }
            },
            "2": {
                "Add_Lattice": {
                    "la_name": ".//Test_json//FEAMesh//GenSphericalConformalMesh.mld",
                    "size": [
                        3.0,
                        3.0,
                        3.0
                    ],
                    "thk": 0.2,
                    "Rot": [
                        0.0,
                        0.0,
                        0.0
                    ],
                    "Trans": [
                        0.0,
                        0.0,
                        0.0
                    ],
                    "Inv": false,
                    "Fill": false,
                    "Cube_Request": {}
                }
            },
            "3": {
                "Evaluate_Points": {
                    "Inp_meshfile": ".//Test_json//FEAMesh//SphericalMesh.med",
                    "Export_file": ".//Test_json//FEAMesh//Points_SDF.csv"
                }
            },
            "100000": {
                "Export": {
                    "outfile": ".//Test_results/SphericalMesh_ConformalLattice.stl"
                }
            }
        },
        "PostProcess": {
            "CombineMeshes": true,
            "RemovePartitionMeshFile": false,
            "RemoveIsolatedParts": true,
            "ExportLazPts": true
        }
    }

In the work flow item :code:`3`, the keywords :code:`Evaluate_Points` defines the input spatial data points, for example, in a mesh :code:`"Inp_meshfile":".//Test_json//FEAMesh//SphericalMesh.med"`, and the calculated results are stored in the csv file :code:`"Export_file": ".//Test_json//FEAMesh//Points_SDF.csv"`. It has to note that, only csv file extension is accepted as the export file format. 

User shall see the results similar to the results below. The export csv file contains two column, index and value. Each row corresponds to the input nodal index. 

.. image:: ./pictures/FEA_SDF_Results.png

===========
Limitations
===========

Here are a few limitations and recommended pre-process before assembling the FEA model.

    - The exported beam element and shell element mesh must check through professional FEA pre-processor. The mesh may contain low quality element, and user shall remove the defect elements, or conduct re-meshing based on the given mesh if necessary. 
    - Merging nodes is highly recommended since the mesh were exported through lattice array. The neighboring elements are not connected.
    - Only single conformal lattice can be exported. Other lattice types or complex lattice design are not supported, the future development will focus on expanding the meshing capability on other lattice type. 

