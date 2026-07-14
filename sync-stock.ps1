# sync-stock.ps1 — Sincroniza stock con el proveedor y publica si hay cambios.
# Registrado en el Programador de tareas de Windows (cada 3 días).
# Uso manual:  powershell -NoProfile -ExecutionPolicy Bypass -File sync-stock.ps1

$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\harri\Desktop\EMPRENDIMIENTO\ancestra-static'
$log  = Join-Path $repo 'sync-stock.log'

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $log -Value $line -Encoding utf8
}

Set-Location $repo
Log '--- inicio sync ---'

# Traer lo último para no pisar cambios remotos
git pull --rebase origin main *>&1 | Out-Null

$output = node update-stock.mjs 2>&1
Log ($output -join "`n")

$changed = git status --porcelain data/products.json
if ($changed) {
  git add data/products.json
  git commit -m "chore: sync automatico de stock con proveedor" *>&1 | Out-Null
  git push origin main *>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Log 'Cambios publicados (Vercel redespliega solo).' }
  else { Log "ERROR: git push fallo (exit $LASTEXITCODE)." }
} else {
  Log 'Sin cambios de stock.'
}
Log '--- fin sync ---'
