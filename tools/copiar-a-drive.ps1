# Copia el proyecto a la carpeta de Google Drive.
#
# El repo de git vive en Documents; Drive guarda solo los archivos, porque
# sincronizar la carpeta .git corrompe el historial.
#
# Uso, parado en la raiz del repo:   npm run drive
#                                    powershell -File tools\copiar-a-drive.ps1

$ErrorActionPreference = "Stop"

$src = (Resolve-Path "$PSScriptRoot\..").Path
$dst = "G:\Mi unidad\Vesti Tu Negocio"

if (-not (Test-Path $dst)) {
  Write-Host "No encuentro $dst" -ForegroundColor Red
  Write-Host "Verifica que Google Drive para escritorio este corriendo."
  exit 1
}

# /E copia subcarpetas; no se usa /MIR para no borrar nada que hayas
# agregado a mano en Drive.
robocopy $src $dst /E /XD ".git" "node_modules" /XF "*.ttf" "package-lock.json" /NFL /NDL /NJH /NP | Out-Null

if ($LASTEXITCODE -ge 8) {
  Write-Host "Robocopy fallo con codigo $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

$t = Get-ChildItem $dst -Recurse -File | Measure-Object -Sum Length
Write-Host "Drive actualizado: $($t.Count) archivos, $([math]::Round($t.Sum/1KB,1)) KB" -ForegroundColor Green
Write-Host $dst -ForegroundColor DarkGray
exit 0
