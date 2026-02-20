# Worktree Rainbow

Automatically assigns a random color to the title bar and status bar for each git branch/worktree in VS Code. Instantly see which branch you're on when switching between multiple worktrees or branches.

![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-blue)

## Features

- Automatically colors the title bar and status bar when you switch branches
- The same branch always gets the same color (colors are persisted)
- Default branches (main/master) keep the default theme with no color applied
- WCAG-compliant contrast calculation ensures text readability
- Multi-root workspace support

## Commands

| Command | Description |
|---------|-------------|
| `Worktree Rainbow: Reroll Color` | Assign a new random color to the current branch |
| `Worktree Rainbow: Clear Color` | Clear the color for the current branch |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `worktreeRainbow.defaultBranches` | `["main", "master"]` | Branches that should not be colored (keep default theme) |

## How It Works

1. When you open a Git repository, the extension detects the current branch name
2. If it's not a default branch, a random color is generated (or a previously saved color is restored)
3. The color is written to `workbench.colorCustomizations` at the workspace scope
4. Colors automatically change when you switch branches

Colors are persisted in `globalState`, so the same branch always gets the same color even after restarting VS Code.

## License

[MIT](LICENSE)
