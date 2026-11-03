export const ANALYSIS_TARGETS = {
  "sec-hand": "hand",
  "sec-icm": "equity",
  "sec-nash": "nash",
} as const;

export type AnalysisView = (typeof ANALYSIS_TARGETS)[keyof typeof ANALYSIS_TARGETS];

let currentView: AnalysisView = "hand";

export function setAnalysisView(view: AnalysisView): void {
  currentView = view;
  document.body.dataset.analysisView = view;
  document.dispatchEvent(new Event("analysis-view-change"));
  document.querySelectorAll<HTMLElement>("[data-analysis-panel]").forEach((panel) => {
    panel.classList.toggle("hidden-analysis", panel.dataset.analysisPanel !== view);
  });
  document.querySelectorAll<HTMLButtonElement>(".analyze-jump [data-jump]").forEach((button) => {
    const target = button.dataset.jump as keyof typeof ANALYSIS_TARGETS;
    const selected = ANALYSIS_TARGETS[target] === view;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

export function initAnalysisView(): void {
  setAnalysisView(currentView);
  document.querySelectorAll<HTMLButtonElement>(".analyze-jump [data-jump], [data-analysis-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = (button.dataset.jump ?? button.dataset.analysisTarget) as keyof typeof ANALYSIS_TARGETS;
      const view = ANALYSIS_TARGETS[target];
      if (!view) return;
      setAnalysisView(view);
      document.querySelector(".analyze-jump")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });
}
