import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdBannerProps {
  slot?: string;
  format?: string;
}

export default function AdBanner({
  slot = import.meta.env.VITE_ADSENSE_SLOT || "",
  format = "auto",
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet
    }
  }, []);

  if (!slot) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-gray-900 flex items-center justify-center text-xs text-gray-500 border-t border-gray-800">
        광고 배너 영역
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 flex items-center justify-center border-t border-gray-800">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={
          import.meta.env.VITE_ADSENSE_CLIENT || "ca-pub-XXXXXXXXXXXXXXXX"
        }
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        ref={adRef}
      />
    </div>
  );
}
