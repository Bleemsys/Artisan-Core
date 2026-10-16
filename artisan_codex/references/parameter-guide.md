# Choose the controls

Use one length unit throughout the model, lattice, input meshes, and scalar fields. Artisan does not infer or convert the intended unit. A value of 2 means 2 model units; call it millimetres only when the user has chosen millimetres.

## Ask for design intent, fill routine inputs

The useful questions are the shape/file, its units and approximate dimensions, desired cell spacing, target strut diameter or wall thickness, and output type. Ask about grading or conformal cells only when relevant. Do not present all JSON parameters as a questionnaire.

For an exploratory preview, offer a clearly labelled trial cell scale and thickness when the user has not chosen them. These are design assumptions, not validated manufacturing or strength requirements. Use the bundled examples for routine settings. Change one important control at a time.

## Setup

| Control | What the user needs to know | Practical starting point |
|---|---|---|
| `Type` | `Sample` gives a box domain; `Geometry` takes the domain from an imported surface. | Use `Sample` for a simple box or explicit bounds. |
| `Sample.Domain` | `[[xmin,xmax],[ymin,ymax],[zmin,zmax]]`; each minimum must be below its maximum. | Cover the intended object and any field region needed. |
| `Sample.Shape` | Accepted value is `Box`. | Keep `Box`. |
| `Geomfile` | Surface file for `Geometry` setup; it must exist. Sample setup does not need a file. | Use the user's model. Do not put a private sample path in their workflow. |
| `res` | Positive sampling spacing `[dx,dy,dz]`, in model units. It affects surface detail and resource use. It does not set cell size. | The small box starter uses `[0.05,0.05,0.05]`. Scale it to the intended features. |
| `Padding` | Nonnegative integer number of extra grid layers around the domain. | Start with 2 for a general preview; some shipped examples use other values. It is not padding in model units. |
| `Rot` | Three rotation values for imported geometry. | Keep `[0,0,0]` unless rotation is requested. The reviewed build uses radians. |
| `onGPU` | Boolean execution choice; support depends on the operation and installation. | Use `false` for portable CPU starters. |
| `memorylimit` | Positive memory budget in bytes, used to choose domain partitions; it is not a guarantee of peak process memory. | Small previews use 1073741824 (1 GiB). A larger value must fit the user's machine. |
| `JsonWorkDir` | Controls how relative input/output paths are resolved. | Set `true` in portable workflows to use the JSON file's folder. `false` uses the launch working folder. |

All common Setup controls except `JsonWorkDir` must be supplied. `Type: Geometry` requires `Geomfile`; `Type: Sample` requires `Sample`. See the exact Setup tables in `references/parameters.md`.

Refine `res` only after checking the small preview. As a starting heuristic, sample the smallest intended strut diameter or wall with several grid intervals; use the preview to decide whether more detail is needed. This is not a fixed Artisan requirement or a surface-quality guarantee. Finer spacing can substantially increase runtime, memory, and file size.

## Lattice controls

The standard `Add_Lattice` command requires all of the following:

| Control | Meaning | Starting choice |
|---|---|---|
| `la_name` | Exact built-in lattice name or a previously defined lattice name. | `BCCubic` for a strut example; `Gyroid` for a TPMS example. |
| `size` | Three positive cell dimensions `[sx,sy,sz]`, in model units, for a periodic lattice. | `[1,1,1]` gives the box starter's cell scale. |
| `thk` | Nonnegative lattice thickness control. For strut lattices it is the strut radius. For TPMS it controls wall thickness; do not promise a uniform measured wall equal to this number. | For a desired strut diameter of 0.2, use `thk: 0.1`. Check TPMS walls in the preview. |
| `Rot` | Three lattice rotation controls, in radians in the reviewed build. | `[0,0,0]`. Do not assume other angle parameters also use radians. |
| `Trans` | Three lattice-position controls, in model units. | `[0,0,0]`. Preview nonzero transforms to check alignment. |
| `Inv` | Inverts the accumulated result at this step. It is an advanced design choice. | `false` for ordinary infill. |
| `Fill` | Clips the result to the setup geometry or sample domain. | `true` for ordinary infill; use explicit trimming for the graded conformal example. |
| `Cube_Request` | Optional design-service request payload, but the key itself is required. | `{}` when directly choosing `size` and `thk`. A configured nonempty request can replace those values. |

`size`, `res`, and `thk` must not be used interchangeably. Increasing `size` spaces periodic cells farther apart. Changing `thk` changes struts/walls. Decreasing `res` samples the design more finely.

Built-in periodic strut names include `BC`, `BCCubic`, `Cubic`, `FCCubic`, `EdgeOcta`, `VertexOcta`, `StarTet`, `Dodecahedron`, and `Auxetic`. Built-in TPMS choices include `SchwarzDiamond`, `SchwarzPrimitive`, `FischerKoch`, `Neovius`, `Lidinoid`, and `Gyroid`. A tetrahedral conformal workflow uses a compatible tet-domain lattice such as `Icosahedral`; do not substitute a hex-domain lattice without checking compatibility.

## Required inputs are not automatic defaults

The zero rotations, empty `Cube_Request`, CPU choice, and memory budgets in the starters are supplied example values. They are not omitted-key defaults. Keep required keys even when their example value looks routine. Use JSON booleans, not strings or 0/1. Use finite numbers, and preserve exact capitalization: `res`, `MeshID`, `Gridfield_ID`, and `FieldID` are different names with different purposes.

An accepted input type does not prove the complete design is valid. Inputs must exist, IDs must be created before use, meshes must contain the requested element type, and fields must cover the intended domain. Do not promise printability, strength, watertightness, exact wall thickness, or exact target tet sizes from a valid JSON file alone.
