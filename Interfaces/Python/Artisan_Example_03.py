# -*- coding: utf-8 -*-
"""
Created on Tue Apr 11 09:33:06 2023

@author: Bleemsys

This is deomonstration of how to use WorkItem method to manipulate the lattice design calculation.
"""

# Add the ArtisanMain.py path into your system path
import sys,os
sys.path.append("..//..//")
# Simply import ArtisanModel. It is a function returns the API class 
from ArtisanMain import ArtisanModel

# Call ArtisanModel to buildup the API class
Model = ArtisanModel()

# Setup section in dict structure
cmd_setup = {      
                "Type" : "Geometry",
                "Geomfile": "..//..//sample-obj//shell_1_of_bdd_.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.75,0.75,0.75],
		          "Padding": 1,
                "onGPU": False,
                "memorylimit": 16106127360
            }
# Push to the Setup method, and it setup the model building required infrastructure, 
# it also calculates all fields for geometry.            
Model.Setup(cmd_setup)
# A simple add lattice commands. The model always starts from Add_Lattice
cmd_workitem = {"Add_Lattice":{
                    "la_name": "Cubic", "size": [8.0,8.0,8.0], "thk":1.2, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": False, "Fill": True, "Cube_Request": {}
                    }
               }
# Call the workitem method to calculates the defined workitem above.
Model.WorkItem(cmd_workitem)

# A repeat call of workitem to save the geometry in a stl file.
cmd_workitem = {"Export": {"outfile": "..//..//Test_results/BingDunDun_Infill.stl"}}
Model.WorkItem(cmd_workitem)

# alternatively, user may extract the surfaces, including the vertices and triangulations. 
verts, faces = Model.ExtractSurf()

