import { Schema } from "effect"

export const Teapot = Schema.Struct({
  title: Schema.String,
  priceJpy: Schema.Finite,
  tags: Schema.Array(Schema.String)
})
export const decodeTeapot = Schema.decodeEffect(Schema.fromJsonString(Teapot))
export const TeapotJsonSchema = Schema.toJsonSchemaDocument(Teapot, {
  onExcessProperty: "error"
})

export const Category = Schema.Literals([
  "shipping",
  "sizing",
  "condition",
  "returns",
  "off_topic"
])

export const TestCase = Schema.Struct({
  question: Schema.String,
  language: Schema.Literals(["en", "ja"]),
  category: Category
})
export type TestCase = typeof TestCase.Type

export const Dataset = Schema.Struct({
  cases: Schema.Array(TestCase)
})
export type Dataset = typeof Dataset.Type

export const decodeDataset = Schema.decodeEffect(Schema.fromJsonString(Dataset))

export const DatasetJsonSchema = Schema.toJsonSchemaDocument(Dataset, {
  onExcessProperty: "error"
})
