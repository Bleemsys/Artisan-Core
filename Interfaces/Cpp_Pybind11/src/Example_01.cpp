#include <pybind11/embed.h>   // py::scoped_interpreter
#include <pybind11/stl.h>     // std::vector <-> Python list auto-conversion
#include <pybind11/numpy.h>   // py::array_t for verts/faces
#include <iostream>
#include <vector>

namespace py = pybind11;

// ---------------------------------------------------------------------------
// Helper: build the Setup command dict as a py::dict
// ---------------------------------------------------------------------------
static py::dict build_cmd_setup()
{
    py::dict cmd;
    cmd["Type"]        = "Geometry";
    cmd["Geomfile"]    = "..//sample-obj//shell_1_of_bdd_.stl";
    cmd["Rot"]         = py::list(py::make_tuple(0.0, 0.0, 0.0));
    cmd["res"]         = py::list(py::make_tuple(0.75, 0.75, 0.75));
    cmd["Padding"]     = 1;
    cmd["onGPU"]       = false;
    cmd["memorylimit"] = 16106127360LL;
    return cmd;
}

// ---------------------------------------------------------------------------
// Helper: build the Add_Lattice workitem dict
// ---------------------------------------------------------------------------
static py::dict build_cmd_add_lattice()
{
    py::dict lattice_params;
    lattice_params["la_name"]      = "Cubic";
    lattice_params["size"]         = py::list(py::make_tuple(8.0, 8.0, 8.0));
    lattice_params["thk"]          = 1.2;
    lattice_params["Rot"]          = py::list(py::make_tuple(0.0, 0.0, 0.0));
    lattice_params["Trans"]        = py::list(py::make_tuple(0.0, 0.0, 0.0));
    lattice_params["Inv"]          = false;
    lattice_params["Fill"]         = true;
    lattice_params["Cube_Request"] = py::dict();   // empty dict {}

    py::dict workitem;
    workitem["Add_Lattice"] = lattice_params;
    return workitem;
}

// ---------------------------------------------------------------------------
// Helper: build the Export workitem dict
// ---------------------------------------------------------------------------
static py::dict build_cmd_export()
{
    py::dict export_params;
    export_params["outfile"] = "..//Test_results/BingDunDun_Infill.stl";

    py::dict workitem;
    workitem["Export"] = export_params;
    return workitem;
}

// ---------------------------------------------------------------------------
// Helper: print basic info of a returned 3D numpy array
// ---------------------------------------------------------------------------
static void print_array_info(const py::array& arr, const std::string& name)
{
    py::buffer_info b = arr.request();
    std::cout << name << ": ndim=" << b.ndim
              << "  shape=(";
    for (int i = 0; i < b.ndim; ++i)
        std::cout << b.shape[i] << (i < b.ndim - 1 ? ", " : "");
    std::cout << ")  dtype=" << b.format << "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
int main()
{
    // 1. Start the embedded Python interpreter
    py::scoped_interpreter guard{};

    try
    {
        // 2. Make sure Python can find ArtisanMain
        //    Adjust the path to wherever ArtisanMain.pyd/.so lives
        py::module_ sys = py::module_::import("sys");
        sys.attr("path").attr("insert")(0, "./py311");
        sys.attr("path").attr("insert")(0, ".");   // current directory first

        // 3. Import ArtisanMain module
        py::module_ ArtisanMain = py::module_::import("ArtisanMain");

        // ----------------------------------------------------------------
        // 4. Instantiate ArtisanModel
        //    Python:  Model = ArtisanMain.ArtisanModel()
        // ----------------------------------------------------------------
        py::object Model = ArtisanMain.attr("ArtisanModel")();

        // ----------------------------------------------------------------
        // 5. Setup
        //    Python:  Model.Setup(cmd_setup)
        // ----------------------------------------------------------------
        py::dict cmd_setup = build_cmd_setup();
        Model.attr("Setup")(cmd_setup);
        std::cout << "[OK] Setup complete.\n";

        // ----------------------------------------------------------------
        // 6. WorkItem — Add Lattice
        //    Python:  Model.WorkItem(cmd_workitem)
        // ----------------------------------------------------------------
        py::dict cmd_lattice = build_cmd_add_lattice();
        Model.attr("WorkItem")(cmd_lattice);
        std::cout << "[OK] Add_Lattice WorkItem complete.\n";

        // ----------------------------------------------------------------
        // 7. WorkItem — Export STL
        //    Python:  Model.WorkItem(cmd_workitem)
        // ----------------------------------------------------------------
        py::dict cmd_export = build_cmd_export();
        Model.attr("WorkItem")(cmd_export);
        std::cout << "[OK] Export WorkItem complete.\n";

        // ----------------------------------------------------------------
        // 8. Extract Surface
        //    Python:  verts, faces = Model.ExtractSurf()
        //    Returns a tuple of two numpy arrays
        // ----------------------------------------------------------------
        py::tuple surf = Model.attr("ExtractSurf")();

        py::array verts = surf[0].cast<py::array>();
        py::array faces = surf[1].cast<py::array>();

        print_array_info(verts, "verts");
        print_array_info(faces, "faces");

        // ----------------------------------------------------------------
        // 9. Access verts data (float64, shape [N, 3])
        // ----------------------------------------------------------------
        {
            py::buffer_info bv = verts.request();
            if (bv.ndim == 2 && bv.shape[1] == 3)
            {
                const ssize_t N  = bv.shape[0];   // number of vertices
                const ssize_t S0 = bv.strides[0]; // stride along rows  (bytes)
                const ssize_t S1 = bv.strides[1]; // stride along cols  (bytes)
                char* base = static_cast<char*>(bv.ptr);

                std::cout << "\nFirst 3 vertices:\n";
                for (ssize_t i = 0; i < std::min(N, (ssize_t)3); ++i)
                {
                    double x = *reinterpret_cast<double*>(base + i*S0 + 0*S1);
                    double y = *reinterpret_cast<double*>(base + i*S0 + 1*S1);
                    double z = *reinterpret_cast<double*>(base + i*S0 + 2*S1);
                    std::cout << "  v[" << i << "] = ("
                              << x << ", " << y << ", " << z << ")\n";
                }
            }
        }

        // ----------------------------------------------------------------
        // 10. Access faces data (int32/int64, shape [M, 3])
        // ----------------------------------------------------------------
        {
            py::buffer_info bf = faces.request();
            if (bf.ndim == 2 && bf.shape[1] == 3)
            {
                const ssize_t M  = bf.shape[0];
                const ssize_t S0 = bf.strides[0];
                const ssize_t S1 = bf.strides[1];
                char* base = static_cast<char*>(bf.ptr);

                // auto-handle int32 or int64 faces
                auto get_idx = [&](ssize_t row, ssize_t col) -> long long {
                    char* p = base + row*S0 + col*S1;
                    if (bf.itemsize == 4)
                        return *reinterpret_cast<int32_t*>(p);
                    else
                        return *reinterpret_cast<int64_t*>(p);
                };

                std::cout << "\nFirst 3 faces:\n";
                for (ssize_t i = 0; i < std::min(M, (ssize_t)3); ++i)
                {
                    std::cout << "  f[" << i << "] = ("
                              << get_idx(i,0) << ", "
                              << get_idx(i,1) << ", "
                              << get_idx(i,2) << ")\n";
                }
            }
        }
    }
    catch (const py::error_already_set& e)
    {
        std::cerr << "[Python Error] " << e.what() << "\n";
        return -1;
    }
    catch (const std::exception& e)
    {
        std::cerr << "[C++ Error] " << e.what() << "\n";
        return -1;
    }

    return 0;
}
