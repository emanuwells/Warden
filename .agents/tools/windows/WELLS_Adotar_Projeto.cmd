@echo off
chcp 65001 >nul
setlocal
where node >nul 2>&1 || (echo ERRO: Node.js nao encontrado.& pause & exit /b 1)
set "TARGET=%~1"
if defined TARGET goto :run
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject Shell.Application).BrowseForFolder(0,'Selecionar projeto existente',0,0); if($s){$s.Self.Path}"`) do set "TARGET=%%I"
if not defined TARGET goto :end
:run
node "%~dp0..\wells-toolkit.mjs" migrate --project "%TARGET%"
echo.
choice /M "Aplicar esta migracao segura"
if errorlevel 2 goto :end
node "%~dp0..\wells-toolkit.mjs" migrate --project "%TARGET%" --apply
node "%~dp0..\wells-toolkit.mjs" audit --project "%TARGET%"
:end
echo.
pause
