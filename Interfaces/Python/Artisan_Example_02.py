# -*- coding: utf-8 -*-
"""
@author: Bleemsys

This demonstration shows the usage of Execution function which reads dict data and log filename 

"""

# Add the ArtisanMain.py path into your system path
import sys,os, pathlib
ArtisanRoot = pathlib.Path("..//..//")
sys.path.append(ArtisanRoot)
# Simply import ArtisanModel. It is a function returns the API class 
from ArtisanMain import Execution
import json

logfilename = ArtisanRoot / "Test_json//Test_log.txt"

cmd_dict = {"Setup":{      "Type" : "Geometry",
                "Geomfile": "..//..//sample-obj//shell_1_of_bdd_.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.75,0.75,0.75],
		          "Padding": 1,
                "onGPU": False,
                "memorylimit": 16106127360
                },
           "WorkFlow":{
                 "1": {"Add_Lattice":{
                     "la_name": "Cubic", "size": [8.0,8.0,8.0], "thk":1.2, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                     "Inv": False, "Fill": True, "Cube_Request": {}
                    }
                      },
                "2":{"Export": {"outfile": "..//..//Test_results/BingDunDun_Infill.stl"}}
           },
 "PostProcess":{"CombineMeshes": True,
                "RemovePartitionMeshFile": False,
                "RemoveIsolatedParts": True, 
                "ExportLazPts": False}
}

Execution(json.dumps(cmd_dict), logfilename)
