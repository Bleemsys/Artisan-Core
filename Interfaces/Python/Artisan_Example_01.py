# -*- coding: utf-8 -*-
"""
Created on Wed Apr 19 12:14:12 2023

@author: y.wang
"""


# Add the ArtisanMain.py path into your system path
import sys,os, pathlib
ArtisanRoot = pathlib.Path("..\\..\\")
sys.path.append(str(ArtisanRoot))
# Simply import ArtisanModel. It is a function returns the API class 
from ArtisanMain import Run

filename = ArtisanRoot / "Test_json//InterfaceTests.txt"
Run(filename)

