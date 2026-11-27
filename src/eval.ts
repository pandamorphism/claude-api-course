import { Context, Data, Effect, Layer } from "effect"
import { Claude, ClaudeError, DEFAULT_MODEL, textOf } from "./claude.js"
import {
  decodeGradeResult,
  GradeResult,
  GradeResultJsonSchema,
  type TestCase
} from "./model.js"

export class GraderError extends Data.TaggedError("GraderError")<{
  readonly cause: unknown
}> {}

export class EvalCaseError extends Data.TaggedError("EvalCaseError")<{
  readonly testCase: TestCase
  readonly cause: ClaudeError | GraderError
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

export class ModelGrader {
  static readonly layer = Layer.effect(
    Grader,
    Effect.gen(function* () {
      const claude = yield* Claude
      const grade = (testCase: TestCase, output: string) =>
        Effect.gen(function* () {
          const prompt = `
            Customer request: ${testCase.question}
            Model Response: ${output}

            Criterias of grading:
            - The response should be relevant to the customer request
            - The response should be on the same language as the customer request
            - 2-3 sentences in polite language
            - The response is not creating rules of shop which model is not aware of
            - The response take into account context of Japanese and JPY currency
            - For off-topic requests, the response should politely back the talk to the shop theme
            - The score must be an integer between 1 and 10 where 1 is the lowest and 10 is the highest and lower is worse and higher is better
            `

          const result = yield* claude.create({
            // use default for better reasoning and grading
            model: DEFAULT_MODEL,
            max_tokens: 5000,
            system: `You are an expert in e-commerce and you are grading a response for a customer request to a Japanese e-commerce shop.`,
            messages: [{ role: "user", content: prompt }],
            output_config: {
              format: {
                type: "json_schema",
                schema: GradeResultJsonSchema.schema
              }
            }
          })
          return yield* decodeGradeResult(textOf(result))
        }).pipe(Effect.mapError((e) => new GraderError({ cause: e })))

      return {
        grade
      }
    })
  )
}
