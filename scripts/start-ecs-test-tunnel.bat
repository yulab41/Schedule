@echo off
echo Connecting to server test tunnel...
echo.
echo Once connected, open http://localhost:8080 in your browser.
echo Press Ctrl+C or close this window to disconnect.
echo.
ssh -i "%USERPROFILE%\.ssh\aliyun_schedule" -N -L 8080:127.0.0.1:8080 root@120.77.220.79
pause
