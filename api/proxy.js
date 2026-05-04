const express = require("express");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");

const app = express();

const TARGET = "https://embedplayapi.top";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.removeHeader("X-Frame-Options");
  res.removeHeader("Content-Security-Policy");
  // Remove Accept-Encoding para forçar resposta sem compressão
  delete req.headers["accept-encoding"];
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(
  "/",
  createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    selfHandleResponse: true,

    on: {
      proxyReq: (proxyReq) => {
        // Remove encoding para receber HTML puro
        proxyReq.removeHeader("accept-encoding");
      },
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        const contentType = proxyRes.headers["content-type"] || "";

        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["content-security-policy"];

        if (!contentType.includes("text/html")) return responseBuffer;

        let html = responseBuffer.toString("utf8");

        html = html.replace(
          /<script[^>]*src=["'][^"']*?(doubleclick|googlesyndication|adservice|exoclick|trafficjunky|plugrush|juicyads|hilltopads|adsterra|propellerads|adskeeper|revcontent|mgid|taboola|outbrain|popads|popcash)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
          "<!-- ad script removed -->"
        );

        html = html.replace(
          /<script[^>]*>([\s\S]*?(window\.open|pop\s*\(|popunder|popwindow|adblock|document\.write\s*\(\s*['"]<script)[\s\S]*?)<\/script>/gi,
          "<!-- ad inline removed -->"
        );

        html = html.replace(
          /<iframe[^>]*src=["'][^"']*?(doubleclick|googlesyndication|adservice|exoclick|trafficjunky|ads?\.)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi,
          "<!-- ad iframe removed -->"
        );

        html = html.replace(
          /<div[^>]*(id|class)=["'][^"']*(advertisement|banner-ad|ad-container|ad-wrapper|ads-slot|sponsored)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
          "<!-- ad div removed -->"
        );

        const injectHead = `
  <meta http-equiv="X-Frame-Options" content="">
  <style>
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