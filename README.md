# H000013 SST-Audio

HTML/browser preview of the auditory Stop-Signal Task built with `psyflow-web`.
The trial procedure, go/stop condition semantics, auditory stop-signal behavior, and adaptive SSD controller are aligned to local `T000013-sst-audio`; block/trial counts are shortened for preview.

## Layout

- `main.ts`: task orchestration
- `config/config.yaml`: declarative config
- `src/run_trial.ts`: trial logic
- `src/controller.ts`: adaptive SSD controller
- `src/utils.ts`: condition generation and block summary

## Run

From `e:\xhmhc\TaskBeacon\psyflow-web`:

```powershell
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:4173/?task=H000013-sst-audio
```
