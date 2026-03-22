@echo off
chcp 65001 >nul 2>&1
title Norte.AI - Instalador do Agent
color 0B

echo.
echo   ========================================
echo          Norte.AI - Inicializador do Agent
echo   ========================================
echo.
echo   Este programa monitora o uso de IA e envia os dados para o dashboard.
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
    call npm install --silent 2>nul
    echo   Dependencias instaladas!
    echo.
)

:: Kill any existing agent on port 3210
echo   Verificando porta 3210...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :3210 ^| findstr LISTENING 2^>nul') do (
    echo   Fechando processo anterior na porta 3210 (PID: %%P^)...
    taskkill /F /PID %%P >nul 2>&1
    timeout /t 1 /nobreak >nul
)

echo.
echo   Iniciando o Agent...
echo.

node agent.cjs

pause
