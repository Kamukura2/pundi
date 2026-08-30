(() => {
  const allowed = new Set(["google","reddit","facebook","linkedin","whatsapp","friend","community","organic","direct","other"]);
  const sourceFrom = value => { const source=String(value||"").trim().toLowerCase(); return allowed.has(source)?source:"other"; };
  const params = new URLSearchParams(location.search);
  const source = sourceFrom(params.get("ref") || "direct");
  try { sessionStorage.setItem("pundi-acquisition-source", source); sessionStorage.setItem("pundi-acquisition-path", location.pathname || "/"); } catch {}
  const ctaFrom = link => { const path=(location.pathname||"/").replace(/^\//,"") || "homepage"; return path === "kalkulator-net-worth" ? "kalkulator-net-worth" : path || "homepage"; };
  document.querySelectorAll('a[href^="https://app.pundi.online"]').forEach(link => {
    const url = new URL(link.href); url.searchParams.set("ref", source); link.href=url.toString();
    link.dataset.acquisitionCta=ctaFrom(link);
    link.addEventListener("click", () => {
      const payload=JSON.stringify({action:"cta_click",event_type:"cta_click",source,landing_path:location.pathname||"/",cta:link.dataset.acquisitionCta});
      try {
        const sent = navigator.sendBeacon?.("/api/acquisition", new Blob([payload], {type:"application/json"}));
        if (!sent) fetch("/api/acquisition",{method:"POST",headers:{"Content-Type":"application/json"},body:payload,keepalive:true}).catch(()=>{});
      } catch {}
    });
  });
})();
