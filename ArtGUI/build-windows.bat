@echo off
setlocal
cd /d "%~dp0"

if "%ARTISAN_PACKAGE_DIR%"=="" (
  echo Set ARTISAN_PACKAGE_DIR to the folder containing your Nuitka-built ArtisanMain.exe.
  echo Example: set ARTISAN_PACKAGE_DIR=C:\Build\ArtisanMain.dist
  exit /b 2
)

if not exist "%ARTISAN_PACKAGE_DIR%\ArtisanMain.exe" (
  echo Could not find ArtisanMain.exe in: %ARTISAN_PACKAGE_DIR%
  exit /b 2
)

if not exist "node_modules\@tauri-apps\cli" (
  echo Installing the Tauri command line package...
  call npm ci
  if errorlevel 1 exit /b %errorlevel%
)

if not exist "src-tauri\resources\artisan" mkdir "src-tauri\resources\artisan"
robocopy "%ARTISAN_PACKAGE_DIR%" "src-tauri\resources\artisan" /E /NFL /NDL /NJH /NJS /NP
if errorlevel 8 exit /b %errorlevel%

call npm run build -- --config src-tauri/tauri.bundle-engine.conf.json
exit /b %errorlevel%
