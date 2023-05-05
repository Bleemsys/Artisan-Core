#include "Python.h"
#include <numpy/arrayobject.h>
#include <iostream>
#include <cstdint>

int main(int argc, char *argv[])
{
    // This example demonstrates how to access Artisan APIs through Setup, WorkItem and ExtractSurf
    // Note that the codes is the embedded python interpreter into the application. 

	// Coding References:
    // Extending Python with C or C++
    // https://docs.python.org/3.9/extending/extending.html
	// Embedding Python in Another Application
	// https://docs.python.org/3.9/extending/embedding.html
    // Using NumPy C-API
	// https://numpy.org/doc/stable/user/c-info.html
    
	PyObject *pName, *pModule, *pDict, *pFunc, *pArgs, *pValue;
    PyObject *ArtisanModel, *AM_Setup, *AM_WorkItem, *AM_ExtractSurf;
    PyObject *pFunc_ArgsVal;

	char filename[] = "ArtisanMain";

	Py_Initialize();
    pName = PyUnicode_FromString(filename);
	// Load the module object
    pModule = PyImport_Import(pName);
	// Check whether the module was loaded.
	if (pModule != NULL) {
		std::cout<< "Artian Modulue loaded \n";
	}else{
		std::cout<< "Fail: Artisan Modulue loaded \n";
	}

	// Access to the function "ArtisanModel" in "ArtisanMain.py".
	// ArtisanModel() has to be called to return the API object.
    ArtisanModel = PyObject_CallObject(PyObject_GetAttrString(pModule, "ArtisanModel"), 
                                       Py_BuildValue("()")); 
    
    // Check whether the API object loaded or not
    if (ArtisanModel != NULL) {
		std::cout<< "API object loaded \n";
	}else{
		std::cout<< "Fail: API object loaded \n";
	}

    // Access the setup method
    AM_Setup = PyObject_GetAttrString(ArtisanModel, "Setup"); 

    if (PyCallable_Check(AM_Setup)) {
		std::cout<< "AM_Setup Function loaded \n";
	}else{
		std::cout<< "Fail: AM_Setup Function loaded \n";
	}

    // Build up the input Dict data object for setup.
    pFunc_ArgsVal = Py_BuildValue("{s:s, s:s, s:O, s:O, s:i, s:O, s:l}",
           "Type", "Geometry",
           "Geomfile", ".//sample-obj//shell_1_of_bdd_.stl",
           "Rot", Py_BuildValue("[d, d, d]", 0.0, 0.0, 0.0),
           "res", Py_BuildValue("[d, d, d]", 0.75, 0.75, 0.75),
           "Padding", 1,
           "onGPU", Py_False, 
           "memorylimit", 16106127360);

	// Define the function parameter values, as a python tuple
	pArgs = PyTuple_New(1); // we have one parameter here - a Dict data object.
	PyTuple_SetItem(pArgs, 0, pFunc_ArgsVal);
	
	// Call Setup method
	PyObject_CallObject(AM_Setup, pArgs);


    // Build up the input Dict data object of the 1st WorkItem.
    // Add a Cubic Lattice
    pFunc_ArgsVal = Py_BuildValue("{s:s, s:O, s:d, s:O, s:O, s:O, s:O, s:O}",
           "la_name", "Cubic",
           "size", Py_BuildValue("[d, d, d]", 8.0, 8.0, 8.0),
           "thk", 1.2,
           "Rot", Py_BuildValue("[d, d, d]", 0.0, 0.0, 0.0),
           "Trans", Py_BuildValue("[d, d, d]", 0.0, 0.0, 0.0),
           "Inv", Py_False,
           "Fill", Py_True, 
           "Cube_Request", Py_BuildValue("{}"));

    pArgs = PyTuple_New(1); // we have one parameter here - a Dict data object.
	PyTuple_SetItem(pArgs, 0, Py_BuildValue("{s:O}", "Add_Lattice", pFunc_ArgsVal));

    // Get the WorkItem function
    AM_WorkItem = PyObject_GetAttrString(ArtisanModel, "WorkItem"); 

    if (PyCallable_Check(AM_WorkItem)) {
		std::cout<< "AM_WorkItem Function loaded \n";
	}else{
		std::cout<< "Fail: AM_WorkItem Function loaded \n";
	}
    // Call WorkItem - Add_Lattice
	PyObject_CallObject(AM_WorkItem, pArgs);

    // Build up the input Dict data object of the 2nd WorkItem.
    // Export the surfaces, save them as stl file.
    pFunc_ArgsVal = Py_BuildValue("{s:O}", "Export",
            Py_BuildValue("{s:s}",
                  "outfile", ".//Test_results/BingDunDun_Infill.stl"));

    PyTuple_SetItem(pArgs, 0, pFunc_ArgsVal);
    // Call WorkItem - Export
    PyObject_CallObject(AM_WorkItem, pArgs);


    // Alternatively we could get the vertices and faces here
    AM_ExtractSurf= PyObject_GetAttrString(ArtisanModel, "ExtractSurf");
    // Call ExtractSurf method to extract the surfaces of the current design.
    PyObject* pGeoms = PyObject_CallObject(AM_ExtractSurf, Py_BuildValue("()"));

    // Extract the returned numpy arrays
    // Vertices
    PyArrayObject* verts = reinterpret_cast<PyArrayObject*>(PyTuple_GetItem(pGeoms, 0));
    // Surfaces
    PyArrayObject* faces = reinterpret_cast<PyArrayObject*>(PyTuple_GetItem(pGeoms, 1));

    // Convert the numpy arrays to C++ arrays
    // This is a critical step that the data types have to match python returned values.
    // Vertices, float numbers.
    float* verts_c = static_cast<float*>(PyArray_DATA(verts));
    // Faces, unsigned int32
    uint32_t* faces_c = static_cast<uint32_t*>(PyArray_DATA(faces));


    // Get the shape of arrays
    npy_intp* verts_shape = PyArray_SHAPE(verts);
    npy_intp* faces_shape = PyArray_SHAPE(faces);

    std::cout << "Vertices Matrix Shape:" << " ";
    std::cout << verts_shape[0] << " "; // Number of the vertices
    std::cout << verts_shape[1] << " "; // Coordinate dimension, i.e. 3, in 3D space
    std::cout << std::endl;
    std::cout << "Faces Matrix Shape:" << " ";
    std::cout << faces_shape[0] << " "; // Number of the faces
    std::cout << faces_shape[1] << " "; // Each face contains three vertices
    std::cout << std::endl;

    // Print out the last vertices coordinate
    std::cout << "Coordinate of the last vertices:" << " ";
    std::cout << verts_c[(verts_shape[0]-1) * verts_shape[1] + 0] << " ";
    std::cout << verts_c[(verts_shape[0]-1) * verts_shape[1] + 1] << " ";
    std::cout << verts_c[(verts_shape[0]-1) * verts_shape[1] + 2] << " ";
    std::cout << std::endl;
    // Print out the last surfaces vertices index
    std::cout << "Vertices index of the last surface:" << " ";
    std::cout << faces_c[(faces_shape[0]-1) * faces_shape[1] + 0] << " ";
    std::cout << faces_c[(faces_shape[0]-1) * faces_shape[1] + 1] << " ";
    std::cout << faces_c[(faces_shape[0]-1) * faces_shape[1] + 2] << " ";
    std::cout << std::endl;

    // Print the data in the numpy arrays
    // for (npy_intp i = 0; i < verts_shape[0]; i++) {
    //     for (npy_intp j = 0; j < verts_shape[1]; j++) {
    //         std::cout << verts_c[i * verts_shape[1] + j] << " ";
    //     }
    //     std::cout << std::endl;
    // }

    // for (npy_intp i = 0; i < faces_shape[0]; i++) {
    //     for (npy_intp j = 0; j < faces_shape[1]; j++) {
    //         std::cout << faces_c[i * faces_shape[1] + j] << " ";
    //     }
    //     std::cout << std::endl;
    // }

    // Use below to print out the error message (if any). 
    PyErr_Print();

	// Clean up
    Py_DECREF(pModule);
	Py_DECREF(pFunc);
    Py_DECREF(pName);
	Py_DECREF(pArgs);
    Py_DECREF(pGeoms);

    Py_DECREF(pFunc_ArgsVal);
    Py_DECREF(ArtisanModel);
    Py_DECREF(AM_Setup);
    Py_DECREF(AM_WorkItem);
    Py_DECREF(AM_ExtractSurf);
    Py_DECREF(verts);
    Py_DECREF(faces);
	// Finish the python interpreter
	Py_Finalize();
	
	return 0;
}