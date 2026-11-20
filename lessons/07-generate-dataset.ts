import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
import { Array, Console, Data, Effect, FileSystem, Layer } from "effect"
import { CHEAP_MODEL, Claude, describeError, textOf } from "../src/claude.js"
import {
  Category,
  Dataset,
  DatasetJsonSchema,
  decodeDataset
} from "../src/model.js"
export class CoverageError extends Data.TaggedError("CoverageError")<{
  readonly message: string
  readonly dataset: Dataset
}> {
  static readonly fromFailedNumberOfTestCases = (dataset: Dataset) =>
    new CoverageError({
      message: `Failed to generate dataset: test cases failed`,
      dataset
    })
}
const generateDataset = Effect.fn("GenerateDataset")(function* () {
  const claude = yield* Claude
  const response = yield* claude.create({
    model: CHEAP_MODEL,
    max_tokens: 4000,
    system: "You represent customers of vintage shop name Lachako",
    messages: [
      {
        role: "user",
        content:
          "Create 15 cases, 3 per category, at least 5 in Japanese, and returns cases that hint at a return without using the word. In the returns category, the customer only describes a problem with the item they received (wrong size, defect, differs from the photos). They must NOT ask for a refund, their money back, or to send the item back."
      }
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: DatasetJsonSchema.schema
      }
    }
  })
  return yield* decodeDataset(textOf(response))
})

export const checkCoverage = (dataset: Dataset) => {
  const casesByCategory = Array.groupBy(
    dataset.cases,
    (testCase) => testCase.category
  )
  const hasMissingCategories =
    Array.difference(Category.literals, Object.keys(casesByCategory)).length > 0

  const casesByLangugage = Array.groupBy(
    dataset.cases,
    (testCase) => testCase.language
  )
  const jpCount = casesByLangugage.ja?.length ?? 0

  if (hasMissingCategories || jpCount < 5 || dataset.cases.length < 15) {
    return Effect.fail(CoverageError.fromFailedNumberOfTestCases(dataset))
  }
  return Effect.succeed(dataset)
}

const saveDataset = Effect.fn("SaveDataset")(function* (dataset: Dataset) {
  const fs = yield* FileSystem.FileSystem
  yield* fs.makeDirectory("data", { recursive: true })
  yield* fs.writeFileString(
    "data/dataset.json",
    JSON.stringify(dataset, null, 2)
  )
})

const program = generateDataset().pipe(
  Effect.andThen((dataset) => checkCoverage(dataset)),
  Effect.tap(saveDataset),
  Effect.tap((dataset) =>
    Console.log(
      "Dataset saved. Returns cases:",
      dataset.cases.filter((c) => c.category === "returns")
    )
  ),
  Effect.provide(Layer.mergeAll(NodeFileSystem.layer, Claude.layer)),
  Effect.tapError((err) => {
    switch (err._tag) {
      case "ClaudeError":
        return Console.error(describeError(err))
      case "CoverageError":
        return Console.error(err.message, err.dataset)
      default:
        return Console.error(err)
    }
  }),
  Effect.tapDefect((err) => Console.error(err))
)

program.pipe(NodeRuntime.runMain({ disableErrorReporting: true }))
