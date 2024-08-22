import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import ast
import json
# Assuming the import path and function exist as provided
from AGUI.base import load_configuration, submit_configuration, save_configuration
from AGUI.vtkbase import ModelViewer
from AGUI.JSONtreeview import JSONTreeView
from AGUI.RibbonTools import ButtonCreator
from AGUI.util import ToolTip
from AGUI.DFEditor import DFEditor
from AGUI.about import show_credit_window

class ArtisanWizard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ArtGUI - Artisan Wizard")
        self.session_file = None
        self.init_gui()
        self.modelviewer = ModelViewer()

    def init_gui(self):
        # Initialize the ribbon first
        self.create_ribbon()
        # self.style = ttk.Style(self)
        # self.style.theme_use('winnative')
        self.call("source", ".\\AGUI\\theme\\azure.tcl")
        self.call("set_theme", "light")

        # Set the placement and configuration for the ribbon
        self.ribbon.grid(row=0, column=0, columnspan=2, sticky="ew")
        self.grid_rowconfigure(0, weight=0)  # Ensure this row does not expand too much

        # Initialize other parts of the GUI
        self.setup_frames_and_bindings()

    def setup_frames_and_bindings(self):
        photo = tk.PhotoImage(file='.\\AGUI\\resources\\icon.png')
        self.iconphoto(True, photo)
        

        # Adjust these frames to start from the next row after the ribbon
        self.setup_frame = self.create_setup_frame()
        self.setup_frame.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)

        self.post_process_frame = self.create_post_process_frame()
        self.post_process_frame.grid(row=2, column=0, sticky="nsew", padx=5, pady=5)

        self.message_panel_frame = self.create_message_panel_frame()
        self.message_panel_frame.grid(row=3, column=0, sticky="nsew", padx=5, pady=5)

        self.workflow_frame = self.setup_workflow_frame()
        # self.workflow_frame = self.setup_workflow_frame()
        self.workflow_frame.grid(row=1, column=1, rowspan=3, sticky="nsew", padx=5, pady=5)

        # Ensure the main window is properly divided
        self.grid_columnconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=3)
        self.grid_rowconfigure(1, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self.grid_rowconfigure(3, weight=2)

        btn_update = ttk.Button(self, text="Update Viewer", command=self.update_viewer)
        btn_update.grid(row=4, column=0, sticky="ew", padx=5, pady=5)

        submit_button = ttk.Button(self, text="Generate", command=self.on_generate)
        submit_button.grid(row=4, column=1, sticky="ew", padx=5, pady=5)
        
    def create_ribbon(self):
        self.ribbon = ttk.Notebook(self)
        self.ribbon.grid(row=0, column=0, columnspan=2, sticky="ew")

        # Creating tabs for the ribbon
        file_tab = ttk.Frame(self.ribbon)
        Lattice_tab = ttk.Frame(self.ribbon)
        Geometry_tab = ttk.Frame(self.ribbon)
        Mesh_tab = ttk.Frame(self.ribbon)
        MeshAdv_tab = ttk.Frame(self.ribbon)
        ProcessMesh_tab = ttk.Frame(self.ribbon)
        Field_tab = ttk.Frame(self.ribbon)
        FieldAdv_tab = ttk.Frame(self.ribbon)
        Export_tab = ttk.Frame(self.ribbon)
        Tools_tab = ttk.Frame(self.ribbon)
        Help_tab = ttk.Frame(self.ribbon)

        # Adding tabs to the notebook
        self.ribbon.add(file_tab, text='File')
        self.ribbon.add(Lattice_tab, text='Lattice')
        self.ribbon.add(Geometry_tab, text='Geometry')
        self.ribbon.add(Mesh_tab, text='Mesh')
        self.ribbon.add(MeshAdv_tab, text='Mesh Adv.')
        self.ribbon.add(ProcessMesh_tab, text='Proc. Mesh')
        self.ribbon.add(Field_tab, text='Field')
        self.ribbon.add(FieldAdv_tab, text='Field Adv.')
        self.ribbon.add(Export_tab, text='Export')
        self.ribbon.add(Tools_tab, text='Tools')
        self.ribbon.add(Help_tab, text='Help')

        # Load an image
        self.save_icon = tk.PhotoImage(file=".//AGUI//resources//save_icon.png") 
        self.load_icon = tk.PhotoImage(file=".//AGUI//resources//load_icon.png")  
        self.saveas_icon = tk.PhotoImage(file=".//AGUI//resources//saveas_icon.png") 
        self.about_icon = tk.PhotoImage(file=".//AGUI//resources//about.png") 

        # Populate File Tab
        self.save_button = ttk.Button(file_tab, text="Save", image=self.save_icon, command=self.save_file)
        self.save_button.grid(row=0, column=0, padx=5, pady=5)
        self.create_tooltip(self.save_button, "Save file")
        self.load_button = ttk.Button(file_tab, text="Load", image=self.load_icon, command=self.load_file)
        self.load_button.grid(row=0, column=1, padx=5, pady=5)
        self.create_tooltip(self.load_button, "Load file")
        self.saveas_button = ttk.Button(file_tab, text="Save As", image=self.saveas_icon, command=self.save_as_file)
        self.saveas_button.grid(row=0, column=2, padx=5, pady=5)
        self.create_tooltip(self.saveas_button, "Save to new file")
        self.bind("<Control-s>", lambda event: self.save_file())
        self.bind("<Control-l>", lambda event: self.load_file())
        # Help Tab
        self.about_button = ttk.Button(Help_tab, text="About", image=self.about_icon, command=self.show_about_window)
        self.about_button.grid(row=0, column=0, padx=5, pady=5)
        self.create_tooltip(self.about_button, "About and Helps")

        # Tools Tab
        # Configuration for each button
        buttons_config = [
            {"text": "Mesh Lattice", "icon": ".//AGUI//resources//MeshTool.png", "json_template": ".//AGUI//templates//meshlattice.json", "file_ext": "mld", "col": 0, "tooltip": "Mesh Lattice Definition Editor"},
            {"text": "Conformal Lattice", "icon": ".//AGUI//resources//Conformal.png", "json_template": ".//AGUI//templates//conformal_lattice.json", "file_ext": "mld", "col": 1, "tooltip": "Conformal Lattice Definition Editor"},
            {"text": "Custom Lattice Tet", "icon": ".//AGUI//resources//TetTool.png", "json_template": ".//AGUI//templates//customlattice_tet_strut.json", "file_ext": "txt", "col": 2, "tooltip": "Custom Lattice in Tet domain definition editor"},
            {"text": "Custom Lattice Hex", "icon": ".//AGUI//resources//HexTool.png", "json_template": ".//AGUI//templates//customlattice_hex_strut.json", "file_ext": "txt", "col": 3, "tooltip": "Custom Lattice in Hex domain definition editor"},
            {"text": "Custom Lattice Math", "icon": ".//AGUI//resources//TPMSTool.png", "json_template": ".//AGUI//templates//customlattice_TPMS.json", "file_ext": "txt", "col": 4, "tooltip": "Custom Lattice TPMS/Math in Hex domain definition editor"},
            {"text": "Custom Lattice Geom", "icon": ".//AGUI//resources//Geometry.png", "json_template": ".//AGUI//templates//CustomLattice_Geom.json", "file_ext": "txt", "col": 5, "tooltip": "Custom Lattice Geometry in Hex domain definition editor"},
            {"text": "Surface Lattice Quad", "icon": ".//AGUI//resources//Geometry.png", "json_template": ".//AGUI//templates//CustomSurfaceLattice_Strut.json", "file_ext": "txt", "col": 6, "tooltip": "Custom Surface Strut Lattice in Quad domain definition editor"},
            {"text": "Surface Lattice Triangle", "icon": ".//AGUI//resources//Geometry.png", "json_template": ".//AGUI//templates//CustomSurfaceLattice_Tri_Strut.json", "file_ext": "txt", "col": 7, "tooltip": "Custom Surface Strut Lattice in Triangle domain definition editor"},
            {"text": "Surface Lattice Geometry", "icon": ".//AGUI//resources//Geometry.png", "json_template": ".//AGUI//templates//CustomSurfaceLattice_Geom.json", "file_ext": "txt", "col": 8, "tooltip": "Custom Surface Lattice Geometry in Quad or Triangle domain definition editor"}
        ]

        # Create buttons dynamically
        for config in buttons_config:
            self.create_tool_button(Tools_tab, config["text"], config["icon"], config["json_template"], config["file_ext"], config["col"], config["tooltip"])

        # Lattice Tab
        Lattice_Button_data = {
            "Add Lattice": ["Add_Lattice", ".//AGUI//templates//Add_Lattice.json"],
            "Subtract Lattice": ["Subtract_Lattice", ".//AGUI//templates//Subtract_Lattice.json"],
            "Lin Interpolation": ["Lin_Interpolate", ".//AGUI//templates//Lin_Interpolate.json"],
            "Add Attractor": ["Add_Attractor", ".//AGUI//templates//Add_Attractor.json"],
            "HS_Interpolate": ["HS_Interpolate", ".//AGUI//templates//HS_Interpolate.json"]
        }
        # Create button creator instance
        self.La_button_creator = ButtonCreator(self, Lattice_tab, Lattice_Button_data, self.AddJSONtoTreeView)
        # Call create_buttons method to create buttons
        self.La_button_creator.create_buttons()

        # Geometry Tab
        Geom_Button_data = {
            "Add Shell": ["Add_Lattice", ".//AGUI//templates//Add_Shell.json"],
            "Add Box": ["Add_Geometry Box", ".//AGUI//templates//Add_Box.json"],
            "Add Cylinder": ["Add_Geometry Cylinder", ".//AGUI//templates//Add_Cylinder.json"],
            "Add Sphere": ["Add_Geometry Sphere", ".//AGUI//templates//Add_Sphere.json"],
            "Subtract Box": ["Subtract_Geometry Box", ".//AGUI//templates//Subtract_Box.json"],
            "Subtract Cylinder": ["Add_Geometry Cylinder", ".//AGUI//templates//Subtract_Cylinder.json"],
            "Subtract Sphere": ["Subtract_Geometry Sphere", ".//AGUI//templates//Subtract_Sphere.json"],
            "Add Surf Plate": ["Add_Surf_Plate", ".//AGUI//templates//Add_Surf_Plate.json"],
            "Subtract Surf Plate": ["Subtract_Surf_Plate", ".//AGUI//templates//Subtract_Surf_Plate.json"],
            "Add Geometry": ["Add_Geometry", ".//AGUI//templates//Add_Geometry.json"],
            "Subtract Geometry":["Subtract_Geometry", ".//AGUI//templates//Subtract_Geometry.json"],
        }
        # Create button creator instance
        self.Geom_button_creator = ButtonCreator(self, Geometry_tab, Geom_Button_data, self.AddJSONtoTreeView)
        # Call create_buttons method to create buttons
        self.Geom_button_creator.create_buttons()

        # Mesh Tab
        Mesh_Button_data = {
            "Tet Mesh": ["Gen_TetBasicMesh", ".//AGUI//templates//Gen_TetBasicMesh.json"],
            "Tet Mesh wF": ["Gen_TetBasicMesh_wFeature", ".//AGUI//templates//Gen_TetBasicMesh_wFeature.json"],
            "Tet Mesh HexSplit": ["Gen_TetBasicMesh_HexSplit", ".//AGUI//templates//Gen_TetBasicMesh_HexSplit.json"],
            "Voronoi Mesh": ["Gen_VoronoiPolyMesh", ".//AGUI//templates//Gen_VoronoiPolyMesh.json"],
            "Voronoi Mesh HexSplit": ["Gen_VoronoiPolyMesh_HexSplit", ".//AGUI//templates//Gen_VoronoiPolyMesh_HexSplit.json"],
            "CartesianHexMesh": ["Gen_BasicCartesianHexMesh", ".//AGUI//templates//Gen_BasicCartesianHexMesh.json"],
            "BasicQuadMesh": ["Gen_BasicQuadMesh", ".//AGUI//templates//Gen_BasicQuadMesh.json"],
            "SurfaceReMesh": ["Gen_SurfaceReMesh", ".//AGUI//templates//Gen_SurfaceReMesh.json"],
            "CylindricalMesh": ["Gen_CylindricalMesh", ".//AGUI//templates//Gen_CylindricalMesh.json"],
            "SphericalMesh": ["Gen_SphericalMesh", ".//AGUI//templates//Gen_SphericalMesh.json"],
            "BoxMesh": ["Gen_BoxMesh", ".//AGUI//templates//Gen_BoxMesh.json"],
        }
        # Create button creator instance
        self.Mesh_button_creator = ButtonCreator(self, Mesh_tab, Mesh_Button_data, self.AddJSONtoTreeView)
        # Call create_buttons method to create buttons
        self.Mesh_button_creator.create_buttons()

        # MeshAdv Tab
        MeshAdv_Button_data = {
            "Tet Mesh Attractor": ["Gen_TetBasicMesh_HexSplit MultiSize Attractor", ".//AGUI//templates//Gen_TetBasicMesh_HexSplit_MultiSize_Attractor.json"],
            "Tet Mesh Field": ["Gen_TetBasicMesh_HexSplit MultiSize Field", ".//AGUI//templates//Gen_TetBasicMesh_HexSplit_MultiSize_Field.json"],
            "CHM MultiSize Attractor": ["Gen_BasicCartesianHexMesh MultiSize Attractor", ".//AGUI//templates//Gen_BasicCartesianHexMesh_MultiSize_Attractor.json"],
            "CHM MultiSize Field": ["Gen_BasicCartesianHexMesh_MultiSize Field", ".//AGUI//templates//Gen_BasicCartesianHexMesh_MultiSize_Field.json"],
            "Gen_ExtHexMesh_Geomfield": ["Gen_ExtHexMesh_Geomfield", ".//AGUI//templates//Gen_ExtHexMesh_Geomfield.json"],
            "Gen_ConformalLatticeMesh": ["Gen_ConformalLatticeMesh", ".//AGUI//templates//Gen_ConformalLatticeMesh.json"],
            
        }
        # Create button creator instance
        self.MeshAdv_button_creator = ButtonCreator(self, MeshAdv_tab, MeshAdv_Button_data, self.AddJSONtoTreeView)
        # Call create_buttons method to create buttons
        self.MeshAdv_button_creator.create_buttons()

        Process_Mesh_Button_data = {
            "Proc_Mesh_ExtractSurf": ["Proc_Mesh_ExtractSurf", ".//AGUI//templates//Proc_Mesh_ExtractSurf.json"],
            "Proc_Mesh_Octree":["Proc_Mesh_Octree", ".//AGUI//templates//Proc_Mesh_Octree.json"],
            "Proc_Mesh_Trim": ["Proc_Mesh_Trim", ".//AGUI//templates//Proc_Mesh_Trim.json"],
            "Proc_Mesh_SurfMeshMap": ["Proc_Mesh_SurfMeshMap", ".//AGUI//templates//Proc_Mesh_SurfMeshMap.json"],
            "Proc_Mesh_GenSkin": ["Proc_Mesh_GenSkin", ".//AGUI//templates//Proc_Mesh_GenSkin.json"],
            "Proc_Mesh_FieldDrivenMesh": ["Proc_Mesh_FieldDrivenMesh", ".//AGUI//templates//Proc_Mesh_FieldDrivenMesh.json"]
        }
        # Create button creator instance
        self.ProcessMesh_button_creator = ButtonCreator(self, ProcessMesh_tab, Process_Mesh_Button_data, self.AddJSONtoTreeView)
        # Call create_buttons method to create buttons
        self.ProcessMesh_button_creator.create_buttons()


        # Field Tab
        Field_Button_data = {
            "Offset Field": ["OP_OffsetField", ".//AGUI//templates//OP_OffsetField.json"],
            "Offset Math":[ "OP_Expr_OffsetField", ".//AGUI//templates//OP_Expr_OffsetField.json"],
            "Merge Field":["OP_FieldMerge", ".//AGUI//templates//OP_FieldMerge_Field.json"],
            "Merge Attractor":[ "OP_FieldMerge Attractor", ".//AGUI//templates//OP_FieldMerge_Attractor.json"],
            "Merge Annulus":[ "OP_FieldMerge Annulus", ".//AGUI//templates//OP_FieldMerge_Annulus.json"],
            "Merge Lin":[ "OP_FieldMerge Lin_Interpolate", ".//AGUI//templates//OP_FieldMerge_Lin.json"],
            "Edge Enhance":[ "OP_EdgeEnhance", ".//AGUI//templates//OP_EdgeEnhance.json"],
            "Corner Enhance": ["OP_CornerEnhance", ".//AGUI//templates//OP_CornerEnhance.json"],
            "Inverse Field": ["Inv_Field", ".//AGUI//templates//Inv_Field.json"],
            "Geom Fill": ["GeomFill", ".//AGUI//templates//GeomFill.json"]
        }
        # Create button creator instance
        self.Field_button_creator = ButtonCreator(self, Field_tab, Field_Button_data, self.AddJSONtoTreeView)
        # Call create_buttons method to create buttons
        self.Field_button_creator.create_buttons()

        FieldAdv_Button_data = {
            "Merge Field trans":["OP_FieldMerge Field with transition", ".//AGUI//templates//OP_FieldMerge_Field_Trans.json"],
            "Merge Attractor trans":[ "OP_FieldMerge Attractor with transition", ".//AGUI//templates//OP_FieldMerge_Attractor_Trans.json"],
            "Merge Annulus trans":[ "OP_FieldMerge Annulus with transition", ".//AGUI//templates//OP_FieldMerge_Annulus_Trans.json"],
            "Merge Lin trans":[ "OP_FieldMerge Lin_Interpolate with transition", ".//AGUI//templates//OP_FieldMerge_Lin_Trans.json"],
        }
        # Create button creator instance
        self.Field_button_creator = ButtonCreator(self, FieldAdv_tab, FieldAdv_Button_data, self.AddJSONtoTreeView)
        # Call create_buttons method to create buttons
        self.Field_button_creator.create_buttons()


        # Export Tab
        Export_Button_data = {
            "Compress": ["OP_Compress", ".//AGUI//templates//OP_Compress.json"],
            "Decompress": ["OP_Decompress", ".//AGUI//templates//OP_Decompress.json"],
            "Export": ["Export", ".//AGUI//templates//Export.json"],
            "Evaluate_Points": ["Evaluate_Points", ".//AGUI//templates//Evaluate_Points.json"],
        }
        # Create button creator instance
        self.Export_button_creator = ButtonCreator(self, Export_tab, Export_Button_data, self.AddJSONtoTreeView)
        # Call create_buttons method to create buttons
        self.Export_button_creator.create_buttons()

    def create_tool_button(self, tab, text, icon_path, json_template, file_ext, col_num, tooltip):
        #icon = tk.PhotoImage(file=icon_path)
        #button = ttk.Button(tab, text=text, image=icon,
        #                    command=lambda: self.show_df_editor(json_template, file_ext))
        #button.image = icon  # Keep a reference to avoid garbage collection
        button = ttk.Button(tab, text=text,
                            command=lambda: self.show_df_editor(json_template, file_ext))
        button.grid(row=0, column=col_num, padx=5, pady=5)
        self.create_tooltip(button, tooltip)
        return button

    def create_tooltip(self, widget, text):
        tooltip = ToolTip(widget, text)
        widget.bind("<Enter>", lambda _: tooltip.show_tip())
        widget.bind("<Leave>", lambda _: tooltip.hide_tip())

    def AddJSONtoTreeView(self, JSONfilename):
        with open(JSONfilename, 'r') as file:
            json_data = json.load(file)
            self.workflow_text_widget.insert_json("", json_data)
        return 

    def update_viewer(self, filename = None):
        wf_dict = self.workflow_text_widget.get_last_entry()
        try:
            if filename == None:
                model_path = wf_dict[list(wf_dict.keys())[-1]]["Export"]["outfile"]  
            else:
                model_path = filename
            if os.path.isfile(model_path):
                self.modelviewer.update_model(model_path)
            else:
                messagebox.showinfo("Update Model", "Did not find the results or the model file. Please generate it first.")
        except:
            messagebox.showinfo("Update Model", "The workflow last command does not contain export file information. The last keywords must be Export having its parameter outfile.")
        return None 

    def browse_file(self, entry):
        filename = filedialog.askopenfilename(filetypes=(("STL files", "*.stl"), ("All files", "*.*")))
        if filename:
            entry.delete(0, tk.END)
            entry.insert(0, filename)
            self.update_viewer(filename)


    def save_file(self):
        self.session_file = save_configuration(self.session_file,
            self.type_entry, self.domain_x_lb, self.domain_x_ub,
            self.domain_y_lb, self.domain_y_ub, self.domain_z_lb, self.domain_z_ub,
            self.geomfile_entry, self.rot_x_entry, self.rot_y_entry, self.rot_z_entry,
            self.res_x_entry, self.res_y_entry, self.res_z_entry,
            self.padding_entry, self.ongpu_var, self.memory_limit_entry,
            self.workflow_text_widget, self.combine_meshes_var,
            self.remove_partition_var, self.remove_isolated_parts_var, self.export_laz_pts_var
        )
        if self.session_file != None:
            self.title("ArtGUI - Artisan Wizard " + self.session_file)

    def save_as_file(self):
        self.session_file = save_configuration(None,
            self.type_entry, self.domain_x_lb, self.domain_x_ub,
            self.domain_y_lb, self.domain_y_ub, self.domain_z_lb, self.domain_z_ub,
            self.geomfile_entry, self.rot_x_entry, self.rot_y_entry, self.rot_z_entry,
            self.res_x_entry, self.res_y_entry, self.res_z_entry,
            self.padding_entry, self.ongpu_var, self.memory_limit_entry,
            self.workflow_text_widget, self.combine_meshes_var,
            self.remove_partition_var, self.remove_isolated_parts_var, self.export_laz_pts_var
        )
        if self.session_file != None:
            self.title("ArtGUI - Artisan Wizard " + self.session_file)

    def load_file(self):
        self.session_file = load_configuration( 
            self.type_entry, self.domain_x_lb, self.domain_x_ub,
            self.domain_y_lb, self.domain_y_ub, self.domain_z_lb, self.domain_z_ub,
            self.geomfile_entry, self.rot_x_entry, self.rot_y_entry, self.rot_z_entry,
            self.res_x_entry, self.res_y_entry, self.res_z_entry,
            self.padding_entry, self.ongpu_var, self.memory_limit_entry,
            self.workflow_text_widget, self.combine_meshes_var,
            self.remove_partition_var, self.remove_isolated_parts_var, self.export_laz_pts_var
        )
        if self.session_file != None:
            self.title("ArtGUI - Artisan Wizard " + self.session_file)

    def on_generate(self):
        if self.session_file is None:
            messagebox.showinfo("Generate", "The file has not been saved yet!")
        else:
            # submit_configuration(self.session_file)
            submit_configuration(self.session_file, self.message_text_widget)

    def create_setup_frame(self):
        frame = ttk.LabelFrame(self, text="Setup", padding=10)
        # frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Type
        ttk.Label(frame, text="Type:").grid(row=0, column=0, sticky="ew")
        self.type_entry = ttk.Entry(frame)
        self.type_entry.grid(row=0, column=1, sticky="ew")
        self.type_entry.insert(0, "Geometry")

        # Geomfile with browse button
        ttk.Label(frame, text="Geomfile:").grid(row=1, column=0, sticky="ew")
        self.geomfile_entry = ttk.Entry(frame)
        self.geomfile_entry.grid(row=1, column=1, sticky="ew")
        self.geomfile_entry.insert(0, ".//sample-obj//cube_1mm.stl")
        browse_button = ttk.Button(frame, text="Browse...", command=lambda: self.browse_file(self.geomfile_entry))
        browse_button.grid(row=1, column=2)

        # Domain
        ttk.Label(frame, text="Domain Lower Bound:").grid(row=2, column=0, sticky="ew")
        self.domain_x_lb = ttk.Entry(frame)
        self.domain_x_lb.grid(row=2, column=1, sticky="ew")
        self.domain_x_lb.insert(0, "0.0")
        self.domain_y_lb = ttk.Entry(frame)
        self.domain_y_lb.grid(row=2, column=2, sticky="ew")
        self.domain_y_lb.insert(0, "0.0")
        self.domain_z_lb = ttk.Entry(frame)
        self.domain_z_lb.grid(row=2, column=3, sticky="ew")
        self.domain_z_lb.insert(0, "0.0")

        ttk.Label(frame, text="Domain Upper Bound:").grid(row=3, column=0, sticky="ew")
        self.domain_x_ub = ttk.Entry(frame)
        self.domain_x_ub.grid(row=3, column=1, sticky="ew")
        self.domain_x_ub.insert(0, "1.0")
        self.domain_y_ub = ttk.Entry(frame)
        self.domain_y_ub.grid(row=3, column=2, sticky="ew")
        self.domain_y_ub.insert(0, "1.0")
        self.domain_z_ub = ttk.Entry(frame)
        self.domain_z_ub.grid(row=3, column=3, sticky="ew")
        self.domain_z_ub.insert(0, "1.0")

        # Rotation
        ttk.Label(frame, text="Rotation:").grid(row=4, column=0, sticky="ew")
        self.rot_x_entry = ttk.Entry(frame)
        self.rot_x_entry.grid(row=4, column=1, sticky="ew")
        self.rot_x_entry.insert(0, "0.0")
        self.rot_y_entry = ttk.Entry(frame)
        self.rot_y_entry.grid(row=4, column=2, sticky="ew")
        self.rot_y_entry.insert(0, "0.0")
        self.rot_z_entry = ttk.Entry(frame)
        self.rot_z_entry.grid(row=4, column=3, sticky="ew")
        self.rot_z_entry.insert(0, "0.0")

        # Resolution
        ttk.Label(frame, text="Resolution:").grid(row=5, column=0, sticky="ew")
        self.res_x_entry = ttk.Entry(frame)
        self.res_x_entry.grid(row=5, column=1, sticky="ew")
        self.res_x_entry.insert(0, "5.0")
        self.res_y_entry = ttk.Entry(frame)
        self.res_y_entry.grid(row=5, column=2, sticky="ew")
        self.res_y_entry.insert(0, "5.0")
        self.res_z_entry = ttk.Entry(frame)
        self.res_z_entry.grid(row=5, column=3, sticky="ew")
        self.res_z_entry.insert(0, "5.0")

        # Padding
        ttk.Label(frame, text="Padding:").grid(row=6, column=0, sticky="ew")
        self.padding_entry = ttk.Entry(frame)
        self.padding_entry.grid(row=6, column=1, sticky="ew")
        self.padding_entry.insert(0, "4")

        # onGPU
        ttk.Label(frame, text="onGPU:").grid(row=7, column=0, sticky="ew")
        self.ongpu_var = tk.BooleanVar()
        ongpu_check = ttk.Checkbutton(frame, text="Use GPU", variable=self.ongpu_var)
        ongpu_check.grid(row=7, column=1, sticky="ew")

        # Memory Limit
        ttk.Label(frame, text="Memory Limit:").grid(row=8, column=0, sticky="ew")
        self.memory_limit_entry = ttk.Entry(frame)
        self.memory_limit_entry.grid(row=8, column=1, sticky="ew")
        self.memory_limit_entry.insert(0, "1073741824000")  # Default memory limit in bytes

        return frame
    
    def setup_workflow_frame(self):
        frame = ttk.LabelFrame(self, text="Workflow", padding=10)
        # Initialize the JSONTreeView with an empty dictionary or a loaded configuration
        self.workflow_text_widget = JSONTreeView(frame, {}, main_gui=self)
        return frame

    def create_post_process_frame(self):
        frame = ttk.LabelFrame(self, text="Post Process", padding=10)
        # frame.pack(side=tk.BOTTOM, fill=tk.BOTH, expand=True)

        # Combine Meshes
        self.combine_meshes_var = tk.BooleanVar(value=True)
        combine_meshes_check = ttk.Checkbutton(frame, text="Combine Meshes", variable=self.combine_meshes_var)
        combine_meshes_check.grid(row=0, column=0, sticky="ew")

        # Remove Partition Mesh File
        self.remove_partition_var = tk.BooleanVar()
        remove_partition_check = ttk.Checkbutton(frame, text="Remove Partition Mesh File", variable=self.remove_partition_var)
        remove_partition_check.grid(row=1, column=0, sticky="ew")

        # Remove Isolated Parts
        self.remove_isolated_parts_var = tk.BooleanVar(value=True)
        remove_isolated_parts_check = ttk.Checkbutton(frame, text="Remove Isolated Parts", variable=self.remove_isolated_parts_var)
        remove_isolated_parts_check.grid(row=2, column=0, sticky="ew")

        # Export LazPts
        self.export_laz_pts_var = tk.BooleanVar()
        export_laz_pts_check = ttk.Checkbutton(frame, text="Export LazPts", variable=self.export_laz_pts_var)
        export_laz_pts_check.grid(row=3, column=0, sticky="ew")

        return frame
    
    def create_message_panel_frame(self):
        frame = ttk.LabelFrame(self, text="Message Panel", padding=10)
        # frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        # Message Text Widget with Scrollbar
        self.message_text_widget = tk.Text(frame, height=10)
        scroll = tk.Scrollbar(frame, command=self.message_text_widget.yview)
        self.message_text_widget.configure(yscrollcommand=scroll.set)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.message_text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        return frame
    
    def show_df_editor(self, template_file, fileext):
        with open(template_file, 'r') as file:
            data = json.load(file)
        df_editor = tk.Toplevel(self)
        editor = DFEditor(df_editor, data, fileext, df_editor)
        

    def show_about_window(self):
        show_credit_window(self)