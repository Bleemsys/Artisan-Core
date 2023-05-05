cmake_minimum_required(VERSION 3.0.0)
project(CheckArtisan VERSION 0.1.0)

include(CTest)
enable_testing()

# Example 01: Run function
# add_executable(Artisan ./src/Artisan_Example_01.cpp)
# Example 02: Excution function
add_executable(Artisan ./src/Artisan_Example_02.cpp)
# Example 03: WorkItem process function
# add_executable(Artisan ./src/Artisan_Example_03.cpp)

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
