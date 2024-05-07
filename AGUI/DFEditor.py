import json
import tkinter as tk
from AGUI.util import ToolTip
from tkinter import ttk, messagebox, simpledialog, filedialog
from AGUI.JSONtreeview import JSONTreeView

class DFEditor(JSONTreeView):
    def __init__(self, master, data, fileext:str, editor_gui = None):
        self.root = master
        self.data = data
        self.editor_gui = editor_gui
        self.editor_gui = editor_gui
        self.fileext = fileext
        self.sessionfile = None
        self.setup_ui()
        self.insert_json('', self.data)

    def setup_ui(self):
        self.tree = ttk.Treeview(self.root, columns=['Value'])
        self.tree.heading('#0', text='Key')
        self.tree.heading('Value', text='Value')
        self.tree.bind('<Double-1>', self.item_clicked)
        self.tree.pack(fill='both', expand=True)
        
        # Context menu
        self.context_menu = tk.Menu(self.root, tearoff=0)
        self.context_menu.add_command(label="Copy", command=self.copy_json)
        self.context_menu.add_command(label="Paste", command=self.paste_json)
        self.tree.bind("<Button-3>", self.on_right_click)  # For Windows/Linux, use "<Button-2>" for Mac
        
        # Button frame
        button_frame = tk.Frame(self.root)
        button_frame.pack(pady=10)
        
        # Control buttons
        # Load an image
        self.editor_icon = tk.PhotoImage(file=".//AGUI//resources//editor.png") 
        self.copy_icon = tk.PhotoImage(file=".//AGUI//resources//copy.png") 
        self.paste_icon = tk.PhotoImage(file=".//AGUI//resources//paste.png") 
        self.save_icon = tk.PhotoImage(file=".//AGUI//resources//save.png") 
        self.load_icon = tk.PhotoImage(file=".//AGUI//resources//load.png")
        self.saveas_icon = tk.PhotoImage(file=".//AGUI//resources//saveas.png") 

        copy_button = tk.Button(button_frame, text="Copy Item", image=self.copy_icon, command=self.copy_json)
        copy_button.pack(side='left', padx=5)
        self.create_tooltip(copy_button, "Copy JSON")

        paste_button = tk.Button(button_frame, text="Paste Item", image=self.paste_icon, command=self.paste_json)
        paste_button.pack(side='left', padx=5)
        self.create_tooltip(paste_button, "Paste JSON")
        
        save_button = tk.Button(button_frame, text="Save", image=self.save_icon, command=self.SaveToFile)
        save_button.pack(side='left', padx=5)
        self.create_tooltip(save_button, "Save JSON to file")

        load_button = tk.Button(button_frame, text="Load", image=self.load_icon, command=self.LoadFromFile)
        load_button.pack(side='left', padx=5)
        self.create_tooltip(load_button, "Load JSON from file")

        saveas_button = tk.Button(button_frame, text="Save As", image=self.saveas_icon, command=self.SaveAs)
        saveas_button.pack(side='left', padx=5)
        self.create_tooltip(saveas_button, "Save JSON to a new file")

        

        editor_button = tk.Button(self.root, text="Editor", image=self.editor_icon, command=lambda: self.load_and_highlight_json(onSave=False))
        editor_button.pack(pady=10)
        self.create_tooltip(editor_button, "Editor")


    def SaveToFile(self):
        if self.sessionfile == None:
            file_path = filedialog.asksaveasfilename(defaultextension="."+self.fileext, 
                                                     filetypes=[(self.fileext+" files", "*."+self.fileext), ("All files", "*.*")])
            self.sessionfile = file_path
        else:
            file_path = self.sessionfile

        if file_path:
            self.data = self.extract_treeview_data("")
            with open(file_path, 'w') as file:
                json.dump(self.data, file, indent=4)
            self.editor_gui.title("ArtGUI Definition Editior "+self.sessionfile)

    def SaveAs(self):
        file_path = filedialog.asksaveasfilename(defaultextension="."+self.fileext, 
                                                 filetypes=[(self.fileext+" files", "*."+self.fileext), ("All files", "*.*")])
        if file_path:
            self.data = self.extract_treeview_data("")
            with open(file_path, 'w') as file:
                json.dump(self.data, file, indent=4)
            self.sessionfile = file_path
            self.editor_gui.title("ArtGUI Definition Editior "+self.sessionfile)

    def LoadFromFile(self):
        file_path = filedialog.askopenfilename(filetypes=[(self.fileext+" files", "*."+self.fileext), ("All files", "*.*")])

        if file_path:
            try:
                with open(file_path, 'r') as file:
                    self.data = json.load(file)
                self.clear_all()
                self.insert_json("", self.data)

                self.sessionfile = file_path
                self.editor_gui.title("ArtGUI Definition Editior "+self.sessionfile)

            except Exception as e:
                tk.messagebox.showerror("Error", f"Failed to load JSON file:\n{e}")
            


    