# Artisan
Artisan is a tool for lattice generation. It is based on implicit modelling technique. The code is based on Python and C++ in order to combining the development speed and computational efficiency. Artisan computes the most of heavy math through C++ code, and conducts the routine calculations via Python. 

![image info](./ArtisanIllustration_05.jpg)

Lattice structure recently draws lots of attention on its potential applications in mechanical performance and heat transferring capabilities. Integrating the lattice structure into the parts can transform the existing design into a lightweight component with functionally enhanced features, such as shocking absorption. The conventional manufacturing methods, such as casting, cannot make such sophisticated design. Additive manufacturing, i.e. 3D printing, is only way of manufacturing these design at this stage. You may find more information regarding to the design and concepts at:

 - Understanding 3D printed lattices: Properties, performance, and design considerations: https://www.fastradius.com/resources/understanding-3d-printed-lattices-performance-and-design-considerations/

 - 3D lattice structures: Design elements and mechanical responses: https://www.fastradius.com/resources/3d-lattice-design-elements/

## Features
Artisan can generate the following lattice fill:

 - Periodical lattices 
 - Tet mesh lattice
 - Mesh based Conformal Lattice

with compatibility of the following types of lattice:

 - Strut lattices, e.g. beam-structure liking lattice,
 - Triply periodic minimal surface (TPMS),
 - Geometric shape lattice.

Users may define their lattice design through:

 - Strut topological definition, e.g. defining points and their connections;
 - Surface equation, e.g. the math equation defines a surface;
 - Geometric shape, e.g. shell shape geometry that defines a unit of lattice.

Artisan considers the utilization of hardware, and the resources spending on the computational tasks:

 - It supports adaptive division on the given filling shape (called domain) and calculate all sub-divided domains and combines them together at the end of computing. This consumes less memory, therefore the large model generation becomes possible.   
 - Artisan supports GPU computing. This could help release some burden of computing from CPU. This is an experimental feature that we aim increase its efficiency in future developments.

## Testing Package

The package is a stand alone package aiming to provide chance for user to verify the basic functionalities and resources costs of the software. We are developing the user guide/manual, meanwhile, you may try the package examples and some quick understanding of the general capability of Artisan.

## Installation
Artisan does not require any installation. It requires installation of the dependency packages and pre-requisites softwares. 

Basic requirements:

 - Python 3.9 ; 
 - CUDA Toolkit: v10.2 / v11.0 / v11.1 / v11.2 / v11.3 / v11.4 / v11.5

Python: https://www.python.org/downloads/release/python-397/

CUDA Toolkit: https://developer.nvidia.com/cuda-toolkit

Users have to make sure their computers having proper hardwares, that support CUDA GPU computing, 

 - NVIDIA CUDA GPU with the Compute Capability 3.0 or later;

A few python dependency packages are required to be installed before running Artisan.  To install the required python package, you may find the requirement.txt file, and in the command window, type

    pip install -r requirements.txt


## Usage
The application can be launched by

    python ArtisanMain.py -f <insert-your-json-file—here>

ArtiasnMain.py will read the json file and interpret the keys and then perform the calculations. There are a few example JSON files under the folder "Test_json", and the sample geometry files are at the folder "sample-obj". For example, 

    python ArtisanMain.py -f .//Test_json//EngineBracket_Infill_Lin.txt

Above commands will perform the complex lattice filling in EngineBracket model. The results are stored at "Test_results", or user may modify the json file to save the results at the desired location. 

## License
This testing package is the copyrighted closed source freeware. Artisan is licensed under Attribution-NonCommercial-NoDerivs 3.0 Unported (CC BY-NC-ND 3.0). You may obtain a copy of the License at https://creativecommons.org/licenses/by-nc-nd/3.0/

You may copy and redistribute this testing package material in any medium or format under the condition for non-commercial purpose. For commercial applications, please contact us. We are also happy to offer the customized development and consulting services.