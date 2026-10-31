import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { chat } from "../src/chat.js"
import { Claude } from "../src/claude.js"

const program = Effect.gen(function* () {
  const r1 = yield* chat([], "Is this kimono suitable for a wedding?")
  yield* Console.log("R1", r1.text)

  const r2 = yield* chat(
    [],
    "Is Black silk tomesode, 1970s, family crests kimono suitable for a wedding?",
    {
      system:
        "You are an assistant at the vintage shop Lachako, you answer briefly (2-3 sentences), politely, and at the end you suggest looking at similar items."
    }
  )
  yield* Console.log("R2", r2.text)
})

program.pipe(Effect.provide(Claude.layer), NodeRuntime.runMain)
