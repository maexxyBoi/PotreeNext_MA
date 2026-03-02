@echo off

REM start Python alpha-shape server
start "" cmd /c "py.exe -m uvicorn src.alphaShaper:app --reload "

REM start static file server
start "" cmd /c "npx.cmd http-server"