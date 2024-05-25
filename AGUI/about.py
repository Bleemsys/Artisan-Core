
import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import ast
import json
import webbrowser

def show_credit_window(main_gui):
    # Load an image
    aboutBG = tk.PhotoImage(file=".//AGUI//resources//AboutBG.png") 
    BG_height = aboutBG.height()
    BG_width = aboutBG.width()

    about_window = tk.Toplevel(main_gui)
    about_window.title("About ArtGUI - Artisan Wizard")
    # about_window.geometry("650x460")  # Width x Height
    about_window.geometry(str(BG_width)+"x"+str(BG_height))  # Width x Height
    # Create a Label to display the background image
    labelBG = tk.Label(about_window, image=aboutBG)
    labelBG.place(x=0, y=0, relwidth=1, relheight=1)
    # Main info text
    info_text = ("ArtGUI - Artisan Wizard, Version 0.0.3\n"
                 "Developed by Yikun Wang\n"
                 "ArtGUI is distributed under the MIT License.\n"
                 "Artisan-core is distributed under CC BY-NC-ND 3.0 for non-commercial applications,\n"
                 "or refer to your license file.\n"
                 "Icons made by Freepik from www.flaticon.com"
                )
    label_info = tk.Label(about_window, text=info_text, justify=tk.LEFT)
    label_info.pack(padx=10, pady=5)        
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
    # Centering the about window on the screen
    about_window.update_idletasks()  # Ensure the window size is calculated

    window_width = about_window.winfo_width()
    window_height = about_window.winfo_height()

    position_right = int(about_window.winfo_screenwidth() / 2 - window_width / 2)
    position_down = int(about_window.winfo_screenheight() / 2 - window_height / 2)
    about_window.geometry(f"+{position_right}+{position_down}")



    about_window.transient(main_gui)  # Set to be on top of the main window
    about_window.grab_set()  # Disable other windows while this is open
    main_gui.wait_window(about_window)  # Wait for this window to close before returning to the main loop