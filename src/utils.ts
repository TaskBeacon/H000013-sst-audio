export function generate_sst_conditions(
  n_trials: number,
  condition_labels: string[] = ["go_left", "go_right", "stop_left", "stop_right"],
  stop_ratio = 0.25,
  max_stop_run = 4,
  min_go_start = 3,
  seed = 2025
): string[] {
  const go_labels = condition_labels.filter((label) => label.startsWith("go"));
  const stop_labels = condition_labels.filter((label) => label.startsWith("stop"));
  const n_stop = Math.round(n_trials * stop_ratio);
  const n_go = n_trials - n_stop;

  const counts = new Map<string, number>();
  const baseGo = Math.floor(n_go / go_labels.length);
  const remGo = n_go % go_labels.length;
  go_labels.forEach((label, index) => counts.set(label, baseGo + (index < remGo ? 1 : 0)));

  const baseStop = Math.floor(n_stop / stop_labels.length);
  const remStop = n_stop % stop_labels.length;
  stop_labels.forEach((label, index) => counts.set(label, baseStop + (index < remStop ? 1 : 0)));

  const trials: string[] = [];
  for (const [label, count] of counts.entries()) {
    for (let index = 0; index < count; index += 1) {
      trials.push(label);
    }
  }

  let state = seed >>> 0;
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (;;) {
    for (let index = trials.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      [trials[index], trials[swapIndex]] = [trials[swapIndex], trials[index]];
    }

    const invalidStart = trials.slice(0, min_go_start).some((label) => !label.startsWith("go"));
    if (invalidStart) {
      continue;
    }

    let violation = false;
    for (let index = 0; index <= trials.length - 5; index += 1) {
      const window = trials.slice(index, index + 5);
      const stopCount = window.filter((label) => label.startsWith("stop")).length;
      if (stopCount > max_stop_run) {
        violation = true;
        break;
      }
    }
    if (!violation) {
      break;
    }
  }

  return trials;
}

export function summarizeBlock(rows: Array<Record<string, unknown>>, blockId: string): {
  go_accuracy: number;
  stop_accuracy: number;
} {
  const blockRows = rows.filter((row) => row.block_id === blockId);
  const goTrials = blockRows.filter((row) => String(row.condition ?? "").startsWith("go"));
  const stopTrials = blockRows.filter((row) => String(row.condition ?? "").startsWith("stop"));
  const goHits = goTrials.reduce((sum, row) => sum + Number(Boolean(row.go_hit)), 0);
  const stopSuccesses = stopTrials.reduce(
    (sum, row) => sum + Number(!Boolean(row.go_ssd_key_press) && !Boolean(row.stop_key_press)),
    0
  );
  return {
    go_accuracy: goTrials.length > 0 ? goHits / goTrials.length : 0,
    stop_accuracy: stopTrials.length > 0 ? stopSuccesses / stopTrials.length : 0
  };
}
