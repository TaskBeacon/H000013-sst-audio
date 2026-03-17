export class Controller {
  readonly initial_ssd: number;
  readonly min_ssd: number;
  readonly max_ssd: number;
  readonly step: number;
  readonly target_success: number;
  readonly condition_specific: boolean;
  readonly histories = new Map<string | null, boolean[]>();
  readonly ssds = new Map<string | null, number>();

  constructor(options: {
    initial_ssd: number;
    min_ssd: number;
    max_ssd: number;
    step: number;
    target_success: number;
    condition_specific?: boolean;
  }) {
    this.initial_ssd = options.initial_ssd;
    this.min_ssd = options.min_ssd;
    this.max_ssd = options.max_ssd;
    this.step = options.step;
    this.target_success = options.target_success;
    this.condition_specific = options.condition_specific ?? false;
  }

  static from_dict(config: Record<string, unknown>): Controller {
    return new Controller({
      initial_ssd: Number(config.initial_ssd ?? 0.25),
      min_ssd: Number(config.min_ssd ?? 0.05),
      max_ssd: Number(config.max_ssd ?? 0.5),
      step: Number(config.step ?? 0.05),
      target_success: Number(config.target_success ?? 0.5),
      condition_specific: Boolean(config.condition_specific ?? false)
    });
  }

  private key(stim: string | null): string | null {
    return this.condition_specific ? stim : null;
  }

  get_ssd(stim: string | null = null): number {
    const key = this.key(stim);
    if (!this.ssds.has(key)) {
      this.ssds.set(key, this.initial_ssd);
      this.histories.set(key, []);
    }
    return this.ssds.get(key) ?? this.initial_ssd;
  }

  update(success: boolean, stim: string | null = null): void {
    const key = this.key(stim);
    const history = this.histories.get(key) ?? [];
    history.push(success);
    this.histories.set(key, history);

    const current = this.get_ssd(stim);
    const successRate = history.reduce((sum, flag) => sum + Number(flag), 0) / history.length;
    const next =
      successRate > this.target_success
        ? Math.min(this.max_ssd, current + this.step)
        : Math.max(this.min_ssd, current - this.step);
    this.ssds.set(key, next);
  }
}
