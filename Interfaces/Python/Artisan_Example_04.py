# Add the ArtisanMain.py path into your system path
import sys,os
import numpy as np
import meshio
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
                "res":[0.5,0.5,0.5],
		        "Padding": 1,
                "onGPU": False,
                "memorylimit": 16106127360
            }
# Push to the Setup method, and it setup the model building required infrastructure, 
# it also calculates all fields for geometry.            
Model.Setup(cmd_setup)

# Read STL mesh
mesh = meshio.read("..//..//sample-obj//shell_1_of_bdd_.stl")

# Extract triangles and vertices
nodes = mesh.points
elems = mesh.cells_dict["triangle"]

print(f"Loaded mesh with {len(nodes)} vertices and {len(elems)} triangles.")

# Create input data for SetMesh
cmd_setmesh = {
    "mesh_id": "demo_mesh",
    "nodes": nodes,
    "elems": elems,
    "elem_type": "Triangle",
    "filetype": ".stl"
}

# Call SetMesh function (must be part of your model already)
Model.SetMesh(cmd_setmesh)

print("Mesh successfully set in Artisan model. Now you may reference to this mesh.")

# Define mesh lattice, we refer to the loaded mesh.
cmd_workitem ={ "Define_Lattice":{
                "la_name":"demo_lattice",
                "definition":{
                        "type": "MeshLattice",
                         "definition": {
                                         "meshfile": "demo_mesh",
                                         "k": 0.0
                                        }
                        
                         }
                }
            }
Model.WorkItem(cmd_workitem)

print("Adding Lattice......")
# Add lattice into the infill
cmd_workitem = {"Add_Lattice":{
                    "la_name": "demo_lattice", "size": [8.0,8.0,8.0], "thk":0.75, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                    "Inv": False, "Fill": True, "Cube_Request": {}
                    }
               }
Model.WorkItem(cmd_workitem)


print("Delete the loaded mesh, and save the results.")
# Remove the loaded mesh from Artisan
Model.RemoveMesh({"MeshID":"demo_mesh"})

# A repeat call of workitem to save the geometry in a stl file.
cmd_workitem = {"Export": {"outfile": "..//..//Test_results/BingDunDun_Infill.stl"}}
Model.WorkItem(cmd_workitem)


