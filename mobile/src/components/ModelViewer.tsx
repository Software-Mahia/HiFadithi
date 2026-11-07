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
      html, body { margin: 0; height: 100%; background: ${colors.ink}; overflow: hidden; }
      model-viewer { width: 100%; height: 100%; --poster-color: transparent; }
      .hint { position: absolute; bottom: 12px; width: 100%; text-align: center;
        color: rgba(255,255,255,.65); font: 12px -apple-system, system-ui, sans-serif; }
      #loader { position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px;
        background: ${colors.ink}; transition: opacity .45s ease; }
      #loader.hidden { opacity: 0; pointer-events: none; }
      .ring { width: 72px; height: 72px; border-radius: 50%;
        background: conic-gradient(#00B4C2 calc(var(--p, 0) * 1%), #2A2321 0);
        display: flex; align-items: center; justify-content: center; position: relative; }
      .ring::after { content: ""; position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%); width: 57px; height: 57px;
        border-radius: 50%; background: ${colors.ink}; }
      .pct { position: absolute; left: 0; right: 0; text-align: center;
        font: 700 12px system-ui, sans-serif; color: #F5EFEA; z-index: 1; }
      .cap { font: 500 12px system-ui, sans-serif; color: #9A8876; letter-spacing: .3px; }
    </style>
  </head>
  <body>
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
    <Box className="h-[340px] overflow-hidden rounded-[24px] bg-[#1B1413]" style={style}>
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
