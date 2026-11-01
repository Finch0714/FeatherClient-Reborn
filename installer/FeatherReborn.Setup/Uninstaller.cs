using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace FeatherReborn.Setup
{
    internal static class Uninstaller
    {
        public static void BeginUninstall()
        {
            var target = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            var answer = MessageBox.Show(
                "将要删除以下目录及其中所有存档、设置和截图：\r\n\r\n" + target +
                "\r\n\r\n确定卸载 Feather Reborn 吗？",
                "卸载 Feather Reborn",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2);
            if (answer != DialogResult.Yes) return;

            var temp = Path.Combine(
                Path.GetTempPath(),
                "FeatherReborn-Uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
            File.Copy(Application.ExecutablePath, temp, true);
            Process.Start(new ProcessStartInfo
            {
                FileName = temp,
                Arguments = "/uninstall-run \"" + target + "\"",
                UseShellExecute = true
            });
            Application.Exit();
        }

        public static void Run(string target)
        {
            if (string.IsNullOrWhiteSpace(target)) return;
            target = Path.GetFullPath(target).TrimEnd('\\');
            try
            {
                InstallerEngine.KillProcessesIn(target);
                InstallerEngine.RemoveShortcuts();
                InstallerEngine.RemoveUninstallEntry();

                for (var attempt = 0; attempt < 12; attempt++)
                {
                    try
                    {
                        if (Directory.Exists(target)) Directory.Delete(target, true);
                        break;
                    }
                    catch
                    {
                        System.Threading.Thread.Sleep(500);
                    }
                }

                if (Directory.Exists(target))
                {
                    MessageBox.Show(
                        "部分文件未能删除。请关闭游戏和资源管理器后重试，或手动删除：\r\n\r\n" + target,
                        "卸载未完全完成",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                    return;
                }

                MessageBox.Show("Feather Reborn 已卸载。", "卸载完成",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("卸载失败：" + ex.Message, "Feather Reborn",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
