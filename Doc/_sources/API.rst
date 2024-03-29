API Interface
*************

Users have the flexibility to interact with Artisan using either Python or C++ through its API interface. This interface allows Artisan to be integrated as a computational engine backend or component for various application development needs. The Artisan API is designed to be compatible with keywords for simplicity and consistency. Users can access its functionalities through keyword-based inputs and retrieve the geometry (e.g., vertices and faces) at any design stage. The examples in this section can be found under the :code:`Interface` folder.

==========
Python API
==========

Artisan has the native Python APIs. User may import the ArtisanMain and call the functions as with other python modulus. In general API interface provides three simple ways to access the Artisan computational power, :code:`Execution`, :code:`Run` and :code:`WorkItem`. Former two functions allows user direct inputs the entire JSON string through a string or a file, whereas the latter enable user to manipulate the lattice design step by step and extract the geometry at any design stage.

The :code:`Run` function reads the specified JSON file, imports the data, and performs the defined calculations. One needs to note that, the working directory is no longer the directory of :code:`ArtisanMain.py` and Artisan package. The application script working directory should be considered as the current directory, therefore the working path related definition in the input JSON file should be updated as well. 

.. code-block:: python

    # Add the ArtisanMain.py path into your system path
    import sys,os, pathlib
    ArtisanRoot = pathlib.Path("..//Artsian_PY39//")
    sys.path.append(ArtisanRoot)
    # Simply import ArtisanModel. It is a function returns the API class 
    from ArtisanMain import Run

    filename = ArtisanRoot / "Test_json//EngineBracket_HS_Infill_Lin_LR.txt"
    Run(filename)

The :code:`Execution` function takes the input JSON string to perform the calculation. Additional file name are required in order to save log output information.

.. code-block:: python 

    # Add the ArtisanMain.py path into your system path
    import sys,os, pathlib
    ArtisanRoot = pathlib.Path("..//Artsian_PY39//")
    sys.path.append(ArtisanRoot)
    # Simply import ArtisanModel. It is a function returns the API class 
    from ArtisanMain import Execution
    import json

    logfilename = ArtisanRoot / "Test_json//Test_log.txt"

    cmd_dict = {"Setup":{      "Type" : "Geometry",
                "Geomfile": ".//sample-obj//shell_1_of_bdd_.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.75,0.75,0.75],
		          "Padding": 1,
                "onGPU": False,
                "memorylimit": 16106127360
                },
           "WorkFlow":{
                 "1": {"Add_Lattice":{
                     "la_name": "Cubic", "size": [8.0,8.0,8.0], "thk":1.2, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0],
                     "Inv": False, "Fill": True, "Cube_Request": {}
                    }
                      },
                "2":{"Export": {"outfile": ".//Test_results/BingDunDun_Infill.stl"}}
           },
    "PostProcess":{"CombineMeshes": True,
                "RemovePartitionMeshFile": False,
                "RemoveIsolatedParts": True, 
                "ExportLazPts": False}
    }

    Execution(json.dumps(cmd_dict), logfilename)

Manipulating the design process through :code:`WorkItem` is as easy as writing the JSON string. The working flow keywords are feed sequentially through :code:`WorkItem` function, as demonstrated below. The order of the keywords are important as they build the lattice step by step. 

.. code-block:: python

    # Add the ArtisanMain.py path into your system path
    import sys,os
    sys.path.append("..//Artsian_PY39//")
    # Simply import ArtisanModel. It is a function returns the API class 
    from ArtisanMain import ArtisanModel

    # Call ArtisanModel to buildup the API class
    Model = ArtisanModel()

    # Setup section in dict structure
    cmd_setup = {      
                "Type" : "Geometry",
                "Geomfile": "..//..//Src//sample-obj//shell_1_of_bdd_.stl",
                "Rot" : [0.0,0.0,0.0],
                "res":[0.75,0.75,0.75],
		          "Padding": 1,
                "onGPU": False,
                "memorylimit": 16106127360
            }
    # Push to the Setup method, and it setup the model building required infrastructure, 
    # it also calculates all fields for geometry.            
    Model.Setup(cmd_setup)
    # A simple add lattice commands. The model always starts from Add_Lattice
    cmd_workitem = {"Add_Lattice":{
                    "la_name": "Cubic", "size": [8.0,8.0,8.0], "thk":1.2, "Rot":[0.0, 0.0, 0.0], "Trans":[0.0, 0.0, 0.0], 
                    "Inv": False, "Fill": True, "Cube_Request": {}
                    }
               }
    # Call the workitem method to calculates the defined workitem above.
    Model.WorkItem(cmd_workitem)

    # A repeat call of workitem to save the geometry in a stl file.
    cmd_workitem = {"Export": {"outfile": "..//..//Src//Test_results/BingDunDun_Infill.stl"}}
    Model.WorkItem(cmd_workitem)

    # alternatively, user may extract the surfaces, including the vertices and triangulations. 
    verts, faces = Model.ExtractSurf()




=======
C++ API 
=======

The interaction between C++ and Artisan is just as straightforward as with Python. C++ applications can integrate the Artisan module through the embedded Python style. Users can refer to official documentation on the following topics:

    Embedding Python in Another Application: https://docs.python.org/3.9/extending/embedding.html
    
    Using NumPy C-API: https://numpy.org/doc/stable/user/c-info.html
    
    Extending Python with C or C++: https://docs.python.org/3.9/extending/extending.html

User may also consider use the well-known third party package to further enhance the interaction between python and C++, such as pybind11 (https://pybind11.readthedocs.io/en/stable/advanced/embedding.html). This section will not cover this part, and will take official python interface as the coding base since it's simply straightforward.  

To compile successfully, users are required to link to the Python libraries. Since Artisan relies on NumPy array-based data operations, compilation requires NumPy library support. The cmake code below shows a simple way of integrating both libs for compilation.

.. code-block:: cmake

    cmake_minimum_required(VERSION 3.0.0)
    project(CheckArtisan VERSION 0.1.0)

    include(CTest)
    enable_testing()

    add_executable(Artisan ./src/Artisan_Example_01.cpp)

    set(CPACK_PROJECT_NAME ${PROJECT_NAME})
    set(CPACK_PROJECT_VERSION ${PROJECT_VERSION})
    include(CPack)

    # find_package(PythonLibs REQUIRED)
    include_directories(C:/ProgramData/Anaconda3/include) # Python include folder
    include_directories(C:/ProgramData/Anaconda3/libs) # Python link lib
    include_directories(C:/ProgramData/Anaconda3/Lib/site-packages/numpy/core/include) # Numpy include folder
    target_include_directories(Artisan PUBLIC C:/ProgramData/Anaconda3/include)
    target_link_directories(Artisan PUBLIC C:/ProgramData/Anaconda3/libs)
    target_link_libraries(Artisan PUBLIC C:/ProgramData/Anaconda3/libs/python39.lib)

Similar to the usage in Python, Artisan offers three different styles of API interfaces. Users can launch the design computation directly by reading the JSON file or through a JSON stream. To do so, they can call the :code:`Run` function and pass in the JSON filename as input to launch the computation. Alternatively, users can push a string data that contains the JSON structure to the :code:`Execution` function to initiate the computation. And user may manipulate the design process through :code:`WorkItem` function. 

The sample code below demonstrates the basic usage of :code:`Run` function. The code loads the modulus using :code:`PyImport_Import` function, and execute the function using :code:`PyObject_CallObject`. Note that the function returns :code:`NULL`.

.. code-block:: cpp

    #include "Python.h"
    #include <iostream>
    #include <fstream>
    #include <conio.h>

    int main(int argc, char *argv[])
    {
    
	// References:
	// Embedding Python in Another Application
	// https://docs.python.org/3.9/extending/embedding.html

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

User may choose passing the c-style JSON string to Artisan, rather than read from external files. The code below demonstrate how to interact with the :code:`Execution` function in :code:`ArtisanMain`. This function requires additional argument that indicates the file name for log output.  

.. code-block:: cpp

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
                                              \"Rot\":[0.0, 0.0, 0.0],                       \
                                              \"Trans\":[0.0, 0.0, 0.0],                     \
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
	
        char filename[] = "ArtisanMain";
	char logfile[] = "Testlogfile.log"; // logfile file name
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

Users can use the :code:`WorkItem` method of the API object to perform various design and export operations on the lattice field. By passing the appropriate workflow keywords as inputs to :code:`WorkItem`, users can apply specific operations to manipulate the lattice field. Once the workflow has been completed, users can extract the resultant geometry using the :code:`ExtractSurf` method. This provides flexibility to users in terms of defining their own customized workflows for specific applications and use cases. The extracted geometry can be further processed or exported as per the user's requirement. The example below showed the usage of these methods. 

.. code-block:: cpp

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












