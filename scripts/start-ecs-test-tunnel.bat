@echo off
chcp 65001 >nul
echo 正在连接服务器测试通道，请稍候...
echo.
echo 连接成功后，请打开浏览器访问： http://localhost:8080
echo 测试结束后，按 Ctrl+C 或直接关闭本窗口即可断开。
echo.
ssh -i "%USERPROFILE%\.ssh\aliyun_schedule" -N -L 8080:127.0.0.1:8080 root@120.77.220.79
pause
