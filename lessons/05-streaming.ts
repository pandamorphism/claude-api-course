import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect, Stream } from "effect"
import { Claude, DEFAULT_MODEL, describeError } from "../src/claude.js"

const askStream = Effect.fn("AskStream")(function* () {
  const claude = yield* Claude
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
      Stream.map((textDelta) => textDelta.text),
      Stream.runForEach((text) => Effect.sync(() => process.stdout.write(text)))
    )
})

askStream().pipe(
  Effect.catchTag("ClaudeError", (err) => Console.error(describeError(err))),
  Effect.provide(Claude.layer),
  NodeRuntime.runMain
)
