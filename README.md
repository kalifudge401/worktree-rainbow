# Worktree Rainbow

A VS Code extension that automatically assigns a random color to the title bar and status bar based on your current git branch or worktree. Instantly see which branch you're on at a glance.

![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-blue)

## Features

- Automatically colors the title bar and status bar when you switch branches
- Same branch always gets the same color (colors are persisted)
- Default branches (main/master) keep the default theme — no color applied
- WCAG-compliant contrast calculation ensures readable text
- Multi-root workspace support

## Commands

| Command | Description |
|---------|-------------|
| `Worktree Rainbow: Reroll Color` | Assign a new random color to the current branch |
| `Worktree Rainbow: Clear Color` | Clear the color for the current branch |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `worktreeRainbow.defaultBranches` | `["main", "master"]` | Branches that should not be colored |
| `worktreeRainbow.targetSettings` | `"user"` | Where to write color customizations: `"user"` (global), `"workspace"` (`.vscode/settings.json`), or `"workspaceFolder"` (multi-root) |

### Overriding `targetSettings` per workspace

Because `worktreeRainbow.targetSettings` is a standard VS Code setting, you can override it at any scope using VS Code's built-in configuration hierarchy (workspaceFolder > workspace > user). For example, if your global setting is `"user"` but a specific workspace needs `"workspace"`, add this to `.vscode/settings.json`:

```json
{
  "worktreeRainbow.targetSettings": "workspace"
}
```

The extension picks up the resolved value automatically — no extra configuration required.

> **Note:** If you commit `"worktreeRainbow.targetSettings": "workspace"` to `.vscode/settings.json`, the extension will also write color keys into that file, which will show as dirty in git. This is expected — it's the same tradeoff that makes `"user"` the default.

## How It Works

1. When you open a git repository, the extension detects the current branch
2. If it's not a default branch, a random color is generated (or a previously saved color is restored)
3. The color is written to `workbench.colorCustomizations` at the scope configured by `worktreeRainbow.targetSettings` (user/global by default)
4. Colors update automatically when you switch branches

Colors are persisted in `globalState`, so the same branch always gets the same color even after restarting VS Code.

## License

MIT
