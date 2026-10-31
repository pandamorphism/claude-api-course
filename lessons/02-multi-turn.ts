import { Effect, Console } from "effect"
import { Claude, DEFAULT_MODEL, textOf } from "../src/claude.js"
import Anthropic from "@anthropic-ai/sdk"
import { NodeRuntime } from "@effect/platform-node"
import { chat } from "../src/chat.js"

const program = Effect.gen(function* () {
  const r1 = yield* chat(
    [],
    "think of a number from 1 to 100 and say it out loud"
  )
  yield* Console.log("R1", r1.text)
  const r2 = yield* chat(r1.history, "What number did you think of?")
  yield* Console.log("R2", r2.text)

  const control = yield* chat([], "What number did you think of?")
  yield* Console.log("Control (no history)", control.text)
})

program.pipe(Effect.provide(Claude.layer), NodeRuntime.runMain)
