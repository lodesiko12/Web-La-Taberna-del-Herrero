# Converts the black-on-white TJ logo into the cream, transparent-background mark
# the dark header and footer need.
#
#   powershell -File tools/make-cream-logo.ps1 -Source "C:\ruta\logo.png"
#
# Ink becomes cream, white becomes transparent, and mid greys keep partial alpha
# so the antialiased edges of the flame stay smooth.
#
# The pixel loop runs in compiled C# via LockBits — a PowerShell GetPixel/SetPixel
# loop over ~658k pixels takes minutes.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$Out,
  [int]$Size = 811
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) { throw "No existe: $Source" }

# $PSScriptRoot is empty when the script is invoked through a relative -File path,
# so derive the script directory from the invocation itself.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Out) { $Out = Join-Path $scriptDir "..\assets\img\tj-mark-cream.png" }

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;

public static class CreamLogo {
  public static void Run(string src, string dst, int size, byte cr, byte cg, byte cb) {
    using (var original = Image.FromFile(src))
    using (var scaled = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(scaled)) {
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.Clear(Color.White);
        g.DrawImage(original, 0, 0, size, size);
      }

      var rect = new Rectangle(0, 0, size, size);
      var data = scaled.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int bytes = Math.Abs(data.Stride) * size;
      var buf = new byte[bytes];
      System.Runtime.InteropServices.Marshal.Copy(data.Scan0, buf, 0, bytes);

      // BGRA order
      for (int i = 0; i < bytes; i += 4) {
        double lum = 0.299 * buf[i + 2] + 0.587 * buf[i + 1] + 0.114 * buf[i];
        int alpha = (int)Math.Round(255.0 - lum);
        if (alpha < 0) alpha = 0; else if (alpha > 255) alpha = 255;
        buf[i]     = cb;
        buf[i + 1] = cg;
        buf[i + 2] = cr;
        buf[i + 3] = (byte)alpha;
      }

      System.Runtime.InteropServices.Marshal.Copy(buf, 0, data.Scan0, bytes);
      scaled.UnlockBits(data);
      scaled.Save(dst, ImageFormat.Png);
    }
  }
}
'@

$outPath = [IO.Path]::GetFullPath($Out)
New-Item -ItemType Directory -Force (Split-Path -Parent $outPath) | Out-Null

# Cream = the --text token, oklch(0.94 0.008 80)
[CreamLogo]::Run((Resolve-Path $Source).Path, $outPath, $Size, 238, 233, 224)

"Escrito: $outPath  ({0:N0} KB)" -f ((Get-Item $outPath).Length / 1KB)
