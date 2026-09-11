# P8 UI Integration Report

One fixed Tutor overlay was added without changing the accepted page/navigation structure. It is available on Overview, Simulation, Forecast and Results; Settings remains unchanged.

The header shows AI Tutor, explanation-only role, current Rapid Warming scenario, 10:30 context time, selected B03, and P7 structured-state availability. Suggested questions change by page and status. Answers retain collapsible category/provider/context/evidence/validation metadata.

The component receives page, mode, selected-building ID, application state and semantic events as props; it builds context through the P7 provider abstraction. It contains no DOM scraper, runtime mutation callback or control function. Provider failure/timeout changes only Tutor output.

Browser automation passed Overview, Simulation, Forecast and Results in English and Chinese, created eight screenshots, refused a valve command without changing applied controls, and verified explicit cross-language response selection.

Screenshots are under `p8-screenshots/` as `p8-tutor-{overview|simulation|forecast|results}-{en|zh}.png`.
