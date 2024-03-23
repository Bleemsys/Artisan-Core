Meshing 
*******

One way of creating lattice infill is mapping the given lattice unit, such strut, TPMS or geometry, into the infill domain as defined by mesh. User may refers to the conformal lattice generation section for details. This section summarized the basic integrated mesher functions. All examples here you should be able to find under the folder :code:`Test_json\MeshLattice`, or otherwise specified locations.

==================
Tetrahedron Mesher
==================

Artisan has an integrated simple tetrahedron elements mesher that automatically meshes the given geometry using Delaunay triangulation algorithm. This basic meshing algorithm discretize the geometry layer-by-layer that conforms the geometric shape. The following JSON, that stores at the file :code:`GenTetBasicMesh.txt`, meshed a sphere with the radius of 600 mm and generated the mesh lattice by using the exactly same mesh. 

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//Ball_Mesh.STL",
                "Rot" : [0.0,0.0,0.0],
                "res":[5.0,5.0,5.0],
				"Padding": 4,
                "onGPU": false,
                "memorylimit": 16106127360
                },
    "WorkFlow":{
          "1": {"Gen_TetBasicMesh":{
                    "Geomfile": ".//sample-obj//Ball_Mesh.STL", 
					"size": [100.0,100.0,100.0],
					"Meshfile": ".//sample-obj//Ball_Mesh.med",
                    "ConvertTet2Beam": true
                    }
               },
          "2": {"Add_Lattice":{
                    "la_name": ".//Test_json_03//GenTetBasicMesh.mld", 
                    "size": [150.0,150.0,150.0], "thk":10.0, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": false, "Cube_Request": {}
                    }
               },
          "3": {
                "Export": {"outfile": ".//Test_results/BallBasicTetNMesh_Lattice.stl"}
               }
		          },
    "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": true}
     }

The keywords :code:`Gen_TetBasicMesh` activates the algorithm. The parameter :code:`"Geomfile"` defines the location of the target meshing geometry, :code:`Meshfile` indicates where the mesh would be stored. Currently it supports Abaqus :code:`inp`, Ansys fluent :code:`msh` and Salome :code:`med` file format. The parameter :code:`"size"` defines the lattice size at current layer as 

.. math::

  num_{nodes} = area / (size[0]*size[1]*0.5)

:code:`num_{nodes}` is the number of nodes at current layer, and they were evenly and randomly distributed over the current layer surface. The value :code:`size[2]`, which is the third element in :code:`size`, defines the layer depth, here 100 mm depth. The parameter :code:`ConvertTet2Beam` is boolean type definition, that :code:`"true"` meant the mesher will convert generated tetrahedron to the beam element (a 2-node-strut-like element), :code:`false` will keep tetrahedron element. One of the benefits is user may import the beam element into the FEA solver for further analysis if the mesh lattice is desired.

Above JSON produced a mesh lattice filled ball geometry as shown below. 

.. image:: ./pictures/BallMeshLattice.png

The cross-sectional view below clearly showed the lattices were stacked layer by layer, from exterior surface towards center. 

.. image:: ./pictures/BallMeshLattice_CrossSection.png

The second tetrahedron mesher is activated using the :code:`Gen_TetBasicMesh_HexSplit` keyword. It shares the same parameters with :code:`Gen_TetBasicMesh`. This mesher accepts the nodes of the Cartesian Hex Mesh (refer to the Cartesian Mesher section) as input vertices and applies the tetrahedron algorithm to generate all tetrahedral elements. Users can refer to the example :code:GenTetBasicMesh_HexSplit.txt, as illustrated below. One advantage of this method is that the mesher produces approximately evenly spaced vertices that are distributed across the shape's surface and volumetric domain.

.. image:: ./pictures/TetBasic_HexSplit.png 

Please note that, this simple mesher may apply to the geometry with less dramatic change and more continuously smooth surface change. The quality of mesh may vary depending on the geometry features and definitions of mesh size etc.. For more complex mesh pattern, user may consider use professional mesher and import the results as input in mesh lattice generation workflow.  

===============
Voronoi Polygon
===============

A Voronoi diagram, also known as a Voronoi tessellation or Voronoi decomposition, is a geometric structure that partitions a space into regions based on the proximity to a set of given points. In a Voronoi diagram, each point in the set is associated with a unique region that consists of all locations in the space that are closer to that point than any other point. It is named after the Russian mathematician Georgy Voronoi, who first introduced the idea. Voronoi polygons have various applications, such as in computer graphics, spatial analysis, geographical information systems, and computational biology. They provide a way to partition space based on proximity and are useful in solving proximity-based problems and analyzing spatial patterns. In additive manufacturing, this structure is often used on the components which suppose to bear loading with cushioning effect. 

Setup the generation of the Voronoi polygons on the given geometry is similar to the tet mesher. Below shows the piece of setup JSON (the file :code:`GenVorMesh.txt`).

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//Ball_Mesh.STL",
                "Rot" : [0.0,0.0,0.0],
                "res":[5.0,5.0,5.0],
		        "Padding": 4,
                "onGPU": false,
                "memorylimit": 16106127360
                },
     "WorkFlow":{
          "1": {"Gen_VoronoiPolyMesh":{
                    "Geomfile": ".//sample-obj//Ball_Mesh.STL", 
		            "size": [100.0,100.0,100.0],
		            "Meshfile": ".//sample-obj//Ball_VorMesh.med",
		            "remove_tol": 5.0
                    }
               },
          "2": {"Add_Lattice":{
                    "la_name": ".//Test_json//MeshLattice//GenVorMesh.mld", 
                    "size": [150.0,150.0,150.0], "thk":10.0, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }
               },
          "3":{
              "Export": {"outfile": ".//Test_results/BallBasicVoriMesh_Lattice.stl"}
              }
		   },
     "PostProcess":{
                "CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": true
                }
    }

The parameter setup is very similar to the keywords :code:`Gen_TetBasicMesh`. The additional parameter :code:`remove_tol` defines tolerance of removing the strut which contains the end node outside of the given geometry. The mesh is an approximation of geometry, sometime, the end-nodes may locate beyond the boundary of geometric shape. This parameter allows user to flexibly remove such. The results are shown below. 

.. image:: ./pictures/VoriMeshBall.png

And the cross-section view shows how the mesher generates the element layer by layer. 

.. image:: ./pictures/VoriMeshBall_CrossSection.png

We can certainly apply this to a more complex geometry. The example below (:code:`GenVorMesh_crank_handle.txt`) shows the generation of the Voronoi polygons on a real world component. 

.. code-block:: json

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//crank_handle.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.25,0.25,0.25],
		      "Padding": 4,
                "onGPU": false,
                "memorylimit": 16106127360000000
                },
     "WorkFlow":{
          "1": {"Gen_VoronoiPolyMesh":{
                    "Geomfile": ".//sample-obj//crank_handle.stl", 
		            "size": [3.0,3.0,3.0],
		            "Meshfile": ".//sample-obj//crank_handle.med",
		            "remove_tol": 0.6
                    }
               },
           "2": {"Add_Lattice":{
                    "la_name": ".//Test_json//MeshLattice//GenVorMesh_crank_handle.mld", 
                    "size": [3.5,3.5,3.5], "thk":0.5, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }
               },
           "3":{
                "Export": {"outfile": ".//Test_results/crank_handle_VoriMesh_Lattice.stl"}
              }
		    },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": true}
    }

And the mesh lattice defintion (:code:`GenVorMesh_crank_handle.mld`) is:

.. code-block:: json

    {
        "type": "MeshLattice",
        "definition": {
            "meshfile": ".//sample-obj//crank_handle.med"
        }
    }

The result is shown as below. As mentioned before, the current mesh strategy may not handle the sharp edge very well, but, in general, it produces a good fitting of Voronoi polygons. 

.. image:: ./pictures/crank_handle_vori_mesh.png

Similar to the tetrahedron mesher, Artisan also features a Voronoi mesher that utilizes the vertices of the Cartesian mesh. The example file :code:`GenVorMesh_HexSplit.txt` includes the keyword :code:`Gen_VoronoiPolyMesh`, which generates a partial Voronoi mesh using the vertices of the Cartesian mesh.

.. image:: ./pictures/VoriBasic_HexSplit.png

================
Cartesian Mesher 
================

Artisan has an integrated Cartesian mesher, which can be used to generate an approximated conformal hex mesh. It's important to note that this mesher employs a projection method to align the boundary mesh nodes with the surface of the given geometry. As a result, the output in some cases may not be a true conformal hex mesh. Even if the boundary mesh is significantly distorted, users can still utilize the resulting mesh to create a lattice that adheres to the given boundary shape. For an example of generating hex-dominant elements on a geometry, users can refer to the file :code:`CartesianHexMesh\\GenCartesianHexMesh.txt`.

.. code-block:: json 

    {"Setup":{  "Type" : "Geometry",
                "Geomfile": ".//sample-obj//telecope_tripode_base.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.1, 0.1, 0.1],
		        "Padding": 4,
                "onGPU": false,
                "memorylimit": 16106127360000000
                },
    "WorkFlow":{
          "1": {
               "Gen_BasicCartesianHexMesh":{
                 "num_elem": [40, 25, 25],
                 "x_range": [0.0, 60.0],
                 "y_range": [0.0, 27.0],
                 "z_range": [0.0, 26.0],
                 "ori":[-48.0,-20.0,0.0],
                 "Normal": [0.0,0.0,1.0],
                 "z_angle": 0.0,
                 "Meshfile": ".//Test_json//CartesianHexMesh//TripodeHexMesh.med",
                 "Geomfile": ".//sample-obj//telecope_tripode_base.stl",
                 "numPrjLayers": 1, 
                 "LayerDepth": 1.0, 
                 "numCoverNodes": -1
                }
               },
          "2": {
               "Add_Lattice":{
                    "la_name": ".//Test_json//CartesianHexMesh//Tripod_HexInfill.mld", 
		                "size": [1.0, 1.0, 1.0], "thk":0.2, 
 		                "Rot": [0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0], 
		                "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }
               },
          "3": {
               "Export": {"outfile": ".//Test_results//Tripod_HexInfill.stl"}
               }
		   },
    "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": true}
    }

The keywords :code:`Gen_BasicCartesianHexMesh` calls the function of producing the Cartesian mesh. Its parameters are very similar to block mesh generation. User may refer to the section :code:`Primitive Design` for details. Here only lists the additional parameters.

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`Geomfile`
     - this parameter defines the targeting geometry, and it is a string defining the path to the file.
   * - :code:`numPrjLayers` 
     - an integer number defines the number of layer projections. If :code:`0`, no projection will be conducted. 
   * - :code:`LayerDepth`
     - the depth of each layer. if :code:`numPrjLayer` is :code:`1`, this parameter is disabled.
   * - :code:`numCoverNodes`
     - an integer number of nodes covered in the boundary layer. It shall be between :code:`1` to :code:`8`. Any elements will the number of node insider geometry less than this definition will be removed. If defines as :code:`-1`, the center point of the element will be used to checked whether the element is inside or outside of geometry. The element outside of geometry will be removed.   

Above example produce the following results. The tripod geometry is overlapped with the cubic lattice using the generated mesh. 

.. image:: ./pictures/Tripod_HexInfill.png

.. image:: ./pictures/Tripod_HexInfill_v02.png

.. note::
     In the JSON example above, the center of the hex element was used to determine whether the element should be removed. Users can experiment with different removal strategies to see how the parameter :code:`numCoverNodes` impacts the final results. In the following example, the parameter :code:`numPrjLayer` is set to :code:`0`. The resulting jig-saw shaped element cluster demonstrates how the Cartesian mesh approximates the outline of the geometry. While this projection method may not guarantee high-quality hex elements, it does produce a hex-dominant mesh that can be utilized for hex lattice infill.

.. image:: ./pictures/Tripod_HexInfill_v03.png


================================
Surface Mesher for Quad Elements 
================================

The surface mesher is a function based on the Cartesian mesher algorithm. It extracts the exterior element surfaces and projects the boundary nodes back onto the geometry's surface. Similar to the Cartesian mesher, the surface mesher produces an approximated all-quad or quad-dominant mesh, which can be used to generate the surface lattice. Please note that the mesher only supports closed surface bodies. Here is a simple example of producing a quad element dominant mesh on a ball. Users can find this example in the file :code:`SurfaceLattice\\Gen_BasicSurfQuadMesh.txt`.

.. code-block:: json 

    {"Setup":{      "Type" : "Sample",
                "Sample": {"Domain" : [[-600.0, 600.0],[-600.0, 600.0],[-600.0, 600.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[4.0, 4.0, 4.0],
                "Padding": 4,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
    "WorkFlow":{
          "1": {
               "Gen_BasicQuadMesh":{
                 "num_elem": [20, 20, 20],
                 "x_range": [0.0, 20.0],
                 "y_range": [0.0, 20.0],
                 "z_range": [0.0, 20.0],
                 "ori":[-10.0,-10.0,-10.0],
                 "Normal": [0.0,0.0,1.0],
                 "z_angle": 0.0,
                 "Meshfile": ".//Test_json//SurfaceLattice//BallSurfQuadMesh.med",
                 "Geomfile": ".//sample-obj//Ball_Mesh.stl",
                 "isProjection": true,  
                 "numCoverNodes": 1,
		         "isSplitTris": false
                }
               },
          "2": {"Add_Lattice":{
                    "la_name": ".//Test_json//SurfaceLattice//BasicSurfQuadLattice.mld", 
                    "size": [15.0, 15.0, 15.0], "thk":7.0, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }
               },
          "3":{
              "Export": {"outfile": ".//Test_results//BasicSurfMeshLattice.stl"}
              }
          
		   },
    "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": true}
    }

Very similar to the keywords :code:`Gen_BasicCartesianHexMesh`, the keywords :code:`Gen_BasicQuadMesh` requires to setup the parameter of projection (:code:`isProjection`) and number of covered nodes (:code:`numCoverNodes`), moreover, it also asks whether splits a quad element as two triangle elements (:code:`isSplitTris`). In this case, we do not want to split the quad element (:code:`"isSplitTris": false`). The result mesh is below.

.. image:: ./pictures/BasicQuadMesh.png

Or we could split the quad as two triangle by :code:`"isSplitTris": true`.

.. image:: ./pictures/BasicQuadMesh_Split.png

This function can certainly be applied to more complicated geometry. The provided example JSON can be located in the file named :code:`SurfaceLattice\Gen_BasicSurfQuadMesh.txt`. This specific example illustrates the geometry of a crank handle, which is primarily composed of quadrilateral elements. It is important to note that while the majority of the elements in this mesh are quadrilaterals, some of these elements may exhibit significant distortion, resulting in shapes that closely resemble triangles. Despite this, the overall structure of the mesh predominantly consists of quadrilateral elements, making it a quad-dominant mesh. 

.. image:: ./pictures/crank_handle_quadmesh.png

.. image:: ./pictures/crank_handle_quadmesh_02.png

