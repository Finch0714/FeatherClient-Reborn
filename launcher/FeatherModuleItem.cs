using System.ComponentModel;

namespace FeatherRebornLauncher;

public sealed class FeatherModuleItem : INotifyPropertyChanged
{
    private bool _visible = true;

    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Initial => string.IsNullOrWhiteSpace(Name) ? "?" : Name[..1].ToUpperInvariant();

    public bool Visible
    {
        get => _visible;
        set
        {
            if (_visible == value) return;
            _visible = value;
            OnPropertyChanged(nameof(Visible));
            OnPropertyChanged(nameof(Badge));
        }
    }

    public string Badge => Visible ? "显示" : "隐藏";

    public event PropertyChangedEventHandler PropertyChanged;

    private void OnPropertyChanged(string name)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }
}
