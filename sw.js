"use strict";
const CACHE_NAME = "taxi-offline-" + new URL(self.registration.scope).pathname + "-v7";
const ASSETS = ["index.html","manifest.webmanifest","icons/taxi-192.png","icons/taxi-512.png","icons/taxi-180.png"].map(path=>new URL(path,self.registration.scope).href);
const APP = new URL("index.html", self.registration.scope).href;
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(new Request(APP, {cache: "reload"}));
    if (!response.ok) throw new Error("Unable to cache taxi app");
    await cache.put(APP, response);
    await cache.addAll(ASSETS.filter(url=>url!==APP));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("message", event => {
  if (event.data === "CHECK_OFFLINE" && event.ports[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      event.ports[0].postMessage({ready: Boolean(await cache.match(APP))});
    })());
  }
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  const home = new URL(self.registration.scope);
  if (request.method !== "GET" || request.mode !== "navigate" ||
      url.origin !== home.origin ||
      (url.pathname !== home.pathname && url.pathname !== new URL(APP).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(APP);
    const refresh = fetch(request).then(async response => {
      if (response.ok) {
        await cache.put(APP, response.clone());
        return response;
      }
      return saved || response;
    }).catch(() => saved || new Response("Connect online once to prepare offline use.", {
      status: 503, headers: {"Content-Type": "text/plain"}
    }));
    event.waitUntil(refresh.then(() => {}));
    return saved || refresh;
  })());
});
