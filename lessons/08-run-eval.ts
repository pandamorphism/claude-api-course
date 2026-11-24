import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
import { Console, Duration, Effect, FileSystem, Layer, Option } from "effect"
import { CHEAP_MODEL, Claude, ClaudeError, textOf } from "../src/claude.js"
import { Grader, GraderError, StubGrader } from "../src/eval.js"
import { Category, Dataset, decodeDataset, TestCase } from "../src/model.js"

type EvalResult = {
  testCase: TestCase
  output: string
  score: number
}

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

export const runTestCase = Effect.fn("runTestCase")(function* (
  testCase: TestCase
): Effect.fn.Return<EvalResult, ClaudeError | GraderError, Claude | Grader> {
  const grader = yield* Grader
  const output = yield* runPrompt(testCase)
  const score = yield* grader.grade(testCase, output)
  return { testCase, output, score }
})

export const runEval = Effect.fn("runEval")(function* (dataset: Dataset) {
  const results = yield* Effect.forEach(dataset.cases, runTestCase, {
    concurrency: 5
  }).pipe(Effect.timed)
  return results
})

const avgScore = (results: EvalResult[]) =>
  results.length === 0
    ? Option.none()
    : Option.some(
        results.reduce((acc, result) => acc + result.score, 0) / results.length
      )

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

const program = Effect.fn("program")(function* () {
  const fs = yield* FileSystem.FileSystem
  const fileContent = yield* fs.readFileString("data/dataset.json")
  const dataset = yield* decodeDataset(fileContent)
  const [duration, results] = yield* runEval(dataset)
  yield* fs.writeFileString(
    "data/results-v1.json",
    JSON.stringify(results, null, 2)
  )
  yield* Console.log(`Duration: ${Duration.format(duration)}`)
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

  return results
})

program().pipe(
  Effect.provide(
    Layer.mergeAll(Claude.layer, StubGrader.layer, NodeFileSystem.layer)
  ),
  Effect.tap((results) => Console.log(results)),
  NodeRuntime.runMain
)
