@echo off
chcp 65001 >nul
setlocal
where node >nul 2>&1 || (echo ERRO: Node.js nao encontrado.& pause & exit /b 1)
set "PROJECT=%~1"
if not defined PROJECT set "PROJECT=%CD%"
echo.
echo 1 - Recomendadas ^(Graphify, CodeBurn e packs Anthropic^)
echo 2 - Frontend ^(Anthropic, Impeccable, Kowalski, Taste, Vercel, shadcn^)
echo 3 - Knowledge ^(Graphify e Obsidian^)
echo 4 - Experimentais ^(Headroom proxy, OmniRoute e claude-mem^)
set /p "OPTION=Escolhe [1]: "
if "%OPTION%"=="2" set "PROFILE=frontend"
if "%OPTION%"=="3" set "PROFILE=knowledge"
if "%OPTION%"=="4" set "PROFILE=experimental"
if not defined PROFILE set "PROFILE=recommended"
if "%PROFILE%"=="experimental" (
  node "%~dp0..\wells-toolkit.mjs" integrations plan --project "%PROJECT%" --profile experimental --accept-risk
  echo.
  choice /M "Guardar o plano experimental apos rever os riscos"
  if errorlevel 2 exit /b 0
  node "%~dp0..\wells-toolkit.mjs" integrations plan --project "%PROJECT%" --profile experimental --accept-risk --apply
) else (
  node "%~dp0..\wells-toolkit.mjs" integrations plan --project "%PROJECT%" --profile %PROFILE%
  echo.
  choice /M "Guardar este plano no projeto"
  if errorlevel 2 exit /b 0
  node "%~dp0..\wells-toolkit.mjs" integrations plan --project "%PROJECT%" --profile %PROFILE% --apply
)
node "%~dp0..\wells-toolkit.mjs" integrations lock --project "%PROJECT%" --apply
pause
