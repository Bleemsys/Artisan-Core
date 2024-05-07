# -*- coding: utf-8 -*-
"""
Created on Mon Apr  3 14:06:51 2023

@author: Yikun Wang

This is ArtGUI modulus/App. ArtGUI is the front end user interface for Artisan. 
It is distributed along with Artisan Package. It is not part of Artisan, but a simple stand-alone application and GUI.

"""

import tkinter as tk

# wiward class
from AGUI.wizard import ArtisanWizard

__AppName__ = 'ArtGUI'
__version_info__ = ('0', '0', '2')
__version__ = '.'.join(__version_info__)

if __name__ == "__main__":

    import ctypes

    myappid = 'bleemsys.ArtGUI.0.0.1' # app info for system
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)

    app = ArtisanWizard()
    app.mainloop()
