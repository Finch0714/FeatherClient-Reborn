using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace FeatherReborn.Setup
{
    internal sealed class InstallProgress
    {
        public int Percent { get; set; }
        public string Status { get; set; }
    }

    internal sealed class InstallOptions
    {
        public string InstallDirectory { get; set; }
        public string PayloadPath { get; set; }
        public string PayloadUrl { get; set; }
        public bool LaunchAfterInstall { get; set; }
    }

    internal static class InstallerEngine
    {
        private static readonly string[] PayloadSearchNames =
        {
            BuildInfo.PayloadFileName,
            "payload.zip"
        };

        public static string DefaultInstallDirectory
        {
            get
            {
                var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                return Path.Combine(local, "FeatherReborn");
            }
        }

        public static string FindLocalPayload()
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var downloads = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "Downloads");

            var directories = new[]
            {
                baseDir,
                Path.Combine(baseDir, "payload"),
                downloads
            };

            foreach (var directory in directories)
            {
                foreach (var name in PayloadSearchNames)
                {
                    var path = Path.Combine(directory, name);
                    if (File.Exists(path)) return path;
                }
            }

            return null;
        }

        public static string ResolvePayloadUrl()
        {
            var sidecar = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "payload.url");
            if (File.Exists(sidecar))
            {
                try
                {
                    var value = File.ReadLines(sidecar)
                        .Select(line => line.Trim())
                        .FirstOrDefault(line => line.Length > 0 && !line.StartsWith("#", StringComparison.Ordinal));
                    if (!string.IsNullOrWhiteSpace(value)) return value;
                }
                catch
                {
                }
            }

            return BuildInfo.DefaultPayloadUrl ?? string.Empty;
        }

        public static async Task<string> InstallAsync(
            InstallOptions options,
            IProgress<InstallProgress> progress,
            CancellationToken cancellationToken)
        {
            progress = progress ?? new Progress<InstallProgress>();
            if (string.IsNullOrWhiteSpace(options.InstallDirectory))
            {
                throw new InvalidOperationException("请选择安装位置。");
            }

            var target = Path.GetFullPath(options.InstallDirectory.Trim());
            if (target.Length < 4 || string.Equals(Path.GetPathRoot(target), target, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("不能直接安装到磁盘根目录。");
            }

            EnsureDiskSpace(target);
            EnsureTargetNotRunning(target);

            var payload = options.PayloadPath;
            if (string.IsNullOrWhiteSpace(payload) || !File.Exists(payload))
            {
                if (string.IsNullOrWhiteSpace(options.PayloadUrl))
                {
                    throw new FileNotFoundException("未找到安装数据包，请先选择 " + BuildInfo.PayloadFileName + "。");
                }

                payload = Path.Combine(Path.GetTempPath(), BuildInfo.PayloadFileName);
                await DownloadPayloadAsync(options.PayloadUrl, payload, progress, cancellationToken);
            }

            progress.Report(new InstallProgress { Percent = 42, Status = "正在校验数据包..." });
            await Task.Run(() =>
            {
                var hash = ComputeSha256(payload, cancellationToken);
                if (!string.IsNullOrWhiteSpace(BuildInfo.PayloadSha256) &&
                    !string.Equals(hash, BuildInfo.PayloadSha256, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidDataException(
                        "数据包校验失败。文件可能下载不完整或不是当前版本，请重新下载 " + BuildInfo.PayloadFileName + "。");
                }
            }, cancellationToken);

            progress.Report(new InstallProgress { Percent = 46, Status = "正在解压文件..." });
            Directory.CreateDirectory(target);
            ExtractPayload(payload, target, progress, cancellationToken);

            progress.Report(new InstallProgress { Percent = 96, Status = "正在创建快捷方式..." });
            CreateLauncherConfigIfMissing(target);
            CopyInstallerForUninstall(target);
            CreateShortcuts(target);
            RegisterUninstall(target);

            progress.Report(new InstallProgress { Percent = 100, Status = "安装完成" });

            if (options.LaunchAfterInstall)
            {
                Launch(target);
            }

            return target;
        }

        public static void Launch(string target)
        {
            var launcher = Path.Combine(target, "FeatherRebornLauncher.exe");
            if (!File.Exists(launcher))
            {
                throw new FileNotFoundException("安装已完成，但没有找到启动器。", launcher);
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = launcher,
                WorkingDirectory = target,
                UseShellExecute = true
            });
        }

        private static void EnsureDiskSpace(string target)
        {
            if (BuildInfo.UnpackedSizeBytes <= 0) return;

            var root = Path.GetPathRoot(target);
            if (string.IsNullOrWhiteSpace(root)) return;

            var drive = new DriveInfo(root);
            var required = BuildInfo.UnpackedSizeBytes + (200L * 1024 * 1024);
            if (drive.AvailableFreeSpace < required)
            {
                var neededGb = Math.Ceiling(required / 1024d / 1024d / 1024d);
                var freeGb = Math.Floor(drive.AvailableFreeSpace / 1024d / 1024d / 1024d);
                throw new IOException(
                    "磁盘空间不足：至少需要 " + neededGb + " GB，当前可用 " + freeGb + " GB。");
            }
        }

        private static void EnsureTargetNotRunning(string target)
        {
            foreach (var process in Process.GetProcesses())
            {
                try
                {
                    if (process.Id == Process.GetCurrentProcess().Id) continue;
                    var file = process.MainModule == null ? null : process.MainModule.FileName;
                    if (string.IsNullOrWhiteSpace(file)) continue;
                    if (!file.StartsWith(target.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase)) continue;

                    var name = process.ProcessName;
                    if (string.Equals(name, "javaw", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(name, "java", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(name, "FeatherRebornLauncher", StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException("目标目录中的 Feather Reborn 或游戏仍在运行，请先关闭后再安装。");
                    }
                }
                catch (InvalidOperationException)
                {
                    throw;
                }
                catch
                {
                }
            }
        }

        private static async Task DownloadPayloadAsync(
            string url,
            string destination,
            IProgress<InstallProgress> progress,
            CancellationToken cancellationToken)
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            Directory.CreateDirectory(Path.GetDirectoryName(destination));

            using (var client = new HttpClient())
            {
                client.Timeout = Timeout.InfiniteTimeSpan;
                using (var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken))
                {
                    response.EnsureSuccessStatusCode();
                    var total = response.Content.Headers.ContentLength ?? BuildInfo.PayloadSizeBytes;
                    using (var input = await response.Content.ReadAsStreamAsync())
                    using (var output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None,
                        1024 * 1024, true))
                    {
                        var buffer = new byte[1024 * 1024];
                        long received = 0;
                        int read;
                        while ((read = await input.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
                        {
                            await output.WriteAsync(buffer, 0, read, cancellationToken);
                            received += read;
                            var percent = total > 0 ? (int)Math.Min(40, received * 40 / total) : 0;
                            progress.Report(new InstallProgress
                            {
                                Percent = percent,
                                Status = "正在下载数据包 " + FormatSize(received) +
                                         (total > 0 ? " / " + FormatSize(total) : "")
                            });
                        }
                    }
                }
            }
        }

        private static string ComputeSha256(string path, CancellationToken cancellationToken)
        {
            using (var sha = SHA256.Create())
            using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
                1024 * 1024, FileOptions.SequentialScan))
            {
                var buffer = new byte[1024 * 1024];
                int read;
                while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    sha.TransformBlock(buffer, 0, read, null, 0);
                }
                sha.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                return BitConverter.ToString(sha.Hash).Replace("-", string.Empty);
            }
        }

        private static void ExtractPayload(
            string payload,
            string target,
            IProgress<InstallProgress> progress,
            CancellationToken cancellationToken)
        {
            var targetRoot = target.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            using (var archive = ZipFile.OpenRead(payload))
            {
                var entries = archive.Entries.Where(entry => !string.IsNullOrEmpty(entry.Name)).ToList();
                long totalBytes = entries.Sum(entry => entry.Length);
                long processed = 0;

                foreach (var entry in entries)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var relative = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                    var destination = Path.GetFullPath(Path.Combine(target, relative));
                    if (!destination.StartsWith(targetRoot, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidDataException("数据包包含非法路径。");
                    }

                    var parent = Path.GetDirectoryName(destination);
                    if (!string.IsNullOrWhiteSpace(parent)) Directory.CreateDirectory(parent);

                    if (File.Exists(destination) && ShouldPreserveExisting(relative))
                    {
                        processed += entry.Length;
                        ReportExtractProgress(progress, processed, totalBytes);
                        continue;
                    }

                    using (var input = entry.Open())
                    using (var output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None,
                        1024 * 1024, true))
                    {
                        var buffer = new byte[1024 * 1024];
                        int read;
                        while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            cancellationToken.ThrowIfCancellationRequested();
                            output.Write(buffer, 0, read);
                            processed += read;
                            ReportExtractProgress(progress, processed, totalBytes);
                        }
                    }
                }
            }
        }

        private static void ReportExtractProgress(IProgress<InstallProgress> progress, long processed, long total)
        {
            var percent = total <= 0 ? 90 : 46 + (int)Math.Min(49, processed * 49 / total);
            progress.Report(new InstallProgress
            {
                Percent = percent,
                Status = "正在解压 " + FormatSize(processed) + " / " + FormatSize(total)
            });
        }

        private static bool ShouldPreserveExisting(string relative)
        {
            var path = relative.TrimStart(Path.DirectorySeparatorChar);
            var prefixes = new[]
            {
                "saves" + Path.DirectorySeparatorChar,
                "screenshots" + Path.DirectorySeparatorChar,
                "logs" + Path.DirectorySeparatorChar,
                "crash-reports" + Path.DirectorySeparatorChar,
                "resourcepacks" + Path.DirectorySeparatorChar,
                "shaderpacks" + Path.DirectorySeparatorChar,
                "config" + Path.DirectorySeparatorChar,
                "feather" + Path.DirectorySeparatorChar
            };
            if (prefixes.Any(prefix => path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))) return true;

            var files = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "options.txt",
                "optionsof.txt",
                "optionsshaders.txt",
                "launcher-config.json",
                "servers.dat",
                "servers.dat_old",
                "usercache.json",
                "usernamecache.json"
            };
            return files.Contains(path);
        }

        private static void CreateLauncherConfigIfMissing(string target)
        {
            var path = Path.Combine(target, "launcher-config.json");
            if (File.Exists(path)) return;

            File.WriteAllText(path,
                "{\r\n" +
                "  \"MemoryMb\": 4096,\r\n" +
                "  \"Username\": \"Player\",\r\n" +
                "  \"ExtraJvmArgs\": \"\",\r\n" +
                "  \"KeepLauncherOpen\": true\r\n" +
                "}\r\n",
                new UTF8Encoding(false));
        }

        private static void CopyInstallerForUninstall(string target)
        {
            var source = Path.GetFullPath(Process.GetCurrentProcess().MainModule.FileName);
            var destination = Path.Combine(target, "FeatherReborn-Setup.exe");
            if (string.Equals(source, destination, StringComparison.OrdinalIgnoreCase)) return;

            File.Copy(source, destination, true);
        }

        private static void CreateShortcuts(string target)
        {
            var launcher = Path.Combine(target, "FeatherRebornLauncher.exe");
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);

            CreateShortcut(Path.Combine(desktop, "Feather Reborn.lnk"), launcher, target);
            CreateShortcut(Path.Combine(programs, "Feather Reborn.lnk"), launcher, target);
        }

        private static void CreateShortcut(string shortcutPath, string launcher, string workingDirectory)
        {
            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) return;

            object shell = null;
            object shortcut = null;
            try
            {
                shell = Activator.CreateInstance(shellType);
                dynamic dynamicShell = shell;
                shortcut = dynamicShell.CreateShortcut(shortcutPath);
                dynamic dynamicShortcut = shortcut;
                dynamicShortcut.TargetPath = launcher;
                dynamicShortcut.WorkingDirectory = workingDirectory;
                dynamicShortcut.IconLocation = launcher + ",0";
                dynamicShortcut.Description = "Feather Reborn 1.8.9";
                dynamicShortcut.Save();
            }
            finally
            {
                if (shortcut != null && System.Runtime.InteropServices.Marshal.IsComObject(shortcut))
                {
                    System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shortcut);
                }
                if (shell != null && System.Runtime.InteropServices.Marshal.IsComObject(shell))
                {
                    System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
                }
            }
        }

        public static void RegisterUninstall(string target)
        {
            const string keyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\FeatherReborn";
            using (var key = Registry.CurrentUser.CreateSubKey(keyPath))
            {
                if (key == null) return;
                var setup = Path.Combine(target, "FeatherReborn-Setup.exe");
                var launcher = Path.Combine(target, "FeatherRebornLauncher.exe");
                key.SetValue("DisplayName", "Feather Reborn 1.8.9");
                key.SetValue("DisplayVersion", BuildInfo.Version);
                key.SetValue("Publisher", "Feather Reborn");
                key.SetValue("InstallLocation", target);
                key.SetValue("DisplayIcon", launcher + ",0");
                key.SetValue("UninstallString", "\"" + setup + "\" /uninstall");
                key.SetValue("QuietUninstallString", "\"" + setup + "\" /uninstall");
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                if (BuildInfo.UnpackedSizeBytes > 0)
                {
                    key.SetValue("EstimatedSize",
                        (int)Math.Min(int.MaxValue, BuildInfo.UnpackedSizeBytes / 1024),
                        RegistryValueKind.DWord);
                }
            }
        }

        public static void RemoveUninstallEntry()
        {
            Registry.CurrentUser.DeleteSubKeyTree(
                @"Software\Microsoft\Windows\CurrentVersion\Uninstall\FeatherReborn",
                false);
        }

        public static void RemoveShortcuts()
        {
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            foreach (var path in new[]
            {
                Path.Combine(desktop, "Feather Reborn.lnk"),
                Path.Combine(programs, "Feather Reborn.lnk")
            })
            {
                try
                {
                    if (File.Exists(path)) File.Delete(path);
                }
                catch
                {
                }
            }
        }

        public static void KillProcessesIn(string target)
        {
            foreach (var process in Process.GetProcesses())
            {
                try
                {
                    var file = process.MainModule == null ? null : process.MainModule.FileName;
                    if (string.IsNullOrWhiteSpace(file)) continue;
                    if (!file.StartsWith(target.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase)) continue;
                    process.Kill();
                    process.WaitForExit(5000);
                }
                catch
                {
                }
            }
        }

        public static string FormatSize(long bytes)
        {
            if (bytes >= 1024L * 1024 * 1024) return (bytes / 1024d / 1024d / 1024d).ToString("0.00") + " GB";
            if (bytes >= 1024L * 1024) return (bytes / 1024d / 1024d).ToString("0.0") + " MB";
            return (bytes / 1024d).ToString("0") + " KB";
        }
    }
}
