import Anthropic from "@anthropic-ai/sdk"
import {
  Config,
  Context,
  Data,
  Effect,
  Layer,
  Redacted,
  Schedule
} from "effect"

export const DEFAULT_MODEL = "claude-opus-5-5"

export class ClaudeError extends Data.TaggedError("ClaudeError")<{
  readonly cause: unknown
}> {}

// 408/409/429/5xx and network failures are worth retrying; 400/401/404 are not.
const isRetryable = (error: ClaudeError): boolean =>
  !(error.cause instanceof Anthropic.APIError) ||
  error.cause.status === undefined ||
  [408, 409, 429].includes(error.cause.status) ||
  error.cause.status >= 500

export class Claude extends Context.Service<
  Claude,
  {
    readonly create: (
      params: Anthropic.MessageCreateParamsNonStreaming
    ) => Effect.Effect<Anthropic.Message, ClaudeError>
  }
>()("Claude") {
  static readonly layer = Layer.effect(
    Claude,
    Effect.gen(function* () {
      const apiKey = yield* Config.Redacted("ANTHROPIC_API_KEY")
      // Retries are owned by Effect below, so turn off the SDK's own.
      const client = new Anthropic({
        apiKey: Redacted.value(apiKey),
        maxRetries: 0
      })

      const create = (params: Anthropic.MessageCreateParamsNonStreaming) =>
        Effect.tryPromise({
          try: (signal) => client.messages.create(params, { signal }),
          catch: (cause) => new ClaudeError({ cause })
        }).pipe(
          Effect.retry({
            schedule: Schedule.exponential("500 millis"),
            times: 3,
            while: isRetryable
          })
        )

      return Claude.of({ create })
    })
  )
}

/** Concatenates the text blocks of a response (skipping thinking/tool blocks). */
export const textOf = (message: Anthropic.Message): string =>
  message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
