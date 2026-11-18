# DepthX Linea 1.2: coda di resa, un video alla volta. Legge coda.txt a ogni giro (si possono aggiungere lavori mentre gira).
# Riga di coda.txt: id|pagina relativa con parametri|orizzontale o verticale|percorso del video mp4
$R = 'C:\Users\Administrator\Desktop\_24_Linea1.2_FloorViewEUnfold'
$S = "$R\_00_Motore\strumenti"; $log = "$S\coda.log"
function scrivi($m) { "$(Get-Date -f 'yyyy-MM-dd HH:mm:ss') $m" | Out-File -Append -Encoding utf8 $log }
scrivi "coda avviata, pid $PID"
$scartati = @{}
while ($true) {
  $righe = Get-Content "$S\coda.txt" | Where-Object { $_ -match '\|' }
  $lavoro = $null
  foreach ($riga in $righe) { $c = $riga.Split('|'); if (-not (Test-Path $c[3]) -and -not $scartati[$c[0]]) { $lavoro = $c; break } }
  if (-not $lavoro) {
    if (-not $vuotaDa) { $vuotaDa = Get-Date; scrivi 'coda vuota, in attesa di nuovi lavori' }
    if (((Get-Date) - $vuotaDa).TotalHours -gt 4 -or (Test-Path "$S\FERMA.txt")) { scrivi 'coda chiusa'; break }
    Start-Sleep 120; continue
  }
  $vuotaDa = $null
  $id, $pagina, $modo, $video = $lavoro
  $fot = "$R\_00_Motore\_fotogrammi\$id"; New-Item -ItemType Directory -Force $fot, (Split-Path $video) | Out-Null
  for ($k = 1; $k -le 4 -and -not (Test-Path "$fot\COMPLETO.txt"); $k++) {
    while ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory -lt 1572864) { Start-Sleep 60 }
    scrivi "$id registrazione, tentativo $k"
    & node "$S\registra.js" $R $pagina $fot $modo *>> "$S\reg_$id.log"
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*puppeteer_dev_chrome_profile*' } | ForEach-Object { try { if ((Get-Process -Id $_.ProcessId).ProcessorAffinity -eq 0xF0) { Stop-Process -Id $_.ProcessId -Force } } catch {} }
  }
  if (-not (Test-Path "$fot\COMPLETO.txt")) { scrivi "$id NON COMPLETATO dopo 4 tentativi"; $scartati[$id] = 1; continue }
  $n = [int](Get-Content "$fot\COMPLETO.txt")
  $sc = if ($modo -eq 'verticale') { '1080:1920' } else { '1920:1080' }
  scrivi "$id codifica di $n fotogrammi"
  & ffmpeg -v error -y -framerate 60 -i "$fot\%05d.jpg" -vf "scale=$($sc):flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.2 -r 60 -threads 4 -an -movflags +faststart $video *>> $log
  $mos = Join-Path (Split-Path $video) ("mosaico_" + $modo + ".jpg")
  & powershell -NoProfile -File "$S\mosaico.ps1" $video $mos *>> $log
  scrivi "$id FATTO: $video"
}

