using System;
using System.IO;
using System.Windows.Forms;

namespace FeatherReborn.Setup
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (args.Length > 0 && string.Equals(args[0], "/uninstall", StringComparison.OrdinalIgnoreCase))
            {
                Uninstaller.BeginUninstall();
                return;
            }

            if (args.Length > 0 && string.Equals(args[0], "/uninstall-run", StringComparison.OrdinalIgnoreCase))
            {
                Uninstaller.Run(args.Length > 1 ? args[1] : string.Empty);
                return;
            }

            if (args.Length > 0 && string.Equals(args[0], "/install", StringComparison.OrdinalIgnoreCase))
            {
                SilentInstall(args);
                return;
            }

            Application.Run(new SetupForm());
        }

        private static void SilentInstall(string[] args)
        {
            if (args.Length < 3)
            {
                Environment.ExitCode = 2;
                return;
            }

            var target = args[1];
            var payload = args[2];
            var launch = args.Length > 3 &&
                         string.Equals(args[3], "launch", StringComparison.OrdinalIgnoreCase);
            try
            {
                var options = new InstallOptions
                {
                    InstallDirectory = target,
                    PayloadPath = payload,
                    PayloadUrl = string.Empty,
                    LaunchAfterInstall = launch
                };
                InstallerEngine.InstallAsync(options, null, System.Threading.CancellationToken.None)
                    .GetAwaiter()
                    .GetResult();
                Environment.ExitCode = 0;
            }
            catch (Exception ex)
            {
                try
                {
                    Directory.CreateDirectory(target);
                    File.WriteAllText(Path.Combine(target, "install-error.log"), ex.ToString());
                }
                catch
                {
                }
                Environment.ExitCode = 1;
            }
        }
    }
}
