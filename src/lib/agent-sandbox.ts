// Resilient sandbox session for the agent.
// - Refreshes the idle timeout on every use (cheap: billed per second).
// - Proactively recreates the sandbox before Novita's ~1h lifetime kills it.
// - If a command fails because the sandbox died mid-run, recreates once and
//   retries the command instead of poisoning the rest of the agent run.
// - Never throws from ensure(): failures come back as notes/results so the
//   agent stream keeps living.

export const SANDBOX_IDLE_MS = 300_000; // 5 min idle, refreshed on use
const MAX_SANDBOX_AGE_MS = 50 * 60_000; // recreate before Novita's 1h kill
export const MAX_COMMAND_TIMEOUT_MS = 600_000; // 10 min per command
export const DEFAULT_COMMAND_TIMEOUT_MS = 60_000; // 60s default

export type SandboxLike = {
  sandboxId: string;
  setTimeout(ms: number): Promise<unknown>;
  commands: {
    run(
      cmd: string,
      opts: { timeoutMs: number },
    ): Promise<{ stdout?: string; stderr?: string; exitCode?: number }>;
  };
};

export type NovitaClientLike = {
  sandbox: {
    connect(id: string): Promise<SandboxLike>;
    create(opts: { template: string; timeoutMs: number }): Promise<SandboxLike>;
  };
};

const DEAD_PATTERNS = /expir|not found|terminat|no such|sandbox.*(gone|dead|kill|stop)|ECONNRESET|socket hang up/i;

function isDeadSandboxError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return DEAD_PATTERNS.test(msg);
}

export class SandboxSession {
  private sb: SandboxLike | null = null;
  private createdAt = 0;
  private pendingId: string | undefined;
  private client: NovitaClientLike;
  private template: string;
  private now: () => number;
  private workdir: string | undefined;
  private workdirReadyFor: string | null = null;

  constructor(
    client: NovitaClientLike,
    template: string,
    now: () => number = Date.now,
    initialId?: string,
    workdir?: string,
  ) {
    this.client = client;
    this.template = template;
    this.now = now;
    this.pendingId = initialId;
    this.workdir = workdir;
  }

  get sandboxId(): string | undefined {
    return this.sb?.sandboxId ?? this.pendingId;
  }

  /** Workdir aktif (untuk prompt/diagnostik). */
  get activeWorkdir(): string | undefined {
    return this.workdir;
  }

  private shellQuote(s: string): string {
    return `'${s.replace(/'/g, `'\\''`)}'`;
  }

  private async createFresh(): Promise<SandboxLike> {
    const sb = await this.client.sandbox.create({
      template: this.template,
      timeoutMs: SANDBOX_IDLE_MS,
    });
    this.createdAt = this.now();
    this.pendingId = sb.sandboxId;
    return sb;
  }

  /** Get a live sandbox, recreating when missing, stale, or near the 1h limit. */
  async ensure(): Promise<{ sb: SandboxLike; note: string }> {
    let note = "";
    if (!this.sb && this.pendingId) {
      try {
        this.sb = await this.client.sandbox.connect(this.pendingId);
        this.createdAt = this.now();
      } catch {
        this.sb = null;
        this.pendingId = undefined;
        note = "Sandbox lama sudah tidak ada; dibuatkan sandbox baru.";
      }
    }
    if (!this.sb) {
      this.sb = await this.createFresh();
      if (!note) note = "Sandbox baru dibuat.";
    } else if (this.now() - this.createdAt > MAX_SANDBOX_AGE_MS) {
      this.sb = await this.createFresh();
      note =
        "Sandbox diperbarui otomatis karena mendekati batas 1 jam Novita; file sesi lama tidak terbawa.";
    }
    // Refresh the idle timeout on every use (best effort).
    await this.sb.setTimeout(SANDBOX_IDLE_MS).catch(() => {});
    // Fase B: pastikan workdir thread ada (sekali per inkarnasi sandbox).
    if (this.workdir && this.workdirReadyFor !== this.sb.sandboxId) {
      try {
        await this.sb.commands.run(`mkdir -p -- ${this.shellQuote(this.workdir)}`, {
          timeoutMs: 30_000,
        });
      } catch {
        /* best-effort: run() tetap jalan, command akan gagal natural */
      }
      this.workdirReadyFor = this.sb.sandboxId;
    }
    return { sb: this.sb, note };
  }

  /**
   * Run a command with one automatic retry on a fresh sandbox if the current
   * one died mid-command. Resolves with exitCode for ordinary failures;
   * throws only when the sandbox itself cannot be (re)created.
   */
  async run(
    command: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; note: string }> {
    // Fase B: semua command jalan di workdir thread (isolasi per-thread).
    const wrapped =
      this.workdir && command.trim()
        ? `cd ${this.shellQuote(this.workdir)} && ${command}`
        : command;
    const first = await this.ensure();
    try {
      const r = await first.sb.commands.run(wrapped, { timeoutMs });
      return {
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
        exitCode: r.exitCode ?? 0,
        note: first.note,
      };
    } catch (error) {
      if (!isDeadSandboxError(error)) throw error;
      // The sandbox died mid-command: forget it completely, recreate fresh,
      // and retry the command once.
      this.sb = null;
      this.pendingId = undefined;
      const second = await this.ensure();
      const r = await second.sb.commands.run(wrapped, { timeoutMs });
      const note =
        "Sandbox diperbarui otomatis karena yang lama mati di tengah perintah; perintah diulang di sandbox baru (file sesi lama tidak terbawa).";
      return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.exitCode ?? 0, note };
    }
  }
}
