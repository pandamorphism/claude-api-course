import { Context, Data, Effect, Layer } from "effect"
import { GradeResult, type TestCase } from "./model.js"

export class GraderError extends Data.TaggedError("GraderError")<{
  readonly cause: unknown
}> {}

export class Grader extends Context.Service<
  Grader,
  {
    readonly grade: (
      testCase: TestCase,
      output: string
    ) => Effect.Effect<GradeResult, GraderError>
  }
>()("Grader") {}

export class StubGrader {
  static readonly layer = Layer.succeed(Grader, {
    grade: () =>
      Effect.succeed({
        score: 10,
        reasoning: "Stub grader always returns a score of 10",
        strengths: [],
        weaknesses: []
      })
  })
}
