using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace FeatherReborn.Setup
{
    internal sealed class SetupForm : Form
    {
        private readonly Color _background = Color.FromArgb(13, 15, 20);
        private readonly Color _panel = Color.FromArgb(24, 27, 34);
        private readonly Color _border = Color.FromArgb(47, 52, 64);
        private readonly Color _accent = Color.FromArgb(129, 105, 255);
        private readonly Color _muted = Color.FromArgb(156, 164, 181);

        private readonly TextBox _pathBox;
        private readonly Label _payloadLabel;
        private readonly Label _statusLabel;
        private readonly ProgressBar _progress;
        private readonly Button _installButton;
        private readonly Button _pickPayloadButton;
        private readonly CheckBox _launchCheck;
        private string _payloadPath;
        private bool _busy;

        public SetupForm()
        {
            Text = "Feather Reborn 安装程序";
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(700, 438);
            MinimumSize = new Size(716, 477);
            MaximumSize = new Size(716, 477);
            BackColor = _background;
            ForeColor = Color.White;
            Font = new Font("Microsoft YaHei UI", 9.5f, FontStyle.Regular, GraphicsUnit.Point);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            DoubleBuffered = true;
            try
            {
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch
            {
            }

            var iconBox = new PictureBox
            {
                Location = new Point(26, 22),
                Size = new Size(48, 48),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent
            };
            try
            {
                var icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (icon != null) iconBox.Image = icon.ToBitmap();
            }
            catch
            {
            }
            Controls.Add(iconBox);

            var title = new Label
            {
                Text = "FEATHER REBORN",
                Location = new Point(88, 20),
                AutoSize = true,
                Font = new Font("Microsoft YaHei UI", 18f, FontStyle.Bold, GraphicsUnit.Point),
                ForeColor = Color.White
            };
            Controls.Add(title);

            var subtitle = new Label
            {
                Text = "Minecraft 1.8.9  ·  安装程序 " + BuildInfo.Version,
                Location = new Point(91, 56),
                AutoSize = true,
                ForeColor = _muted
            };
            Controls.Add(subtitle);

            var line = new Panel
            {
                Location = new Point(26, 88),
                Size = new Size(648, 1),
                BackColor = _border
            };
            Controls.Add(line);

            AddLabel("安装位置", 26, 108);
            _pathBox = new TextBox
            {
                Location = new Point(26, 132),
                Size = new Size(518, 28),
                BackColor = _panel,
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Text = InstallerEngine.DefaultInstallDirectory
            };
            Controls.Add(_pathBox);

            var browse = CreateButton("浏览", 26, 0);
            browse.Location = new Point(554, 130);
            browse.Size = new Size(120, 32);
            browse.Click += (sender, args) => BrowseInstallDirectory();
            Controls.Add(browse);

            AddLabel("安装数据", 26, 180);
            _payloadLabel = new Label
            {
                Location = new Point(104, 181),
                Size = new Size(438, 22),
                AutoEllipsis = true,
                ForeColor = _muted,
                Text = "正在查找数据包..."
            };
            Controls.Add(_payloadLabel);

            _pickPayloadButton = CreateButton("选择文件", 554, 177);
            _pickPayloadButton.Size = new Size(120, 32);
            _pickPayloadButton.Click += (sender, args) => BrowsePayload();
            Controls.Add(_pickPayloadButton);

            var hint = new Label
            {
                Text = "需要下载 " + BuildInfo.PayloadFileName + (BuildInfo.PayloadSizeBytes > 0
                    ? "（" + InstallerEngine.FormatSize(BuildInfo.PayloadSizeBytes) + "）"
                    : string.Empty) + "，安装后无需联网启动。",
                Location = new Point(26, 208),
                Size = new Size(648, 22),
                ForeColor = Color.FromArgb(116, 124, 142)
            };
            Controls.Add(hint);

            var progressPanel = new Panel
            {
                Location = new Point(26, 248),
                Size = new Size(648, 10),
                BackColor = Color.FromArgb(38, 42, 52)
            };
            Controls.Add(progressPanel);
            _progress = new ProgressBar
            {
                Location = new Point(0, 0),
                Size = new Size(648, 10),
                Style = ProgressBarStyle.Continuous,
                Minimum = 0,
                Maximum = 100,
                Value = 0
            };
            progressPanel.Controls.Add(_progress);

            _statusLabel = new Label
            {
                Text = "准备安装",
                Location = new Point(26, 269),
                Size = new Size(648, 23),
                ForeColor = _muted
            };
            Controls.Add(_statusLabel);

            _launchCheck = new CheckBox
            {
                Text = "安装完成后启动 Feather Reborn",
                Location = new Point(26, 315),
                AutoSize = true,
                Checked = true,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            Controls.Add(_launchCheck);

            _installButton = CreateButton("安装", 0, 0);
            _installButton.Location = new Point(554, 366);
            _installButton.Size = new Size(120, 40);
            _installButton.BackColor = _accent;
            _installButton.Font = new Font("Microsoft YaHei UI", 10.5f, FontStyle.Bold, GraphicsUnit.Point);
            _installButton.Click += async (sender, args) => await InstallAsync();
            Controls.Add(_installButton);

            var close = CreateButton("取消", 0, 0);
            close.Location = new Point(424, 366);
            close.Size = new Size(120, 40);
            close.Click += (sender, args) => Close();
            Controls.Add(close);

            Load += (sender, args) => DetectPayload();
        }

        private void AddLabel(string text, int x, int y)
        {
            Controls.Add(new Label
            {
                Text = text,
                Location = new Point(x, y),
                AutoSize = true,
                ForeColor = Color.White
            });
        }

        private Button CreateButton(string text, int x, int y)
        {
            var button = new Button
            {
                Text = text,
                Location = new Point(x, y),
                Size = new Size(100, 32),
                FlatStyle = FlatStyle.Flat,
                BackColor = _panel,
                ForeColor = Color.White,
                Cursor = Cursors.Hand
            };
            button.FlatAppearance.BorderColor = _border;
            button.FlatAppearance.MouseOverBackColor = Color.FromArgb(38, 42, 52);
            return button;
        }

        private void DetectPayload()
        {
            var found = InstallerEngine.FindLocalPayload();
            if (!string.IsNullOrWhiteSpace(found))
            {
                SetPayload(found);
                return;
            }

            var url = InstallerEngine.ResolvePayloadUrl();
            _payloadLabel.Text = string.IsNullOrWhiteSpace(url)
                ? "未找到数据包，请选择文件"
                : "未找到本地数据包，将从下载地址获取";
            _statusLabel.Text = "准备安装";
        }

        private void SetPayload(string path)
        {
            _payloadPath = path;
            _payloadLabel.Text = path;
            _payloadLabel.ForeColor = Color.FromArgb(186, 196, 214);
            var length = 0L;
            try
            {
                length = new FileInfo(path).Length;
            }
            catch
            {
            }
            _statusLabel.Text = "数据包已选择" + (length > 0 ? " · " + InstallerEngine.FormatSize(length) : string.Empty);
        }

        private void BrowseInstallDirectory()
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "选择 Feather Reborn 安装位置";
                dialog.SelectedPath = _pathBox.Text;
                dialog.ShowNewFolderButton = true;
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    _pathBox.Text = dialog.SelectedPath;
                }
            }
        }

        private void BrowsePayload()
        {
            using (var dialog = new OpenFileDialog())
            {
                dialog.Title = "选择 Feather Reborn 安装数据包";
                dialog.Filter = "Feather Reborn 数据包 (*.zip)|*.zip|所有文件 (*.*)|*.*";
                dialog.CheckFileExists = true;
                var directory = AppDomain.CurrentDomain.BaseDirectory;
                dialog.InitialDirectory = Directory.Exists(directory) ? directory : string.Empty;
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    SetPayload(dialog.FileName);
                }
            }
        }

        private async Task InstallAsync()
        {
            if (_busy) return;

            if (string.IsNullOrWhiteSpace(_payloadPath) || !File.Exists(_payloadPath))
            {
                var url = InstallerEngine.ResolvePayloadUrl();
                if (string.IsNullOrWhiteSpace(url))
                {
                    BrowsePayload();
                    if (string.IsNullOrWhiteSpace(_payloadPath)) return;
                }
            }

            var target = _pathBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(target))
            {
                MessageBox.Show("请选择安装位置。", "Feather Reborn",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            _busy = true;
            SetControlsEnabled(false);
            _progress.Value = 0;
            _statusLabel.Text = "准备安装...";

            var progress = new Progress<InstallProgress>(value =>
            {
                _progress.Value = Math.Max(0, Math.Min(100, value.Percent));
                _statusLabel.Text = value.Status;
            });

            try
            {
                var options = new InstallOptions
                {
                    InstallDirectory = target,
                    PayloadPath = _payloadPath,
                    PayloadUrl = InstallerEngine.ResolvePayloadUrl(),
                    LaunchAfterInstall = _launchCheck.Checked
                };

                await Task.Run(() => InstallerEngine.InstallAsync(options, progress, CancellationToken.None));
                _statusLabel.Text = "安装完成";
                MessageBox.Show(
                    "Feather Reborn 1.8.9 已安装完成。\r\n\r\n" +
                    "以后请从桌面快捷方式启动。",
                    "安装完成",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                Close();
            }
            catch (Exception ex)
            {
                _statusLabel.Text = "安装失败";
                MessageBox.Show(ex.Message, "安装失败",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                _busy = false;
                SetControlsEnabled(true);
            }
        }

        private void SetControlsEnabled(bool enabled)
        {
            _pathBox.Enabled = enabled;
            _pickPayloadButton.Enabled = enabled;
            _installButton.Enabled = enabled;
            _launchCheck.Enabled = enabled;
            foreach (Control control in Controls)
            {
                if (control is Button && control != _installButton && control.Text == "取消")
                {
                    control.Enabled = enabled;
                }
            }
        }
    }
}
