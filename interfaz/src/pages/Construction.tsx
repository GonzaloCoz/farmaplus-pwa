import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import OneContext from "anatomy-figures/one-context";
import { useTheme } from "@/hooks/useTheme";
import { getTabMetaForPath } from "@/config/navigation";

const CLEAN_FIGURE_CSS = `
  .gk-doc-plate-corners,
  .gk-doc-legend,
  .gk-stage-head,
  .gk-face-text {
    display: none !important;
  }
  .gk-halo {
    opacity: 0.35 !important;
  }
  .fig11-halo {
    opacity: 0.45 !important;
  }
  .gk.gk-embed,
  .gk-doc-box,
  .gk-doc-plate,
  .gk-doc-plate[data-framed] {
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    border-radius: 0 !important;
  }
`;

interface ConstructionProps {
  titleOverride?: string;
}

export default function Construction({ titleOverride }: ConstructionProps = {}) {
  const { theme } = useTheme();
  const location = useLocation();
  const figureRef = useRef<HTMLDivElement>(null);

  const { title: routeTitle } = getTabMetaForPath(location.pathname);
  const title = titleOverride || routeTitle;

  useEffect(() => {
    const shadow = figureRef.current?.shadowRoot;
    if (!shadow) return;

    if ("adoptedStyleSheets" in shadow && typeof CSSStyleSheet !== "undefined") {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CLEAN_FIGURE_CSS);
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
    } else {
      const styleEl = document.createElement("style");
      styleEl.textContent = CLEAN_FIGURE_CSS;
      shadow.appendChild(styleEl);
    }
  }, [theme]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-3">
      <OneContext
        ref={figureRef}
        theme={theme}
        tokens={{ "--anatomy-card": "var(--surface-3)" }}
        className="w-full max-w-[720px]"
      />
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground text-xs gap-1.5">
        <span className="font-semibold text-foreground text-sm">
          {title} está en construcción
        </span>
        <span className="text-muted-foreground text-xs">
          Estamos trabajando en esta herramienta para que esté disponible muy pronto.
        </span>
      </div>
    </div>
  );
}
