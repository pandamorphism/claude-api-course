import Anthropic from "@anthropic-ai/sdk"
import { Effect, Stream } from "effect"
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
  {
    onDelta,
    ...requestOptions
  }: ChatOptions & { onDelta?: (text: string) => void } = {}
) {
  const claude = yield* Claude
  const withUser: History = [...memory, { role: "user", content: userText }]
  const result = yield* claude
    .stream({
      messages: [...withUser],
      ...requestOptions,
      max_tokens: 1000,
      model: DEFAULT_MODEL
    })
    .pipe(
      Stream.tap((chunk) => {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          const deltaText = chunk.delta.text
          return Effect.sync(() => onDelta?.(deltaText))
        }
        return Effect.void
      }),
      Stream.runFold<
        {
          txt: string
          stopReason: Anthropic.StopReason | null
          outputTokens: number | null
        },
        Anthropic.RawMessageStreamEvent
      >(
        () => ({
          txt: "",
          stopReason: null,
          outputTokens: null
        }),
        (acc, chunk) => {
          if (chunk.type === "message_delta") {
            return {
              txt: acc.txt,
              stopReason: chunk.delta.stop_reason,
              outputTokens: chunk.usage.output_tokens
            }
          } else if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            return {
              txt: acc.txt + chunk.delta.text,
              stopReason: acc.stopReason,
              outputTokens: acc.outputTokens
            }
          }
          return acc
        }
      )
    )
  const history: History = [
    ...withUser,
    { role: "assistant", content: result.txt }
  ]
  return {
    text: result.txt,
    stopReason: result.stopReason,
    outputTokens: result.outputTokens,
    history
  }
})
