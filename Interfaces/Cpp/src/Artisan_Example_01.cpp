#include "Python.h"
#include <iostream>
#include <fstream>
#include <conio.h>


int main(int argc, char *argv[])
{
    
	// References:
	// Embedding Python in Another Application
	// https://docs.python.org/3.8/extending/embedding.html

	// The code below demonstrates how to call the "Run" function which takes one argument - filename
	// It reads the file containing the json, and then execute the file and construct the model.
	// commands: Artisan.exe <-- the json file path here -->
	// Examples: Artisan.exe .//Test_json//crank_handle_infill.txt
	// Note this is only an example since we take the first argument after Artisan.exe as input.
	
	PyObject *pName, *pModule, *pDict, *pFunc, *pArgs, *pValue;
	// Initialize the Python Interpreter
    Py_Initialize();
	// Imports ArtisanMain.py
	char filename[] = "ArtisanMain";
    pName = PyUnicode_FromString(filename);
	// Load the module object
    pModule = PyImport_Import(pName);
	// Check whether the module was loaded.
	if (pModule != NULL) {
		std::cout<< "Modulue loaded \n";
	}else{
		std::cout<< "Fail: Modulue loaded \n";
	}
	// Access to the function "Run" in "ArtisanMain.py".
	// Run(filename) 
	// This function will read the "filename" - a JSON file and execute the file.
	pFunc = PyObject_GetAttrString(pModule, "Run");
	if (pFunc && PyCallable_Check(pFunc)) {
		std::cout<< "Function loaded \n";
	}else{
		std::cout<< "Fail: Function loaded \n";
	}
	// Define the function parameter values, as a python tuple
	pArgs = PyTuple_New(1); // we have one parameter here, the JSON file name.
	PyTuple_SetItem(pArgs, 0, PyUnicode_FromString(argv[1]));
	// Call function
	pValue = PyObject_CallObject(pFunc, pArgs);
	// Clean up
    Py_DECREF(pModule);
	Py_DECREF(pFunc);
    Py_DECREF(pName);
	Py_DECREF(pArgs);
	// Finish the python interpreter
	Py_Finalize(); 

	return 0;
}