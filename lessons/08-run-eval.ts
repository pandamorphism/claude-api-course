import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
import { Console, Duration, Effect, FileSystem, Layer, Option } from "effect"
import { CHEAP_MODEL, Claude, textOf } from "../src/claude.js"
import { Grader, StubGrader } from "../src/eval.js"
import { Category, Dataset, decodeDataset, TestCase } from "../src/model.js"

type GraderResult = {
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
) {
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

const avgScore = (results: GraderResult[]) =>
  results.length === 0
    ? Option.none()
    : Option.some(
        results.reduce((acc, result) => acc + result.score, 0) / results.length
      )

const report = (results: GraderResult[]) => {
  const averageScore = avgScore(results)
  const byCategory = Category.literals.reduce(
    (acc, category) => {
      acc[category] = results.filter(
        (result) => result.testCase.category === category
      )
      return acc
    },
    {} as Record<string, GraderResult[]>
  )

  const averageByCategory = Object.fromEntries(
    Object.entries(byCategory).map(([category, results]) => [
      category,
      avgScore(results)
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
