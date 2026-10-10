cmake_minimum_required(VERSION 3.20)
project(ArtisanCppCaller LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# -------------------------
# pybind11 (local copy)
# -------------------------
set(PYBIND11_SRC_DIR "C:/Users/wangy/Documents/Project-Artisan/Artisan/SoloPkg/Py311_compiled_libs/libs/pybind11")

if(EXISTS "${PYBIND11_SRC_DIR}/CMakeLists.txt")
  add_subdirectory("${PYBIND11_SRC_DIR}" "${CMAKE_BINARY_DIR}/_deps/pybind11-build")
else()
  find_package(pybind11 CONFIG REQUIRED)
endif()

# -------------------------
# Embedded Python
# -------------------------
set(PY_EMBED_DIR "C:/Users/wangy/Documents/Project-Artisan/Artisan/SoloPkg/Py311_compiled_libs/python-3.11.7-embed-amd64")
set(PY_INCLUDE_DIR "${PY_EMBED_DIR}/include")
set(PY_LIB_DIR     "${PY_EMBED_DIR}/libs")

# -------------------------
# List all your examples here
# -------------------------
set(EXAMPLES
    Example_01
    Example_02
    Example_03
)

foreach(EXAMPLE ${EXAMPLES})
    add_executable(${EXAMPLE} src/${EXAMPLE}.cpp)

    target_include_directories(${EXAMPLE} PRIVATE "${PY_INCLUDE_DIR}")
    target_link_directories(${EXAMPLE} PRIVATE "${PY_LIB_DIR}")
    target_link_libraries(${EXAMPLE} PRIVATE pybind11::embed python311)

    add_custom_command(TARGET ${EXAMPLE} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
                "${PY_EMBED_DIR}"
                "$<TARGET_FILE_DIR:${EXAMPLE}>/py311"
    )
endforeach()
