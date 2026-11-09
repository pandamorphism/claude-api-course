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
    messages: [...withUser],
    ...options
  })
  const text = textOf(response)
  const history: History = [...withUser, { role: "assistant", content: text }]
  return { text, history }
})
type StreamResult = {
  txt: string
  stopReason: Anthropic.StopReason | null
  outputTokens: number | null
}
const isTextDelta = (
  e: Anthropic.RawMessageStreamEvent
): e is Anthropic.RawContentBlockDeltaEvent & { delta: Anthropic.TextDelta } =>
  e.type === "content_block_delta" && e.delta.type === "text_delta"

export const chatStream = Effect.fn("chatStream")(function* (
  memory: History,
  userText: string,
  {
    onDelta,
    ...requestOptions
  }: ChatOptions & { onDelta?: (text: string) => Effect.Effect<void> } = {}
) {
  const claude = yield* Claude
  const withUser: History = [...memory, { role: "user", content: userText }]
  const result = yield* claude
    .stream({
      max_tokens: 1000,
      model: DEFAULT_MODEL,
      messages: [...withUser],
      ...requestOptions
    })
    .pipe(
      Stream.tap((chunk) => {
        if (isTextDelta(chunk)) {
          const deltaText = chunk.delta.text
          return onDelta ? onDelta(deltaText) : Effect.void
        }
        return Effect.void
      }),
      Stream.runFold(
        (): StreamResult => ({
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
          } else if (isTextDelta(chunk)) {
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
