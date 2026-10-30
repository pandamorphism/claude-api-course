import { Effect, Console } from "effect"
import { Claude, DEFAULT_MODEL, textOf } from "../src/claude.js"
import Anthropic from "@anthropic-ai/sdk"
import { NodeRuntime } from "@effect/platform-node"

type History = ReadonlyArray<Anthropic.MessageParam>

const chat = Effect.fn("chat")(function* (memory: History, userText: string) {
  const claude = yield* Claude
  const withUser: History = [...memory, { role: "user", content: userText }]

  const response = yield* claude.create({
    max_tokens: 1024,
    model: DEFAULT_MODEL,
    messages: [...withUser]
  })
  const text = textOf(response)
  const history: History = [...withUser, { role: "assistant", content: text }]
  return { text, history }
})
const program = Effect.gen(function* () {
  const r1 = yield* chat(
    [],
    "think of a number from 1 to 100 and say it out of loud"
  )
  yield* Console.log("R1", r1.text)
  const r2 = yield* chat(r1.history, "What number did you think of?")
  yield* Console.log("R2", r2.text)
})

program.pipe(Effect.provide(Claude.layer), NodeRuntime.runMain)
