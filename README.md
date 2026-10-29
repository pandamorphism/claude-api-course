# Building with the Claude API, in Effect TS v4

My workspace for the Anthropic Academy course **"Building with the Claude API"**.
The course examples are in Python; here they are translated to TypeScript using
[Effect](https://effect.website) v4.

## Conventions

- **One file per course lesson** in `lessons/`, numbered in course order
  (`01-first-request.ts`, `02-...`). Each one is a standalone program.
- **Python examples translated to Effect v4.** Every call to Claude goes through the
  shared `Claude` service in `src/claude.ts` (`Context.Service` + `Layer`). It wraps
  `@anthropic-ai/sdk`'s `messages.create`, fails with a typed `ClaudeError`, and retries
  transient errors with exponential backoff (500ms base, 3 retries). It reads the API key
  with `Config.Redacted("ANTHROPIC_API_KEY")`.
- **Effect Schema instead of Pydantic.** Where the course uses Pydantic models and
  `model_validate_json`, these lessons use `Schema.Struct` with
  `Schema.decodeEffect(Schema.fromJsonString(...))`.
- Uses Effect v4 APIs only: `Schema` from `"effect"`, `Schema.Union([...])`, `Context.Service`.

## Setup

```sh
npm install          # also patches tsc with the Effect language service (prepare script)
cp .env.example .env # then fill in ANTHROPIC_API_KEY
```

## Running

```sh
npm run typecheck                            # tsc 7 + Effect diagnostics
npm run lesson -- lessons/01-first-request.ts
```

## Editor

Requires the Zed extension **Effect Language Service (tsgo)**, which provides the
`effect-tsgo` language server. `.zed/settings.json` turns off vtsls and
typescript-language-server and points `effect-tsgo` at this project's patched
`node_modules/@typescript/typescript-win32-x64/lib/tsc.exe --lsp --stdio`, so the
editor uses the same tsc (and Effect plugin settings) as `npm run typecheck`.
The binary path is absolute. Update it if you move the repo. On Windows, don't use
`node_modules/.bin/tsc`: it's a shell script that Zed can't launch.
