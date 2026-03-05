import * as vscode from "vscode";
import * as path from "path";
import { generateRandomColor, darken, contrastForeground } from "./color";

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
