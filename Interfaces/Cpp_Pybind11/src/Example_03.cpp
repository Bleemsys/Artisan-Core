// main.cpp
#include <pybind11/embed.h>
#include <pybind11/numpy.h>
#include <iostream>
#include <vector>
#include <array>

namespace py = pybind11;

py::dict make_sample_setup() { 
    // Setup object
    py::dict setup;
 
    setup["Type"] = "Sample";
 
    // "Sample": { "Domain": [[-123,123.0],[-123.0,123.0],[-5.0,245.0]], "Shape":"Box" }
    py::dict sample;
 
    // Domain is a 3x2 list-of-lists
    py::list domain;
 
    domain.append(py::make_tuple(-1.0, 11.0));
    domain.append(py::make_tuple(-1.0, 11.0));
    domain.append(py::make_tuple(-1.0, 11.0));
 
    sample["Domain"] = domain;
    sample["Shape"] = "Box";
 
    setup["Sample"] = sample;

    setup["Rot"] = py::make_tuple(0.0, 0.0, 0.0);
    setup["res"] = py::make_tuple(0.3, 0.3, 0.3);
    setup["Padding"] = 1;
    setup["onGPU"] = false;
    setup["JsonWorkDir"] = true;
 
    // Use int64 to safely hold large values
    setup["memorylimit"] = py::int_(161061273000LL);
 
    
    return setup;
}

py::dict make_gen_z_contourlines() {
 
    // -----------------------------------------------------------
    //  "res": [1.2, 1.2, 1.2]
    // -----------------------------------------------------------
    py::list res;
    res.append(1.2);
    res.append(1.2);
    res.append(1.2);
 
    // -----------------------------------------------------------
    //  "PlaneHeights": [0, 1, 2, ... , 6]
    // -----------------------------------------------------------
    std::vector<int> heights(6);
    std::iota(heights.begin(), heights.end(), 0); 
 
    py::list plane_heights;
    for (int h : heights) {
        plane_heights.append(h);
    }
 
    // -----------------------------------------------------------
    //  Assemble the inner dict
    // -----------------------------------------------------------
    py::dict gen_z;
    gen_z["res"]             = res;
    gen_z["PlaneHeights"]    = plane_heights;
    gen_z["out_meshfile"]    = ".//export_countourlines.container";
 
    // -----------------------------------------------------------
    //  Wrap with the top-level key  "Gen_Z_ContourLines": { ... }
    // -----------------------------------------------------------
    py::dict cmd;
    cmd["Gen_Z_ContourLines"] = gen_z;
 
    return cmd;
}

static py::array_t<double> make_nodes_cube(double L) {
    // Cube from (0,0,0) to (L,L,L)
    // 8 vertices
    std::vector<std::array<double, 3>> v = {
        {0, 0, 0}, // 0
        {L, 0, 0}, // 1
        {L, L, 0}, // 2
        {0, L, 0}, // 3
        {0, 0, L}, // 4
        {L, 0, L}, // 5
        {L, L, L}, // 6
        {0, L, L}  // 7
    };

    py::array_t<double> nodes({static_cast<py::ssize_t>(v.size()), py::ssize_t(3)});
    auto r = nodes.mutable_unchecked<2>();
    for (py::ssize_t i = 0; i < (py::ssize_t)v.size(); ++i) {
        r(i, 0) = v[i][0];
        r(i, 1) = v[i][1];
        r(i, 2) = v[i][2];
    }
    return nodes;
}

static py::array_t<int> make_elems_cube_triangles() {
    // 12 triangles (2 per face), outward winding (typical)
    // Faces:
    // z=0: (0,1,2,3)
    // z=L: (4,5,6,7)
    // y=0: (0,1,5,4)
    // y=L: (3,2,6,7)
    // x=0: (0,4,7,3)
    // x=L: (1,2,6,5)
    std::vector<std::array<int, 3>> t = {
        // bottom (z=0)
        {0, 2, 1}, {0, 3, 2},
        // top (z=L)
        {4, 5, 6}, {4, 6, 7},
        // front (y=0)
        {0, 1, 5}, {0, 5, 4},
        // back (y=L)
        {3, 6, 2}, {3, 7, 6},
        // left (x=0)
        {0, 4, 7}, {0, 7, 3},
        // right (x=L)
        {1, 2, 6}, {1, 6, 5}
    };

    py::array_t<int> elems({static_cast<py::ssize_t>(t.size()), py::ssize_t(3)});
    auto r = elems.mutable_unchecked<2>();
    for (py::ssize_t i = 0; i < (py::ssize_t)t.size(); ++i) {
        r(i, 0) = t[i][0];
        r(i, 1) = t[i][1];
        r(i, 2) = t[i][2];
    }
    return elems;
}

void print_dict_repr(const py::dict& d) {
    std::cout << py::repr(d).cast<std::string>() << "\n";
}
 

int main() {
    try {
        py::scoped_interpreter guard{}; // start Python

        py::module_ sys = py::module_::import("sys");
        sys.attr("path").attr("insert")(0, "py311"); // embedded Python stdlib/libs
        sys.attr("path").attr("insert")(0, ".");     // working directory (ArtisanMain.py)

        // from ArtisanMain import ArtisanModel
        py::module_ artisanMain = py::module_::import("ArtisanMain");
        py::object ArtisanModel = artisanMain.attr("ArtisanModel");

        // Model = ArtisanModel()
        py::object Model = ArtisanModel();

        // ---- Create a C++ cube mesh and set it via cmd_setmesh ----
        const double L = 10.0; // cube size (units)
        py::array_t<double> nodes = make_nodes_cube(L);
        py::array_t<int> elems = make_elems_cube_triangles();

        std::cout << "Cube mesh: " << nodes.shape(0) << " vertices, "
                  << elems.shape(0) << " triangles.\n";

        // cmd_setup dict
        py::dict cmd_setup;
        cmd_setup = make_sample_setup();
        Model.attr("Setup")(cmd_setup);

        py::dict cmd_setmesh;
        cmd_setmesh["mesh_id"] = "demo_mesh";
        cmd_setmesh["nodes"] = nodes;                 // NumPy array (N,3) float64
        cmd_setmesh["elems"] = elems;                 // NumPy array (M,3) int32/64
        cmd_setmesh["elem_type"] = "Triangle";
        cmd_setmesh["filetype"] = ".stl";

        // Model.SetMesh(cmd_setmesh)
        Model.attr("SetMesh")(cmd_setmesh);

        std::cout << "SetMesh Done.\n";

        py::dict add_geometry;
        py::dict paras;

        paras["Scale"] = py::make_tuple(1.0, 1.0, 1.0);
        paras["Trans"] = py::make_tuple(0.0, 0.0, 0.0);
        paras["Rot"] = py::make_tuple(0.0, 0.0, 0.0);

        add_geometry["Name"] = "demo_mesh";
        add_geometry["k_factor"] = 0.0;
        add_geometry["push2GeomField"] = false;
        add_geometry["Paras"] = paras;

        py::dict cmd_workitem1;
        cmd_workitem1["Add_Geometry"] = add_geometry;
        Model.attr("WorkItem")(cmd_workitem1);

        std::cout << "Add_Geometry Done.\n";

        py::dict cmd_workitem2;
        cmd_workitem2 = make_gen_z_contourlines(); 
        Model.attr("WorkItem")(cmd_workitem2);

        std::cout << "Gen_Z_Contourlines Done.\n";

        // Remove mesh
        py::dict cmd_remove;
        cmd_remove["MeshID"] = "demo_mesh";
        Model.attr("RemoveMesh")(cmd_remove);

        // Get contourlines
        py::object obj;
        const char* inp_name = "export_countourlines";
        obj = Model.attr("GetGenContainerData")(py::str(inp_name));
        py::dict export_contourlines = obj.cast<py::dict>();

        print_dict_repr(export_contourlines);

        std::cout << "Done.\n";
        return 0;
    } catch (const py::error_already_set &e) {
        std::cerr << "Python exception:\n" << e.what() << "\n";
        return 1;
    }
}
