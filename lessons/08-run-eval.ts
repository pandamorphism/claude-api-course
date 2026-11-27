import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
import {
  Array as Arr,
  Console,
  Data,
  Duration,
  Effect,
  FileSystem,
  Layer,
  Match,
  Option,
  Order
} from "effect"
import {
  CHEAP_MODEL,
  Claude,
  ClaudeError,
  describeError,
  textOf
} from "../src/claude.js"
import { Grader, GraderError } from "../src/eval.js"
import { ModelGrader } from "../src/graders/model.js"
import {
  Category,
  Dataset,
  decodeDataset,
  GradeResult,
  TestCase
} from "../src/model.js"

type EvalResult = {
  testCase: TestCase
  output: string
  gradeResult: GradeResult
}
export class EvalCaseError extends Data.TaggedError("EvalCaseError")<{
  readonly testCase: TestCase
  readonly cause: ClaudeError | GraderError
}> {}

export const runPrompt = Effect.fn("runPrompt")(function* (testCase: TestCase) {
  const claude = yield* Claude
  const answer = yield* claude.create({
    model: CHEAP_MODEL,
    max_tokens: 4000,
    system:
      "You are an assistant at the vintage shop Lachako, you answer briefly (2-3 sentences), politely. Shop is located in Japan, delivery only in Japan and prices are in Japanese yen.",
    messages: [
      {
        role: "user",
        content: `Customer question: ${testCase.question}.`
      }
    ]
  })
  return textOf(answer)
})

export const runTestCase = Effect.fn("runTestCase")(
  function* (
    testCase: TestCase
  ): Effect.fn.Return<EvalResult, ClaudeError | GraderError, Claude | Grader> {
    const grader = yield* Grader
    const output = yield* runPrompt(testCase)
    const gradeResult = yield* grader.grade(testCase, output)
    return { testCase, output, gradeResult }
  },
  (effect, testCase) =>
    effect.pipe(
      Effect.mapError((error) => new EvalCaseError({ testCase, cause: error }))
    )
)

export const runEval = Effect.fn("runEval")(function* (dataset: Dataset) {
  const results = yield* Effect.partition(dataset.cases, runTestCase, {
    concurrency: 5
  }).pipe(Effect.timed)
  return results
})

const avgScore = (evalResult: EvalResult[]) =>
  evalResult.length === 0
    ? Option.none()
    : Option.some(
        evalResult.reduce((acc, result) => acc + result.gradeResult.score, 0) /
          evalResult.length
      )

const lowest = (results: EvalResult[]) =>
  Arr.isReadonlyArrayNonEmpty(results)
    ? Option.some(
        Arr.min(
          results,
          Order.mapInput(Order.Number, (r: EvalResult) => r.gradeResult.score)
        )
      )
    : Option.none()

const report = (results: EvalResult[]) => {
  const averageScore = avgScore(results)
  const averageByCategory = Object.fromEntries(
    Category.literals.map((category) => [
      category,
      avgScore(results.filter((r) => r.testCase.category === category))
    ])
  )
  return { averageScore, averageByCategory }
}

const describeCaseError = (e: EvalCaseError) =>
  Match.valueTags(e.cause, {
    ClaudeError: describeError,
    GraderError: (e) => String(e.cause)
  })

const program = Effect.fn("program")(function* () {
  const fs = yield* FileSystem.FileSystem
  const fileContent = yield* fs.readFileString("data/dataset.json")
  const dataset = yield* decodeDataset(fileContent)
  const [duration, [results, fails]] = yield* runEval(dataset)
  yield* fs.writeFileString(
    "data/results-v1.json",
    JSON.stringify(results, null, 2)
  )
  yield* Console.log(`Duration: ${Duration.format(duration)}`)

  yield* Console.log(`Total Fails: ${fails.length}`)
  yield* Console.log(
    `Fails: ${fails.map((f) => `${f.testCase.question}\n${describeCaseError(f)}`).join("\n")}`
  )

  const reportResults = report(results)
  yield* Console.log(
    `Average score: ${Option.getOrElse(reportResults.averageScore, () => "N/A")}`
  )
  yield* Console.log(`Average by category:`)
  const byCategoryReport = Object.entries(reportResults.averageByCategory).map(
    ([category, score]) =>
      `${category}: ${Option.getOrElse(score, () => "N/A")}`
  )
  yield* Console.log(byCategoryReport.join("\n"))
  const lowestScore = lowest(results)
  yield* Console.log(
    `Lowest score: ${Option.match(lowestScore, {
      onNone: () => "N/A",
      onSome: (r) =>
        `question: ${r.testCase.question}\nanswer: ${r.output}\nscore: ${r.gradeResult.score}, reason: ${r.gradeResult.reasoning}, strengths: ${r.gradeResult.strengths}, weaknesses: ${r.gradeResult.weaknesses}`
    })}`
  )
  return results
})

program().pipe(
  Effect.provide(
    Layer.mergeAll(
      Layer.provideMerge(ModelGrader.layer, Claude.layer),
      NodeFileSystem.layer
    )
  ),
  NodeRuntime.runMain
)
