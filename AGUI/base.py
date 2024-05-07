# -*- coding: utf-8 -*-
"""
Created on Sun Apr 21 21:06:45 2024

@author: Yikun Wang
"""
import json
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

    
def save_configuration(sessionfile:str, type_entry, domain_x_lb, domain_x_ub, domain_y_lb, domain_y_ub,
                       domain_z_lb, domain_z_ub, geomfile_entry, rot_x_entry, rot_y_entry,
                       rot_z_entry, res_x_entry, res_y_entry, res_z_entry, padding_entry,
                       ongpu_var, memory_limit_entry, workflow_text_widget, combine_meshes_var,
                       remove_partition_var, remove_isolated_parts_var, export_laz_pts_var):
    
    def get_float(entry_widget, default=0.0):
        try:
            return float(entry_widget.get()) if entry_widget.get() else default
        except ValueError:
            return default
    
    def get_int(entry_widget, default=0):
        try:
            return int(entry_widget.get()) if entry_widget.get() else default
        except ValueError:
            return default
    
    setup_data = {
        "Type": type_entry.get(),
        "Sample": {
            "Domain": [
                [get_float(domain_x_lb), get_float(domain_x_ub)],
                [get_float(domain_y_lb), get_float(domain_y_ub)],
                [get_float(domain_z_lb), get_float(domain_z_ub)]
            ],
            "Shape": "Box"
        },
        "Geomfile": geomfile_entry.get(),
        "Rot": [get_float(rot_x_entry), get_float(rot_y_entry), get_float(rot_z_entry)],
        "res": [get_float(res_x_entry), get_float(res_y_entry), get_float(res_z_entry)],
        "Padding": get_int(padding_entry),
        "onGPU": ongpu_var.get(),
        "memorylimit": get_int(memory_limit_entry)
    }

    #workflow_text = workflow_text_widget.get("1.0", tk.END).strip()
    workflow_text = workflow_text_widget.get()
    
    if type(workflow_text) == dict:
        workflow_dict = workflow_text
    else:
        messagebox.showerror("Error", "Invalid JSON format.")
        return None

    # if workflow_text == "":
    #     workflow_dict = json.loads("{}")
    # else:
    #     try:
    #         workflow_dict = json.loads(workflow_text)
    #     except json.JSONDecodeError as e:
    #         messagebox.showerror("Error", "Invalid JSON format: " + str(e))
    #         return None
        
    post_process_data = {
        "CombineMeshes": combine_meshes_var.get(),
        "RemovePartitionMeshFile": remove_partition_var.get(),
        "RemoveIsolatedParts": remove_isolated_parts_var.get(),
        "ExportLazPts": export_laz_pts_var.get()
    }

    data_to_save = {
        "Setup": setup_data,
        "WorkFlow": workflow_dict,
        "PostProcess": post_process_data
    }

    filepath = None

    if sessionfile == None:
        filepath = filedialog.asksaveasfilename(initialdir="/", title="Save Configuration",
                                            defaultextension=".json",
                                            filetypes=[("JSON files", "*.json"), ("All files", "*.*")])
    else:
        filepath = sessionfile

    if filepath:
        with open(filepath, 'w') as file:
            json.dump(data_to_save, file, indent=4)
        #messagebox.showinfo("Save Configuration", f"Configuration saved successfully to {filepath}")

    if filepath == "":
        filepath = None
    
    return filepath


def load_configuration(type_entry, domain_x_lb, domain_x_ub, domain_y_lb, domain_y_ub,
                       domain_z_lb, domain_z_ub, geomfile_entry, rot_x_entry, rot_y_entry,
                       rot_z_entry, res_x_entry, res_y_entry, res_z_entry, padding_entry,
                       ongpu_var, memory_limit_entry, workflow_text_widget, combine_meshes_var,
                       remove_partition_var, remove_isolated_parts_var, export_laz_pts_var):
    # Ask the user to select a JSON file
    filepath = filedialog.askopenfilename(title="Open Configuration File", filetypes=[("JSON Files", "*.json"),
                                                                                      ("All files", "*.*")])
    if not filepath:
        return  # User cancelled the dialog
    
    try:
        # Read and parse the JSON file
        with open(filepath, 'r') as file:
            data = json.load(file)
        
        # Now populate the GUI widgets with the data from the JSON file
        setup_data = data.get("Setup", {})
        type_entry.delete(0, tk.END)
        type_entry.insert(0, setup_data.get("Type", ""))
        
        
        try:
            geomfile_entry.delete(0, tk.END)
            geomfile_entry.insert(0, setup_data.get("Geomfile", ""))
        except:
            geomfile_entry.delete(0, tk.END)
            geomfile_entry.insert(0, "")


        try:
            domain_x_lb.delete(0, tk.END)
            domain_x_lb.insert(0, setup_data["Sample"]["Domain"][0][0])
            domain_x_ub.delete(0, tk.END)
            domain_x_ub.insert(0, setup_data["Sample"]["Domain"][0][1])
            
            domain_y_lb.delete(0, tk.END)
            domain_y_lb.insert(0, setup_data["Sample"]["Domain"][1][0])
            domain_y_ub.delete(0, tk.END)
            domain_y_ub.insert(0, setup_data["Sample"]["Domain"][1][1])

            domain_z_lb.delete(0, tk.END)
            domain_z_lb.insert(0, setup_data["Sample"]["Domain"][2][0])
            domain_z_ub.delete(0, tk.END)
            domain_z_ub.insert(0, setup_data["Sample"]["Domain"][2][1])
        except:
            domain_x_lb.delete(0, tk.END)
            domain_x_lb.insert(0, 0.0)
            domain_x_ub.delete(0, tk.END)
            domain_x_ub.insert(0, 0.0)
            
            domain_y_lb.delete(0, tk.END)
            domain_y_lb.insert(0, 0.0)
            domain_y_ub.delete(0, tk.END)
            domain_y_ub.insert(0, 0.0)

            domain_z_lb.delete(0, tk.END)
            domain_z_lb.insert(0, 0.0)
            domain_z_ub.delete(0, tk.END)
            domain_z_ub.insert(0, 0.0)

        rot_x_entry.delete(0, tk.END)
        rot_x_entry.insert(0, setup_data.get("Rot", [])[0])
        rot_y_entry.delete(0, tk.END)
        rot_y_entry.insert(0, setup_data.get("Rot", [])[1])
        rot_z_entry.delete(0, tk.END)
        rot_z_entry.insert(0, setup_data.get("Rot", [])[2])

        res_x_entry.delete(0, tk.END)
        res_x_entry.insert(0, setup_data.get("res", [])[0])
        res_y_entry.delete(0, tk.END)
        res_y_entry.insert(0, setup_data.get("res", [])[1])
        res_z_entry.delete(0, tk.END)
        res_z_entry.insert(0, setup_data.get("res", [])[2])

        padding_entry.delete(0, tk.END)
        padding_entry.insert(0, setup_data.get("Padding", ""))

        ongpu_var.set(setup_data.get("onGPU", False))
        memory_limit_entry.delete(0, tk.END)
        memory_limit_entry.insert(0, setup_data.get("memorylimit", ""))
        
        #print(type(data.get("WorkFlow", "")))

        # workflow_text_widget.delete("1.0", tk.END)
        # workflow_text_widget.insert("1.0", json.dumps(data.get("WorkFlow", ""), indent=4))
        workflow_text_widget.clear_all()
        workflow_text_widget.insert_json("", data["WorkFlow"])

        combine_meshes_var.set(data["PostProcess"].get("CombineMeshes", False))
        remove_partition_var.set(data["PostProcess"].get("RemovePartitionMeshFile", False))
        remove_isolated_parts_var.set(data["PostProcess"].get("RemoveIsolatedParts", False))
        export_laz_pts_var.set(data["PostProcess"].get("ExportLazPts", False))

    except Exception as e:
        messagebox.showerror("Error", "Failed to load file: " + str(e))
    
    return filepath

def submit_configuration(filename, output_text_widget):
    import subprocess
    try:
        import sys
        
        # cmd = ['python', 'ArtisanMain.py', '-f', filename]

        cmd = [sys.executable, 'ArtisanMain.py', '-f', filename]
        
        output_text_widget.delete('1.0', tk.END)
        output_text_widget.update()

        # Start the subprocess and capture its output
        # process = subprocess.run(cmd, shell=False, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        
        while True:
            data = process.stdout.readline()   # Alternatively proc.stdout.read(1024)
            if len(data) == 0:
                break
            out = str(data.rstrip().decode('utf-8'))
            output_text_widget.insert(tk.END, out + "\n")
            output_text_widget.update()
            output_text_widget.see(tk.END) 

        if process.stderr:
            output_text_widget.insert(tk.END, "Errors:\n" + process.stderr)
        
        process.stdout.close()
        # messagebox.showinfo("Success", "Configuration submitted successfully.")
        
    except subprocess.CalledProcessError as e:
        output_text_widget.insert(tk.END, f"Execution Failed:\n{str(e)}\n")
        messagebox.showerror("Execution Failed", f"Executable failed: {str(e)}")
    except Exception as e:
        output_text_widget.insert(tk.END, f"Error:\n{str(e)}\n")
        messagebox.showerror("Error", f"An error occurred: {str(e)}")
        
