import Anthropic from "@anthropic-ai/sdk"
import { Effect } from "effect"
import { Claude, DEFAULT_MODEL, textOf } from "./claude.js"

export type History = ReadonlyArray<Anthropic.MessageParam>
export type ChatOptions = Partial<
  Pick<Anthropic.MessageCreateParamsNonStreaming, "system">
>
export const chat = Effect.fn("chat")(function* (
  memory: History,
  userText: string,
  options: ChatOptions = {}
) {
  const claude = yield* Claude
  const withUser: History = [...memory, { role: "user", content: userText }]

  const response = yield* claude.create({
    max_tokens: 1024,
    model: DEFAULT_MODEL,
    ...options,
    messages: [...withUser]
  })
  const text = textOf(response)
  const history: History = [...withUser, { role: "assistant", content: text }]
  return { text, history }
})
