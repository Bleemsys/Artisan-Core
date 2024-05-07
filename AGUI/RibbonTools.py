import tkinter as tk
from tkinter import ttk
from AGUI.util import ToolTip

class ButtonCreator:
    def __init__(self, parent, tab, button_data, command_func):
        self.parent = parent
        self.tab = tab
        self.button_data = button_data
        self.command_func = command_func

    def create_buttons(self):
        # Clear existing content in the tab
        for widget in self.tab.winfo_children():
            widget.destroy()

        # List to hold button objects
        self.buttons = []

        # Create buttons in the tab
        for i, (text, strings) in enumerate(self.button_data.items()):
            command = lambda strs=strings[1]: self.command_func(strs)
            button = ttk.Button(self.tab, text=text, command=command)
            button.grid(row=0, column=i, padx=5, pady=5)
            self.buttons.append(button)
            self.create_tooltip(button, strings[0])

    def create_tooltip(self, widget, text):
        tooltip = ToolTip(widget, text)
        widget.bind("<Enter>", lambda _: tooltip.show_tip())
        widget.bind("<Leave>", lambda _: tooltip.hide_tip())

    