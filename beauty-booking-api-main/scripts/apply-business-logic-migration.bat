@echo off
REM Script Windows: apply migration thủ công cho BeautyBook
REM Chạy: scripts\apply-business-logic-migration.bat
setlocal
cd /d "%~dp0\.."

echo === Reading DATABASE_URL from .env ===
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    if /I "%%a"=="DATABASE_URL" set "DB_URL=%%b"
)

if "%DB_URL%"=="" (
    echo Could not read DATABASE_URL from .env
    exit /b 1
)

echo === Connecting to database and applying migration...
node scripts\apply-business-logic-migration.js
if errorlevel 1 (
    echo Migration failed.
    exit /b 1
)

echo === Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo Prisma generate failed.
    exit /b 1
)

echo === Done! Schema is now in sync.
endlocal
