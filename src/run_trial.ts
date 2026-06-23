import {
  set_trial_context,
  type StimBank,
  type TaskSettings,
  type TrialBuilder
} from "psyflow-web";

import type { Controller } from "./controller";

export function run_trial(
  trial: TrialBuilder,
  condition: string,
  context: {
    settings: TaskSettings;
    stimBank: StimBank;
    controller: Controller;
  }
): TrialBuilder {
  const { settings, stimBank, controller } = context;
  const [condKind, condSide] = String(condition).split("_", 2);
  const correctKey = String(condSide === "left" ? settings.left_key ?? "f" : settings.right_key ?? "j");
  const keyList = ((settings.key_list as string[]) ?? ["f", "j"]).map(String);
  const goDuration = Number(settings.go_duration ?? 1);
  const triggers = (settings.triggers as Record<string, number | string | null | undefined> | undefined) ?? {};
  const trigger = (name: string): number | null => {
    const value = Number(triggers[name]);
    return Number.isFinite(value) ? value : null;
  };
  const resolveSsd = () => controller.get_ssd(condSide);
  const resolveRemaining = () => Math.max(0, goDuration - resolveSsd());

  const fixation = trial.unit("fixation").addStim(stimBank.get("fixation"));
  set_trial_context(fixation, {
    trial_id: trial.trial_id,
    phase: "fixation",
    valid_keys: [...keyList],
    block_id: trial.block_id,
    condition_id: condition,
    task_factors: {
      condition,
      stage: "fixation",
      trial_index: trial.trial_index,
      block_id: trial.block_id
    },
    stim_id: "fixation"
  });
  fixation
    .show({
      duration: (settings.fixation_duration as number | number[] | null | undefined) ?? null,
      onset_trigger: trigger("fixation_onset")
    })
    .to_dict();

  if (condKind === "go") {
    const go = trial.unit("go").addStim(stimBank.get(condition));
    set_trial_context(go, {
      trial_id: trial.trial_id,
      phase: "go_response_window",
      valid_keys: [...keyList],
      block_id: trial.block_id,
      condition_id: condition,
      task_factors: {
        condition,
        stage: "go_response_window",
        trial_index: trial.trial_index,
        block_id: trial.block_id
      },
      stim_id: condition
    });
    go
      .captureResponse({
        keys: keyList,
        correct_keys: correctKey,
        duration: goDuration,
        onset_trigger: trigger("go_onset"),
        response_trigger: trigger("go_response"),
        timeout_trigger: trigger("go_miss"),
        terminate_on_response: true
      })
      .to_dict();

    const noResponse = trial
      .unit("no_response_feedback")
      .when((snapshot) => !Boolean(snapshot.units.go?.key_press))
      .addStim(stimBank.get("no_response_feedback"));
    set_trial_context(noResponse, {
      trial_id: trial.trial_id,
      phase: "no_response_feedback",
      deadline_s: Number(settings.no_response_feedback_duration ?? 0.8),
      valid_keys: [],
      block_id: trial.block_id,
      condition_id: condition,
      task_factors: {
        condition,
        stage: "no_response_feedback",
        condition_kind: condKind,
        condition_side: condSide,
        trial_index: trial.trial_index,
        block_id: trial.block_id
      },
      stim_id: "no_response_feedback"
    });
    noResponse
      .show({
        duration: Number(settings.no_response_feedback_duration ?? 0.8),
        onset_trigger: trigger("no_response_feedback_onset")
      })
      .to_dict();

    return trial;
  }

  const goStim = condition.replace("stop", "go");
  const goSsd = trial.unit("go_ssd").addStim(stimBank.get(goStim));
  set_trial_context(goSsd, {
    trial_id: trial.trial_id,
    phase: "pre_stop_go_window",
    valid_keys: [...keyList],
    block_id: trial.block_id,
    condition_id: condition,
    task_factors: {
      condition,
      stage: "pre_stop_go_window",
      trial_index: trial.trial_index,
      block_id: trial.block_id
    },
    stim_id: goStim
  });
  goSsd
    .captureResponse({
      keys: keyList,
      duration: () => resolveSsd(),
      onset_trigger: trigger("go_onset"),
      response_trigger: trigger("pre_stop_response"),
      terminate_on_response: false
    })
    .set_state({
      ssd_s: () => resolveSsd()
    })
    .to_dict();

  const stop = trial.unit("stop").addStim(stimBank.get(goStim)).addStim(stimBank.get("stop_signal"));
  set_trial_context(stop, {
    trial_id: trial.trial_id,
    phase: "stop_signal_window",
    valid_keys: [...keyList],
    block_id: trial.block_id,
    condition_id: condition,
    task_factors: {
      condition,
      stage: "stop_signal_window",
      trial_index: trial.trial_index,
      block_id: trial.block_id,
      ssd_s: () => resolveSsd()
    },
    stim_id: "stop_signal"
  });
  stop
    .captureResponse({
      keys: keyList,
      duration: () => resolveRemaining(),
      onset_trigger: trigger("stop_onset"),
      response_trigger: trigger("on_stop_response"),
      terminate_on_response: true
    })
    .set_state({
      ssd_s: () => resolveSsd()
    })
    .to_dict();

  trial.finalize((snapshot, _runtime, helpers) => {
    const failedStop = Boolean(snapshot.units.go_ssd?.key_press) || Boolean(snapshot.units.stop?.key_press);
    helpers.setTrialState("stop_failed", failedStop);
    helpers.setTrialState("ssd_s", snapshot.units.go_ssd?.ssd_s ?? null);
    controller.update(!failedStop, condSide);
  });

  return trial;
}
