@echo off
rem Called by a build/dev wrapper with setlocal. Environment changes stay in that wrapper.
if "%HDF5_DIR%"=="" if exist "%ProgramData%\Anaconda3\Library\include\hdf5.h" set "HDF5_DIR=%ProgramData%\Anaconda3"
if "%HDF5_DIR%"=="" (
  echo Set HDF5_DIR to an HDF5 development installation or Anaconda environment.
  exit /b 2
)
if exist "%HDF5_DIR%\Library\bin\hdf5.dll" (
  set "PATH=%HDF5_DIR%\Library\bin;%PATH%"
) else (
  set "PATH=%HDF5_DIR%\bin;%PATH%"
)
if "%ARTGUI_BUILD_PYTHON%"=="" (
  if exist "%HDF5_DIR%\python.exe" (
    set "ARTGUI_BUILD_PYTHON=%HDF5_DIR%\python.exe"
  ) else (
    set "ARTGUI_BUILD_PYTHON=python"
  )
)
"%ARTGUI_BUILD_PYTHON%" "%~dp0prepare_hdf5.py" --hdf5-dir "%HDF5_DIR%"
exit /b %errorlevel%
