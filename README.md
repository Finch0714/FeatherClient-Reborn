# FeatherClient-Reborn

Feather Client 1.8.9 的本地启动方案、Soar 风格 ClickGUI/HUD 编辑器，以及小型安装器。

## 下载

- 安装器：[FeatherReborn-Setup.exe](https://github.com/finch0714/FeatherClient-Reborn/releases/download/v1.0.0/FeatherReborn-Setup.exe)
- 离线数据包（GitHub 原始地址）：[FeatherReborn-Payload.zip](https://github.com/finch0714/FeatherClient-Reborn/releases/download/payload-v1.0.0/FeatherReborn-Payload.zip)
- 离线数据包（gh-proxy 镜像）：[v4.gh-proxy.org 镜像](https://v4.gh-proxy.org/https://github.com/finch0714/FeatherClient-Reborn/releases/download/payload-v1.0.0/FeatherReborn-Payload.zip)

安装器很小，数据包约 672 MB。安装器默认使用上面的 gh-proxy 镜像下载数据包；
也可以先手动下载数据包，再在安装器里选择本地 zip。

## 使用

1. 运行 `FeatherReborn-Setup.exe`。
2. 默认安装到 `%LOCALAPPDATA%\FeatherReborn`，不需要管理员权限。
3. 安装器会自动下载 payload；如果下载失败，选择已下载的 `FeatherReborn-Payload.zip`。
4. 安装完成后从桌面快捷方式启动。
5. 启动器里点击“启动游戏”；进入游戏后右 Shift 打开本地设置和 HUD 编辑器。

安装器会创建桌面/开始菜单快捷方式和当前用户卸载项。
重复安装会保留已有存档、设置、截图和日志；卸载会删除整个安装目录。

## 校验值

```text
Payload SHA-256:
54490ec5f8012a19edb6d78ea6231645bd023b4f6fe1432e98efc40251ab134d

Setup SHA-256:
d21f45dfd1faa8419dfd2f9535e5d56d56789a50321c22e30ef8b7881c4b2f26
```

## 源码结构

```text
launcher/                  WPF 启动器
local-ui/                  ClickGUI、HUD 编辑器和设置界面
local-ui-server.js         本地 HTTP/API 服务
start-reborn.ps1           直接启动脚本
installer/FeatherReborn.Setup/  小型安装器
installer/build-release.ps1     离线包和安装器打包脚本
dist/                      已构建安装器和发布元数据
```

## 环境

- Windows 10/11 x64
- .NET 10 SDK（构建启动器）
- .NET Framework 4.8（构建安装器）
- Node.js 22.20.0（打包脚本会自动下载）
- Java 8、Minecraft 1.8.9、Forge 11.15.1.2318 由 payload 提供

## 构建

仓库不包含 672 MB 的 payload，构建完整安装包需要一个已经可运行的
Feather Client 1.8.9 游戏目录：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\build-release.ps1 `
  -SourceRoot "E:\FeatherClient_minecraft" `
  -Version "1.0.0" `
  -PayloadUrl "https://v4.gh-proxy.org/https://github.com/finch0714/FeatherClient-Reborn/releases/download/payload-v1.0.0/FeatherReborn-Payload.zip"
```

启动器：

```powershell
dotnet publish .\launcher\FeatherRebornLauncher.csproj -c Release -r win-x64 `
  --self-contained true -p:PublishSingleFile=true `
  -p:EnableCompressionInSingleFile=true
```

安装器：

```powershell
dotnet build .\installer\FeatherReborn.Setup\FeatherReborn.Setup.csproj -c Release
```

## 启动约束

- `feather-1.8.9-1.0.0-SNAPSHOT.temp.jar` 必须保持在 `mods` 中启用。
- 不要把 `mods` 目录加入 Java classpath。
- Feather jar 不能同时出现在 `mods` 和 `-cp`。
- `MouseDelayFix` 必须保持禁用。
- 本地 UI 端口为 `127.0.0.1:4200`。
- 启动环境使用 `FEATHER_TEST=1`、`FEATHER_LOCAL_TEST=1`、`FEATHER_DEBUG=1`。

## 说明

官方 Feather 1.8.9 jar 仍可下载，但固定版本是未打补丁的基础版；
安装包使用已修复的本地 jar，避免重新出现“没有开始按钮”的问题。

Feather Client、Minecraft 资源及第三方模组的再分发条款需要自行确认。
本项目不是 Feather 官方项目。
