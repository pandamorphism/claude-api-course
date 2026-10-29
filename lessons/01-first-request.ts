// Lesson 01: first request + structured JSON output
// Python original: client.messages.create(...) then json.loads / Pydantic model_validate_json.
// Here: Claude service (src/claude.ts) + Schema.fromJsonString for decoding.
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect, Schema } from "effect"
import { Claude, DEFAULT_MODEL, textOf } from "../src/claude.js"

const Teapot = Schema.Struct({
  title: Schema.String,
  priceJpy: Schema.Finite,
  tags: Schema.Array(Schema.String)
})

const decodeTeapot = Schema.decodeEffect(Schema.fromJsonString(Teapot))

// Models sometimes wrap JSON in ```json fences even when told not to.
const stripFences = (text: string) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")

const program = Effect.gen(function*() {
  const claude = yield* Claude
  const response = yield* claude.create({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    messages: [{
      role: "user",
      content: "Invent a marketplace listing for a vintage Showa-era Japanese teapot. " +
        "Respond with only a JSON object (no prose, no code fences) of the shape " +
        '{"title": string, "priceJpy": number, "tags": string[]}.'
    }]
  })

  const teapot = yield* decodeTeapot(stripFences(textOf(response)))
  yield* Console.log(teapot)
  yield* Console.log(`tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`)
})

program.pipe(Effect.provide(Claude.layer), NodeRuntime.runMain)
