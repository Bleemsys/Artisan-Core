import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json

class CappedConeConformal(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.title("Capped Cone Conformal Lattice Infill Setup")
        self.grab_set()   # Modal behavior
        self.resizable(False, False)
        

        # ---------- default values ----------
        defaults = {
            "x_min": -650.0, "x_max": 650.0,
            "y_min": -650.0, "y_max": 650.0,
            "z_min": -200.0, "z_max": 620.0,
            "num_elem_x": 3, "num_elem_y": 20, "num_elem_z": 3,
            "r_min": 400.0, "r_max": 600.0,
            "phi_min": 0.0, "phi_max": 1.0,
            "ori_x": 0.0, "ori_y": 0.0, "ori_z": 0.0,
            "Height": 600.0,
            "r_bottom": 400.0,
            "UB_heightRatio": 0.4,
            "la_name": "BCCubic",
            "outfile": ".//ConeMesh_ConformalLattice_Base.stl",
            "la_type": "Conformal",
            "la_thk": 15.0
        }

        self.vars = {k: tk.StringVar(value=str(v)) for k, v in defaults.items()}

        # Layout
        self.build_layout()

    # ------------------------------------------------------------------
    def build_layout(self):
        frm = ttk.Frame(self)
        frm.pack(padx=10, pady=10)

        row = 0

        # Helper
        def add_row(label, *keys):
            nonlocal row
            ttk.Label(frm, text=label).grid(row=row, column=0, sticky="e", padx=5, pady=2)
            col = 1
            for k in keys:
                ttk.Entry(frm, textvariable=self.vars[k], width=10).grid(row=row, column=col, padx=2, pady=2)
                col += 1
            row += 1

        # Domain
        ttk.Label(frm, text="Domain (X, Y, Z)").grid(row=row, column=0, sticky="w")
        row += 1

        add_row("X min / max", "x_min", "x_max")
        add_row("Y min / max", "y_min", "y_max")
        add_row("Z min / max", "z_min", "z_max")

        ttk.Separator(frm, orient="horizontal").grid(row=row, column=0, columnspan=5, sticky="ew", pady=5)
        row += 1

        ttk.Label(frm, text="Capped Cone").grid(row=row, column=0, sticky="w")
        row += 1

        # Mesh Parameters
        add_row("num_elem (Nx Ny Nz)", "num_elem_x", "num_elem_y", "num_elem_z")
        add_row("r_range (min max)", "r_min", "r_max")
        add_row("phi_range (min max)", "phi_min", "phi_max")
        add_row("ori (x y z)", "ori_x", "ori_y", "ori_z")
        add_row("Height", "Height")
        add_row("r_bottom", "r_bottom")
        add_row("UB_heightRatio", "UB_heightRatio")

        ttk.Separator(frm, orient="horizontal").grid(row=row, column=0, columnspan=5, sticky="ew", pady=5)
        row += 1

        # Lattice name (dropdown)
        # ttk.Label(frm, text="Define Lattice Infill Type").grid(row=row, column=0, sticky="e")
        # la_type_options = ["Conformal", "Periodic"]
          
        # la_type_combo = ttk.Combobox(
        #     frm,
        #     textvariable=self.vars["la_type"],
        #     values=la_type_options,
        #     state="readonly",   # 'readonly' means user must pick from list; use 'normal' to allow free typing
        #     width=23
        # )
        # la_type_combo.grid(row=row, column=1, columnspan=3, sticky="w")
        # # Ensure the combo shows the default if it is in the list
        # if self.vars["la_type"].get() in la_type_options:
        #     la_type_combo.current(la_type_options.index(self.vars["la_type"].get()))
        # row += 2

        ttk.Label(frm, text="Lattice").grid(row=row, column=0, sticky="w")
        row += 1

        # Lattice name (dropdown)
        ttk.Label(frm, text="Define_Lattice la_name").grid(row=row, column=0, sticky="e")
        la_options = ["Cubic", "BCCubic", "VertexOcta", "BC", "FCCubic", "EdgeOcta", 
                      "StarTet", "Dodecahedron", "Auxetic",
                      "SchwarzDiamond", "SchwarzPrimitive", "FischerKoch", "Neovius", "Lidinoid", "Gyroid"]
          
        la_combo = ttk.Combobox(
            frm,
            textvariable=self.vars["la_name"],
            values=la_options,
            state="readonly",   # 'readonly' means user must pick from list; use 'normal' to allow free typing
            width=23
        )
        la_combo.grid(row=row, column=1, columnspan=3, sticky="w")
        # Ensure the combo shows the default if it is in the list
        if self.vars["la_name"].get() in la_options:
            la_combo.current(la_options.index(self.vars["la_name"].get()))
        row += 1

        add_row("Lattice Thickness", "la_thk")
        row += 1


        # outfile
        ttk.Label(frm, text="Export outfile").grid(row=row, column=0, sticky="e")
        ttk.Entry(frm, textvariable=self.vars["outfile"], width=35).grid(row=row, column=1, columnspan=2, sticky="w")
        ttk.Button(frm, text="Browse…", command=self.browse_outfile)\
            .grid(row=row, column=3, sticky="w", padx=3)
        row += 1

        # Bottom buttons
        btm = ttk.Frame(self)
        btm.pack(pady=10, fill="x")

        ttk.Button(btm, text="OK / Save JSON", command=self.save_json)\
            .pack(side="right", padx=5)
        ttk.Button(btm, text="Cancel", command=self.destroy)\
            .pack(side="right")

    # ------------------------------------------------------------------
    def browse_outfile(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".stl",
            filetypes=[("STL files", "*.stl"), ("All files", "*.*")]
        )
        if path:
            self.vars["outfile"].set(path)

    # ------------------------------------------------------------------
    def save_json(self):
        try:
            # Read values
            domain = [
                [float(self.vars["x_min"].get()), float(self.vars["x_max"].get())],
                [float(self.vars["y_min"].get()), float(self.vars["y_max"].get())],
                [float(self.vars["z_min"].get()), float(self.vars["z_max"].get())],
            ]
            num_elem = [
                int(self.vars["num_elem_x"].get()),
                int(self.vars["num_elem_y"].get()),
                int(self.vars["num_elem_z"].get()),
            ]
            r_range = [
                float(self.vars["r_min"].get()), float(self.vars["r_max"].get())
            ]
            phi_range = [
                float(self.vars["phi_min"].get()), float(self.vars["phi_max"].get())
            ]
            ori = [
                float(self.vars["ori_x"].get()),
                float(self.vars["ori_y"].get()), float(self.vars["ori_z"].get()),
            ]

        except ValueError as e:
            messagebox.showerror("Invalid Input", f"Error: {e}")
            return
        
        la_size = (float(self.vars["r_max"].get()) / int(self.vars["num_elem_x"].get()))

        # Build JSON structure
        data = {
            "Setup": {
                "Type": "Sample",
                "Sample": {"Domain": domain, "Shape": "Box"},
                "Geomfile": "",
                "Rot": [0.0, 0.0, 0.0],
                "res": [5.0, 5.0, 5.0],
                "Padding": 1,
                "onGPU": False,
                "JsonWorkDir": False,
                "memorylimit": 1073741824000
            },
            "WorkFlow": {
                "1": {
                    "Gen_CappedConeMesh": {
                        "num_elem": num_elem,
                        "r_range": r_range,
                        "phi_range": phi_range,
                        "ori": ori,
                        "Height": float(self.vars["Height"].get()),
                        "Normal": [0.0, 0.0, 1.0],
                        "r_bottom": float(self.vars["r_bottom"].get()),
                        "Mesh_file": "CappedConeMesh",
                        "UB_heightRatio": float(self.vars["UB_heightRatio"].get()),
                        "Preserve_thickness": False
                    }
                },
                "2": {
                    "Define_Lattice": {
                        "la_name": "GenCappedConeConformalMesh",
                        "definition": {
                            "type": "ConformalLattice",
                            "definition": {
                                "meshfile": "CappedConeMesh",
                                "la_name": self.vars["la_name"].get(),
                                "la_domain": "Hex",
                                "k": 0.0
                            }
                        }
                    }
                },
                "5": {
                    "Add_Lattice": {
                        "la_name": "GenCappedConeConformalMesh",
                        "size": [la_size, la_size, la_size], #[60.0, 60.0, 60.0],
                        "thk": float(self.vars["la_thk"].get()),
                        "Rot": [0.0, 0.0, 0.0],
                        "Trans": [0.0, 0.0, 0.0],
                        "Inv": False,
                        "Fill": False,
                        "Cube_Request": {}
                    }
                },
                "999": {
                    "Export": {"outfile": self.vars["outfile"].get()}
                }
            },
            "PostProcess": {
                "CombineMeshes": True,
                "RemovePartitionMeshFile": False,
                "RemoveIsolatedParts": True,
                "ExportLazPts": True
            }
        }

        

        save_path = filedialog.asksaveasfilename(
            title="Save JSON",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if not save_path:
            return

        with open(save_path, "w") as f:
            json.dump(data, f, indent=4)

        messagebox.showinfo("Saved", f"Saved to:\n{save_path}")
        # self.parent.session_file = save_path
        # self.parent.title("ArtGUI - Artisan Wizard " + save_path)
        # Reload JSON into Wizard GUI
        self.parent.load_config_from_path(save_path)
        self.destroy()


class CappedConePeriodic(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.title("Capped Cone Periodic Lattice Infill Setup")
        self.grab_set()   # Modal behavior
        self.resizable(False, False)
        

        # ---------- default values ----------
        defaults = {
            "x_min": -650.0, "x_max": 650.0,
            "y_min": -650.0, "y_max": 650.0,
            "z_min": -200.0, "z_max": 620.0,
            "num_elem_x": 3, "num_elem_y": 20, "num_elem_z": 3,
            "r_min": 400.0, "r_max": 600.0,
            "phi_min": 0.0, "phi_max": 1.0,
            "ori_x": 0.0, "ori_y": 0.0, "ori_z": 0.0,
            "Height": 600.0,
            "r_bottom": 400.0,
            "UB_heightRatio": 0.4,
            "la_name": "BCCubic",
            "outfile": ".//ConeMesh_ConformalLattice_Base.stl",
            "la_type": "Periodic",
            "la_thk": 15.0,
            "la_size_x": 60.0, "la_size_y": 60.0, "la_size_z": 60.0,
            "la_rot_x": 0.0,  "la_rot_y": 0.0,  "la_rot_z": 0.0,
            "la_trans_x": 0.0, "la_trans_y": 0.0, "la_trans_z": 0.0,
        }

        self.vars = {k: tk.StringVar(value=str(v)) for k, v in defaults.items()}

        # Layout
        self.build_layout()

    # ------------------------------------------------------------------
    def build_layout(self):
        frm = ttk.Frame(self)
        frm.pack(padx=10, pady=12)

        row = 0

        # Helper
        def add_row(label, *keys):
            nonlocal row
            ttk.Label(frm, text=label).grid(row=row, column=0, sticky="e", padx=5, pady=2)
            col = 1
            for k in keys:
                ttk.Entry(frm, textvariable=self.vars[k], width=10).grid(row=row, column=col, padx=2, pady=2)
                col += 1
            row += 1

        # Domain
        ttk.Label(frm, text="Domain (X, Y, Z)").grid(row=row, column=0, sticky="w")
        row += 1

        add_row("X min / max", "x_min", "x_max")
        add_row("Y min / max", "y_min", "y_max")
        add_row("Z min / max", "z_min", "z_max")

        ttk.Separator(frm, orient="horizontal").grid(row=row, column=0, columnspan=5, sticky="ew", pady=5)
        row += 1

        ttk.Label(frm, text="Capped Cone").grid(row=row, column=0, sticky="w")
        row += 1

        # Mesh Parameters
        add_row("num_elem (Nx Ny Nz)", "num_elem_x", "num_elem_y", "num_elem_z")
        add_row("r_range (min max)", "r_min", "r_max")
        add_row("phi_range (min max)", "phi_min", "phi_max")
        add_row("ori (x y z)", "ori_x", "ori_y", "ori_z")
        add_row("Height", "Height")
        add_row("r_bottom", "r_bottom")
        add_row("UB_heightRatio", "UB_heightRatio")

        ttk.Separator(frm, orient="horizontal").grid(row=row, column=0, columnspan=5, sticky="ew", pady=5)
        row += 1

        # Lattice name (dropdown)
        # ttk.Label(frm, text="Define Lattice Infill Type").grid(row=row, column=0, sticky="e")
        # la_type_options = ["Conformal", "Periodic"]
          
        # la_type_combo = ttk.Combobox(
        #     frm,
        #     textvariable=self.vars["la_type"],
        #     values=la_type_options,
        #     state="readonly",   # 'readonly' means user must pick from list; use 'normal' to allow free typing
        #     width=23
        # )
        # la_type_combo.grid(row=row, column=1, columnspan=3, sticky="w")
        # # Ensure the combo shows the default if it is in the list
        # if self.vars["la_type"].get() in la_type_options:
        #     la_type_combo.current(la_type_options.index(self.vars["la_type"].get()))
        # row += 2

        ttk.Label(frm, text="Lattice").grid(row=row, column=0, sticky="w")
        row += 1

        # Lattice name (dropdown)
        ttk.Label(frm, text="Define Lattice la_name").grid(row=row, column=0, sticky="e")
        la_options = ["Cubic", "BCCubic", "VertexOcta", "BC", "FCCubic", "EdgeOcta", 
                      "StarTet", "Dodecahedron", "Auxetic",
                      "SchwarzDiamond", "SchwarzPrimitive", "FischerKoch", "Neovius", "Lidinoid", "Gyroid"]
          
        la_combo = ttk.Combobox(
            frm,
            textvariable=self.vars["la_name"],
            values=la_options,
            state="readonly",   # 'readonly' means user must pick from list; use 'normal' to allow free typing
            width=23
        )
        la_combo.grid(row=row, column=1, columnspan=3, sticky="w")
        # Ensure the combo shows the default if it is in the list
        if self.vars["la_name"].get() in la_options:
            la_combo.current(la_options.index(self.vars["la_name"].get()))
        row += 1

        add_row("Lattice Thickness", "la_thk")

        add_row("Lattice size (sx sy sz)", "la_size_x", "la_size_y", "la_size_z")
        add_row("Lattice Rot (Rx Ry Rz)", "la_rot_x", "la_rot_y", "la_rot_z")
        add_row("Lattice Trans (Tx Ty Tz)", "la_trans_x", "la_trans_y", "la_trans_z")

        # outfile
        ttk.Label(frm, text="Export outfile").grid(row=row, column=0, sticky="e")
        ttk.Entry(frm, textvariable=self.vars["outfile"], width=35).grid(row=row, column=1, columnspan=2, sticky="w")
        ttk.Button(frm, text="Browse…", command=self.browse_outfile)\
            .grid(row=row, column=3, sticky="w", padx=3)
        row += 1

        # Bottom buttons
        btm = ttk.Frame(self)
        btm.pack(pady=10, fill="x")

        ttk.Button(btm, text="OK / Save JSON", command=self.save_json)\
            .pack(side="right", padx=5)
        ttk.Button(btm, text="Cancel", command=self.destroy)\
            .pack(side="right")

    # ------------------------------------------------------------------
    def browse_outfile(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".stl",
            filetypes=[("STL files", "*.stl"), ("All files", "*.*")]
        )
        if path:
            self.vars["outfile"].set(path)

    # ------------------------------------------------------------------
    def save_json(self):
        try:
            # Read values
            domain = [
                [float(self.vars["x_min"].get()), float(self.vars["x_max"].get())],
                [float(self.vars["y_min"].get()), float(self.vars["y_max"].get())],
                [float(self.vars["z_min"].get()), float(self.vars["z_max"].get())],
            ]
            num_elem = [
                int(self.vars["num_elem_x"].get()),
                int(self.vars["num_elem_y"].get()),
                int(self.vars["num_elem_z"].get()),
            ]
            r_range = [
                float(self.vars["r_min"].get()), float(self.vars["r_max"].get())
            ]
            phi_range = [
                float(self.vars["phi_min"].get()), float(self.vars["phi_max"].get())
            ]
            ori = [
                float(self.vars["ori_x"].get()),
                float(self.vars["ori_y"].get()), float(self.vars["ori_z"].get()),
            ]
            

        except ValueError as e:
            messagebox.showerror("Invalid Input", f"Error: {e}")
            return
        
        try:
            thk = float(self.vars["la_thk"].get())
            la_size = [
                float(self.vars["la_size_x"].get()),
                float(self.vars["la_size_y"].get()),
                float(self.vars["la_size_z"].get()),
            ]
            la_rot = [
                float(self.vars["la_rot_x"].get()),
                float(self.vars["la_rot_y"].get()),
                float(self.vars["la_rot_z"].get()),
            ]
            la_trans = [
                float(self.vars["la_trans_x"].get()),
                float(self.vars["la_trans_y"].get()),
                float(self.vars["la_trans_z"].get()),
            ]
        except ValueError as e:
            messagebox.showerror("Invalid Lattice Parameters", f"Error: {e}")
            return

        # Build JSON structure
        data = {
            "Setup": {
                "Type": "Sample",
                "Sample": {"Domain": domain, "Shape": "Box"},
                "Geomfile": "",
                "Rot": [0.0, 0.0, 0.0],
                "res": [5.0, 5.0, 5.0],
                "Padding": 1,
                "onGPU": False,
                "JsonWorkDir": False,
                "memorylimit": 1073741824000
            },
            "WorkFlow": {
                "1": {
                    "Gen_CappedConeMesh": {
                        "num_elem": num_elem,
                        "r_range": r_range,
                        "phi_range": phi_range,
                        "ori": ori,
                        "Height": float(self.vars["Height"].get()),
                        "Normal": [0.0, 0.0, 1.0],
                        "r_bottom": float(self.vars["r_bottom"].get()),
                        "Mesh_file": "CappedConeMesh",
                        "UB_heightRatio": float(self.vars["UB_heightRatio"].get()),
                        "Preserve_thickness": False
                    }
                },
                "2": {
                "Proc_Mesh_ExtractSurf": {
                    "Elem_Type": "Hex",
                    "inp_meshfile": "CappedConeMesh",
                    "out_meshfile": "CappedConeMesh_Exterior",
                    "isSplitTris": True
                     }
                },
                "3":{
                    "Add_Geometry":{
                        "Name": "CappedConeMesh_Exterior",
                        "k_factor": 0.0,
                        "push2GeomField": True,
                        "Paras": {
                            "Scale": [1.0, 1.0, 1.0],
                            "Trans": [0.0, 0.0, 0.0],
                            "Rot":   [0.0, 0.0, 0.0]
                      }
                  }
                },
                "4": {
                    "Add_Lattice": {
                        "la_name": self.vars["la_name"].get(),
                        "size": la_size, #[60.0, 60.0, 60.0],
                        "thk": thk,
                        "Rot": la_rot,
                        "Trans": la_trans,
                        "Inv": False,
                        "Fill": True,
                        "Cube_Request": {}
                    }
                },
                "999": {
                    "Export": {"outfile": self.vars["outfile"].get()}
                }
            },
            "PostProcess": {
                "CombineMeshes": True,
                "RemovePartitionMeshFile": False,
                "RemoveIsolatedParts": True,
                "ExportLazPts": True
            }
        }

        

        save_path = filedialog.asksaveasfilename(
            title="Save JSON",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if not save_path:
            return

        with open(save_path, "w") as f:
            json.dump(data, f, indent=4)

        messagebox.showinfo("Saved", f"Saved to:\n{save_path}")
        # self.parent.session_file = save_path
        # self.parent.title("ArtGUI - Artisan Wizard " + save_path)
        # Reload JSON into Wizard GUI
        self.parent.load_config_from_path(save_path)
        self.destroy()


class UniversalConformalInfill(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.title("Univeral Mesh Lattice Infill Setup")
        self.grab_set()   # Modal behavior
        self.resizable(False, False)
        
        # ---------- default values ----------
        defaults = {
            "x_min": -650.0, "x_max": 650.0,
            "y_min": -650.0, "y_max": 650.0,
            "z_min": -200.0, "z_max": 620.0,
            "meshfile": ".//test.inp",
            "la_name": "BCCubic",
            "la_thk": 15.0,
            "la_size_x": 60.0, "la_size_y": 60.0, "la_size_z": 60.0,
            "outfile": ".//export_file.stl"
        }

        self.vars = {k: tk.StringVar(value=str(v)) for k, v in defaults.items()}

        # Layout
        self.build_layout()

    # ------------------------------------------------------------------
    def build_layout(self):
        frm = ttk.Frame(self)
        frm.pack(padx=10, pady=12)

        row = 0

        # Helper
        def add_row(label, *keys):
            nonlocal row
            ttk.Label(frm, text=label).grid(row=row, column=0, sticky="e", padx=5, pady=2)
            col = 1
            for k in keys:
                ttk.Entry(frm, textvariable=self.vars[k], width=10).grid(row=row, column=col, padx=2, pady=2)
                col += 1
            row += 1

        # Domain
        # ttk.Label(frm, text="Domain (X, Y, Z)").grid(row=row, column=0, sticky="w")
        # row += 1

        # add_row("X min / max", "x_min", "x_max")
        # add_row("Y min / max", "y_min", "y_max")
        # add_row("Z min / max", "z_min", "z_max")

        # ttk.Separator(frm, orient="horizontal").grid(row=row, column=0, columnspan=5, sticky="ew", pady=5)
        # row += 1

        ttk.Label(frm, text="Conformal Mesh").grid(row=row, column=0, sticky="w")
        row += 1

        # Mesh Parameters
        ttk.Label(frm, text="Meshfile").grid(row=row, column=0, sticky="e")
        ttk.Entry(frm, textvariable=self.vars["meshfile"], width=35).grid(row=row, column=1, columnspan=2, sticky="w")
        ttk.Button(frm, text="Browse…", command=self.browse_meshfile)\
            .grid(row=row, column=3, sticky="w", padx=3)
        row += 1

        ttk.Separator(frm, orient="horizontal").grid(row=row, column=0, columnspan=5, sticky="ew", pady=5)
        row += 1

        ttk.Label(frm, text="Lattice").grid(row=row, column=0, sticky="w")
        row += 1

        # Lattice name (dropdown)
        ttk.Label(frm, text="Define Lattice la_name").grid(row=row, column=0, sticky="e")
        la_options = ["Cubic", "BCCubic", "VertexOcta", "BC", "FCCubic", "EdgeOcta", 
                      "StarTet", "Dodecahedron", "Auxetic",
                      "SchwarzDiamond", "SchwarzPrimitive", "FischerKoch", "Neovius", "Lidinoid", "Gyroid"]
          
        la_combo = ttk.Combobox(
            frm,
            textvariable=self.vars["la_name"],
            values=la_options,
            state="readonly",   # 'readonly' means user must pick from list; use 'normal' to allow free typing
            width=23
        )
        la_combo.grid(row=row, column=1, columnspan=3, sticky="w")
        # Ensure the combo shows the default if it is in the list
        if self.vars["la_name"].get() in la_options:
            la_combo.current(la_options.index(self.vars["la_name"].get()))
        row += 1

        add_row("Lattice Thickness", "la_thk")
        add_row("Lattice size (sx sy sz)", "la_size_x", "la_size_y", "la_size_z")
        
        # outfile
        ttk.Label(frm, text="Export outfile").grid(row=row, column=0, sticky="e")
        ttk.Entry(frm, textvariable=self.vars["outfile"], width=35).grid(row=row, column=1, columnspan=2, sticky="w")
        ttk.Button(frm, text="Browse…", command=self.browse_outfile)\
            .grid(row=row, column=3, sticky="w", padx=3)
        row += 1

        # Bottom buttons
        btm = ttk.Frame(self)
        btm.pack(pady=10, fill="x")

        ttk.Button(btm, text="OK / Save JSON", command=self.save_json)\
            .pack(side="right", padx=5)
        ttk.Button(btm, text="Cancel", command=self.destroy)\
            .pack(side="right")

    # ------------------------------------------------------------------
    def browse_outfile(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".stl",
            filetypes=[("STL files", "*.stl"), ("All files", "*.*")]
        )
        if path:
            self.vars["outfile"].set(path)

    def browse_meshfile(self):
        path = filedialog.askopenfilename(
            title="Select mesh file",
            filetypes=[("Inp files", "*.inp"), ("All files", "*.*")]
        )
        if not path:
            return

        self.vars["meshfile"].set(path)

        # Auto-update Domain from imported mesh
        try:
            xmin, xmax, ymin, ymax, zmin, zmax = self._compute_bbox_from_inp(path)
            self._set_domain_vars(xmin, xmax, ymin, ymax, zmin, zmax)
        except Exception as e:
            messagebox.showerror("Bounding Box Error", f"Failed to read domain from mesh:\n{e}")



    # ------------------------------------------------------------------
    def save_json(self):
        try:
            # Read values
            domain = [
                [float(self.vars["x_min"].get()), float(self.vars["x_max"].get())],
                [float(self.vars["y_min"].get()), float(self.vars["y_max"].get())],
                [float(self.vars["z_min"].get()), float(self.vars["z_max"].get())],
            ]
        except ValueError as e:
            messagebox.showerror("Invalid Input", f"Error: {e}")
            return
        
        try:
            meshfile = self.vars["meshfile"].get()
            thk = float(self.vars["la_thk"].get())
            la_size = [
                float(self.vars["la_size_x"].get()),
                float(self.vars["la_size_y"].get()),
                float(self.vars["la_size_z"].get()),
            ]
        except ValueError as e:
            messagebox.showerror("Invalid Lattice Parameters", f"Error: {e}")
            return
        
        res = [
                (float(self.vars["x_max"].get()) - float(self.vars["x_min"].get()))/100,
                (float(self.vars["y_max"].get()) - float(self.vars["y_min"].get()))/100,
                (float(self.vars["z_max"].get()) - float(self.vars["z_min"].get()))/100,
            ]

        # Build JSON structure
        data ={
            "Setup": {
                "Type": "Sample",
                "Sample": {
                    "Domain": domain,
                    "Shape": "Box"
                },
                "Geomfile": "",
                "Rot": [0.0, 0.0, 0.0],
                "res": res, #[2.0, 2.0, 2.0],
                "Padding": 5,
                "onGPU": False,
                "JsonWorkDir":True,
                "memorylimit": 1073741824000
            },
            "WorkFlow": {
                "1": {
                    "Define_Lattice": {
                        "la_name": "GenConformalMesh",
                        "definition": {
                            "type": "ConformalLattice",
                            "definition": {
                                "meshfile": meshfile,
                                "la_name": self.vars["la_name"].get(),
                                "la_domain": "Hex",
                                "k": 0.0
                            }
                        }
                    }
                },
                "2": {
                    "Add_Lattice": {
                        "la_name": "GenConformalMesh",
                        "size": la_size,
                        "thk": thk,
                        "Rot": [0.0, 0.0, 0.0],
                        "Trans": [0.0, 0.0, 0.0],
                        "Inv": False,
                        "Fill": False,
                        "Cube_Request": {}
                    }
                },
                "999": {
                    "Export": {
                        "outfile": self.vars["outfile"].get()
                    }
                }
            },
            "PostProcess": {
                "CombineMeshes": True,
                "RemovePartitionMeshFile": False,
                "RemoveIsolatedParts": True,
                "ExportLazPts": True
            }
        }        

        save_path = filedialog.asksaveasfilename(
            title="Save JSON",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if not save_path:
            return

        with open(save_path, "w") as f:
            json.dump(data, f, indent=4)

        messagebox.showinfo("Saved", f"Saved to:\n{save_path}")
        # self.parent.session_file = save_path
        # self.parent.title("ArtGUI - Artisan Wizard " + save_path)
        # Reload JSON into Wizard GUI
        self.parent.load_config_from_path(save_path)
        self.destroy()
    
    def _compute_bbox_from_inp(self, path: str):
        """
        Compute bounding box from an Abaqus .inp by scanning *Node section.
        Returns: (xmin, xmax, ymin, ymax, zmin, zmax)
        """
        xmin = ymin = zmin = float("inf")
        xmax = ymax = zmax = float("-inf")

        in_node_section = False
        found_any = False

        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for raw in f:
                line = raw.strip()
                if not line:
                    continue

                # Section switching
                if line.startswith("*"):
                    head = line.upper()
                    if head.startswith("*NODE"):
                        in_node_section = True
                    elif in_node_section:
                        # leaving *Node when another keyword starts
                        break
                    continue

                if not in_node_section:
                    continue

                # Typical node line: id, x, y, z
                # Some files may include trailing fields; we only need first 4 entries.
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 4:
                    continue

                try:
                    x = float(parts[1])
                    y = float(parts[2])
                    z = float(parts[3])
                except ValueError:
                    continue

                found_any = True
                if x < xmin: xmin = x
                if x > xmax: xmax = x
                if y < ymin: ymin = y
                if y > ymax: ymax = y
                if z < zmin: zmin = z
                if z > zmax: zmax = z

        if not found_any:
            raise ValueError("No nodes found in *Node section. Cannot compute bounding box.")

        return xmin, xmax, ymin, ymax, zmin, zmax


    def _set_domain_vars(self, xmin, xmax, ymin, ymax, zmin, zmax):
        # Format nicely; adjust precision if you want
        self.vars["x_min"].set(f"{xmin:.6g}")
        self.vars["x_max"].set(f"{xmax:.6g}")
        self.vars["y_min"].set(f"{ymin:.6g}")
        self.vars["y_max"].set(f"{ymax:.6g}")
        self.vars["z_min"].set(f"{zmin:.6g}")
        self.vars["z_max"].set(f"{zmax:.6g}")

