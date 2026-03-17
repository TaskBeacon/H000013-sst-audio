import {
  BlockUnit,
  StimBank,
  SubInfo,
  TaskSettings,
  TrialBuilder,
  count_down,
  mountTaskApp,
  next_trial_id,
  parsePsyflowConfig,
  reset_trial_counter,
  type CompiledTrial,
  type Resolvable,
  type RuntimeView,
  type StimRef,
  type StimSpec,
  type TrialSnapshot
} from "psyflow-web";

import configText from "./config/config.yaml?raw";
import { Controller } from "./src/controller";
import { run_trial } from "./src/run_trial";
import { generate_sst_conditions, summarizeBlock } from "./src/utils";

const instructionVoiceAsset = new URL("./assets/instruction_text_voice.mp3", import.meta.url).href;

function buildWaitTrial(
  meta: { trial_id: string; condition: string; trial_index: number },
  blockId: string | null,
  unitLabel: string,
  stimInputs: Array<Resolvable<StimRef | StimSpec | null>>
): CompiledTrial {
  const trial = new TrialBuilder({
    trial_id: meta.trial_id,
    block_id: blockId,
    trial_index: meta.trial_index,
    condition: meta.condition
  });
  trial.unit(unitLabel).addStim(...stimInputs).waitAndContinue();
  return trial.build();
}

export async function run(root: HTMLElement): Promise<void> {
  const parsed = parsePsyflowConfig(configText, import.meta.url);
  const settings = TaskSettings.from_dict(parsed.task_config);
  const subInfo = new SubInfo(parsed.subform_config);
  const stimBank = new StimBank(parsed.stim_config);
  const controller = Controller.from_dict(parsed.controller_config);

  settings.triggers = parsed.trigger_config;
  settings.controller = parsed.controller_config;

  if (settings.voice_enabled) {
    stimBank.convert_to_voice("instruction_text", {
      voice: String(settings.voice_name ?? "zh-CN-YunyangNeural"),
      rate: 1,
      assetFiles: {
        instruction_text: instructionVoiceAsset
      },
      fallbackToSpeech: false
    });
  }

  await mountTaskApp({
    root,
    task_id: "H000013-sst-audio",
    task_name: "Stop-Signal Task (SST-Audio)",
    task_description: "HTML preview aligned to local psyflow SST-Audio procedure and parameters.",
    settings,
    subInfo,
    stimBank,
    buildTrials: (): CompiledTrial[] => {
      reset_trial_counter();

      const compiledTrials: CompiledTrial[] = [];
      const instructionInputs: Array<Resolvable<StimRef | StimSpec | null>> = [stimBank.get("instruction_text")];
      if (settings.voice_enabled) {
        instructionInputs.push(stimBank.get("instruction_text_voice"));
      }
      compiledTrials.push(
        buildWaitTrial(
          { trial_id: "instruction", condition: "instruction", trial_index: -1 },
          null,
          "instruction_text",
          instructionInputs
        )
      );

      for (let blockIndex = 0; blockIndex < Number(settings.total_blocks ?? 1); blockIndex += 1) {
        const blockId = `block_${blockIndex}`;
        compiledTrials.push(
          ...count_down({
            seconds: 3,
            block_id: blockId,
            trial_id_prefix: `countdown_${blockId}`,
            stim: {
              color: "white",
              height: 3.5
            }
          })
        );

        const block = new BlockUnit({
          block_id: blockId,
          block_idx: blockIndex,
          settings
        }).generate_conditions({
          func: generate_sst_conditions
        });

        block.conditions.forEach((condition, trialIndex) => {
          const trial = new TrialBuilder({
            trial_id: next_trial_id(),
            block_id: block.block_id,
            trial_index: trialIndex,
            condition
          });
          run_trial(trial, condition, {
            settings,
            stimBank,
            controller
          });
          compiledTrials.push(trial.build());
        });

        compiledTrials.push(
          buildWaitTrial(
            {
              trial_id: `block_break_${blockIndex}`,
              condition: "block_break",
              trial_index: Number(block.conditions.length) + blockIndex
            },
            block.block_id,
            "block",
            [
              (_snapshot: TrialSnapshot, runtime: RuntimeView) => {
                const summary = summarizeBlock(runtime.getReducedRows(), block.block_id);
                return stimBank.get_and_format("block_break", {
                  block_num: blockIndex + 1,
                  total_blocks: settings.total_blocks,
                  go_accuracy: summary.go_accuracy,
                  stop_accuracy: summary.stop_accuracy
                });
              }
            ]
          )
        );
      }

      compiledTrials.push(
        buildWaitTrial(
          {
            trial_id: "goodbye",
            condition: "goodbye",
            trial_index: Number(settings.total_trials ?? 0)
          },
          null,
          "goodbye",
          [stimBank.get("good_bye")]
        )
      );

      return compiledTrials;
    }
  });
}

export async function main(root: HTMLElement): Promise<void> {
  await run(root);
}

export default main;
