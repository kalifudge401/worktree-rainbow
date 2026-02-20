import * as vscode from "vscode";
import * as path from "path";

// --- Git Extension API types (subset) ---
interface GitExtension {
  getAPI(version: 1): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
  onDidOpenRepository: vscode.Event<Repository>;
}

interface Repository {
  state: RepositoryState;
  rootUri: vscode.Uri;
}

interface RepositoryState {
  HEAD: Branch | undefined;
  onDidChange: vscode.Event<void>;
}

interface Branch {
  name?: string;
}

// --- Color utilities ---

function randomHsl(): { h: number; s: number; l: number } {
  const h = Math.floor(Math.random() * 360);
  const s = 60 + Math.floor(Math.random() * 20); // 60-80%
  const l = 40 + Math.floor(Math.random() * 10); // 40-50%
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

/** Returns "#ffffff" or "#000000" based on WCAG relative luminance */
function contrastForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

function generateRandomColor(): string {
  const { h, s, l } = randomHsl();
  return hslToHex(h, s, l);
}

// --- State key helpers ---

function colorKey(repoPath: string, branchName: string): string {
  return `colors:${repoPath}:${branchName}`;
}

// --- Core logic ---

function isDefaultBranch(branchName: string): boolean {
  const config = vscode.workspace.getConfiguration("worktreeRainbow");
  const defaults: string[] = config.get("defaultBranches", ["main", "master"]);
  return defaults.includes(branchName);
}

function resolveRepository(git: GitAPI): Repository | undefined {
  const uri = vscode.window.activeTextEditor?.document.uri;
  if (uri) {
    let best: Repository | undefined;
    let bestLen = -1;
    for (const repo of git.repositories) {
      const root = repo.rootUri.fsPath;
      const isMatch =
        uri.fsPath === root || uri.fsPath.startsWith(root + path.sep);
      if (isMatch && root.length > bestLen) {
        best = repo;
        bestLen = root.length;
      }
    }
    if (best) {
      return best;
    }
  }
  return git.repositories[0];
}

async function applyColor(color: string): Promise<void> {
  const fg = contrastForeground(color);
  const inactiveBg = darken(color, 0.3);
  const inactiveFg = contrastForeground(inactiveBg);

  const config = vscode.workspace.getConfiguration("workbench");
  const existing =
    config.get<Record<string, unknown>>("colorCustomizations") ?? {};

  const updated: Record<string, unknown> = {
    ...existing,
    "titleBar.activeBackground": color,
    "titleBar.activeForeground": fg,
    "titleBar.inactiveBackground": inactiveBg,
    "titleBar.inactiveForeground": inactiveFg,
    "statusBar.background": color,
    "statusBar.foreground": fg,
  };

  await config.update(
    "colorCustomizations",
    updated,
    vscode.ConfigurationTarget.Workspace,
  );
}

const MANAGED_KEYS = [
  "titleBar.activeBackground",
  "titleBar.activeForeground",
  "titleBar.inactiveBackground",
  "titleBar.inactiveForeground",
  "statusBar.background",
  "statusBar.foreground",
];

async function clearColor(): Promise<void> {
  const config = vscode.workspace.getConfiguration("workbench");
  const existing =
    config.get<Record<string, unknown>>("colorCustomizations") ?? {};

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!MANAGED_KEYS.includes(key)) {
      cleaned[key] = value;
    }
  }

  const target =
    Object.keys(cleaned).length > 0 ? cleaned : undefined;
  await config.update(
    "colorCustomizations",
    target,
    vscode.ConfigurationTarget.Workspace,
  );
}

async function handleBranchChange(
  context: vscode.ExtensionContext,
  repo: Repository,
): Promise<void> {
  const branchName = repo.state.HEAD?.name;
  if (!branchName) {
    await clearColor();
    return;
  }

  if (isDefaultBranch(branchName)) {
    await clearColor();
    return;
  }

  const repoPath = repo.rootUri.fsPath;
  const key = colorKey(repoPath, branchName);

  let color = context.globalState.get<string>(key);
  if (!color) {
    color = generateRandomColor();
    await context.globalState.update(key, color);
  }

  await applyColor(color);
}

// --- Extension lifecycle ---

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const gitExtension =
    vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!gitExtension) {
    return;
  }

  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }
  const git = gitExtension.exports.getAPI(1);

  function watchRepo(repo: Repository): void {
    let lastBranch: string | undefined;
    let pending: Promise<void> = Promise.resolve();

    const enqueue = () => {
      const current = repo.state.HEAD?.name;
      if (current !== lastBranch) {
        lastBranch = current;
        pending = pending.then(() =>
          handleBranchChange(context, repo).catch((err) =>
            console.error("Worktree Rainbow:", err),
          ),
        );
      }
    };

    enqueue();

    const disposable = repo.state.onDidChange(enqueue);
    context.subscriptions.push(disposable);
  }

  // Watch existing repositories
  for (const repo of git.repositories) {
    watchRepo(repo);
  }

  // Watch newly opened repositories
  context.subscriptions.push(git.onDidOpenRepository(watchRepo));

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("worktreeRainbow.reroll", async () => {
      try {
        const repo = resolveRepository(git);
        if (!repo) {
          vscode.window.showWarningMessage(
            "Worktree Rainbow: No git repository found.",
          );
          return;
        }

        const branchName = repo.state.HEAD?.name;
        if (!branchName) {
          vscode.window.showWarningMessage(
            "Worktree Rainbow: No branch detected.",
          );
          return;
        }

        if (isDefaultBranch(branchName)) {
          vscode.window.showInformationMessage(
            `Worktree Rainbow: "${branchName}" is a default branch (no color applied).`,
          );
          return;
        }

        const repoPath = repo.rootUri.fsPath;
        const key = colorKey(repoPath, branchName);
        const color = generateRandomColor();
        await context.globalState.update(key, color);
        await applyColor(color);
        vscode.window.showInformationMessage(
          `Worktree Rainbow: New color ${color} for "${branchName}"`,
        );
      } catch (err) {
        console.error("Worktree Rainbow:", err);
        vscode.window.showErrorMessage(
          "Worktree Rainbow: Failed to reroll color.",
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("worktreeRainbow.clear", async () => {
      try {
        const repo = resolveRepository(git);
        if (repo) {
          const branchName = repo.state.HEAD?.name;
          if (branchName) {
            const repoPath = repo.rootUri.fsPath;
            const key = colorKey(repoPath, branchName);
            await context.globalState.update(key, undefined);
          }
        }
        await clearColor();
        vscode.window.showInformationMessage(
          "Worktree Rainbow: Color cleared.",
        );
      } catch (err) {
        console.error("Worktree Rainbow:", err);
        vscode.window.showErrorMessage(
          "Worktree Rainbow: Failed to clear color.",
        );
      }
    }),
  );
}

export function deactivate(): void {}
