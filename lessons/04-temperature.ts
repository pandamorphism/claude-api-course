import { Anthropic } from "@anthropic-ai/sdk"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { Claude, DEFAULT_MODEL, describeError, textOf } from "../src/claude.js"

const PROMPT =
  "Suggest one creative name for a vintage Japanese tea shop. Reply with the name only."

const ask = Effect.fn("ask")(function* (model: string, temperature: number) {
  const claude = yield* Claude
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 50,
    messages: [{ role: "user", content: PROMPT }]
  }
  // The SDK types no longer have `temperature`, so we bypass the excess-property check.
  const response = yield* claude.create({
    ...params,
    temperature
  } as Anthropic.MessageCreateParamsNonStreaming)
  return textOf(response)
})

const askDefaultModel = Effect.gen(function* () {
  // anthropic-version 2026-10-21 removed sampling params.
  const response = yield* ask(DEFAULT_MODEL, 1)
  yield* Console.log("response", response)
}).pipe(
  Effect.catchTag("ClaudeError", (e) =>
    Console.error("Got an error:", describeError(e))
  )
)
askDefaultModel.pipe(Effect.provide(Claude.layer), NodeRuntime.runMain)
