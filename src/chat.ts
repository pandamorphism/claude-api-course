import Anthropic from "@anthropic-ai/sdk"
import { Console, Effect, Stream } from "effect"
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

export const chatStream = Effect.fn("chatStream")(function* (
  memory: History,
  userText: string,
  options: ChatOptions = {}
) {
  const claude = yield* Claude
  const withUser: History = [...memory, { role: "user", content: userText }]
  const text = yield* claude
    .stream({
      messages: [...withUser],
      ...options,
      max_tokens: 1000,
      model: DEFAULT_MODEL
    })
    .pipe(
      Stream.tap((chunk) =>
        chunk.type === "message_delta"
          ? Console.log(
              `\nStop reason is: ${chunk.delta.stop_reason} \n and the output tokens are: ${chunk.usage.output_tokens}`
            )
          : Effect.void
      ),
      Stream.filter((chunk) => chunk.type === "content_block_delta"),
      Stream.map((contentBlockDelta) => contentBlockDelta.delta),
      Stream.filter((delta) => delta.type === "text_delta"),
      Stream.map((textDelta) => textDelta.text),
      Stream.tap((text) => Effect.sync(() => process.stdout.write(text))),
      Stream.runFold(
        () => "",
        (acc, text) => acc + text
      )
    )
  const history: History = [...withUser, { role: "assistant", content: text }]
  return { text, history }
})
