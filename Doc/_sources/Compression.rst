Compression 
***********

Designing complex lattice structures often involves multiple steps, resulting in long computational times. This process can be further slowed down by intensive computations across various design stages. Additionally, the resulting files, when stored in standard formats, tend to be large (often exceeding 100MB), posing challenges in file management and frequent reloading. Artisan offers users the option to retain the original JSON text. This enables the reproduction of design steps and the modification of parameters to generate alternative designs. Alternatively, users can choose to store only the final design results in a compressed, non-standard format to optimize storage and efficiency.

The example JSON file, at :code:`Test_json\\Compression\\EngineBracket_HS_Infill_Lin_LR_Compress.json`, shows a standard design flow applied on the engine bracket model. 

.. code-block:: json

    {"Setup":{  "Type": "Geometry",
                "Geomfile": ".//sample-obj//EngineBracket.STL",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.4,0.4,0.4],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 10737418240000
                },
    "WorkFlow":{
          "1": {
          "Add_Lattice":{
                    "la_name": "SchwarzDiamond", "size": [8.0,8.0,8.0], "thk":0.2, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0], "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }},
          "2": {
          "Lin_Interpolate" : {
                    "la_name": "SchwarzDiamond", "size": [8.0,8.0,8.0], "thk": 1.4, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0],
                    "pt_01":[90.0,0.0,0.0], "n_vec_01":[-1.0,0.0,0.0], 
                    "pt_02":[45.0,0.0,0.0], "n_vec_02":[1.0,0.0,0.0], 
                    "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }},
          "3": {
          "Lin_Interpolate" : {
                    "la_name": "SchwarzDiamond", "size": [8.0,8.0,8.0], "thk": 0.35, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0],
                    "pt_01":[0.0,0.0,50.0], "n_vec_01":[0.0,0.0,-1.0], 
                    "pt_02":[0.0,0.0,20.0], "n_vec_02":[0.0,0.0,1.0], 
                    "Inv": false, "Fill": false, 
                    "Cube_Request": {}
                    }},
          "4" :{"HS_Interpolate" : {
                    "la_name": "Cubic", 
                    "size": [5.0,5.0,5.0], 
                    "thk": 0.5, "pt":[90.0,30.0,50.0], "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0],
                    "n_vec":[-1.0,-1.0,0.0], "Fill": false, "Cube_Request": {}
                    }},
          "5":{
          "Add_Attractor": {
                    "la_name": "Cubic", "size": [5.0,5.0,5.0], "thk": 1.8, "Rot":[0.0,0.0,0.0], "Trans":[0.0,0.0,0.0],
                    "pt":[120.0,20.0,50.0], "r":45.0, "Inv": false, "Fill": true, 
                    "Cube_Request": {}
                    }},
          "6":{"OP_Compress": {"compressed_file": ".//Test_results/compressed_file_EngineBracket.smd"}},
          "7": {
                "Export": {"outfile": ".//Test_results/EngineBracket_HS_Lin_TPMS_Infill_LR.stl"}
          }
        },
    "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": false}
    }

The keywords :code:`OP_Compress` recorded the key field data and stores all data into the file :code:`.//Test_results/compressed_file_EngineBracket.smd`. The results file :code:`EngineBracket_HS_Lin_TPMS_Infill_LR.stl` is 101 MB. The saved file data file :code:`compressed_file_EngineBracket.smd` is about 8.99 MB. The following JSON demonstrates how to get the model data back from the saved field data file. 

.. code-block:: json

    {"Setup":{  "Type": "Geometry",
                "Geomfile": ".//sample-obj//EngineBracket.STL",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.9,0.1,0.9],
                "Padding": 1,
                "onGPU": false,
                "memorylimit": 10737418240000
                },
    "WorkFlow":{
          "1":{ "OP_Decompress": {"compressed_file": ".//Test_results/compressed_file_EngineBracket.smd", 
                "rebuild": false, 
                "OP_type": "Build"}},
          "2":{
                "Export": {"outfile": ".//Test_results/EngineBracket_HS_Lin_TPMS_Infill_LR_Decompress.stl"}
           }},
    "PostProcess":{"CombineMeshes": true,
                "RemovePartitionMeshFile": false,
                "RemoveIsolatedParts": true, 
                "ExportLazPts": false}
    }

The keywords :code:`OP_Decompress` does the operation of decoding and restoring the field data. It has three parameters, as explained below. 

.. list-table:: 
   :widths: 30 70
   :header-rows: 1

   * - Parameter
     - Details
   * - :code:`compressed_file`
     - the pass and file name to the saved field data.
   * - :code:`rebuild`
     - a boolean type value, that rebuilds the lattice field if :code:`true`. If user would like to do subsequent design works after decompression, it is highly recommend set this value as :code:`true`.   
   * - :code:`OP_type`
     - It can be the following strings, :code:`Build`, :code:`Union`, :code:`Intersection` and :code:`Diff`. The value :code:`"Build"` will re-construct the entire field and geometric field by using given saved field data file. :code:`Union`, :code:`Intersection` and :code:`Diff` will conduct the union, intersection and difference operation between the current lattice field and reloaded field from the file. 

The illustrations below shows the comparison between original stl and decompressed and exported stl. Two overlapped model showed no dis-match on colours, and can be considered as identical. 

The time consumption between compress and decompressed can be quite different. :code:`OP_Compress` only takes the key data from field and encode the data into more compacted form, whereas :code:`OP_Decompress` has to re-generate the data from the given data records, hence longer computational time. If user selected to rebuild the field for further design work, :code:`OP_Decompress` takes additional step to re-compute the whole field data. Please bear in mind, these operations do not apply to stl models, but act on the lattice field data.

The value :code:`"Build"` in the parameter :code:`OP_Type` in :code:`OP_Compress` will discard all current field setup (user will lose all previous lattice design if exists), and reconstruct the field by using the given saved field data file, then new design work can be keep working on the new field.

.. image:: ./pictures/compression_comparison.png

Under the folder :code:`\\Test_json\\Compression\\` there are three sets of compression and decompression examples. Besides two showed above, :code:`Sample_Box.json` and :code:`Sample_Box_Decompress.json` showed the simple box shape in field compressed & saved, and decompressed; :code:`Sample_Box_Infill_Compress.json` and :code:`Sample_Box_Infill_Decompress.json` used a simple lattice infill of a box to demonstrate the field data compressed/save and decompression/load. One other benefits with new keywords here is that, user may save and reload the files without the original JSON design file.

The compression ratio may be vary. The tested cases here showed about 11 times compression ratio, it means the saved field data in the file is about 1/11-th original stl file size. However, this could be different in different design. 
