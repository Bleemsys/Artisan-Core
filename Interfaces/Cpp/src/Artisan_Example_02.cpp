#include "Python.h"
#include <iostream>
#include <fstream>
#include <conio.h>


int main(int argc, char *argv[])
{
    
	// This demo shows how to pass a c-style string with JSON to the execution function
	// User are required to give a logfile name as well. 
	
	PyObject *pName, *pModule, *pDict, *pFunc, *pArgs, *pValue;
	char TestString[] = "{\"Setup\": {\"Type\": \"Geometry\",                                \ 
	                                  \"Geomfile\": \".//sample-obj//shell_1_of_bdd_.stl\",  \
									  \"Rot\": [0.0, 0.0, 0.0],                              \
									  \"res\": [0.75, 0.75, 0.75],                           \
									  \"Padding\": 1, \"onGPU\": false,                      \
									  \"memorylimit\": 16106127360                           \
									  },                                                     \
						 \"WorkFlow\": {                                                     \
							\"1\": {                                                         \
							\"Add_Lattice\": {\"la_name\": \"Cubic\",                        \
							                  \"size\": [8.0, 8.0, 8.0],                     \
											  \"thk\": 1.2,                                  \
											  \"Rot\": [0.0, 0.0, 0.0],                      \
											  \"Trans\": [0.0, 0.0, 0.0],                    \
											  \"Inv\": false,                                \
											  \"Fill\": true,                                \
											  \"Cube_Request\": {}}},                        \
							\"2\": {                                                         \
							\"Export\": {\"outfile\": \".//Test_results/BingDunDun_Infill.stl\"}}}, \
					    \"PostProcess\": {                                                   \
							\"CombineMeshes\": true,                                         \
							\"RemovePartitionMeshFile\": false,                              \
							\"RemoveIsolatedParts\": true,                                   \
							\"ExportLazPts\": false}}" ;                                      \
							
	char logfile[] = "Testlogfile.log"; // logfile file name 
	char filename[] = "ArtisanMain";
	Py_Initialize();
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
	pFunc = PyObject_GetAttrString(pModule, "Execution");
	if (pFunc && PyCallable_Check(pFunc)) {
		std::cout<< "Function loaded \n";
	}else{
		std::cout<< "Fail: Function loaded \n";
	}
	// Define the function parameter values, as a python tuple
	pArgs = PyTuple_New(2); // we have two parameter here, one json like string, and logfile filename.
	PyTuple_SetItem(pArgs, 0, PyUnicode_FromString(TestString));
	PyTuple_SetItem(pArgs, 1, PyUnicode_FromString(logfile));
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