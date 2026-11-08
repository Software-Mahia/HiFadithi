import type { StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { colors } from "../theme";
import { Box } from "@/components/ui/box";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function html(glbUrl: string) {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js"></script>
    <style>
      html, body { margin: 0; height: 100%; background: ${colors.museumStudio}; overflow: hidden; }
      .studio { position: absolute; inset: 0; overflow: hidden; background:
        radial-gradient(ellipse at 50% 30%, rgba(201,162,39,.12), transparent 43%),
        linear-gradient(180deg, #282522 0%, #171513 58%, #0E0D0C 100%); }
      .studio::before { content: ""; position: absolute; left: -20%; right: -20%; bottom: -32%; height: 62%;
        transform: perspective(420px) rotateX(58deg); transform-origin: center top;
        background: repeating-linear-gradient(90deg, rgba(243,235,221,.055) 0 1px, transparent 1px 78px),
          repeating-linear-gradient(0deg, rgba(243,235,221,.045) 0 1px, transparent 1px 54px); opacity: .55; }
      model-viewer { position: absolute; inset: 0; width: 100%; height: 100%; --poster-color: transparent; background: transparent; }
      .museum-label { position: absolute; left: 18px; top: 18px; color: rgba(243,235,221,.82);
        font: 600 10px system-ui, sans-serif; letter-spacing: 1.7px; z-index: 3; }
      .museum-label::after { content: ""; display: block; width: 30px; height: 2px; margin-top: 8px; background: #C9A227; }
      #loader { position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px;
        background: ${colors.museumStudio}; transition: opacity .45s ease; z-index: 4; }
      #loader.hidden { opacity: 0; pointer-events: none; }
      .ring { width: 72px; height: 72px; border-radius: 50%;
        background: conic-gradient(#00B4C2 calc(var(--p, 0) * 1%), #2A2321 0);
        display: flex; align-items: center; justify-content: center; position: relative; }
      .ring::after { content: ""; position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%); width: 57px; height: 57px;
        border-radius: 50%; background: ${colors.museumStudio}; }
      .pct { position: absolute; left: 0; right: 0; text-align: center;
        font: 700 12px system-ui, sans-serif; color: #F5EFEA; z-index: 1; }
      .cap { font: 500 12px system-ui, sans-serif; color: #9A8876; letter-spacing: .3px; }
    </style>
  </head>
  <body>
    <div class="studio"></div>
    <div class="museum-label">NATIONAL MUSEUM OF KENYA</div>
    <div id="loader">
      <div class="ring"><span class="pct" id="pct">0%</span></div>
      <span class="cap">Loading 3D model</span>
    </div>
    <model-viewer
      src="${esc(glbUrl)}"
      camera-controls
      auto-rotate
      auto-rotate-delay="1200"
      rotation-per-second="18deg"
      shadow-intensity="1"
      shadow-softness="0.85"
      exposure="1.05"
      tone-mapping="neutral"
      camera-orbit="35deg 72deg auto"
      min-camera-orbit="auto auto 55%"
      max-camera-orbit="auto auto 130%"
      environment-image="neutral"
      interaction-prompt="auto"
      alt="3D model of the artefact">
    </model-viewer>
    <div class="hint">Drag to rotate · Pinch to zoom</div>
    <script>
      (function () {
        const hook = () => {
          const V = customElements.get("model-viewer");
          if (V) V.meshoptDecoderLocation =
            "https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_decoder.js";
        };
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", hook, { once: true });
        } else {
          hook();
        }
        const loader = document.getElementById("loader");
        const pct = document.getElementById("pct");
        const ring = document.querySelector(".ring");
        let lastPct = -1;
        const update = (p) => {
          const v = Math.max(0, Math.min(1, p || 0));
          const r = Math.round(v * 100);
          ring.style.setProperty("--p", v * 100);
          if (r !== lastPct) { pct.textContent = r + "%"; lastPct = r; }
        };
        const done = () => {
          if (lastPct >= 0) update(1);
          loader.classList.add("hidden");
          setTimeout(() => loader.remove(), 600);
        };
        // model-viewer emits "progress" (detail.totalProgress 0..1) as it
        // streams and decodes the scene.
        const wire = (mv) => {
          if (!mv) return;
          mv.addEventListener("progress", (e) => update(e.detail && e.detail.totalProgress));
          const watch = () => mv.loaded ? done() : requestAnimationFrame(watch);
          requestAnimationFrame(watch);
        };
        if (customElements.get("model-viewer")) {
          wire(document.querySelector("model-viewer"));
        } else {
          customElements.whenDefined("model-viewer").then(() =>
            wire(document.querySelector("model-viewer")));
        }
      })();
    </script>
  </body>
</html>`;
}

export function ModelViewer({ glbUrl, style }: { glbUrl: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Box className="h-[340px] overflow-hidden rounded-[24px] border border-[#3D2E2B] bg-[#171513]" style={style}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: html(glbUrl) }}
        style={{ flex: 1, backgroundColor: colors.ink }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        startInLoadingState={false}
      />
    </Box>
  );
}
