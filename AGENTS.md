# Repository Guidelines

## Model Selection Protocol
For every task assigned in this repository, evaluate the logical complexity before executing code changes:
- If the task requires basic boilerplate, syntax updates, simple refactoring, or writing unit tests, route to the fastest, cost-efficient processing profile.
- If the task demands multi-file architecture tracking, complex algorithmic logic, or deep system debugging, escalate the request to deep reasoning and flagship processing capabilities.

## Project Structure & Module Organization

This repository is currently an empty project workspace. No application code, tests, assets, or build configuration exists yet. When adding the initial implementation, organize application code under `src/`, automated tests under `tests/`, and static assets under `public/` or `assets/`, as appropriate for the chosen framework. Keep configuration files at the repository root and document the resulting structure in `README.md`.

## Build, Test, and Development Commands

No development, build, lint, or test commands are configured. Do not assume commands such as `npm test` or `npm run build` are available. When introducing a toolchain, define reproducible commands for local development, production builds, linting, and testing. Document each command and its prerequisites in `README.md`, and commit the relevant dependency manifest and lockfile.
- IF npm dependency installation fails for some reason try `npm install --force` as a last resort.

## Coding Style & Naming Conventions

No language or formatter has been selected. Follow the chosen language’s standard conventions and configure a formatter and linter alongside the first source files. Use descriptive names, keep modules focused, and apply consistent indentation. Prefer names that describe behavior, such as `createTask` or `task_repository`, according to the language’s conventions.

## Testing Guidelines

No testing framework or coverage threshold is configured. Introduce tests with the first functional implementation, covering core behavior and failure cases. Use descriptive test names that state the expected outcome, and follow the selected framework’s file naming conventions. Document how to run the complete suite and individual tests.

## Commit & Pull Request Guidelines

There is no Git history from which to infer commit conventions. Use concise, imperative commit subjects, such as `Add task creation form`, and keep each commit focused. Pull requests should explain the change, link related issues when available, and report validation performed. Include screenshots for visible interface changes and describe any setup or configuration changes.

## Security & Configuration

Never commit secrets or credentials. Provide placeholder values in an example configuration file when environment variables become necessary, and exclude local secrets and generated artifacts through `.gitignore`.
- Never trust user IDs, roles, prices, or usage limits supplied by the client.
- Enforce resource ownership on the server.
- Do not log access tokens, API keys, payment data, or prompt content.
- Use the existing secret-management and environment-variable system.
- Do not weaken validation or authorization to make a failing test pass.


## Task Planning & Safety Boundaries
- **Before coding:** State your approach in 1-2 sentences for minor changes (1–2 files), or provide a brief file checklist for larger changes.
- **Stop-and-Ask:** If a requirement is ambiguous, or if a change affects database migrations, authentication, or external API keys, **ask a clarifying question** before making irreversible edits.
- **No destructive actions:** Never force-push, drop database tables, or commit `.env` secrets.


## Git Workflow

- Do not commit, push, merge, or force-push without approval.
- Do not include unrelated formatting changes.
- Keep migrations and generated files in the same change as the code that requires them.
- Summarize user-visible behavior and validation in the pull request.


## Completion Report

After completing a task, report:

- Summary of the behavior changed
- Modified files
- Important implementation decisions
- Commands executed
- Test and build results
- Acceptance criteria status
- Assumptions
- Known limitations
- Remaining risks

## Sensitive Data

Never include these in code, tests, logs, screenshots, commits, or reports:

- Access tokens
- API keys
- Private keys
- Passwords
- Session cookies
- Full customer records
- Payment data
- Production database exports

Use synthetic fixtures for tests.