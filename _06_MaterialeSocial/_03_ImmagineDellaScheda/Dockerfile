# Immagine minima della scheda Vast per il render del Materiale social (Ufficio 1.2 Planimetrie 3D).
# Solo il necessario al motore: Chrome, Node 22, ffmpeg, librerie grafiche, puppeteer-core e i file dei driver NVIDIA.
# Sulla scheda non si installa niente: il pacco si apre e il render parte.
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive NVIDIA_DRIVER_CAPABILITIES=all
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends curl wget ca-certificates xz-utils ffmpeg libvulkan1 libegl1 libgl1 libgles2 fonts-liberation unzip openssh-server bc \
 && curl -fsSL https://nodejs.org/dist/v22.21.1/node-v22.21.1-linux-x64.tar.xz | tar -xJ -C /opt \
 && ln -sf /opt/node-v22.21.1-linux-x64/bin/* /usr/local/bin/ \
 && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb \
 && apt-get install -y -qq /tmp/chrome.deb && rm /tmp/chrome.deb \
 && mkdir -p /opt/depthx && cd /opt/depthx && npm i --silent --no-audit --no-fund puppeteer-core@25.17.0 \
 && mkdir -p /etc/vulkan/icd.d /usr/share/glvnd/egl_vendor.d \
 && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' > /etc/vulkan/icd.d/nvidia_icd.json \
 && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json \
 && apt-get clean && rm -rf /var/lib/apt/lists/*
