# Artisan Examples Index

Use this file to select the closest working example before creating or modifying a workflow.

## Basic Lattice

- `Src/Test_json/Basic/Sample_Box.json`
- `Src/Test_json/Basic/BingDunDun_Infill_LR.json`
- `Src/Test_json/Basic/SingleLatticeUnit.json`

## Custom Lattice

- Strut: `Src/Test_json/CustomLattice/BingDunDun_CustomInfill_Strut.json`
- TPMS: `Src/Test_json/CustomLattice/BingDunDun_CustomInfill_TPMS.json`
- Geometry: `Src/Test_json/CustomLattice/BingDunDun_CustomInfill_Geom.json`
- Geometry plate: `Src/Test_json/CustomLattice/BingDunDun_CustomInfill_GeomPlate.json`

## Conformal Lattice

- Tet conformal shoe: `Src/Test_json/ConformalLattice/Shoe_TetConformal_Infill_LR.json`
- Custom conformal twisted bar: `Src/Test_json/ConformalLattice/Twisted_Bar_ConformalCustomLattice.json`
- Hex conformal step 1 polycube: `Src/Test_json/ConformalLattice/HexConformal/HexConformal_Step01_Polycube.json`
- Hex conformal step 2 Cartesian mesh: `Src/Test_json/ConformalLattice/HexConformal/HexConformal_Step02_CartesianMesh.json`
- Hex conformal step 3 mapping: `Src/Test_json/ConformalLattice/HexConformal/HexConformal_Step03_Mapping.json`

## Mesh Lattice And Meshing

- Cylindrical mesh: `Src/Test_json/MeshLattice/GenCylindricalMesh.json`
- Spherical mesh: `Src/Test_json/MeshLattice/GenSphericalMesh.json`
- Tet basic mesh: `Src/Test_json/MeshLattice/GenTetBasicMesh.json`
- Tet hex split: `Src/Test_json/MeshLattice/GenTetBasicMesh_HexSplit.json`
- Voronoi mesh: `Src/Test_json/MeshLattice/GenVorMesh.json`
- External mesh with geometry field: `Src/Test_json/MeshLattice/ExtMesh/Mesh_GeomField.json`
- Extract mesh surface: `Src/Test_json/MeshLattice/ExtractMeshSurf/ExtractMeshSurf.json`
- Field-driven mesh: `Src/Test_json/MeshLattice/FieldDrivenMesh/FieldDrivenMesh_Attractor.json`
- Skin generation: `Src/Test_json/MeshLattice/GenSkin/Crankhandle_MeshTrim_Beam.json`
- Octree mesh: `Src/Test_json/MeshLattice/OctTree/Proc_OctTreeMesh.json`

## Field Operations

- Offset field: `Src/Test_json/FieldOpt/Bar_FieldOffset.json`
- Edge enhancement: `Src/Test_json/FieldOpt/Box_EdgeEnhance.json`
- Corner enhancement: `Src/Test_json/FieldOpt/Box_CornerEnhance.json`
- Expression offset: `Src/Test_json/FieldOpt/Box_FieldOffsetExpr.json`
- Attractor expression offset: `Src/Test_json/FieldOpt/Box_FieldOffsetExpr_attractor.json`
- Geometry field offset: `Src/Test_json/FieldOpt/CylinderGradeLattice.json`
- Field TPMS: `Src/Test_json/FieldTPMS/Cube_FieldTPMS.json`

## Lattice Transition And Merge

- Linear merge: `Src/Test_json/LatticeMerge/Box_FieldMerge_Lin.json`
- Attractor merge: `Src/Test_json/LatticeMerge/Box_FieldMerge_Attractor.json`
- Annulus merge: `Src/Test_json/LatticeMerge/Box_FieldMerge_Annulus.json`
- Variable-size merge: `Src/Test_json/LatticeMerge/Box_FieldMerge_VarSize.json`
- Twisted conformal merge: `Src/Test_json/LatticeMerge/Twisted_Bar_Conformal_MergeLattice.json`

## Primitive Design

- Box geometry: `Src/Test_json/PrimitiveDesign/GenBox.json`
- Add geometry: `Src/Test_json/PrimitiveDesign/GenBox_Add.json`
- Subtract geometry: `Src/Test_json/PrimitiveDesign/GenBox_Subtraction.json`
- Intersect geometry: `Src/Test_json/PrimitiveDesign/GenBox_Intersection.json`
- Cylindrical conformal mesh: `Src/Test_json/PrimitiveDesign/GenCylindricalConformalMesh.json`
- Spherical conformal mesh: `Src/Test_json/PrimitiveDesign/GenSphericalConformalMesh.json`
- Capped cone conformal mesh: `Src/Test_json/PrimitiveDesign/GenCappedConeConformalMesh.json`

## Surface Lattice

- Ball surface lattice: `Src/Test_json/SurfaceLattice/BallSurfaceLattice.json`
- Box surface lattice: `Src/Test_json/SurfaceLattice/Box_SurfaceLattice.json`
- Crankhandle surface lattice: `Src/Test_json/SurfaceLattice/Crankhandle_SurfaceLattice.json`
- Generate simple quad mesh: `Src/Test_json/SurfaceLattice/GenSimpleQuadMesh.json`
- Generate basic surface quad mesh: `Src/Test_json/SurfaceLattice/Gen_BasicSurfQuadMesh.json`

## FEA And Export

- Spherical conformal FEA mesh: `Src/Test_json/FEAMesh/GenSphericalConformalMesh.json`
- Export TPMS conformal: `Src/Test_json/FEAMesh/Parts02_Export_TPMS_conformal.json`
- Mesh trim: `Src/Test_json/FEAMesh/MeshTrim/Crankhandle_MeshTrim.json`
- Mesh trim with surface map: `Src/Test_json/FEAMesh/MeshTrim_SurfMap/Crankhandle_MeshTrim_SurfMap.json`

## Python And C++ API Integration

- Python examples: `Interfaces/Python/Artisan_Example_01.py` through `Interfaces/Python/Artisan_Example_04.py`
- C++ examples: `Interfaces/Cpp/src/Artisan_Example_01.cpp` through `Interfaces/Cpp/src/Artisan_Example_03.cpp`
