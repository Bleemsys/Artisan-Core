import json
import tkinter as tk
from AGUI.util import ToolTip
from tkinter import ttk, messagebox, simpledialog

class JSONTreeView:
    def __init__(self, master, data, main_gui = None):
        self.root = master
        self.data = data
        self.main_gui = main_gui
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
        self.moveup_icon = tk.PhotoImage(file=".//AGUI//resources//moveUp.png") 
        self.movedown_icon = tk.PhotoImage(file=".//AGUI//resources//moveDown.png")  
        self.editor_icon = tk.PhotoImage(file=".//AGUI//resources//editor.png") 
        self.clear_icon = tk.PhotoImage(file=".//AGUI//resources//clear.png") 
        self.delete_icon = tk.PhotoImage(file=".//AGUI//resources//delete.png") 
        self.copy_icon = tk.PhotoImage(file=".//AGUI//resources//copy.png") 
        self.paste_icon = tk.PhotoImage(file=".//AGUI//resources//paste.png") 

        up_button = tk.Button(button_frame, text="Move Up", image=self.moveup_icon, command=self.move_up)
        up_button.pack(side='left', padx=5)
        self.create_tooltip(up_button, "Move up")

        down_button = tk.Button(button_frame, text="Move Down", image=self.movedown_icon, command=self.move_down)
        down_button.pack(side='left', padx=5)
        self.create_tooltip(down_button, "Move down")
        
        delete_button = tk.Button(button_frame, text="Delete Item", image=self.delete_icon, command=self.delete_item)
        delete_button.pack(side='left', padx=5)
        self.create_tooltip(delete_button, "Delete item")

        copy_button = tk.Button(button_frame, text="Copy Item", image=self.copy_icon, command=self.copy_json)
        copy_button.pack(side='left', padx=5)
        self.create_tooltip(copy_button, "Copy JSON")

        paste_button = tk.Button(button_frame, text="Paste Item", image=self.paste_icon, command=self.paste_json)
        paste_button.pack(side='left', padx=5)
        self.create_tooltip(paste_button, "Paste JSON")

        load_json_button = tk.Button(self.root, text="Editor", image=self.editor_icon, command=self.load_and_highlight_json)
        load_json_button.pack(pady=10)
        self.create_tooltip(load_json_button, "Editor")

        clear_button = tk.Button(self.root, text="Clear All", image=self.clear_icon, command=self.clear_all)
        clear_button.pack(pady=10)
        self.create_tooltip(clear_button, "Clear all")
    
    def create_tooltip(self, widget, text):
        tooltip = ToolTip(widget, text)
        widget.bind("<Enter>", lambda _: tooltip.show_tip())
        widget.bind("<Leave>", lambda _: tooltip.hide_tip())

    def insert_json(self, parent, json_dict):
        for key, value in json_dict.items():
            if isinstance(value, dict):
                # Insert dictionary nodes recursively
                node = self.tree.insert(parent, 'end', text=key, values=[{}])
                self.insert_json(node, value)
            elif isinstance(value, list):
                # Insert lists directly without further filtering
                node = self.tree.insert(parent, 'end', text=key, values=[json.dumps(value)])
            elif isinstance(value, (int, float, bool)):
                # Insert numbers and booleans directly
                self.tree.insert(parent, 'end', text=key, values=[value])
            else:
                # Insert strings directly
                self.tree.insert(parent, 'end', text=key, values=[value])

    def item_clicked(self, event):
        item_id = self.tree.focus()
        item = self.tree.item(item_id)
        key = item['text']
        value = item['values'][0] if item['values'] else ''
        
        top = tk.Toplevel(self.root)
        tk.Label(top, text="Edit key:").pack(padx=10, pady=5)
        key_entry = tk.Entry(top)
        key_entry.insert(0, key)
        key_entry.pack(padx=10, pady=5)
        
        tk.Label(top, text="Edit value:").pack(padx=10, pady=5)
        value_entry = tk.Entry(top)
        value_entry.insert(0, value)
        value_entry.pack(padx=10, pady=5)
        
        def save_changes():
            new_key = key_entry.get()
            
            # Check if the node is a leaf node
            is_leaf_node = not self.tree.get_children(item_id)
        
            if is_leaf_node:
                # Handle leaf node (very bottom)
                 new_value = value_entry.get()
            else:
                # Handle non-leaf node
                new_value = self.extract_treeview_data(item_id)

            parent_id = self.tree.parent(item_id)
            self.tree.delete(item_id)
            #new_item_id = self.tree.insert(parent_id, 'end', text=new_key, values=[new_value])
            new_value = {new_key: new_value}
            self.insert_json(parent_id, new_value)
            self.data = self.extract_treeview_data("")
            top.destroy()

        tk.Button(top, text="Save", command=save_changes).pack(pady=10)
            
    def delete_item(self):
        try:
            selected_item = self.tree.selection()[0]
            if selected_item:
                self.tree.delete(selected_item)
        except:
            pass

    def move_up(self):
        selected_item = self.tree.selection()[0]
        parent = self.tree.parent(selected_item)
        index = self.tree.index(selected_item)
        if index > 0:
            self.tree.move(selected_item, parent, index - 1)

    def move_down(self):
        selected_item = self.tree.selection()[0]
        parent = self.tree.parent(selected_item)
        index = self.tree.index(selected_item)
        next_index = index + 1
        children = self.tree.get_children(parent)
        if next_index < len(children):
            self.tree.move(selected_item, parent, next_index)

    def copy_json(self):
        try:
            selected_item = self.tree.selection()[0]  # Get selected item
            item_data = self.tree.item(selected_item)
            key = item_data['text']
            json_to_copy = json.dumps({key: self.extract_treeview_data(selected_item)}, indent=4)
            self.root.clipboard_clear()
            self.root.clipboard_append(json_to_copy)
        except:
            pass

    def paste_json(self):
        selected_item = self.tree.selection()[0] if self.tree.selection() else ''
        input_json = self.root.clipboard_get()
        try:
            json_data = json.loads(input_json)
            if json_data:
                if selected_item:
                    # Insert the JSON data as a child of the selected item
                    self.insert_json(selected_item, json_data)
                else:
                    # If no item is selected, insert at the root
                    self.insert_json('', json_data)
        except json.JSONDecodeError:
            messagebox.showerror("Error", "Invalid JSON")
        except Exception as e:
            messagebox.showerror("Error", f"An error occurred: {str(e)}")
    
    def clear_all(self):
        """Clears all the nodes in the tree."""
        for item in self.tree.get_children():
            self.tree.delete(item)

    def on_right_click(self, event):
        try:
            self.tree.selection_set(self.tree.identify_row(event.y))
            self.context_menu.tk_popup(event.x_root, event.y_root)
        finally:
            self.context_menu.grab_release()

    def save_data(self):
        self.data = self.extract_treeview_data('')
        
    def get(self):
        self.save_data()
        return self.data
    
    def extract_treeview_data(self, node_id=''):
        def node_to_dict(item):
            children = self.tree.get_children(item)
            if not children:
                # If the node has no children, return the value
                values = self.tree.item(item, 'values')

                re_val = self.parse_treeview_value(values[0])

                return re_val if values else None
            else:
                # If the node has children, create a dictionary
                node_dict = {}
                for child in children:
                    child_key = self.tree.item(child, 'text')
                    node_dict[child_key] = node_to_dict(child)
                return node_dict

        reconstructed_data = {}
        root_nodes = self.tree.get_children(node_id)
        for root_item in root_nodes:
            key = self.tree.item(root_item, 'text')
            reconstructed_data[key] = node_to_dict(root_item)

        return reconstructed_data

    def parse_treeview_value(self, value):
        """
        Attempt to parse a Treeview value to its appropriate Python data type.
        The priority order of parsing is: JSON, number, boolean, string.
        """
        # Try parsing as JSON
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            pass

        # Try parsing as an integer
        try:
            return int(value)
        except ValueError:
            pass

        # Try parsing as a float
        try:
            return float(value)
        except ValueError:
            pass

        # Try parsing as a boolean
        lowered_value = value.lower()
        if lowered_value in ('true', 'false'):
            return lowered_value == 'true'

        # If all else fails, return as string
        return value


    def get_last_entry(self):
        """Returns the last entry in the TreeView as a dictionary, including nested items."""
        children = self.tree.get_children()
        if children:  # Check if there are any items in the TreeView
            last_item_id = children[-1]  # Get the identifier of the last item
            last_item = self.tree.item(last_item_id)
            key = last_item['text']
            # Extract complete data structure under this item
            full_data = self.extract_treeview_data(last_item_id)
            return {key: full_data}  # Return as a dictionary with key and nested data
        else:
            return None  # Returns None if the TreeView is empty
    
    def setup_tags(self, text_widget):
        """Define tags for JSON highlighting"""
        text_widget.tag_configure('brace', foreground='magenta', font=('Helvetica', 10, 'bold'))
        text_widget.tag_configure('key', foreground='blue', font=('Helvetica', 10, 'bold'))
        text_widget.tag_configure('value', foreground='darkorange')

    def highlight_json(self, text_widget, json_text):
        import re
        """Apply highlighting to JSON text"""
        text_widget.delete(1.0, tk.END)
        text_widget.insert(1.0, json_text)

        # Patterns for key, string, number, boolean, null
        patterns = {
            'brace': r'[{[\]}]',
            'key': r'\"(.*?)\"\s*:',
            'value': r'(?<=:\s)(\".*?\"|\d+(\.\d+)?|true|false|null)'
        }

        # Apply tags based on patterns
        for tag, pattern in patterns.items():
            for match in re.finditer(pattern, json_text):
                start_idx = f"1.0 + {match.start()} chars"
                end_idx = f"1.0 + {match.end()} chars"
                text_widget.tag_add(tag, start_idx, end_idx)
    
    def rehighlight_json_on_enter(self, event):
        """Event handler to rehighlight JSON on pressing Enter key"""
        text_widget = event.widget
        try:
            json_content = text_widget.get("1.0", tk.END)
            parsed_json = json.loads(json_content)
            formatted_json = json.dumps(parsed_json, indent=4)
            self.highlight_json(text_widget, formatted_json)
        except json.JSONDecodeError:
            pass

    def update_treeview_from_json(self, text_widget):
        """Updates the treeview from JSON in the text widget"""
        try:
            json_content = text_widget.get("1.0", tk.END)
            parsed_json = json.loads(json_content)
            self.data = parsed_json
            self.clear_all()
            self.insert_json('', parsed_json)
        except json.JSONDecodeError:
            tk.messagebox.showerror("Error", "Invalid JSON format")

    def Save_File(self):
        self.update_treeview_from_json(self.text_widget)
        self.main_gui.save_file()

    def load_and_highlight_json(self, onSave=True):
        self.save_data()
        """Load the JSON data and highlight it in a new Text widget window"""
        formatted_json = json.dumps(self.data, indent=4)
        
        # Create a new Toplevel window
        new_window = tk.Toplevel(self.root)
        new_window.title("JSON Viewer")
        new_window.geometry("600x600")
        
        # Create a Frame to hold Text widget and Scrollbars
        frame = tk.Frame(new_window)
        frame.pack(fill='both', expand=True)

        # Add vertical scrollbar
        scrollbar_y = tk.Scrollbar(frame)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)

        # Add horizontal scrollbar
        scrollbar_x = tk.Scrollbar(frame, orient=tk.HORIZONTAL)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)

        # Add the Text widget
        text_widget = tk.Text(frame, wrap=tk.NONE, yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        text_widget.pack(fill='both', expand=True)
        
        self.text_widget = text_widget

        # Configure scrollbars to control Text widget
        scrollbar_y.config(command=text_widget.yview)
        scrollbar_x.config(command=text_widget.xview)
        
        # Apply tags and highlight JSON
        self.setup_tags(text_widget)
        self.highlight_json(text_widget, formatted_json)

        # Bind Enter key to rehighlight JSON
        text_widget.bind('<Return>', self.rehighlight_json_on_enter)

        # Add button frame below the Text widget
        button_frame = tk.Frame(new_window)
        button_frame.pack(pady=10)

        self.fresh_icon = tk.PhotoImage(file=".//AGUI//resources//update.png") 
        self.Edsave_icon = tk.PhotoImage(file=".//AGUI//resources//save.png")  
        self.close_icon = tk.PhotoImage(file=".//AGUI//resources//close.png") 

        # Add Update button
        update_button = tk.Button(button_frame, text="Update", image=self.fresh_icon, command=lambda: self.update_treeview_from_json(text_widget))
        update_button.pack(side='left', padx=5)
        self.create_tooltip(update_button, "Refresh")

        # Add Save button (calls the main GUI's save_file method)
        if onSave:
            save_button = tk.Button(button_frame, text="Save", image=self.Edsave_icon, command=self.Save_File)
            save_button.pack(side='left', padx=5)
            self.create_tooltip(save_button, "Save to file")

        # Add Close button
        close_button = tk.Button(button_frame, text="Close", image=self.close_icon, command=new_window.destroy)
        close_button.pack(side='left', padx=5)
        self.create_tooltip(close_button, "Close")