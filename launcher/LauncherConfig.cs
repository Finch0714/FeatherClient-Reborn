using System.Text.Json;
using System.IO;

namespace FeatherRebornLauncher;

public sealed class LauncherConfig
{
    public int MemoryMb { get; set; } = 4096;
    public string Username { get; set; } = "Player";
    public string ExtraJvmArgs { get; set; } = "";
    public bool KeepLauncherOpen { get; set; } = true;

    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true
    };

    public static LauncherConfig Load(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                var loaded = JsonSerializer.Deserialize<LauncherConfig>(File.ReadAllText(path));
                if (loaded != null)
                {
                    loaded.MemoryMb = Math.Clamp(loaded.MemoryMb, 1024, 16384);
                    if (string.IsNullOrWhiteSpace(loaded.Username)) loaded.Username = "Player";
                    return loaded;
                }
            }
        }
        catch
        {
        }
        return new LauncherConfig();
    }

    public void Save(string path)
    {
        try
        {
            File.WriteAllText(path, JsonSerializer.Serialize(this, Options));
        }
        catch
        {
        }
    }
}
