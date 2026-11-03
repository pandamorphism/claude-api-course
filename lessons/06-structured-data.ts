import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { Claude, DEFAULT_MODEL, describeError, textOf } from "../src/claude.js"
import { decodeTeapot, TeapotJsonSchema } from "../src/model.js"

const experimentA = Effect.gen(function* () {
  const claude = yield* Claude
  const response = yield* claude.create({
    model: DEFAULT_MODEL,
    max_tokens: 1000,
    stop_sequences: ["```"],
    messages: [
      {
        role: "user",
        content:
          "Invent a marketplace listing for a vintage Showa-era Japanese teapot. " +
          "Respond with only a JSON object (no prose, no code fences) of the shape " +
          '{"title": string, "priceJpy": number, "tags": string[]}.'
      },
      {
        role: "assistant",
        content: "```json"
      }
    ]
  })

  yield* Console.log(textOf(response))
  yield* Console.log(response.stop_reason)
  yield* Console.log(
    `tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  )
})

const experimentB = Effect.gen(function* () {
  const claude = yield* Claude
  yield* Console.log("JsonSchema", JSON.stringify(TeapotJsonSchema, null, 2))
  const response = yield* claude.create({
    model: DEFAULT_MODEL,
    max_tokens: 1000,
    output_config: {
      format: {
        type: "json_schema",
        schema: TeapotJsonSchema.schema
      }
    },
    messages: [
      {
        role: "user",
        content:
          "Invent a marketplace listing for a vintage Showa-era Japanese teapot."
      }
    ]
  })

  const teapot = yield* decodeTeapot(textOf(response))
  yield* Console.log(teapot)
  yield* Console.log(
    `tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  )
})

experimentA.pipe(
  Effect.catchTag("ClaudeError", (err) => Console.error(describeError(err))),
  Effect.andThen(() =>
    experimentB.pipe(
      Effect.catchTag("ClaudeError", (err) => Console.error(describeError(err)))
    )
  ),
  Effect.provide(Claude.layer),
  NodeRuntime.runMain
)
