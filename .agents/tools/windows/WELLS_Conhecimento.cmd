@echo off
chcp 65001 >nul
setlocal
where node >nul 2>&1 || (echo ERRO: Node.js nao encontrado.& pause & exit /b 1)
set "PROJECT=%~1"
if not defined PROJECT set "PROJECT=%CD%"
node "%~dp0..\wells-toolkit.mjs" knowledge build --project "%PROJECT%"
echo.
choice /M "Regenerar INDEX e GRAPH"
if errorlevel 2 goto :lint
node "%~dp0..\wells-toolkit.mjs" knowledge build --project "%PROJECT%" --apply
:lint
node "%~dp0..\wells-toolkit.mjs" knowledge lint --project "%PROJECT%"
pause
