@echo off
setlocal
where node >nul 2>&1 || (echo ERRO: Node.js nao encontrado.& pause & exit /b 1)
set /p "PROJECT=Arrasta ou cola aqui a pasta do projeto: "
set "PROJECT=%PROJECT:"=%"
node "%~dp0..\wells-toolkit.mjs" audit --project "%PROJECT%"
pause
