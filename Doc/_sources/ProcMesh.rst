Mesh Process
************

A mesh is a discrete approximation of a given shape, consisting of vertices, edges, and faces that define its structure. In Artisan, meshes serve as the foundation for constructing conformal lattice infill, enabling intricate and efficient design configurations. Users can leverage these meshes for a variety of design purposes. Artisan continually enhances its mesh processing capabilities, introducing new functions and tools to expand the possibilities for design.

=============================
Extract External Surface Mesh 
=============================

User may extract the surface mesh (either Quad or Triangle) from the volumetric mesh. The extracted mesh can be used, for instance, as conformal mesh for external reinforcement bars and patterns. Below shows the keyword :code:`Proc_Mesh_ExtractSurf` to extract the surface mesh from user given mesh, user many find this example under the folder :code:`.//Test_json//MeshLattice//ExtractMeshSurf//ExtractMeshSurf.json`.

.. code-block:: json

    {
        "Setup": {
            "Type": "Sample",
            "Sample": {
                "Domain": [[-10.0, 10.0], [-10.0, 10.0], [-10.0, 10.0]],
                "Shape": "Box"
            },
            "Geomfile": "",
            "Rot": [0.0, 0.0, 0.0],
            "res": [0.1, 0.1, 0.1],
            "Padding": 1,
            "onGPU": false,
            "memorylimit": 1073741824000
        },
        "WorkFlow": {
            "1": {
                "Gen_CylindricalMesh": {
                    "num_elem": [3, 10, 3],
                    "r_range": [2.0, 8.0],
                    "phi_range": [0.0, 1.0],
                    "ori": [0.0, 0.0, -2.0],
                    "Height": 10.0,
                    "Normal": [0.0, 0.0, 1.0],
                    "Mesh_file": ".//Test_json//MeshLattice//ExtractMeshSurf//CylindricalMesh.med"
                }
            },
            "2": {
                "Proc_Mesh_ExtractSurf": {
                    "Elem_Type": "Hex",
                    "inp_meshfile": ".//Test_json//MeshLattice//ExtractMeshSurf//CylindricalMesh.med",
                    "out_meshfile": ".//Test_json//MeshLattice//ExtractMeshSurf//CylindricalMeshSurf.med",
                    "isSplitTris": true
                }
            },
            "3": {
                "Add_Lattice": {
                    "la_name": ".//Test_json//MeshLattice//ExtractMeshSurf//GenCylindricalSurfMesh.mld",
                    "size": [3.0, 3.0, 3.0],
                    "thk": 0.25,
                    "Rot": [0.0, 0.0, 0.0],
                    "Trans": [0.0, 0.0, 0.0],
                    "Inv": false,
                    "Fill": false,
                    "Cube_Request": {}
                }
            },
            "9999": {
                "Export": {
                    "outfile": ".//Test_results/CylindricalMesh_ConformalLattice.stl"
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

The workflow item :code:`2` is the keyword :code:`Proc_Mesh_ExtractSurf`, and only takes the following 4 parameters:

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`Elem_Type`
     - supports :code:`Hex` and :code:`Tet`, former extracts the surface elements from the hex elements, latter extracts the surface triangles from the tet elements;
   * - :code:`inp_meshfile` 
     - file path to the input mesh file, currently supports Abaqus inp file and salome med file. 
   * - :code:`out_meshfile`
     - file path for the export mesh file, currently supports Abaqus inp file and salome med file.
   * - :code:`isSplitTris`
     - a boolean type parameter, if :code:`true`, the quad elements (surface mesh of hex element) will be split to 2 triangles. 

Above JSON produce the following result. 

.. image:: ./pictures/Extract_SurfMesh_Tris.png 

And in the example :code:`ExtractSurfMesh_Sphere.json`, the JSON workflow produce a partial spherical mesh, and then extract the all quad surface elements. 

.. image:: ./pictures/Extract_SurfMesh_Quad.png

and the triangle surface mesh (example: :code:`ExtractMeshSurf_EngineBracket.json`) 

.. image:: ./pictures/Extract_SurfMesh_ExtractTris.png 


===========
Octree Mesh 
===========

Octree mesh generation is possible. User only need provide an input mesh to the keyword :code:`Proc_Mesh_Octree` and geometric field to generate the octree mesh. Below is a simple example that generates an octree mesh using the input mesh and spherical geometry. Please note that this experimental feature may subject to change in future. 

.. code-block:: json 

    {
        "Setup": {
            "Type": "Geometry",
            "Sample": {
                "Domain": [[0.0, 1.0], [0.0, 1.0], [0.0, 1.0]],
                "Shape": "Box"
            },
            "Geomfile": ".//sample-obj//Ball_Mesh.STL",
            "Rot": [0.0, 0.0, 0.0],
            "res": [5.0, 5.0, 5.0],
            "Padding": 4,
            "onGPU": false,
            "memorylimit": 1073741824000
        },
        "WorkFlow": {
            "1": {
                "Gen_BoxMesh": {
                    "num_elem": [5, 5, 5],
                    "x_range": [0.0, 1200.0],
                    "y_range": [0.0, 1200.0],
                    "z_range": [0.0, 1200.0],
                    "ori": [-600.0, -600.0, -600.0],
                    "Normal": [0.0, 0.0, 1.0],
                    "z_angle": 0.0,
                    "Mesh_file": ".//Test_json//MeshLattice//OctTree//BoxMesh.med"
                }
            },
            "2": {
                "Proc_Mesh_Octree": {
                    "Type":"Geom",
                    "inp_meshfile": ".//Test_json//MeshLattice//OctTree//BoxMesh.med",
                    "out_meshfile": ".//Test_json//MeshLattice//OctTree//BoxMeshOut.inp",
                    "Fieldfile": ".//sample-obj/Ball_Mesh.STL",
                    "numCoverNodes": 4,
                    "refine_stepsize": 150,
                    "num_refinements": 3
                }
            },
            "3": {
                "Add_Lattice": {
                    "la_name": ".//Test_json//MeshLattice//OctTree//OctTreeConformal.mld",
                    "Rot": [0.0, 0.0, 0.0],
                    "Trans": [0.0, 0.0, 0.0],
                    "Inv": false,
                    "Fill": false,
                    "Cube_Request": {},
                    "thk": 15.0,
                    "size": [20.0, 20.0, 20.0]
                }
            },
            "10000": {
                "Export": {
                    "outfile": ".//Test_results//OctTreeMesh.stl"
                }
            }
        },
        "PostProcess": {
            "CombineMeshes": true,
            "RemovePartitionMeshFile": false,
            "RemoveIsolatedParts": true,
            "ExportLazPts": false
        }
    }

The keyword :code:`Proc_Mesh_Octree` processes the given input mesh and generates the octree mesh. This function used the input field (here the geometric signed distance field) as design parameter. It will gradually expand the checking range (from low value to high value) to check whether the element is inside of the current range, if yes, then conduct the refinement. Those which have been inside checking multiple times, shall be refined multiple times. The details of the parameters are listed below. 

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`Type`
     - supports :code:`Geom` and :code:`Field`. In current version, only :code:`Geom` works. :code:`"Geom"` takes the geometric mesh file as input and computes the signed distance field as parameter to refine the given mesh.
   * - :code:`inp_meshfile` 
     - file path to the input mesh file, currently supports Abaqus inp file and salome med file. 
   * - :code:`out_meshfile`
     - file path for the export mesh file, currently supports Abaqus inp file and salome med file.
   * - :code:`Fieldfile`
     - In :code:`"Geom"` type, this string has to be a path to :code:`stl`, :code:`ply` or :code:`obj` file. In future, it shall support the field data file. 
   * - :code:`numCoverNodes`
     - can be range from -1 to 8. If not :code:`0`, the function will eliminate the after refinement mesh elements, any element with the number of inside nodes less then this value shall be removed. if it is :code:`-1`, the function will check whether the mid-point of a element is inside of the geometry. 
   * - :code:`refine_stepsize`
     - The function will gradually expand its checking range by using this step size value. 
   * - :code:`num_refinements`
     - The function will gradually expand its checking range by using this step size number. 


Above JSON produce the following refined mesh,

.. image:: ./pictures/Octreemesh_01.png

and its cross-sectional view as below. 

.. image:: ./pictures/Octreemesh_02.png




     


