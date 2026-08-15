param([string]$Version = '0.29.29')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $projectRoot 'dist'
$downloadDir = Join-Path $projectRoot 'public\downloads'
$workDir = Join-Path $projectRoot '.build\windows-installer'
$stageDir = Join-Path $workDir 'payload'
$target = Join-Path $downloadDir "Altered-Windows-Setup-v$Version.exe"

if (-not (Test-Path -LiteralPath (Join-Path $distDir 'altered-standalone.html'))) {
  throw 'Run npm run build before building the Windows installer.'
}

New-Item -ItemType Directory -Force -Path $stageDir,$downloadDir | Out-Null
Get-ChildItem -LiteralPath $stageDir -Force | Remove-Item -Recurse -Force
Copy-Item -LiteralPath (Join-Path $distDir 'altered-standalone.html') -Destination (Join-Path $stageDir "Altered-v$Version.html")
Copy-Item -LiteralPath (Join-Path $distDir 'pdf.bundle.js') -Destination $stageDir
Copy-Item -LiteralPath (Join-Path $distDir 'pdf.worker.min.mjs') -Destination $stageDir
Copy-Item -LiteralPath (Join-Path $distDir 'tesseract.bundle.js') -Destination $stageDir
Copy-Item -LiteralPath (Join-Path $projectRoot 'INSTALL.md') -Destination (Join-Path $stageDir 'INSTALL.txt')
Copy-Item -LiteralPath (Join-Path $projectRoot 'RELEASE_NOTES.md') -Destination (Join-Path $stageDir 'RELEASE_NOTES.txt')

# ICO files may contain a PNG payload. Keeping the original artwork avoids a
# second icon source and preserves the moon/runic A at shortcut sizes.
$png = [IO.File]::ReadAllBytes((Join-Path $projectRoot 'public\icon-192.png'))
$icoPath = Join-Path $stageDir 'Altered.ico'
$stream = [IO.File]::Create($icoPath)
$writer = [IO.BinaryWriter]::new($stream)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
  $writer.Write([byte]192); $writer.Write([byte]192); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22)
  $writer.Write($png)
} finally { $writer.Dispose(); $stream.Dispose() }

$installScript = @'
param([string]$SourceDirectory)
$ErrorActionPreference = 'Stop'
$version = '__VERSION__'
$testRoot = $env:ALTERED_INSTALL_TEST_ROOT
$installDirectory = if ($testRoot) { Join-Path $testRoot 'Altered' } else { Join-Path $env:LOCALAPPDATA 'Altered' }
New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
Get-ChildItem -LiteralPath $installDirectory -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $SourceDirectory '*') -Destination $installDirectory -Recurse -Force

$shell = New-Object -ComObject WScript.Shell
$desktop = if ($testRoot) { Join-Path $testRoot 'Desktop' } else { $shell.SpecialFolders('Desktop') }
$startMenu = if ($testRoot) { Join-Path $testRoot 'StartMenu\Altered' } else { Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Altered' }
New-Item -ItemType Directory -Force -Path $desktop | Out-Null
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
$appFile = Join-Path $installDirectory 'Altered-v__VERSION__.html'
$appUrl = 'https://altered-ferocitus.ghostdaddy.chatgpt.site/'
$iconFile = Join-Path $installDirectory 'Altered.ico'
foreach ($shortcutPath in @((Join-Path $desktop 'Altered.lnk'),(Join-Path $startMenu 'Altered.lnk'))) {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
  $shortcut.Arguments = '"' + $appUrl + '"'
  $shortcut.WorkingDirectory = $installDirectory
  $shortcut.IconLocation = $iconFile + ',0'
  $shortcut.Description = 'Altered rules-aware transformation character sheet'
  $shortcut.Save()
}
$offlineShortcut = $shell.CreateShortcut((Join-Path $startMenu 'Altered Offline.lnk'))
$offlineShortcut.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
$offlineShortcut.Arguments = '"' + $appFile + '"'
$offlineShortcut.WorkingDirectory = $installDirectory
$offlineShortcut.IconLocation = $iconFile + ',0'
$offlineShortcut.Description = 'Altered offline fallback (live character refresh unavailable)'
$offlineShortcut.Save()

$uninstall = @"
`$desktop = (New-Object -ComObject WScript.Shell).SpecialFolders('Desktop')
Remove-Item -LiteralPath (Join-Path `$desktop 'Altered.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath '$startMenu' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Altered' -Recurse -Force -ErrorAction SilentlyContinue
Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -ArgumentList '/c','timeout /t 2 /nobreak >nul & rmdir /s /q ""$installDirectory""'
"@
$uninstallPath = Join-Path $installDirectory 'Uninstall-Altered.ps1'
Set-Content -LiteralPath $uninstallPath -Value $uninstall -Encoding UTF8
$uninstallShortcut = $shell.CreateShortcut((Join-Path $startMenu 'Uninstall Altered.lnk'))
$uninstallShortcut.TargetPath = 'powershell.exe'
$uninstallShortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $uninstallPath + '"'
$uninstallShortcut.IconLocation = $iconFile + ',0'
$uninstallShortcut.Save()

if (-not $testRoot) {
  $uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Altered'
  New-Item -Path $uninstallKey -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name DisplayName -Value 'Altered' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name DisplayVersion -Value $version -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name InstallLocation -Value $installDirectory -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name DisplayIcon -Value $iconFile -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name UninstallString -Value ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $uninstallPath + '"') -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null
  Start-Process -FilePath $appUrl
}
'@.Replace('__VERSION__',$Version)
Set-Content -LiteralPath (Join-Path $stageDir 'Install-Altered.ps1') -Value $installScript -Encoding UTF8
$installCommand = @'
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Altered.ps1" -SourceDirectory "%~dp0."
exit /b %errorlevel%
'@
Set-Content -LiteralPath (Join-Path $stageDir 'install.cmd') -Value $installCommand -Encoding ASCII

$files = Get-ChildItem -LiteralPath $stageDir -File | Sort-Object Name
$sourceEntries = ($files | ForEach-Object -Begin {$index=0} -Process { $line = "%FILE$index%="; $index++; $line }) -join "`r`n"
$stringEntries = ($files | ForEach-Object -Begin {$index=0} -Process { $line = "FILE$index=`"$($_.Name)`""; $index++; $line }) -join "`r`n"
$sedPath = Join-Path $workDir 'Altered-Setup.sed'
$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$stageDir\
[SourceFiles0]
$sourceEntries
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=Altered $Version was installed. A desktop shortcut is ready.
TargetName=$target
FriendlyName=Altered $Version Setup
AppLaunched=cmd.exe /c install.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=cmd.exe /c install.cmd
UserQuietInstCmd=cmd.exe /c install.cmd
$stringEntries
"@
Set-Content -LiteralPath $sedPath -Value $sed -Encoding ASCII
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
$process = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\iexpress.exe') -ArgumentList @('/N','/Q',$sedPath) -Wait -PassThru
if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $target)) { throw "IExpress failed to create $target" }
Get-Item -LiteralPath $target | Select-Object FullName,Length,LastWriteTime
