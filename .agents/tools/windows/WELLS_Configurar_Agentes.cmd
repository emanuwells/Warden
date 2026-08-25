@echo off
chcp 65001 >nul
setlocal
where node >nul 2>&1 || (echo ERRO: Node.js nao encontrado.& pause & exit /b 1)
echo.
echo 1 - Claude Code apenas ^(recomendado^)
echo 2 - Claude Code, Codex e Gemini CLI
set /p "OPTION=Escolhe [1]: "
if "%OPTION%"=="2" (set "AGENT=all") else (set "AGENT=claude")
node "%~dp0..\wells-toolkit.mjs" configure --agent %AGENT%
echo.
choice /M "Aplicar esta configuracao no teu perfil de utilizador"
if errorlevel 2 exit /b 0
node "%~dp0..\wells-toolkit.mjs" configure --agent %AGENT% --apply
pause
