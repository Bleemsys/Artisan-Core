==========
Fill a box
==========

Assuming we would like to fill a box geometry with Cubic lattice, the input JSON shall be like this:

.. code-block:: json

    {"Setup":{  "Type" : "Sample",
                "Sample": {"Domain" : [[0.0,4.0],[0.0,4.0],[0.0,4.0]], "Shape": "Box"},
                "Geomfile": "",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.05,0.05,0.05],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 1073741824000
                },
      "WorkFlow":{
          "1":{"Add_Lattice":{
                    "la_name": "BCCubic", "size": [1.0,1.0,1.0], "thk":0.1, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": false, "Fill": true, "Cube_Request": {}
                    }},
           "2":{"Export": {"outfile": ".//Test_results/Test_Sample_Strut_Infill.stl"}}
           },
       "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": false,
                "ExportLazPts": false}
    }

The JSON contains three sections, 
 - :code:`Setup`, setup the general computational domain (an 3D block that computes everything) and other essential required computing quantities such as resolution (keywords :code:`res`). The domain was defined in a block from :code:`(0.0,0.0,0.0)` to :code:`(4.0, 4.0, 4.0)` - a solid cube with length of 4 mm. 

 - :code:`WorkFlow` defines the how the resultant lattices built, e.g. connection between two different lattice fields etc.. The single step of lattice operation is defined by numeric index keywords, such as :code:`"1"`, :code:`"2"` etc.. In the step :code:`"1"`, we added a BCCubic lattice with 1 mm in x, y and z direction, and the radius of the beam was 0.1 mm. In the step :code:`"2"`, the results saved in the file :code:`".//Test_results/Test_Sample_Strut_Infill.stl"`.

 - :code:`PostProcess` implements simple post processes on the resultant geometries. In this example, we would only combine the meshes if the automatic partitions were made. 

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`Type`
     - A string that defines how Artisan determines the computational domain. If set to :code:`Sample`, the user must explicitly define the domain using the :code:`Sample` parameter. If set to :code:`Geometry`, Artisan uses the bounding box of the geometry defined by :code:`Geomfile` as the computational domain.
   * - :code:`Sample`
     - Explicitly defines the minimum and maximum bounds of the computational domain. The format is: :code:`{"Domain" : [[x_min, x_max], [y_min, y_max], [z_min, z_max]], "Shape": "Box"}`.
   * - :code:`Geomfile`
     - A string specifying the file path to the geometry. This geometry is considered the infill geometry, and its bounding box will be used to define the computational domain.
   * - :code:`Rot`
     - A list of three float values specifying the rotation (in degrees) applied to the imported geometry.
   * - :code:`Res`
     - A list of three float values defining the resolution of the computational domain in the X, Y, and Z directions. Smaller values result in finer triangle surfaces in the generated geometry but increase computation time.
   * - :code:`Padding`
     - Additional grid layers added around the computational domain. This value must be at least 2.
   * - :code:`onGPU`
     - A boolean flag. If set to :code:`True`, GPU computations will be enabled. Note that not all keywords support GPU computation.
   * - :code:`memorylimit`
     - The upper limit of memory usage. Artisan will automatically partition the computational domain based on this limit.
   * - :code:`JsonWorkDir`
     - A boolean flag. If set to :code:`True`, Artisan uses the folder containing the JSON input files as the working directory. If set to :code:`False`, Artisan’s own folder is used. The default value is :code:`False`. If this parameter is not specified, Artisan defaults to using its own folder. All relative paths in the :code:`WorkFlow` procedure are resolved relative to this directory.


Save the JSON as :code:`Sample_box.json`,  and type

.. code-block::

    python ArtisanMain.pt -f .//Test_json//Sample_box.json

You should see the results stl file at the folder Test_results, and launch the paraview, loads the file, you should be able to see the following.

.. image:: ../pictures/Fill_box_results.png


A few output files were also generated. Under the folder which contains the input JSON file, you should find the following:

 - "Sample_box.log", a log file containing inputs and execution information. 
 - "Sample_box.prg", this is a file regularly updated during the computing procedure, it informs the current progress of percentage of job completion.  

In the destination folder, you will see: 

 - the results file, e.g. "Test_Sample_Strut_Infill.stl", and 
 - the partitioned mesh file "Test_Sample_Strut_Infill_000000.stl". In this case, the partition was not triggered and only one mesh file was produced.

