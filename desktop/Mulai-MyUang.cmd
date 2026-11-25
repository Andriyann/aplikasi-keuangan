@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (python mulai.py) else (py -3 mulai.py)
if errorlevel 1 pause
