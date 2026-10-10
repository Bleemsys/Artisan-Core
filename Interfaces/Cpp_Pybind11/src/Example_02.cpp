#include <pybind11/embed.h>
#include <pybind11/numpy.h>
#include <iostream>
#include <vector>
#include <cstring>

namespace py = pybind11;

// ============================================================================
//  Command builders
//  Each function returns a py::dict describing one Artisan instruction.
// ============================================================================

py::dict build_cmd_setup()
{
    py::dict cmd;
    cmd["Type"]        = "Geometry";
    cmd["Geomfile"]    = "..//sample-obj//shell_1_of_bdd_.stl";
    cmd["Rot"]         = py::make_tuple(0.0, 0.0, 0.0);
    cmd["res"]         = py::make_tuple(0.75, 0.75, 0.75);
    cmd["Padding"]     = 1;
    cmd["onGPU"]       = false;
    cmd["memorylimit"] = 16106127360LL;
    return cmd;
}

py::dict build_cmd_add_lattice()
{
    py::dict params;
    params["la_name"]      = "Cubic";
    params["size"]         = py::make_tuple(8.0, 8.0, 8.0);
    params["thk"]          = 1.2;
    params["Rot"]          = py::make_tuple(0.0, 0.0, 0.0);
    params["Trans"]        = py::make_tuple(0.0, 0.0, 0.0);
    params["Inv"]          = false;
    params["Fill"]         = true;
    params["Cube_Request"] = py::dict();

    py::dict cmd;
    cmd["Add_Lattice"] = params;
    return cmd;
}

py::dict build_cmd_export()
{
    py::dict params;
    params["outfile"] = "..//Test_results//BingDunDun_Infill_T02.stl";

    py::dict cmd;
    cmd["Export"] = params;
    return cmd;
}

// ============================================================================
//  SDF helpers (float32 / np.float32)
// ============================================================================

// Returns true if the array is C-contiguous (row-major, no padding between elements).
bool is_c_contiguous(const py::buffer_info& buf)
{
    if (buf.ndim != 3) return false;

    const ssize_t itemsize = (ssize_t)sizeof(float);
    return buf.strides[2] == itemsize
        && buf.strides[1] == buf.shape[2]                * itemsize
        && buf.strides[0] == buf.shape[1] * buf.shape[2] * itemsize;
}

// Copies a 3D float32 NumPy array into a flat C++ vector.
// Handles both contiguous and non-contiguous (e.g. Fortran-order) layouts.
std::vector<float> copy_to_vector(const py::array_t<float>& arr)
{
    py::buffer_info buf = arr.request();

    const ssize_t dim0  = buf.shape[0];
    const ssize_t dim1  = buf.shape[1];
    const ssize_t dim2  = buf.shape[2];
    const ssize_t total = dim0 * dim1 * dim2;

    std::vector<float> out(total);

    if (is_c_contiguous(buf))
    {
        // Fast path: single memcpy for contiguous memory.
        std::memcpy(out.data(), buf.ptr, (size_t)total * sizeof(float));
    }
    else
    {
        // Safe path: stride-based element-by-element copy.
        const auto* raw = static_cast<const uint8_t*>(buf.ptr);
        ssize_t idx = 0;
        for (ssize_t i = 0; i < dim0; ++i)
        for (ssize_t j = 0; j < dim1; ++j)
        for (ssize_t k = 0; k < dim2; ++k)
        {
            const auto* elem = raw + i * buf.strides[0]
                                   + j * buf.strides[1]
                                   + k * buf.strides[2];
            out[idx++] = *reinterpret_cast<const float*>(elem);
        }
    }

    return out;
}

// Wraps a flat float vector into a new C-contiguous 3D NumPy float32 array.
// The returned array owns its own memory — safe to pass to Python.
py::array_t<float> wrap_as_numpy(
    const std::vector<float>& data,
    ssize_t dim0, ssize_t dim1, ssize_t dim2)
{
    py::array_t<float> arr({ dim0, dim1, dim2 });
    std::memcpy(arr.mutable_data(), data.data(),
                (size_t)(dim0 * dim1 * dim2) * sizeof(float));
    return arr;
}

// ============================================================================
//  Python interpreter setup
// ============================================================================

void configure_python_path()
{
    py::module_ sys = py::module_::import("sys");
    sys.attr("path").attr("insert")(0, "py311"); // embedded Python stdlib/libs
    sys.attr("path").attr("insert")(0, ".");     // working directory (ArtisanMain.py)
}

// ============================================================================
//  Main
// ============================================================================

int main()
{
    py::scoped_interpreter guard{};
    configure_python_path();

    try
    {
        // ------------------------------------------------------------------
        // 1. Create a single ArtisanModel instance for the entire workflow.
        // ------------------------------------------------------------------
        py::module_ artisan = py::module_::import("ArtisanMain");
        py::object  model   = artisan.attr("ArtisanModel")();

        // ------------------------------------------------------------------
        // 2. Run the standard Artisan pipeline.
        // ------------------------------------------------------------------
        model.attr("Setup")(build_cmd_setup());
        std::cout << "[OK] Setup complete.\n";

        model.attr("WorkItem")(build_cmd_add_lattice());
        std::cout << "[OK] Lattice added.\n";

        
        // ------------------------------------------------------------------
        // 3. GET: Retrieve the SDF field as a float32 NumPy array.
        // ------------------------------------------------------------------
        py::array raw_sdf = model.attr("GetLatticeField")().cast<py::array>();

        // ensure() accepts float32 arrays as-is, and will cast other
        // numeric dtypes to float32 — always check the result is valid.
        py::array_t<float> sdf = py::array_t<float>::ensure(raw_sdf);
        if (!sdf)
            throw std::runtime_error("GetLatticeField did not return a float32-compatible array.");

        py::buffer_info buf = sdf.request();
        if (buf.ndim != 3)
            throw std::runtime_error("Expected a 3D SDF array.");

        const ssize_t dim0 = buf.shape[0];
        const ssize_t dim1 = buf.shape[1];
        const ssize_t dim2 = buf.shape[2];

        std::cout << "[OK] SDF retrieved — shape: ("
                  << dim0 << ", " << dim1 << ", " << dim2
                  << "), dtype: float32.\n";

        // ------------------------------------------------------------------
        // 4. MODIFY: Copy SDF into C++, then add 2.0 to every element.
        // ------------------------------------------------------------------
        std::vector<float> sdf_data = copy_to_vector(sdf);

        for (float& v : sdf_data)
            v -= 2.0f; // Adding material is -, Remove material is +

        std::cout << "[OK] Added 2.0 to all " << sdf_data.size() << " SDF elements.\n";

        // ------------------------------------------------------------------
        // 5. SET: Push the modified SDF back to the model as float32.
        // ------------------------------------------------------------------
        py::array_t<float> updated_sdf = wrap_as_numpy(sdf_data, dim0, dim1, dim2);
        model.attr("SetLatticeField")(updated_sdf);

        std::cout << "[OK] Modified SDF pushed back — shape: ("
                  << dim0 << ", " << dim1 << ", " << dim2 << ").\n";
        
        model.attr("WorkItem")(build_cmd_export());
        std::cout << "[OK] STL exported.\n";

    }
    catch (const py::error_already_set& e)
    {
        std::cerr << "[Python Error] " << e.what() << "\n";
        return 1;
    }
    catch (const std::exception& e)
    {
        std::cerr << "[C++ Error]    " << e.what() << "\n";
        return 1;
    }

    return 0;
}
