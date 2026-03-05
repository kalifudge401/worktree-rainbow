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

## How It Works

1. When you open a git repository, the extension detects the current branch
2. If it's not a default branch, a random color is generated (or a previously saved color is restored)
3. The color is written to `workbench.colorCustomizations` at the workspace scope
4. Colors update automatically when you switch branches

Colors are persisted in `globalState`, so the same branch always gets the same color even after restarting VS Code.

## License

MIT
