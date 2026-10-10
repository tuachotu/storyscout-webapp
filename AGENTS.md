# StoryScout Webapp Guidance

## Approval boundary

- Present a concrete, technology-specific plan and wait for explicit approval
  before executing project work.
- Implement only the approved scope.
- Do not add a feature, persona, domain entity, field, integration, or workflow
  unless the user explicitly requested and approved it.
- Do not commit, push, deploy, make external API calls, or perform other external
  writes without explicit approval.

## Product boundary

- This project is a React webapp.
- Its only approved product features are Record and Transcribe.
- It communicates with the backend exclusively through the documented REST API.
- It must not import backend source code or access backend storage directly.
- Storytellers/personas, translation, summaries, AI metadata, authentication,
  database behavior, S3, and AWS are out of scope.

## Continuity

- Update `STATUS.md` after every meaningful completed step.
- Update the active plan's `progress-log.md` after every meaningful completed
  step.
- On resumption, read the approved plan, progress log, and `STATUS.md`; inspect
  the actual files and rerun the last relevant validation before continuing.

## Approved book reader amendment — 2026-10-06

The user approved public book landing and reading pages using the documented API,
prepared summaries, original-language/English text, optional images, and original
audio playback through API-issued S3 URLs. This overrides conflicting historical
feature restrictions above for this scope only. Live local reader testing approved.
See ../planning/2026-10-06/book-reader/plan.md. No deployment or infrastructure changes.
