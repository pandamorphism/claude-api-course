import { Context, Data, Effect, Layer } from "effect"
import type { TestCase } from "./model.js"

export class GraderError extends Data.TaggedError("GraderError")<{
  readonly cause: unknown
}> {}

export class Grader extends Context.Service<
  Grader,
  {
    readonly grade: (
      testCase: TestCase,
      output: string
    ) => Effect.Effect<number, GraderError>
  }
>()("Grader") {}

export class StubGrader {
  static readonly layer = Layer.succeed(Grader, {
    grade: () => Effect.succeed(10)
  })
}
