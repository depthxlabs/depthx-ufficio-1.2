param([string]$video, [string]$uscita)
# DepthX Linea 1.2: mosaico di controllo, un fotogramma ogni 2 secondi, 5 colonne.
$dur = [double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $video)
$n = [math]::Floor($dur / 2) + 1; $righe = [math]::Ceiling($n / 5)
$w = & ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 $video
$lato = if ([int]$w -gt 1500) { 384 } else { 216 }
& ffmpeg -v error -y -i $video -vf "fps=1/2,scale=$($lato):-1,tile=5x$($righe):padding=4:color=white" -frames:v 1 -update 1 $uscita
"mosaico: $n fotogrammi, durata $([math]::Round($dur,2)) s -> $uscita"
