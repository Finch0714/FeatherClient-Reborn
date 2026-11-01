using System.ComponentModel;

namespace FeatherRebornLauncher;

public sealed class ModItem : INotifyPropertyChanged
{
    private bool _enabled;

    public string Name { get; set; } = "";
    public string FileName { get; set; } = "";
    public string FilePath { get; set; } = "";
    public bool Required { get; set; }
    public bool Incompatible { get; set; }
    public bool CanToggle => !Required;
    public string Initial => string.IsNullOrWhiteSpace(Name) ? "?" : Name[..1].ToUpperInvariant();

    public bool Enabled
    {
        get => _enabled;
        set
        {
            if (_enabled == value) return;
            _enabled = value;
            OnPropertyChanged(nameof(Enabled));
            OnPropertyChanged(nameof(Badge));
        }
    }

    public string Badge => Incompatible ? "不兼容" : (Required ? "必需" : (Enabled ? "已启用" : "已禁用"));

    public event PropertyChangedEventHandler PropertyChanged;

    private void OnPropertyChanged(string name)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }
}
