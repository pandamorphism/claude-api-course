import { Context, Effect, Layer } from "effect"
import { ClaudeError } from "./claude.js"
import type { TestCase } from "./model.js"

export class Grader extends Context.Service<
  Grader,
  {
    readonly grade: (
      testCase: TestCase,
      output: string
    ) => Effect.Effect<number, ClaudeError>
  }
>()("Grader") {}

export class StubGrader {
  static readonly layer = Layer.succeed(Grader, {
    grade: () => Effect.succeed(10)
  })
}
