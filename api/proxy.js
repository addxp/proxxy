const express = require("express");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");
 
const app = express();
 
const TARGET = "https://embedplayapi.top";
 
// CORS — permite embed em qualquer origem
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  // Remove proteções que bloqueiam iframes
  res.removeHeader("X-Frame-Options");
  res.removeHeader("Content-Security-Policy");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
 
// Proxy reverso com interceptação da resposta HTML
app.use(
  "/",
createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  selfHandleResponse: true,
  decompress: true, // ← adiciona essa linha
  
  on: {
    // ... resto do código
  }
})
    on: {
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        const contentType = proxyRes.headers["content-type"] || "";
 
        // Remove headers que bloqueiam embed
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["content-security-policy"];
 
        // Só modifica respostas HTML
        if (!contentType.includes("text/html")) return responseBuffer;
 
        let html = responseBuffer.toString("utf8");
 
        // ─── BLOQUEIO DE ANÚNCIOS ──────────────────────────────────────────
 
        // Remove scripts de redes de anúncios comuns
        const adScriptPatterns = [
          /https?:\/\/(www\.)?(doubleclick\.net|googlesyndication\.com|adservice\.google\.[a-z]+)[^"']*/gi,
          /https?:\/\/[^"']*\/(ads?|adserver|adnetwork|banner|popup|popunder)[^"']*/gi,
          /https?:\/\/(cdn\.)?(exoclick|trafficjunky|plugrush|juicyads|hilltopads|adsterra|propellerads|adskeeper|revcontent|mgid|taboola|outbrain)[^"']*/gi,
        ];
 
        // Remove tags <script> de redes de anúncios
        html = html.replace(
          /<script[^>]*src=["'][^"']*?(doubleclick|googlesyndication|adservice|exoclick|trafficjunky|plugrush|juicyads|hilltopads|adsterra|propellerads|adskeeper|revcontent|mgid|taboola|outbrain|popads|popcash)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
          "<!-- ad script removed -->"
        );
 
        // Remove scripts inline de anúncios (pop-ups, redirects)
        html = html.replace(
          /<script[^>]*>([\s\S]*?(window\.open|pop\s*\(|popunder|popwindow|adblock|document\.write\s*\(\s*['"]<script)[\s\S]*?)<\/script>/gi,
          "<!-- ad inline removed -->"
        );
 
        // Remove iframes de anúncios
        html = html.replace(
          /<iframe[^>]*src=["'][^"']*?(doubleclick|googlesyndication|adservice|exoclick|trafficjunky|ads?\.)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi,
          "<!-- ad iframe removed -->"
        );
 
        // Remove divs com classes/ids típicos de anúncios
        html = html.replace(
          /<div[^>]*(id|class)=["'][^"']*(advertisement|banner-ad|ad-container|ad-wrapper|ads-slot|sponsored)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
          "<!-- ad div removed -->"
        );
 
        // ─── FORÇAR ALLOW EMBED ────────────────────────────────────────────
 
        // Injeta no <head> para garantir que o player funcione dentro de iframe
        const injectHead = `
  <meta http-equiv="X-Frame-Options" content="">
  <style>
    /* Remove overlays e banners de anúncio */
    [class*="ad-"], [id*="ad-"],
    [class*="banner"], [id*="banner"],
    [class*="popup"], [id*="popup"],
    [class*="overlay"]:not(.vjs-overlay),
    [class*="sponsor"] { display: none !important; }
  </style>`;
 
        html = html.replace(/<head>/i, `<head>${injectHead}`);
 
        return html;
      }),
    },
  })
);
 
module.exports = app;