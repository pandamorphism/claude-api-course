// Lesson 01: first request + structured JSON output
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { Claude, DEFAULT_MODEL, textOf } from "../src/claude.js"
import { decodeTeapot, TeapotJsonSchema } from "../src/model.js"

const program = Effect.gen(function* () {
  const claude = yield* Claude
  const response = yield* claude.create({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
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
          "Invent a marketplace listing for a vintage Showa-era Japanese teapot. "
      }
    ]
  })

  const teapot = yield* decodeTeapot(textOf(response))
  yield* Console.log(teapot)
  yield* Console.log(
    `tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  )
})

program.pipe(Effect.provide(Claude.layer), NodeRuntime.runMain)
