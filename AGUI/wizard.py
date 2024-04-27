import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import ast
# Assuming the import path and function exist as provided
from AGUI.base import load_configuration, submit_configuration, save_configuration
from AGUI.vtkbase import ModelViewer

class ArtisanWizard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ArtGUI - Artisan Wizard")
        self.session_file = None
        self.init_gui()
        self.modelviewer = ModelViewer()
        
    def init_gui(self):
       # Menu and Style configuration
        self.config(menu=self.create_menu())
        self.style = ttk.Style(self)
        self.style.theme_use('winnative')

        photo = tk.PhotoImage(file = '.\\AGUI\\resources\\icon.png')
        self.iconphoto(True, photo)

        # Bind shortcuts
        self.bind("<Control-s>", lambda event: self.save_file())
        # self.bind("<Control-A>", lambda event: self.save_as_file())
        self.bind("<Control-l>", lambda event: self.load_file())
        
        # Frames using grid
        self.setup_frame = self.create_setup_frame()
        self.setup_frame.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)

        self.post_process_frame = self.create_post_process_frame()
        self.post_process_frame.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)

        self.message_panel_frame = self.create_message_panel_frame()
        self.message_panel_frame.grid(row=2, column=0, sticky="nsew", padx=5, pady=5)

        self.workflow_frame = self.setup_workflow_frame()
        self.workflow_frame.grid(row=0, column=1, rowspan=3, sticky="nsew", padx=5, pady=5)

        # Configure grid column and row sizes
        self.grid_columnconfigure(0, weight=1)  # Setup, postprocess, and message panels share this column
        self.grid_columnconfigure(1, weight=3)  # Workflow gets more relative width

        self.grid_rowconfigure(0, weight=1)  # Setup frame gets a portion of vertical space
        self.grid_rowconfigure(1, weight=1)  # Postprocess frame gets a portion of vertical space
        self.grid_rowconfigure(2, weight=2)  # Message panel gets more vertical space since it might need to show more info

        # update viewer
        btn_update = ttk.Button(self, text="Update Viewer", command=self.update_viewer)
        btn_update.grid(row=3, column=0, columnspan=1, sticky="ew", padx=5, pady=5)

        # Submit Button at the bottom spanning 1 column
        submit_button = ttk.Button(self, text="Generate", command=self.on_generate)
        submit_button.grid(row=3, column=1, columnspan=1, sticky="ew", padx=5, pady=5)

        # Syntax highlighting tags
        self.workflow_text_widget.tag_configure('brace', foreground='magenta',font=('Helvetica', 10, 'bold'))
        self.workflow_text_widget.tag_configure('key', foreground='blue', font=('Helvetica', 10, 'bold'))
        #self.workflow_text_widget.tag_configure('value', foreground='darkorange')

        # Bind text changes to the highlighting function
        self.workflow_text_widget.bind('<Return>', self.highlight_json)
        

    def update_viewer(self):
        import json
        wf_dict = json.loads(self.workflow_text_widget.get("1.0", tk.END).strip())
        
        try:
            model_path = wf_dict[list(wf_dict.keys())[-1]]["Export"]["outfile"]  
            if os.path.isfile(model_path):
                self.modelviewer.update_model(model_path)
            else:
                messagebox.showinfo("Update Model", "Did not find the results file. Please generate it first.")

        except:
            messagebox.showinfo("Update Model", "The workflow last command does not contain export file information. \
                                The last keywords must be Export having its parameter outfile.")
        return None 

    def create_menu(self):
        menu_bar = tk.Menu(self)
        file_menu = tk.Menu(menu_bar, tearoff=0)
        file_menu.add_command(label="Save", command=self.save_file, accelerator="Ctrl+S")
        file_menu.add_command(label="Save as", command=self.save_as_file)
        file_menu.add_command(label="Load", command=self.load_file, accelerator="Ctrl+L")
        menu_bar.add_cascade(label="File", menu=file_menu)

        help_menu = tk.Menu(menu_bar, tearoff=0)
        help_menu.add_command(label="About", command=self.show_about_window)
        menu_bar.add_cascade(label="Help", menu=help_menu)

        return menu_bar

    def browse_file(self, entry):
        filename = filedialog.askopenfilename(filetypes=(("STL files", "*.stl"), ("All files", "*.*")))
        if filename:
            entry.delete(0, tk.END)
            entry.insert(0, filename)

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
        self.highlight_json()

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
        # frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        # Workflow text widget with scrollbar
        self.workflow_text_widget = tk.Text(frame, height=10)
        scroll = tk.Scrollbar(frame, command=self.workflow_text_widget.yview)
        self.workflow_text_widget.configure(yscrollcommand=scroll.set)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.workflow_text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

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
    
    def highlight_json(self, event=None):
        import json
        import re
        current_position = self.workflow_text_widget.index(tk.INSERT)  # Get current cursor position

        content = self.workflow_text_widget.get("1.0", "end-1c")
        self.workflow_text_widget.tag_remove('brace', '1.0', 'end')
        self.workflow_text_widget.tag_remove('key', '1.0', 'end')
        self.workflow_text_widget.tag_remove('value', '1.0', 'end')

        try:
            obj = json.loads(content)
            formatted_json = json.dumps(obj, indent=4)
            self.workflow_text_widget.delete("1.0", "end")
            self.workflow_text_widget.insert("1.0", formatted_json)

            for match in re.finditer(r'[{[\]}]', formatted_json):
                self.workflow_text_widget.tag_add('brace', f"1.0 + {match.start()}c", f"1.0 + {match.end()}c")
            for match in re.finditer(r'\"(.*?)\"(?=:)', formatted_json):
                self.workflow_text_widget.tag_add('key', f"1.0 + {match.start()}c", f"1.0 + {match.end()}c")
            #for match in re.finditer(r': (.*?)(,|\n)', formatted_json):
            #    self.workflow_text_widget.tag_add('value', f"1.0 + {match.start(1)}c", f"1.0 + {match.end(1)}c")

            # # Highlight strings
            # for match in re.finditer(r'\"(.*?)\"', formatted_json):
            #     if ':' not in match.group(1):  # Avoid highlighting keys
            #         self.workflow_text_widget.tag_add('value', f"1.0 + {match.start(1)}c", f"1.0 + {match.end(1)}c")

            # # Highlight numbers
            # for match in re.finditer(r'\b-?\d+(\.\d+)?([eE][+-]?\d+)?\b', formatted_json):
            #     self.workflow_text_widget.tag_add('value', f"1.0 + {match.start()}c", f"1.0 + {match.end()}c")

            # # Highlight Booleans
            # for match in re.finditer(r'\b(true|false)\b', formatted_json):
            #     self.workflow_text_widget.tag_add('value', f"1.0 + {match.start()}c", f"1.0 + {match.end()}c")

                #for match in re.finditer(r': .*?,|\n', formatted_json):
                #    self.workflow_text_widget.tag_add('value', f"1.0 + {match.start(1)}c", f"1.0 + {match.end(1)}c")

            self.workflow_text_widget.mark_set(tk.INSERT, current_position)  # Restore cursor position
        except json.JSONDecodeError:
            pass  # Optionally handle or log errors here

    def show_about_window(self):
        import webbrowser

        about_window = tk.Toplevel(self)
        about_window.title("About ArtGUI - Artisan Wizard")
        about_window.geometry("500x300")  # Width x Height

        # Main info text
        info_text = ("ArtGUI - Artisan Wizard, Version 0.0.1\n"
                     "Developed by Yikun Wang\n"
                     "ArtGUI is distributed under the MIT License.\n"
                     "Artisan-core is distributed under CC BY-NC-ND 3.0 for non-commercial applications.\n\n"
                    )
        label_info = tk.Label(about_window, text=info_text, justify=tk.LEFT)
        label_info.pack(padx=10, pady=10)        

        # Additional info text
        additional_text = ("For more information, visit ")
        label_additional = tk.Label(about_window, text=additional_text, justify=tk.LEFT)
        label_additional.pack(padx=10, pady=5)

        link1_label = tk.Label(about_window, text="https://bleemsys.com/Artisan.html", fg="blue", cursor="hand2")
        link1_label.pack(padx=10, pady=5)
        link1_label.bind("<Button-1>", lambda e: webbrowser.open_new("https://bleemsys.com/Artisan.html"))

         # Additional info text
        onlinedoc_text = ("For the online help manual, visit ")
        label_additional = tk.Label(about_window, text=onlinedoc_text, justify=tk.LEFT)
        label_additional.pack(padx=10, pady=5)

        # Second link label
        link2_label = tk.Label(about_window, text="https://bleemsys.com/Artisan/docs/index.html", fg="blue", cursor="hand2")
        link2_label.pack(padx=10, pady=5)
        link2_label.bind("<Button-1>", lambda e: webbrowser.open_new("https://bleemsys.com/Artisan/docs/index.html"))

        # Button to close the about window
        close_button = tk.Button(about_window, text="Close", command=about_window.destroy)
        close_button.pack(pady=10)

        # Centering the about window on the screen
        window_width = about_window.winfo_reqwidth()
        window_height = about_window.winfo_reqheight()
        position_right = int(about_window.winfo_screenwidth() / 2 - window_width / 2)
        position_down = int(about_window.winfo_screenheight() / 2 - window_height / 2)
        about_window.geometry("+{}+{}".format(position_right, position_down))

        about_window.transient(self)  # Set to be on top of the main window
        about_window.grab_set()  # Disable other windows while this is open
        self.wait_window(about_window)  # Wait for this window to close before returning to the main loop
