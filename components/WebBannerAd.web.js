import { useEffect, useRef } from "react";

const client = process.env.EXPO_PUBLIC_ADSENSE_CLIENT_ID;
const slot = process.env.EXPO_PUBLIC_ADSENSE_SLOT_ID;

export default function WebBannerAd({ style }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!client || !slot) return;

    let script = document.querySelector(`script[data-ad-client="${client}"]`);
    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      script.crossOrigin = "anonymous";
      script.setAttribute("data-ad-client", client);
      document.head.appendChild(script);
    }

    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
  }, []);

  if (!client || !slot) return null;

  return (
    <ins
      ref={containerRef}
      className="adsbygoogle"
      style={{ display: "block", ...style }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
