.. _LineStructure:
Line Structure
**************

Line structures that conform to complex shapes can be generated without explicitly defining lattice units or meshes. Artisan currently supports two primary approaches for constructing line structures: point-based algorithms and field-based generation. The point-based approach uses specialized algorithms to connect predefined material points, while the field-based approach allows users to leverage external fields, internal fields, and Artisan’s grid field container to build a target field and generate line structures directly from it. Future development will focus on expanding and integrating more advanced line structure generation capabilities within Artisan.

=====================
Minimum Spanning Tree 
=====================

A Minimum Spanning Tree (MST) is a graph-based optimization method used to connect a set of points with the minimum total connection cost. In a connected, weighted, undirected graph, an MST links all vertices together without forming cycles while minimizing the sum of edge weights. This makes it an efficient solution for designing lightweight networks, such as transportation systems, communication networks, and structural frameworks. In computational design, MST algorithms can be used to generate optimized line structures by efficiently connecting material points while reducing redundancy.

Example :code:`.//Test_json//MaterialPoints//BingDunDun_Infill_LR.json` gives a basic workflow of generating MST line structure. 

.. code-block:: json

        {
        "Setup": {
            "Type": "Geometry",
            "Sample": {
                "Domain": [
                    [0.0, 0.0],
                    [0.0, 0.0],
                    [0.0, 0.0]
                ],
                "Shape": "Box"
            },
            "Geomfile": ".//sample-obj//shell_1_of_bdd_.stl",
            "Rot": [0.0, 0.0, 0.0],
            "res": [0.8, 0.8, 0.8],
            "Padding": 1,
            "onGPU": false,
            "memorylimit": 161061273000
        },
        "WorkFlow": {
            "1": {
                "Gen_MaterialPoints_SurfaceLayers":{
                    "inp_meshfile":".//sample-obj//shell_1_of_bdd_.stl", 
                    "depth": [0, 10], 
                    "res":[5.0, 5.0, 1.8], 
                    "sampling": "Poisson", 
                    "out_matpoints_file": ".//Test_results//BingDunDun_MatPts_Grid.csv"
                }
            },
            "2": {
                "Gen_MSTMesh_Basic":{
                    "inp_matpoints_file":".//Test_results//BingDunDun_MatPts_Grid.csv", 
                    "out_meshfile":".//Test_results//BingDunDun_MST_Mesh.inp"
                }
            },
            "3":{
                "Define_Lattice":{
                    "la_name": "MSTMesh",
                    "definition":{
                        "type": "MeshLattice",
                        "definition": {
                            "meshfile": ".//Test_results//BingDunDun_MST_Mesh.inp"
                        }
                    }
                }
            },
            "4": {"Add_Lattice":{
                        "la_name": "MSTMesh", 
                        "size": [5.0,5.0,5.0], "thk":1.2, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": false, 
                        "Cube_Request": {}
                        }
                   },
            "5":{
                  "Export": {"outfile": ".//Test_results//BingDunDun_MST_Lattice.stl"}
                  }

        },
        "PostProcess": {
            "CombineMeshes": true,
            "RemovePartitionMeshFile": false,
            "RemoveIsolatedParts": true,
            "ExportLazPts": false
        }
    }

Above workflow does the following operations.

- Work item :code:`1` with :code:`Gen_MaterialPoints_SurfaceLayers` generates sampling points on the surface of geometry with  :code:`0` and :code:`10` depth. 
- Work item :code:`2` with :code:`Gen_MSTMesh_Basic` computes the MST line structure with previous generated material points and export the results as beam elements.
- Work item :code:`3` with :code:`Define_Lattice` defines the mesh lattice which read the mesh exported from item :code:`2` .  
- Work item :code:`4` with :code:`Add_Lattice` generate the lattice.
- Work item :code:`5` with :code:`Export` extracts the mesh and export the mesh into a file.

The parameters of the keyword :code:`Gen_MaterialPoints_SurfaceLayers` are defined as below.

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`inp_meshfile`
     - A file path string of the input geometry. 
   * - :code:`depth`
     - A list of numerical values that defines the sampling surfaces. In this example, the material is sampled on the geometry surface itself (SDF depth :code:`0.0`) as well as on an inward offset surface at an SDF depth of :code:`10.0`.
   * - :code:`res`
     - approximated material points spacing distance in X, Y and Z direction. 
   * - :code:`sampling`
     - Sampling strategy, it supports :code:`Poisson` sampling algorithm in the current version.
   * - :code:`out_matpoints_file`
     - the export file path of the generated material points.

The parameters of the keyword :code:`Gen_MSTMesh_Basic` are defined as below. 

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`inp_matpoints_file`
     - A file path string of the input material points file. 
   * - :code:`out_meshfile`
     - an exported results mesh file, or mesh id in mesh container.

Two layers of tree structures were generated based on defined depth. 

.. image:: ./pictures/MST_01.png

.. image:: ./pictures/MST_02.png

======================
Streamlines over Field
======================

Artisan is now focusing on the development of field based line structure without defining mesh and lattice unit. 
Unlike the mesh based conformal lattice, the field based line structure lattice do not rely on the pre-defined mesh, or lattice unit, user only need to produce a field that conformal to the geometry shape, and use the streamline algorithm to generate the structure. 

Example :code:`\Test_json\LaplaceField\LaplaceField_LineStructure.json` shows a procedure of field based conformal line structure lattice generation using laplace field. 

.. code-block:: json

    {
    "Setup": {
        "Type": "Geometry",
        "Sample": {
            "Domain": [
                [0.0, 0.0],
                [0.0, 0.0],
                [0.0, 0.0]
            ],
            "Shape": "Box"
        },
        "Geomfile": "..//..//sample-obj//LaplaceFieldGeometry.stl",
        "Rot": [0.0, 0.0, 0.0],
        "res": [1.0, 1.0, 1.0],
        "Padding": 5,
        "onGPU": false,
        "memorylimit": 161061273000,
        "JsonWorkDir": true
    },
    "WorkFlow": {
        "1": {
            "Gen_Field_Laplace": {
                "inp_meshfile":"..//..//sample-obj//LaplaceFieldGeometry.stl", 
                "res": [2.5, 2.5, 2.5], 
                "sources":[75.0, 75.0, 170.0], 
                "source_strengths":[1000.0],
                "sinks":[75.0, 75.0, -35.0],
                "sink_strengths": [-1000.0],
                "influence_factors": {
                    "radius": 50,                     
                    "kernel": "tophat"
                }, 
                "solver_factors":{
                    "method": "bicgstab",
                    "tol": 1e-3,
                    "maxiter":300
                },
                "out_fieldfile": "LaplaceField", 
                "is_create_on_lattice_field": false       
            }
        },
        "2":{
            "Gen_Mesh_Streamlines": {
                "inp_fieldfile":"LaplaceField", 
                "out_meshfile":"..//..//Test_results//LaplaceField_Mesh.inp",               
                "source": [75.0, 75.0, 170.0], 
                "sink": [75.0, 75.0, -35.0],
                "step": 1.5, 
                "num_integration_steps": 350,
                "num_streamlines_seeds": 100,               
                "source_plane_dir": [0.0, 0.0, -1.0],
                "source_plane_radius": 20.0,
                "min_streamlines_spacing": 2.0
            }
        },
        "3": {
        "Define_Lattice":{
            "la_name": "LaplaceStreamLines",
            "definition": {
                    "type": "MeshLattice",
                    "definition": {
                            "meshfile": "..//..//Test_results//LaplaceField_Mesh.inp",
                            "k" : 0.0
                                }
                        }
                    }
            },
        "4": {"Add_Lattice":{
                "la_name": "LaplaceStreamLines", 
                "size": [10.0,10.0,10.0], 
                "thk":1.2, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                "Inv": false, "Fill": true, "Cube_Request": {}
                }
           },
        "999":{"Export": {"outfile": "..//..//Test_results//LaplaceField_LineMeshLattice.stl"}}    
    },
    "PostProcess": {
        "CombineMeshes": true,
        "RemovePartitionMeshFile": false,
        "RemoveIsolatedParts": true,
        "ExportLazPts": false
        }
    }

Above workflow does the following operations.

- Work item :code:`1` with :code:`Gen_Field_Laplace` solves the laplace equation with defined source and sink points. 
- Work item :code:`2` with :code:`Gen_Mesh_Streamlines` reads the field, and generates the streamlines of the field.
- Work item :code:`3` with :code:`Define_Lattice` defines the mesh lattice which read the mesh exported from item :code:`2` .  
- Work item :code:`4` with :code:`Add_Lattice` generate the lattice.
- Work item :code:`5` with :code:`Export` extracts the mesh and export the mesh into a file.

The :code:`Gen_Field_Laplace` keyword solves a well-defined Laplace equation over the specified domain. In this formulation, the given geometry is treated as the boundary, with a zero normal flux boundary condition applied, for example, effectively modeling the boundary as a perfectly insulated layer, analogous to a heat transfer conduction problem with no flux across the surface.

The parameters of the keyword :code:`Gen_Field_Laplace` are defined as below.

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`inp_meshfile`
     -  A mesh ID or file path of defined geometry as boundary of the field problem. 
   * - :code:`res`
     - A list of numerical values that defines the sampling surfaces. In this example, the material is sampled on the geometry surface itself (SDF depth :code:`0.0`) as well as on an inward offset surface at an SDF depth of :code:`10.0`.
   * - :code:`sources`
     - A list of 3 float numbers defining the coordinate of source. 
   * - :code:`source_strengths`
     - Strength of the source, usually this is a positive number. 
   * - :code:`sinks`
     - A list of 3 float numbers defining the coordinate of sink. 
   * - :code:`sink_strengths`
     - Strength of the sink, usually this is a negative number. 
   * - :code:`influence_factors`
     - This defines the source and sink influence volumes, it contains two parameters, :code:`kernel` defines influence pattern, :code:`tophat` means the strength maintaining constant value within this given :code:`radius` volume. 
   * - :code:`solver_factors`
     - This defines the solver related parameters: :code:`method` supports the solver :code:`cg`, :code:`gmres`, :code:`bicgstab`,
        :code:`spsolve` and :code:`splu`; :code:`tol` defines tolerance of the numerical convergence; :code:`maxiter` defines the maximum number of iteration.
   * - :code:`out_fieldfile`
     - the export ID or file path for the field results.  
   * - :code:`is_create_on_lattice_field`
     - if :code:`true`, the grids over the domain for numerical solution will created on the lattice field. 

The keyword :code:`Gen_Mesh_Streamlines` generates the stream lines from field as beam element based mesh. User may use this mesh as tool mesh, for example, to generate the pipe lines for fluids driven heat transferring application.  

The parameters of the keyword :code:`Gen_Mesh_Streamlines` are defined as below.

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`inp_fieldfile`
     - A field ID or a field file path as input field. 
   * - :code:`out_meshfile`
     - A mesh ID or mesh file path for exporting results.
   * - :code:`source`
     - A coordinate of the source point. 
   * - :code:`sink`
     - A coordinate of the sink point, e.g. stop point.
   * - :code:`num_integration_steps`
     - The number of numerical integration steps. 
   * - :code:`source_plane_dir`
     - The keyword will define a circle area for generating a number of seed points to start computing the stream lines, :code:`source_plane_dir` defines the direction of plane at the :code:`source` point. 
   * - :code:`source_plane_radius`
     - The radius of the circle around the :code:`source` point to generate the seed points.
   * - :code:`num_streamlines_seeds`
     - The total number of candidate seed points of the starting points of stream lines. Please note, the some candidates will be removed from results if neighboring two lines are smaller than the :code:`min_streamlines_spacing`. 
   * - :code:`min_streamlines_spacing`
     -  minimum spacing between two neighboring stream lines, if less than, one stream line will be removed from result. 

Below, the streamline lattice is overlaid within the specified geometric domain. The generated lattice, highlighted in green, conforms perfectly to the given geometry. Users can further generate multiple layers to fill the remaining available space.

.. image:: ./pictures/LaplaceField_01.png

.. image:: ./pictures/LaplaceField_02.png

.. image:: ./pictures/LaplaceField_03.png