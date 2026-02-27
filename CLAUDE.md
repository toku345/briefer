# Agent Guide

Development guide for AI coding agents working on this repository.

## Project Overview

Briefer is a Chrome extension (Manifest V3) that summarizes and chats about web pages using a local LLM (vLLM).

## Commands

```bash
bun install              # Install dependencies
bun run build            # Build (WXT)
bun run dev              # Dev mode (WXT HMR)
bun run test             # Run tests (Vitest)
bun run test <file>      # Run a single test file
bun run typecheck        # Type checking only
bun run lint             # Lint check
bun run check            # Lint + format check
bun run check:fix        # Lint + format auto-fix
```

## Pre-commit Checks

All the following commands must pass before committing:

```bash
bun run typecheck    # Type checking
bun run check        # Lint + format
bun run test         # Tests
```

## Loading the Extension

1. Build with `bun run build`
2. Open `chrome://extensions`
3. Enable Developer mode
4. Click "Load unpacked" and select `.output/chrome-mv3`

## Architecture

Side Panel fetches directly to vLLM API. Service Worker does not relay — it only handles Side Panel open/close and context menu registration.

```text
┌─────────────┐     POST /v1/chat/completions
│ Side Panel  │ ─────────────────────────────────▶ vLLM
│ (Chat UI)   │ ◀───────── streaming response ────  :8000
└─────────────┘
       │
       │ chrome.scripting.executeScript (returns DOM content)
       ▼
   Target Tab

┌─────────────────┐
│ Service Worker  │  Side Panel open/close + context menu registration only
│ (lightweight)   │
└─────────────────┘
```

### Key Files

| File | Role |
|------|------|
| `lib/types.ts` | Shared type definitions (ChatMessage, StreamChunk, Settings, etc.) |
| `lib/extractor.ts` | Page content extraction (article > main > role="main" > body) |
| `lib/llm-client.ts` | vLLM API client (streaming, called directly from Side Panel) |
| `lib/settings-store.ts` | Settings management (server URL, temperature, max_tokens) |
| `lib/get-placeholder.ts` | Dynamic placeholder for InputContainer (5-state: error/loading/normal) |
| `entrypoints/background.ts` | Service Worker (Side Panel open/close + context menu) |
| `entrypoints/sidepanel/index.tsx` | Side Panel entry point |
| `entrypoints/sidepanel/hooks/useChatStream.ts` | Unified streaming hook (incl. AbortController management) |
| `entrypoints/sidepanel/hooks/usePageContent.ts` | Page content retrieval via executeScript |
| `entrypoints/sidepanel/hooks/useServerHealth.ts` | vLLM server health check |
| `wxt.config.ts` | WXT config (manifest definition, React module) |

## LLM Settings

Managed by `lib/settings-store.ts`. Server URL (default: `http://localhost:8000/v1`), temperature, and max_tokens are configurable from the UI. Models are dynamically fetched from the vLLM server and selectable in the UI.

## Test Patterns

- Stack: Vitest + @testing-library/react + jsdom
- Add `// @vitest-environment jsdom` at the top of component test files
- Chrome API mocking: `(globalThis as unknown as { chrome: typeof chrome }).chrome = mockChrome as unknown as typeof chrome`
- storage.onChanged listener tests: collect listeners in an array and invoke them manually to simulate `storage.onChanged` events
- Timer tests: `vi.useFakeTimers({ shouldAdvanceTime: true })` + `vi.advanceTimersByTimeAsync()`
- Hook tests: `renderHook()` + `waitFor()` / `act()` for async state updates
- Hooks using React Query must be wrapped with `QueryClientProvider`

## Chrome Extension Gotchas

- Use a `mounted` flag for async operations inside `useEffect` to prevent setState after cleanup
- Null out `AbortController` after abort (`ref.current = null`) to avoid stale state on re-execution
- Always call `removeListener` in cleanup for `chrome.storage.onChanged.addListener`
- `getSettings()` merges defaults with stored settings via `{ ...DEFAULT_SETTINGS, ...stored }` (`lib/settings-store.ts`)
- Icon buttons require `aria-label` + `title`; SVGs require `aria-hidden="true"`

## Rules for Implementation Planning

- Before presenting a plan to the user, review it using the `codex` command. See below for specific usage.
- Adjust the review instructions as needed. Note that codex tends to raise non-essential nitpicks, so always include an instruction like "Don't nitpick. Only flag critical issues."
- Repeat the update → review cycle until `codex` has no more issues to raise.

```bash
# initial plan review request
# Always specify the model with -m (gpt-5.3-codex is recommended)
codex exec -m gpt-5.3-codex "Review this plan. Don't nitpick. Only flag critical issues: {plan_full_path}"

# updated plan review request
# Without resume --last, the context from the initial review will be lost
codex exec resume --last -m gpt-5.3-codex "The plan has been updated. Review it again. Don't nitpick. Only flag critical issues: {plan_full_path}"
```

## Rules for Code Review

- When a code review is requested, use `codex exec` to have Codex review the code as well.
- Instead of writing lengthy explanations of the implementation, simply pass the commit hash or range to Codex.

```bash
git diff HEAD~1 > /tmp/claude/diff.txt
codex exec -m gpt-5.3-codex "Review the following diff. Only flag critical bugs or design issues: /tmp/claude/diff.txt"
```
