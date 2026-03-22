@echo off
chcp 65001 >nul 2>&1
title Norte.AI - Servidor
color 0B

echo.
echo   ========================================
echo          Norte.AI - Servidor
echo   ========================================
echo.
echo   Iniciando o servidor do dashboard...
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERRO] Node.js nao encontrado!
    echo   Baixe em: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "node_modules" (
    echo   Instalando dependencias...
    call npm install --silent
    echo   [OK] Dependencias instaladas!
    echo.
)

:: Build frontend if needed
if not exist "dist" (
    echo   Compilando o dashboard...
    call npx vite build --silent 2>nul
    echo   [OK] Dashboard compilado!
    echo.
)

:: Kill any existing process on port 3000
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo   Fechando processo anterior na porta 3000 (PID: %%P^)...
    taskkill /F /PID %%P >nul 2>&1
    timeout /t 1 /nobreak >nul
)

echo   Servidor iniciando...
echo.
echo   ========================================
echo   Dashboard: http://localhost:3000
echo   ========================================
echo.
echo   Mantenha esta janela aberta!
echo   Para parar, feche esta janela ou aperte Ctrl+C
echo.

node server/index.cjs

pause
