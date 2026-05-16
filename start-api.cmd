@echo off
cd /d "%~dp0"
echo P2PQuake intensity API を起動します...
echo.
echo 起動したら、次のURLをブラウザで開いてください:
echo http://localhost:3000/api/intensities
echo.
echo この黒い画面は閉じないでください。閉じるとAPIも止まります。
echo.
npm.cmd start
pause
