using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace FeatherRebornLauncher;

public partial class MainWindow : Window
{
    private static readonly Dictionary<string, string> ModuleNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["fps"] = "FPS",
        ["cps"] = "CPS",
        ["tps"] = "TPS",
        ["coordinates"] = "坐标",
        ["scoreboard"] = "计分板",
        ["potionEffects"] = "药水效果",
        ["bossBar"] = "Boss 血条",
        ["keystrokes"] = "按键显示",
        ["armorStatus"] = "装备状态",
        ["toggleSprint"] = "切换疾跑",
        ["ping"] = "延迟",
        ["direction"] = "方向",
        ["time"] = "时间",
        ["systemresources"] = "系统资源",
        ["serverAddress"] = "服务器地址",
        ["itemCounter"] = "物品计数",
        ["damageIndicator"] = "伤害指示",
        ["tablist"] = "Tab 列表",
        ["subtitles"] = "字幕",
        ["crosshair"] = "准星",
        ["nametags"] = "玩家名称",
        ["animations"] = "动画",
        ["customChat"] = "自定义聊天",
        ["chatOptions"] = "聊天",
        ["graphicsOptions"] = "画面",
        ["performanceOptions"] = "性能",
        ["cosmeticOptions"] = "装饰",
        ["reconnect"] = "自动重连",
        ["saturation"] = "饱和度",
        ["zoom"] = "缩放",
        ["waypoints"] = "路径点",
        ["inventory"] = "背包 HUD",
        ["itemInfo1"] = "物品信息",
        ["playtime"] = "游玩时间",
        ["comboDisplay"] = "连击",
        ["reachDisplay"] = "攻击距离",
        ["speedMeter"] = "速度计",
        ["mousestrokes"] = "鼠标显示",
        ["hitindicator"] = "命中指示",
        ["blockIndicator"] = "方块指示",
        ["timeChanger"] = "时间修改",
        ["weatherchanger"] = "天气修改",
        ["darkmode"] = "深色模式",
        ["autohidehud"] = "自动隐藏 HUD"
    };

    private readonly ObservableCollection<ModItem> _mods = new();
    private readonly ObservableCollection<FeatherModuleItem> _modules = new();
    private ICollectionView _modsView;
    private ICollectionView _modulesView;
    private string _gameRoot;
    private string _configPath;
    private LauncherConfig _config;
    private bool _loading;

    public MainWindow()
    {
        InitializeComponent();

        _gameRoot = LauncherService.FindGameRoot() ?? AppContext.BaseDirectory;
        _configPath = Path.Combine(_gameRoot, "launcher-config.json");
        _config = LauncherConfig.Load(_configPath);

        _modsView = CollectionViewSource.GetDefaultView(_mods);
        _modsView.Filter = ModFilter;
        _modulesView = CollectionViewSource.GetDefaultView(_modules);
        _modulesView.Filter = ModuleFilter;
        JarModsList.ItemsSource = _modsView;
        FeatherModulesList.ItemsSource = _modulesView;

        _loading = true;
        UsernameBox.Text = _config.Username;
        MemorySlider.Value = _config.MemoryMb;
        ExtraArgsBox.Text = _config.ExtraJvmArgs;
        KeepOpenCheck.IsChecked = _config.KeepLauncherOpen;
        GameDirBox.Text = _gameRoot;
        GamePathText.Text = _gameRoot;
        _loading = false;

        UpdateMemoryLabels(_config.MemoryMb);
        ShowPage("home");
        ShowModTab("jar");
        RefreshMods();
        RefreshModules();
        RefreshLogs();
        UpdateStatus();

        if (!File.Exists(Path.Combine(_gameRoot, "feather-versions", "1.8.9.json")))
        {
            SetStatus("未找到 1.8.9 游戏目录，请把启动器放到 Feather 根目录", true);
            LaunchButton.IsEnabled = false;
        }
        else if (LauncherService.IsGameRunning(_gameRoot))
        {
            SetStatus("游戏已经在运行");
        }
        else
        {
            SetStatus("就绪");
        }
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ButtonState != MouseButtonState.Pressed) return;
        try
        {
            DragMove();
        }
        catch
        {
        }
    }

    private void Minimize_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void Nav_Checked(object sender, RoutedEventArgs e)
    {
        if (sender is RadioButton { Tag: not null } button)
        {
            ShowPage(button.Tag.ToString() ?? "home");
        }
    }

    private void ShowPage(string page)
    {
        if (HomePage == null || ModsPage == null || SettingsPage == null || LogsPage == null) return;
        HomePage.Visibility = page == "home" ? Visibility.Visible : Visibility.Collapsed;
        ModsPage.Visibility = page == "mods" ? Visibility.Visible : Visibility.Collapsed;
        SettingsPage.Visibility = page == "settings" ? Visibility.Visible : Visibility.Collapsed;
        LogsPage.Visibility = page == "logs" ? Visibility.Visible : Visibility.Collapsed;
        if (page == "logs") RefreshLogs();
    }

    private void ModTab_Checked(object sender, RoutedEventArgs e)
    {
        if (sender is RadioButton { Tag: not null } button)
        {
            ShowModTab(button.Tag.ToString() ?? "jar");
        }
    }

    private void ShowModTab(string tab)
    {
        if (JarModsPanel == null || FeatherModsPanel == null) return;
        JarModsPanel.Visibility = tab == "jar" ? Visibility.Visible : Visibility.Collapsed;
        FeatherModsPanel.Visibility = tab == "feather" ? Visibility.Visible : Visibility.Collapsed;
    }

    private void GoSettings_Click(object sender, RoutedEventArgs e)
    {
        NavSettings.IsChecked = true;
    }

    private void UsernameBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (_loading || _config == null || UsernameBox == null) return;
        _config.Username = UsernameBox.Text;
    }

    private void MemorySlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
    {
        if (_loading || MemoryText == null || HomeMemoryText == null) return;
        var mb = (int)Math.Round(e.NewValue / 512.0) * 512;
        _config.MemoryMb = Math.Clamp(mb, 1024, 16384);
        UpdateMemoryLabels(_config.MemoryMb);
    }

    private void UpdateMemoryLabels(int mb)
    {
        if (MemoryText == null || HomeMemoryText == null) return;
        MemoryText.Text = $"{mb} MB";
        HomeMemoryText.Text = $"{mb} MB ({mb / 1024.0:0.#} GB)";
    }

    private void SaveSettings_Click(object sender, RoutedEventArgs e)
    {
        SaveSettings();
        SetStatus("设置已保存");
    }

    private void SaveSettings()
    {
        if (_config == null) return;
        var mb = (int)Math.Round(MemorySlider.Value / 512.0) * 512;
        _config.MemoryMb = Math.Clamp(mb, 1024, 16384);
        _config.Username = string.IsNullOrWhiteSpace(UsernameBox.Text) ? "Player" : UsernameBox.Text.Trim();
        _config.ExtraJvmArgs = ExtraArgsBox.Text.Trim();
        _config.KeepLauncherOpen = KeepOpenCheck.IsChecked == true;
        _config.Save(_configPath);
        UpdateMemoryLabels(_config.MemoryMb);
    }

    private async void Launch_Click(object sender, RoutedEventArgs e)
    {
        if (_config == null) return;
        SaveSettings();
        if (LauncherService.IsGameRunning(_gameRoot))
        {
            SetStatus("游戏已经在运行", true);
            return;
        }

        LaunchButton.IsEnabled = false;
        SetStatus("正在启动游戏...");
        try
        {
            var process = await Task.Run(() => LauncherService.Launch(_config, _gameRoot,
                message => Dispatcher.Invoke(() => SetStatus(message))));
            await Task.Delay(5000);
            if (process.HasExited)
            {
                SetStatus("游戏启动后退出，查看日志", true);
                RefreshLogs();
                NavLogs.IsChecked = true;
                var tail = string.Join(Environment.NewLine,
                    (LogBox.Text ?? "").Split(new[] { "\r\n", "\n" }, StringSplitOptions.None).TakeLast(30));
                MessageBox.Show(this,
                    "游戏启动后退出。\n\n最近日志：\n" + tail,
                    "启动失败", MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }
            SetStatus("游戏已启动");
            if (!_config.KeepLauncherOpen)
            {
                var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.4) };
                timer.Tick += (_, _) =>
                {
                    timer.Stop();
                    Close();
                };
                timer.Start();
            }
        }
        catch (Exception ex)
        {
            SetStatus("启动失败: " + ex.Message, true);
            MessageBox.Show(this, ex.ToString(), "启动失败", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            LaunchButton.IsEnabled = true;
        }
    }

    private void OpenFolder_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            Process.Start(new ProcessStartInfo("explorer.exe", $"\"{_gameRoot}\"") { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            SetStatus("无法打开目录: " + ex.Message, true);
        }
    }

    private void RefreshMods_Click(object sender, RoutedEventArgs e)
    {
        RefreshMods();
        RefreshModules();
        SetStatus("模组列表已刷新");
    }

    private void RefreshMods()
    {
        if (_gameRoot == null || JarModsList == null) return;
        _loading = true;
        try
        {
            _mods.Clear();
            var dir = Path.Combine(_gameRoot, "mods");
            if (Directory.Exists(dir))
            {
                var items = new List<ModItem>();
                foreach (var path in Directory.EnumerateFiles(dir))
                {
                    var file = Path.GetFileName(path);
                    var isJar = file.EndsWith(".jar", StringComparison.OrdinalIgnoreCase);
                    var isDisabledJar = file.EndsWith(".jar.disabled", StringComparison.OrdinalIgnoreCase);
                    if (!isJar && !isDisabledJar) continue;

                    var enabled = !isDisabledJar;
                    var baseName = file;
                    if (baseName.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase))
                        baseName = baseName[..^".disabled".Length];
                    if (baseName.EndsWith(".jar", StringComparison.OrdinalIgnoreCase))
                        baseName = baseName[..^".jar".Length];
                    if (baseName.EndsWith(".temp", StringComparison.OrdinalIgnoreCase))
                        baseName = baseName[..^".temp".Length];

                    items.Add(new ModItem
                    {
                        Name = baseName,
                        FileName = file,
                        FilePath = path,
                        Enabled = enabled,
                        Required = baseName.StartsWith("feather-1.8.9", StringComparison.OrdinalIgnoreCase),
                        Incompatible = baseName.Contains("MouseDelayFix", StringComparison.OrdinalIgnoreCase)
                    });
                }

                foreach (var item in items
                             .OrderByDescending(i => i.Required)
                             .ThenBy(i => i.Name, StringComparer.OrdinalIgnoreCase))
                {
                    _mods.Add(item);
                }
            }

            _modsView?.Refresh();
        }
        catch (Exception ex)
        {
            SetStatus("读取模组失败: " + ex.Message, true);
        }
        finally
        {
            _loading = false;
            UpdateStatus();
        }
    }

    private void RefreshModules()
    {
        if (_gameRoot == null || FeatherModulesList == null) return;
        _loading = true;
        try
        {
            _modules.Clear();
            var file = Path.Combine(_gameRoot, "feather", "configuration", "profiles", "default.json");
            var hidden = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var hiddenFile = Path.Combine(_gameRoot, "feather", "clickgui-hidden.json");
            if (File.Exists(hiddenFile) &&
                JsonNode.Parse(File.ReadAllText(hiddenFile)) is JsonArray hiddenArray)
            {
                foreach (var node in hiddenArray)
                {
                    var id = node?.GetValue<string>();
                    if (!string.IsNullOrWhiteSpace(id)) hidden.Add(id);
                }
            }
            if (File.Exists(file) &&
                JsonNode.Parse(File.ReadAllText(file)) is JsonObject root)
            {
                var items = new List<FeatherModuleItem>();
                foreach (var pair in root)
                {
                    if (pair.Value is not JsonObject module) continue;
                    items.Add(new FeatherModuleItem
                    {
                        Id = pair.Key,
                        Name = ModuleNames.TryGetValue(pair.Key, out var name) ? name : pair.Key,
                        Visible = !hidden.Contains(pair.Key)
                    });
                }

                foreach (var item in items.OrderBy(i => i.Name, StringComparer.OrdinalIgnoreCase))
                {
                    _modules.Add(item);
                }
            }

            _modulesView?.Refresh();
        }
        catch (Exception ex)
        {
            SetStatus("读取 Feather 模块失败: " + ex.Message, true);
        }
        finally
        {
            _loading = false;
            UpdateStatus();
        }
    }

    private bool ModFilter(object item)
    {
        if (item is not ModItem mod) return false;
        var query = SearchBox?.Text?.Trim();
        if (string.IsNullOrWhiteSpace(query)) return true;
        return mod.Name.Contains(query, StringComparison.OrdinalIgnoreCase) ||
               mod.FileName.Contains(query, StringComparison.OrdinalIgnoreCase);
    }

    private bool ModuleFilter(object item)
    {
        if (item is not FeatherModuleItem module) return false;
        var query = SearchBox?.Text?.Trim();
        if (string.IsNullOrWhiteSpace(query)) return true;
        return module.Name.Contains(query, StringComparison.OrdinalIgnoreCase) ||
               module.Id.Contains(query, StringComparison.OrdinalIgnoreCase);
    }

    private void Search_TextChanged(object sender, TextChangedEventArgs e)
    {
        _modsView?.Refresh();
        _modulesView?.Refresh();
    }

    private void ModToggle_Click(object sender, RoutedEventArgs e)
    {
        if (_loading) return;
        if (sender is not CheckBox { Tag: ModItem item } checkBox) return;
        if (item.Required)
        {
            checkBox.IsChecked = true;
            item.Enabled = true;
            SetStatus("Feather 核心 JAR 不能禁用", true);
            return;
        }

        var enabled = checkBox.IsChecked == true;
        if (enabled && item.Incompatible)
        {
            var result = MessageBox.Show(this,
                "MouseDelayFix 在当前签名/补丁环境下会导致启动崩溃，建议保持禁用。\n\n仍要启用吗？",
                "不兼容模组", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (result != MessageBoxResult.Yes)
            {
                checkBox.IsChecked = false;
                item.Enabled = false;
                return;
            }
        }
        try
        {
            LauncherService.SetModEnabled(item, enabled);
            SetStatus($"{item.Name} 已{(enabled ? "启用" : "禁用")}，下次启动生效");
        }
        catch (Exception ex)
        {
            item.Enabled = !enabled;
            checkBox.IsChecked = !enabled;
            SetStatus("切换模组失败: " + ex.Message, true);
        }
        _modsView?.Refresh();
        UpdateStatus();
    }

    private void ModuleToggle_Click(object sender, RoutedEventArgs e)
    {
        if (_loading) return;
        if (sender is not CheckBox { Tag: FeatherModuleItem item } checkBox) return;
        var enabled = checkBox.IsChecked == true;
        try
        {
            LauncherService.SetFeatherModuleVisible(_gameRoot, item.Id, enabled);
            item.Visible = enabled;
            SetStatus($"{item.Name} 已{(enabled ? "显示" : "隐藏")}在 ClickGUI");
        }
        catch (Exception ex)
        {
            item.Visible = !enabled;
            checkBox.IsChecked = !enabled;
            SetStatus("切换显示失败: " + ex.Message, true);
        }
        _modulesView?.Refresh();
        UpdateStatus();
    }

    private void RefreshLogs_Click(object sender, RoutedEventArgs e)
    {
        RefreshLogs();
    }

    private void RefreshLogs()
    {
        if (LogBox == null || _gameRoot == null) return;
        try
        {
            var file = Path.Combine(_gameRoot, "logs", "latest.log");
            if (!File.Exists(file))
            {
                LogBox.Text = "暂无 logs/latest.log";
                return;
            }
            var lines = File.ReadLines(file).TakeLast(400);
            LogBox.Text = string.Join(Environment.NewLine, lines);
            LogBox.ScrollToEnd();
        }
        catch (Exception ex)
        {
            LogBox.Text = "读取日志失败: " + ex.Message;
        }
    }

    private void UpdateStatus()
    {
        if (JarModsStatText != null)
            JarModsStatText.Text = $"{_mods.Count(m => m.Enabled)} / {_mods.Count}";
        if (ModulesStatText != null)
            ModulesStatText.Text = $"{_modules.Count(m => m.Visible)} / {_modules.Count}";
        if (JarModsCountText != null)
            JarModsCountText.Text = $"{_mods.Count(m => m.Enabled)} 启用 / {_mods.Count} 个 JAR";
        if (ModulesCountText != null)
            ModulesCountText.Text = $"{_modules.Count(m => m.Visible)} 显示 / {_modules.Count} 个模块";
    }

    private void SetStatus(string message, bool error = false)
    {
        if (GlobalStatusText == null) return;
        GlobalStatusText.Text = message;
        var brush = (TryFindResource(error ? "ErrorBrush" : "SuccessBrush") as Brush) ?? Brushes.Gray;
        if (StatusDot != null) StatusDot.Fill = brush;
        if (SidebarStatusDot != null) SidebarStatusDot.Fill = brush;
        if (SidebarStatusText != null) SidebarStatusText.Text = error ? "需要处理" : "就绪";
    }
}
