# Codex Workflow

Use [TASK_BOARD.md](TASK_BOARD.md) as the running task tracker. Each Codex session should begin by reading the board, aligning on the current task, and ending with the board updated to reflect what changed and what still needs attention.

## Working Rules
- Read `TASK_BOARD.md` before making edits.
- Use `TASK_BOARD.md` to plan the work before implementation begins.
- Break the feature into finite, scoped, testable tasks instead of broad milestones.
- Keep the active task list current as work moves from audit to implementation to validation.
- Prefer small balance passes with validation after each pass instead of large unverified rewrites.
- Record validation outcomes and newly discovered risks back in `TASK_BOARD.md`.
- Use prompts that name the target systems and expected verification steps.
- After each task, evaluate performance and regression risk before moving to the next one.
- When the feature is complete, fold the durable outcomes into `README.md`, reset `TASK_BOARD.md` to a clean state, then commit, push, and open a pull request.

## Planning With The Task Board
- Start each feature by turning the request into a short list of concrete tasks in `TASK_BOARD.md`.
- Each task should have a clear scope, expected output, and at least one validation step.
- Keep tasks small enough to complete and verify in a single focused iteration.
- Mark tasks complete only after code review of the diff and the relevant checks have run.
- Add follow-up items when new issues are discovered instead of letting them stay implicit.

## Example Task Shapes
- `Audit current balance values in src/config.js and identify the exact stats that need tuning.`
- `Tune class baseline stats for one class and validate the change with targeted gameplay checks.`
- `Adjust XP scaling and run regression checks to confirm level-up flow still works.`
- `Run a final performance and regression pass, then summarize the shipped behavior in README.md.`

## Validation Expectations
- Run targeted checks after each task, not only at the end of the feature.
- Include both regression-oriented checks and performance-oriented checks when the project provides them.
- Record the commands run and the outcome in `TASK_BOARD.md`.

### Example Validation Commands
```bash
git status -u
npm run check
npm run validate:boss
npm run perf:test
```

### Example Targeted Iteration Loop
```bash
git status -u
git diff --stat
npm run check
git diff
```

## End-Of-Feature Closeout
- Confirm every scoped task in `TASK_BOARD.md` is complete or deliberately deferred.
- Scan the project for oversized files and refactor files above the 500 LOC threshold into logical components.
- Summarize completed feature work back into the relevant sections of `README.md`.
- Reset `TASK_BOARD.md` to a clean ready-for-next-initiative state after the work is documented.
- Commit and push the final branch state, then open a pull request to `main`.

### Example File Size Audit Commands
```bash
rg --files -g "*.js" -g "*.md" -g "*.css" -g "*.html" | ForEach-Object {
  $lines = (Get-Content $_ | Measure-Object -Line).Lines
  if ($lines -gt 500) { "{0}`t{1}" -f $lines, $_ }
}
```

### Example Finalization Commands
```bash
git status -u
git diff --stat
git add README.md docs/TASK_BOARD.md docs/CODEX_WORKFLOW.md src
git diff --cached
git commit -m "Complete feature and document results"
git push -u origin feature/<short-feature-name>
gh pr create --base main --title "<feature title>" --body "<summary>"
```

## Git And GitHub Workflow
- Start feature work on a dedicated branch instead of working directly on `main`.
- Check the repository state with `git status -u` before and after meaningful changes.
- Review the diff before committing so the commit matches the intended scope.
- Write focused commits with a clear message tied to the feature or fix.
- Push the branch to the remote before opening or updating a pull request.
- Use pull requests to summarize intent, validation, and review areas.
- Treat review feedback as a tracked follow-up item and update `TASK_BOARD.md` when it changes the plan.

### 1. Sync And Create Branch
- Example commands:
```bash
git status -u
git switch main
git pull --ff-only
git switch -c feature/<short-feature-name>
git status -u
```

### 2. Inspect Current Work
- Example commands:
```bash
git status -u
git diff --stat
git diff
```

### 3. Stage And Commit
- Example commands:
```bash
git add docs/TASK_BOARD.md docs/CODEX_WORKFLOW.md src/config.js
git status -u
git diff --cached
git commit -m "Tune gameplay difficulty and progression"
```

### 4. Push Branch
- Example commands:
```bash
git push -u origin feature/<short-feature-name>
```

### 5. Open Or Update Pull Request
- Example commands:
```bash
gh pr create --title "Tune gameplay difficulty and progression" --body-file docs/pr-summary.md
gh pr view --web
```
- If GitHub CLI is not available, push the branch and open the PR in the browser.

### 6. Review Feedback And Follow-Up
- Example commands:
```bash
git status -u
gh pr view --comments
git add <updated-files>
git commit -m "Address pull request feedback"
git push
```

## Generic Prompt Examples For Repo Operations
1. `Read docs/TASK_BOARD.md, inspect the current repo state with git status -u, and create a new feature branch for the task if one does not already exist.`
2. `Implement the next item from docs/TASK_BOARD.md, then run git status -u and summarize which files changed and why.`
3. `Review the current diff, group the changes into a clean commit, and propose a concise commit message before committing.`
4. `Push the current feature branch, then draft a pull request summary that includes scope, validation, and open questions.`
5. `Review the latest feedback on this branch, identify required code changes or clarifications, and update docs/TASK_BOARD.md with the follow-up work.`

## Pull Request Checklist
1. Confirm the work is on the correct feature branch.
2. Run `git status -u` and make sure unexpected files are understood.
3. Re-read the diff for accidental edits, debug code, or unrelated changes.
4. Confirm `docs/TASK_BOARD.md` reflects completed work and no stale in-progress items remain.
5. Run the relevant validation commands for the scope of the change.
6. Perform the 500 LOC file audit and refactor oversized files when needed.
7. Update the relevant sections of `README.md` with durable feature outcomes.
8. Commit with a message that matches the actual change set.
9. Push the branch and open or update the pull request.
10. Include a short PR description with purpose, major changes, validation, and known risks.
11. After review, address feedback, re-run validation as needed, and push the follow-up commits.

## Example Prompt Sequence
1. `Read TASK_BOARD.md, inspect the current gameplay difficulty, class stats, and XP progression systems, then summarize the main tuning levers and update TASK_BOARD.md with a short implementation plan.`
2. `Using TASK_BOARD.md as the source of truth, tune the class baseline stats and per-level growth in src/config.js. Keep the first pass conservative, explain the tradeoffs, and update TASK_BOARD.md with the changes made.`
3. `Review enemy scaling and floor difficulty in src/config.js and the gameplay runtime files. Adjust the progression curve to smooth early floors without flattening late-game pressure, then update TASK_BOARD.md with any follow-up concerns.`
4. `Adjust experience gain and level pacing in the runtime systems, especially src/game/enemySystems.js and src/game/GameRuntimeSystems.js. After the changes, run the relevant validation commands and record the results in TASK_BOARD.md.`
5. `Review this branch against TASK_BOARD.md. List any balance risks, missing tests, or tuning gaps, and propose the next two prompts to continue the work.`

## Suggested Session Pattern
1. Start with the board and confirm the current task.
2. Break the feature into finite, testable tasks if the board is not yet specific enough.
3. Inspect only the files needed for the active task.
4. Implement one task-sized change.
5. Run targeted validation and performance or regression checks as applicable.
6. Update `TASK_BOARD.md` before starting the next task or ending the session.
7. At feature completion, audit large files, refactor if needed, update `README.md`, reset the board, commit, push, and open the PR.
