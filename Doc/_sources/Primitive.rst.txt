Primitive Design
****************

Often the design of the lightweight structure requires the lattice generation on a primitive shape, such as cylinder or sphere. Artisan can generate mesh-based discretization of the domain and morph the lattice unit onto the element. All examples in this section can be found under the folder :code:`\\Test_json\\PrimitiveDesign\\`. Note that, all mesh generation of primitive shapes only supports :code:`.med` file format.  

==================
Cylindrical Domain
==================

The design on the cylindrical domain is common in most of industrial applications, for instance, the heat exchanger in the pressurized vessel application. Artisan integrates a simple mesh generator for the cylindrical domain. User may use this infrastructure to further produce conformal lattice. The definition of the cylindrical domain requires the radius, :math:`\phi` and height.

The following example can be find in the file :code:`GenCylindricalConformalMesh.txt`.    

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[-10.0,10.0],[-10.0,10.0],[-10.0,10.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.1,0.1,0.1],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
     "WorkFlow":{
          "1": {"Gen_CylindricalMesh":{
                     "num_elem": [3,10,3], 
                     "r_range": [2.0,8.0],
                     "phi_range": [0.0,1.0],
                     "ori":[0.0,0.0,-2.0],
                     "Height": 10.0,
                     "Normal": [0.0,0.0,1.0],
                     "Mesh_file": ".//Test_json//PrimitiveDesign//CylindricalMesh.med"
                    }
               },
          "2": {"Add_Lattice":{
                    "la_name": ".//Test_json//PrimitiveDesign//GenCylindricalConformalMesh.mld", 
                    "size": [3.0,3.0,3.0], "thk":0.25, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }
               },
          "3":{
              "Export": {"outfile": ".//Test_results/CylindricalMesh_ConformalLattice.stl"}
              }
		   },
     "PostProcess":{"CombineMeshes": true,
                    "RemovePartitionMeshFile": false,
                    "RemoveIsolatedParts": true, 
                    "ExportLazPts": true}
    }


The keywords :code:`Gen_CylindricalMesh` contains the parameters as defined in the table below. 

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`num_elem`
     - it is a list parameter containing 3 elements. Each elements defines the number of lattice units in each direction.
   * - :code:`r_range` 
     - a list parameter containing 2 elements. The first one defines the lower bound of radius, and the second one defines the upper bound of radius. Two elements forms the range of infill.
   * - :code:`phi_range`
     - a list parameter containing 2 elements. The first one defines the lower bound of :math:`\phi`, and the second one defines the upper bound of :math:`\phi`. Two elements forms the span range in :math:`\phi` direction.
   * - :code:`ori`
     - a list parameter defining the coordinate of origin of the cylinder shape.
   * - :code:`Height`
     - a float number defining the height of cylinder shape.  
   * - :code:`Normal`
     - a list containing 3 elements, and it is the definition of the normal direction of the cylinder.
   * - :code:`Mesh_file`
     - the file path to store the results.

The results as blow shows a strut lattice generation on the cylinder body. User may certainly change to other types of lattice unit, e.g. TPMS or geometry.
    
.. image:: ./pictures/Cylindrical_Mesh.png

The parameter :code:`phi_range` provides a more interesting design features, that may help to control spanning of the cylinder. For example, the illustration below shows the case of the parameter :code:`"phi_range": [0,0.5]`. 

.. image:: ./pictures/Cylindrical_Mesh_half.png


================
Spherical Domain
================

User can generate lattices on the spherical domain through the keywords :code:`Gen_SphericalMesh`. The JSON below (filename: :code:`GenSphericalConformalMesh.txt`) shows a demonstration of this feature using TPMS lattice.

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[-10.0,10.0],[-10.0,10.0],[-10.0,10.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.05,0.05,0.05],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
    "WorkFlow":{
          "1": {"Gen_SphericalMesh":{
                     "num_elem": [3,10,4], 
                     "r_range": [3.0,8.0],
                     "phi_range": [0.0,1.0],
                     "theta_range":[0.3,0.7],
                     "ori":[0.0,0.0,0.0],
                     "Normal": [1.0,1.0,0.0],
                     "Mesh_file": ".//Test_json//PrimitiveDesign//SphericalMesh.med"
                    }
               },
          "2": {"Add_Lattice":{
                    "la_name": ".//Test_json//PrimitiveDesign//GenSphericalConformalMesh.mld", 
                    "size": [3.0,3.0,3.0], "thk":0.2, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }
               },
          "3":{
              "Export": {"outfile": ".//Test_results/SphericalMesh_ConformalLattice.stl"}
              }
		   },
    "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": true}
    }

The parameters in :code:`Gen_SphericalMesh` are explained in the table below.

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`num_elem`
     - it is a list parameter containing 3 elements. Each elements defines the number of lattice units in each direction.
   * - :code:`r_range` 
     - a list parameter containing 2 elements. The first one defines the lower bound of radius, and the second one defines the upper bound of radius. Two elements forms the range of infill.
   * - :code:`phi_range`
     - a list parameter containing 2 elements. The first one defines the lower bound of :math:`\phi`, and the second one defines the upper bound of :math:`\phi`. Two elements forms the span range in :math:`\phi` direction.
   * - :code:`theta_range`
     - a list parameter containing 2 elements. The first one defines the lower bound of :math:`\theta`, and the second one defines the upper bound of :math:`\phi`. Two elements forms the span range in :math:`\theta` direction.
   * - :code:`ori`
     - a list parameter defining the coordinate of origin of the cylinder shape.
   * - :code:`Height`
     - a float number defining the height of cylinder shape.  
   * - :code:`Normal`
     - a list containing 3 elements, and it is the definition of the normal direction of the cylinder.
   * - :code:`Mesh_file`
     - the file path to store the results.

Below presented the resultant lattice on spherical domain. 

.. image:: ./pictures/spherical_mesh.png

Similar to the :code:`Gen_CylindricalMesh`, the keywords :code:`Gen_SphericalMesh` can also change the spanning of domain. In the case above, we have a complete :math:`\phi` direction spanning, and the spanning of :math:`\theta` is between :code:`0.3` to :code:`0.7` - :math:`0.3\times\pi` to :math:`0.7\times\pi`. User may alter both :code:`phi_range` and :code:`theta_range` to generate various combined spanning of the domain. The illustration below shows the case with parameter value :code:`"phi_range":[0.2, 0.8]`.

.. image:: ./pictures/spherical_mesh_part.png

==========
Box Domain
==========

User may define a hex mesh in the box-shape domain, and then conformal the lattice structure. This will produce the exact same results as the conventional way of lattice filling in the domain. The conformal lattice uses a different algorithm to compute the infill to the conventional periodic lattice infill. The base code of conformal lattice use openMP to accelerate the calculations, this can be dramatically faster when number of infill is huge. This functionality aims to provide an easy access to the faster algorithm in order to improve the efficiency. Below shows an example of filling lattice using the generated box mesh. The example file can be found at :code:`\\PrimitiveDesign\\GenBoxConformalMesh.txt`. 

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[0.0,20.0],[0.0,20.0],[0.0,20.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.05,0.05,0.05],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
     "WorkFlow":{
          "1": {"Gen_BoxMesh":{
                     "num_elem": [8,8,8], 
                     "x_range": [0.0, 15.0],
                     "y_range": [0.0, 15.0],
                     "z_range": [0.0, 15.0],
                     "ori":[0.0,0.0,0.0],
                     "Normal": [0.0,0.0,1.0],
                     "Mesh_file": ".//Test_json//PrimitiveDesign//BoxMesh.med"
                    }
               },
          "2": {"Add_Lattice":{
                    "la_name": ".//Test_json//PrimitiveDesign//GenBoxConformalMesh.mld", 
                    "size": [2.5,2.5,2.5], "thk":0.1, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }
               },
          "3":{
              "Export": {"outfile": ".//Test_results/BoxMesh_ConformalLattice.stl"}
              }
		   },
     "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false, 
                "ExportLazPts": false}
    }

The result, as expected, is lattice infill in a box.

.. image:: ./pictures/BoxDomainMesh.png 

Here is the explanation of parameters.

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`num_elem`
     - it is a list parameter containing 3 elements. Each elements defines the number of lattice units in each direction.
   * - :code:`x_range` 
     - a list parameter containing 2 elements. The lower and upper bounds of the in x direction - the direction before rotation.
   * - :code:`y_range`
     - a list parameter containing 2 elements. The lower and upper bounds of the in y direction - the direction before rotation.
   * - :code:`z_range`
     - a list parameter containing 2 elements. The lower and upper bounds of the in z direction - the direction before rotation.
   * - :code:`ori`
     - a list parameter defining the coordinate of origin of the cylinder shape.  
   * - :code:`Normal`
     - a list containing 3 elements, and it is the definition of the normal direction of the box. If the direction is not aligned with [0.0, 0.0, 1.0], the box will be rotated accordantly.
   * - :code:`Mesh_file`
     - the file path to store the results.


=====================================
Primitive Shape and Geometry handling
=====================================

A few simple geometry handling functions have been integrated into Artisan. It could be useful if adding some geometric entity after lattice infill. It has to mention that, the whole geometry handling is based on implicit modelling concept, explicit modelling capability is not available. In general, user may :code:`Add`, :code:`Subtract` and :code:`Intersect` on the shape :code:`Sphere`, :code:`Box`, :code:`Cylinder` and other user defined geometries. 

In the example file :code:`\\Test_json\\PrimitiveDesign\\GenBox.txt`, a simple geometry was constructed using :code:`Sphere`, :code:`Box`, :code:`Cylinder`.

.. code-block:: json

  {"Setup":{    "Type" : "Sample",
                "Sample": {"Domain" : [[-5.0,5.0],[-5.0,5.0],[-5.0,5.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.05,0.05,0.05],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
 "WorkFlow":{
          "1": {"Add_Geometry":{
                     "Name": "Box", 
                     "k_factor": 0.0,
                     "push2GeomField": false,
                     "Paras": {
                         "ori": [0.0, 0.0, 0.0],
                         "normal": [0, 0, 1],
                         "length": [2, 2, 2]
                        }
                    }
               },
          "2": {"Add_Geometry":{
                     "Name": "Cylinder", 
                     "k_factor": 0.7,
                     "push2GeomField": false,
                     "Paras": {
                         "pa": [0.0, 0.0, 0.0],
                         "pb": [0.0, 0.0, 5.0],
                         "r": 1.0
                        }
                    }
               },
          "3": {"Subtract_Geometry":{
                     "Name": "Sphere", 
                     "k_factor": 0.5,
                     "push2GeomField": false,
                     "Paras": {
                         "ori": [-2.0, 0.0, 0.0],
                         "r": 1.5
                        }
                    }
               },
          "4":{
              "Export": {"outfile": ".//Test_results/GenBox.stl"}
              }
		   },
   "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false, 
                "ExportLazPts": false}
  }


Above JSON will produce a result of two combined shape with a subtracted spherical indent. 

.. image:: ./pictures/GenBox.png


There are other three examples in the folder :code:`\\Test_json\\`, called :code:`GenBox_Add.txt`, :code:`GenBox_Subtract.txt` and :code:`GenBox_Intersection.txt`. Three examples demonstrates the different operations between two boxes. Below shows the overlapping of three results. The red part is intersection part, the blue and grey makes the adding union results, and the grey is the cut result. All operation used the smooth transitions.

.. image:: ./pictures/PrimitiveShapes.png

.. image:: ./pictures/PrimitiveShapes_02.png

The keywords :code:`Add_Geometry` and :code:`Subtract_Geometry` manipulate the geometry handling, such as adding and subtracting. Along with the keywords :code:`Intersect_Geometry`, three keywords shared same parameters.

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`Name`
     - :code:`"Sphere"`, :code:`"Box"`, :code:`"Cylinder"` or the file path to the geometry file.
   * - :code:`k_factor` 
     - A float number above 0.0. It represents the smoothness transition around the conjunction areas. If :code:`0.0`, no smoothness. It should be a number less than :code:`1.0` in most of cases, but may beyond :code:`1.0`.
   * - :code:`"push2GeomField"`
     - If :code:`true`, the geometry handling will be applied to geometric field. If :code:`false`, the operation is applied to lattice field. 
   * - :code:`"Paras"`
     - The parameters used for the primitive shapes and geometries. 


The :code:`Box` shape has following parameters:

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`ori`
     - The center point coordinate of the box.
   * - :code:`normal`
     - A directional vector which forms the rotation from [0.0, 0.0, 1.0] to this given vector. If it is aligned with [0.0, 0.0, 1.0], no rotation.

The :code:`Sphere` shape has following parameters:

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`ori`
     - The center point coordinate of the sphere.
   * - :code:`r`
     - the radius of the sphere.

The :code:`Cylinder` shape has following parameters:

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`pa`
     - The center point coordinate of the box.
   * - :code:`pb`
     - A directional vector which forms the rotation from [0.0, 0.0, 1.0] to this given vector. If it is aligned with [0.0, 0.0, 1.0], no rotation.
   * - :code:`r`
     - The radius of the cylindrical body. 
     
It is possible to load external geometry, as demonstrated below. The JSON shows the parameter :code:`Name` in the keyword :code:`Add_Geometry` became a file path string. It is interpreted as an external geometry, not an integrated primitive shape. 


.. code-block:: json

  {"Setup":{    "Type" : "Sample",
                "Sample": {"Domain" : [[-10.0,10.0],[-10.0,10.0],[-10.0,10.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.05,0.05,0.05],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
   "WorkFlow":{
          
          "1": {"Add_Geometry":{
                     "Name": ".//sample-obj//Klemmwinkel Form A.stl", 
                     "k_factor": 0.0,
                     "push2GeomField": true,
                     "Paras": {
                         "Scale": [0.5, 0.5, 0.5],
                         "Trans": [0.0, 0.0, 5.0],
                         "Rot": [0, 0, 0]
                        }
                    }
               },
          "2": {"Add_Lattice":{
                    "la_name": "Cubic", "size": [2.0,2.0,2.0], "thk":0.1, 
                    "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0], 
                    "Inv": false, "Fill": true, 
                    "Cube_Request": {}
                    }
               },
          "3":{
              "Export": {"outfile": ".//Test_results/GenGeom.stl"}
              }
		   },
   "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": true}
  }

In this case, parameter :code:`Paras` has the following operation parameters, i.e. :code:`Scale`, :code:`Trans` and :code:`Rot`. The operation sequences is scale, translation, then rotation. 

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`Scale`
     - a list containing 3 elements, representing scales in three dimensions.
   * - :code:`Trans`
     - a list containing 3 elements, translational vector before rotation.  
   * - :code:`Rot`
     - a list of three radiuses defining the rotation using x, y and z axis.

The JSON reads an external geometry, conducted scale and translation, and push to geometric field, then conduct the periodic lattice infill in the geometry. 

.. image:: ./pictures/GenGeom.png