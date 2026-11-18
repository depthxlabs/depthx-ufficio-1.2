#!/bin/bash
# DepthX Linea 1.2: preparazione di una macchina Vast.ai (immagine nvidia/cuda Ubuntu 22.04, NVIDIA_DRIVER_CAPABILITIES=all).
# Uso: bash vast_prepara.sh   (dalla cartella /root/lavoro/_00_Motore/strumenti, dopo aver estratto il pacco in /root/lavoro)
set -e
export DEBIAN_FRONTEND=noninteractive
cd "$(dirname "$0")"
apt-get update -qq
apt-get install -y -qq curl wget ca-certificates xz-utils ffmpeg libvulkan1 vulkan-tools libegl1 libgl1 libgles2 fonts-liberation >/dev/null
# Node 22 o piu' recente: puppeteer-core 25 e' un modulo ES che Node 20 non carica con require
if ! node -e "process.exit(+process.versions.node.split('.')[0] >= 22 ? 0 : 1)" 2>/dev/null; then curl -fsSL https://nodejs.org/dist/v22.21.1/node-v22.21.1-linux-x64.tar.xz | tar -xJ -C /opt; ln -sf /opt/node-v22.21.1-linux-x64/bin/* /usr/local/bin/; fi
if ! command -v google-chrome >/dev/null; then wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb; apt-get install -y -qq /tmp/chrome.deb >/dev/null; fi
# file di registro dei driver grafici NVIDIA, se il contenitore non li ha
L=/usr/lib/x86_64-linux-gnu
if [ ! -f /etc/vulkan/icd.d/nvidia_icd.json ] && [ ! -f /usr/share/vulkan/icd.d/nvidia_icd.json ] && [ -e $L/libGLX_nvidia.so.0 ]; then mkdir -p /etc/vulkan/icd.d; echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' > /etc/vulkan/icd.d/nvidia_icd.json; fi
if [ ! -f /usr/share/glvnd/egl_vendor.d/10_nvidia.json ] && [ -e $L/libEGL_nvidia.so.0 ]; then mkdir -p /usr/share/glvnd/egl_vendor.d; echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json; fi
[ -d node_modules/puppeteer-core ] || npm i --silent --no-audit --no-fund puppeteer-core@25.17.0 >/dev/null
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
echo "core: $(nproc)"
ls $L/libGLX_nvidia.so.0 $L/libEGL_nvidia.so.0 2>&1 | sed 's/^/driver grafico: /'
# prova dei flag: 60 fotogrammi ciascuno, si tiene il piu' veloce con la scheda NVIDIA
R=/root/lavoro; P='_01_FloorView/_02_TrilocaleFamiglia/codice/index.html?o=o'
for F in "--use-angle=vulkan --enable-features=Vulkan --disable-vulkan-surface --enable-gpu" "--use-angle=gl-egl --use-gl=angle --enable-gpu"; do
  rm -rf /tmp/provaGPU; s=$(date +%s.%N)
  FLAG_CHROME="$F" timeout 240 node registra.js $R "$P" /tmp/provaGPU orizzontale 600 659 2>&1 | grep -E "scheda grafica|ERRORE" || true
  e=$(date +%s.%N); n=$(ls /tmp/provaGPU/*.jpg 2>/dev/null | wc -l)
  echo "FLAG [$F]: $n fotogrammi in $(echo "$e - $s" | bc 2>/dev/null || python3 -c "print($e-$s)") s (avvio compreso)"
done
