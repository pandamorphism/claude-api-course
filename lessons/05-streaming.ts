import { NodeRuntime } from "@effect/platform-node"
import { Clock, Console, Effect, Option, Ref, Stream } from "effect"
import { Claude, DEFAULT_MODEL, describeError } from "../src/claude.js"

const askStream = Effect.fn("askStream")(function* () {
  const claude = yield* Claude
  const timeMetrics = yield* Ref.make<{
    firstChunkResponse: Option.Option<number>
  }>({ firstChunkResponse: Option.none() })
  const start = yield* Clock.currentTimeMillis
  yield* claude
    .stream({
      messages: [
        {
          role: "user",
          content:
            "Is Black silk tomesode, 1970s, family crests kimono suitable for a wedding?"
        }
      ],
      max_tokens: 1000,
      model: DEFAULT_MODEL
    })
    .pipe(
      Stream.filter((chunk) => chunk.type === "content_block_delta"),
      Stream.map((contentBlockDelta) => contentBlockDelta.delta),
      Stream.filter((delta) => delta.type === "text_delta"),
      Stream.tap((_) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          yield* Ref.update(timeMetrics, (metrics) => {
            return Option.isNone(metrics.firstChunkResponse)
              ? {
                  ...metrics,
                  firstChunkResponse: Option.some(now - start)
                }
              : metrics
          })
        })
      ),
      Stream.map((textDelta) => textDelta.text),
      Stream.runForEach((text) =>
        Effect.sync(() => process.stdout.write(text))
      ),
      Effect.tap(() => Console.log())
    )
  const end = yield* Clock.currentTimeMillis
  const metrics = yield* Ref.get(timeMetrics)
  yield* Option.match(metrics.firstChunkResponse, {
    onSome: (responseTime) =>
      Console.log(`\nFirst chunk response: ${responseTime}ms`),
    onNone: () => Console.log("First chunk response: N/A")
  })
  yield* Console.log(`\nTotal time: ${end - start}ms`)
})

askStream().pipe(
  Effect.catchTag("ClaudeError", (err) => Console.error(describeError(err))),
  Effect.provide(Claude.layer),
  NodeRuntime.runMain
)
