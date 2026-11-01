using System.Diagnostics;
using System.IO.Compression;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.IO;
using System.Threading;

namespace FeatherRebornLauncher;

public static class LauncherService
{
    private static readonly string[] CefRequired =
    {
        "icudtl.dat",
        "resources.pak",
        "snapshot_blob.bin",
        "v8_context_snapshot.bin",
        Path.Combine("locales", "en-US.pak")
    };

    public static string FindGameRoot()
    {
        var candidates = new List<string>();
        void Add(string path)
        {
            if (!string.IsNullOrWhiteSpace(path)) candidates.Add(Path.GetFullPath(path));
        }

        Add(AppContext.BaseDirectory);
        Add(Directory.GetCurrentDirectory());
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 6 && dir != null; i++)
        {
            Add(dir.FullName);
            dir = dir.Parent;
        }

        return candidates.Distinct(StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(path => File.Exists(Path.Combine(path, "feather-versions", "1.8.9.json")));
    }

    public static bool IsGameRunning(string root)
    {
        foreach (var process in Process.GetProcessesByName("javaw"))
        {
            try
            {
                var file = process.MainModule?.FileName;
                if (!string.IsNullOrWhiteSpace(file) &&
                    file.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            catch
            {
            }
        }
        return false;
    }

    public static Process Launch(LauncherConfig config, string root, Action<string> status)
    {
        var java = Path.Combine(root, "jre", "jre8u332b09-windows-x64", "bin", "javaw.exe");
        if (!File.Exists(java))
        {
            throw new FileNotFoundException("找不到 javaw.exe。请确认启动器位于 Feather 游戏目录内。", java);
        }

        var modsDir = Path.Combine(root, "mods");
        if (Directory.Exists(modsDir))
        {
            var mouseFix = Directory.EnumerateFiles(modsDir, "*MouseDelayFix*.jar")
                .FirstOrDefault(path => !path.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase));
            if (mouseFix != null)
            {
                throw new InvalidOperationException(
                    "MouseDelayFix 已启用，它会与当前签名/补丁环境冲突并导致启动崩溃。请先在模组页禁用它。");
            }
        }

        var natives = Path.Combine(root, "versions", "1.8.9", "natives-combined");
        status("检查 CEF 运行库...");
        EnsureCefFiles(root, natives);

        status("检查本地 UI 服务...");
        EnsureLocalUi(root, status);

        status("构建启动参数...");
        var classpath = BuildClasspath(root);
        var args = new List<string>
        {
            $"-Xmx{Math.Clamp(config.MemoryMb, 1024, 16384)}M",
            "-Xms512M",
            $"-Djava.library.path={natives}",
            $"-Dorg.lwjgl.librarypath={natives}",
            "-Dfml.ignoreInvalidMinecraftCertificates=true",
            "-Dfml.ignorePatchDiscrepancies=true"
        };

        if (!string.IsNullOrWhiteSpace(config.ExtraJvmArgs))
        {
            args.AddRange(SplitArguments(config.ExtraJvmArgs));
        }

        args.Add("-cp");
        args.Add(string.Join(";", classpath));
        args.Add("FeatherDirectLaunch");
        args.Add("--username");
        args.Add(string.IsNullOrWhiteSpace(config.Username) ? "Player" : config.Username.Trim());
        args.Add("--version");
        args.Add("1.8.9-feather");
        args.Add("--gameDir");
        args.Add(root);
        args.Add("--assetsDir");
        args.Add(Path.Combine(root, "assets"));
        args.Add("--assetIndex");
        args.Add("1.8.9-feather-game");
        args.Add("--uuid");
        args.Add("00000000000000000000000000000000");
        args.Add("--accessToken");
        args.Add("0");
        args.Add("--userProperties");
        args.Add("{}");
        args.Add("--userType");
        args.Add("legacy");
        args.Add("--versionType");
        args.Add("feather");
        args.Add("--tweakClass");
        args.Add("net.minecraftforge.fml.common.launcher.FMLTweaker");
        args.Add("--tweakClass");
        args.Add("org.spongepowered.asm.launch.MixinTweaker");
        args.Add("--mixin");
        args.Add("mixins.feather.json");
        args.Add("--mixin.config");
        args.Add("mixins.feather.core.json");

        var startInfo = new ProcessStartInfo
        {
            FileName = java,
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = false
        };
        foreach (var arg in args)
        {
            startInfo.ArgumentList.Add(arg);
        }
        startInfo.Environment["FEATHER_TEST"] = "1";
        startInfo.Environment["FEATHER_LOCAL_TEST"] = "1";
        startInfo.Environment["FEATHER_DEBUG"] = "1";

        var process = Process.Start(startInfo);
        if (process == null)
        {
            throw new InvalidOperationException("无法创建 Minecraft 进程。");
        }
        status("游戏进程已启动");
        return process;
    }

    public static void SetModEnabled(ModItem item, bool enabled)
    {
        var path = item.FilePath;
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            throw new FileNotFoundException("模组文件不存在。", path);
        }

        if (enabled && path.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase))
        {
            var target = path[..^".disabled".Length];
            if (File.Exists(target))
            {
                throw new IOException("目标文件已存在：" + target);
            }
            File.Move(path, target);
            item.FilePath = target;
            item.FileName = Path.GetFileName(target);
        }
        else if (!enabled && !path.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase))
        {
            var target = path + ".disabled";
            if (File.Exists(target))
            {
                throw new IOException("目标文件已存在：" + target);
            }
            File.Move(path, target);
            item.FilePath = target;
            item.FileName = Path.GetFileName(target);
        }

        item.Enabled = enabled;
    }

    public static void SetFeatherModuleVisible(string root, string id, bool visible)
    {
        var file = Path.Combine(root, "feather", "clickgui-hidden.json");
        var hidden = new List<string>();
        try
        {
            if (File.Exists(file))
            {
                var array = JsonNode.Parse(File.ReadAllText(file)) as JsonArray;
                if (array != null)
                {
                    hidden = array.Select(node => node?.GetValue<string>())
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .ToList();
                }
            }
        }
        catch
        {
            hidden = new List<string>();
        }

        hidden.RemoveAll(value => string.Equals(value, id, StringComparison.OrdinalIgnoreCase));
        if (!visible)
        {
            hidden.Add(id);
        }
        hidden = hidden.Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var temp = file + ".launcher.tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(hidden, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temp, file, true);
    }

    private static void EnsureCefFiles(string root, string natives)
    {
        var missing = CefRequired.Where(item => !File.Exists(Path.Combine(natives, item))).ToArray();
        if (missing.Length == 0) return;

        var cefJar = Path.Combine(root, "libraries", "native", "net", "digitalingot", "cef_binary",
            "103.0.0", "cef_binary-103.0.0+geeea43e-windows64.jar");
        if (!File.Exists(cefJar))
        {
            throw new FileNotFoundException("CEF 运行库缺失，且找不到恢复包。", cefJar);
        }

        Directory.CreateDirectory(natives);
        using var zip = ZipFile.OpenRead(cefJar);
        foreach (var entry in zip.Entries)
        {
            if (string.IsNullOrEmpty(entry.Name) ||
                entry.FullName.StartsWith("META-INF/", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var target = Path.Combine(natives, entry.FullName.Replace('/', '\\'));
            if (File.Exists(target)) continue;
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            entry.ExtractToFile(target, true);
        }
    }

    private static List<string> BuildClasspath(string root)
    {
        var classpath = new List<string> { Path.Combine(root, "bootstrap") };
        var versionFile = Path.Combine(root, "feather-versions", "1.8.9.json");
        var rootNode = JsonNode.Parse(File.ReadAllText(versionFile)) as JsonObject;
        var libraries = rootNode?["libraries"] as JsonArray;
        if (libraries == null)
        {
            throw new InvalidDataException("无法解析 feather-versions/1.8.9.json");
        }

        foreach (var library in libraries)
        {
            if (library == null || !IsLibraryAllowed(library)) continue;
            var name = library["name"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(name)) continue;
            var path = Path.Combine(root, "libraries", "java", name.Replace('/', '\\'));
            if (File.Exists(path)) classpath.Add(path);
        }
        return classpath;
    }

    private static bool IsLibraryAllowed(JsonNode library)
    {
        var rules = library["rules"] as JsonArray;
        if (rules == null) return true;
        var allowed = false;
        foreach (var rule in rules)
        {
            var osName = rule?["os"]?["name"]?.GetValue<string>();
            var matchesOs = string.IsNullOrWhiteSpace(osName) ||
                            osName.Equals("windows", StringComparison.OrdinalIgnoreCase);
            if (!matchesOs) continue;

            var action = rule?["action"]?.GetValue<string>();
            if (string.Equals(action, "allow", StringComparison.OrdinalIgnoreCase)) allowed = true;
            else if (string.Equals(action, "disallow", StringComparison.OrdinalIgnoreCase)) allowed = false;
        }
        return allowed;
    }

    private static void EnsureLocalUi(string root, Action<string> status)
    {
        if (IsPortOpen(4200))
        {
            status("本地 UI 已在运行");
            return;
        }

        var server = Path.Combine(root, "local-ui-server.js");
        if (!File.Exists(server))
        {
            throw new FileNotFoundException("找不到 local-ui-server.js。", server);
        }

        var node = FindNode(root) ?? throw new FileNotFoundException(
            "找不到 Node.js。请安装 Node.js，或确保 node.exe 在 PATH 中。");
        var startInfo = new ProcessStartInfo
        {
            FileName = node,
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add(server);
        Process.Start(startInfo);

        for (var i = 0; i < 24; i++)
        {
            Thread.Sleep(250);
            if (IsPortOpen(4200))
            {
                status("本地 UI 已就绪");
                return;
            }
        }
        throw new TimeoutException("本地 UI 服务未能在 6 秒内启动。");
    }

    private static bool IsPortOpen(int port)
    {
        try
        {
            using var client = new TcpClient();
            var task = client.ConnectAsync("127.0.0.1", port);
            if (!task.Wait(350)) return false;
            return client.Connected;
        }
        catch
        {
            return false;
        }
    }

    private static string FindNode(string root)
    {
        var bundled = Path.Combine(root, "node", "node.exe");
        if (File.Exists(bundled)) return bundled;

        var direct = new[]
        {
            @"C:\Program Files\nodejs\node.exe",
            @"C:\Program Files (x86)\nodejs\node.exe"
        };
        foreach (var path in direct)
        {
            if (File.Exists(path)) return path;
        }

        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = "where.exe",
                Arguments = "node",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            };
            using var process = Process.Start(startInfo);
            if (process != null)
            {
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit(1000);
                var first = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                    .FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(first) && File.Exists(first)) return first;
            }
        }
        catch
        {
        }
        return null;
    }

    private static IEnumerable<string> SplitArguments(string text)
    {
        var current = new StringBuilder();
        var inQuotes = false;
        foreach (var ch in text)
        {
            if (ch == '"')
            {
                inQuotes = !inQuotes;
                continue;
            }
            if (char.IsWhiteSpace(ch) && !inQuotes)
            {
                if (current.Length > 0)
                {
                    yield return current.ToString();
                    current.Clear();
                }
                continue;
            }
            current.Append(ch);
        }
        if (current.Length > 0) yield return current.ToString();
    }
}
