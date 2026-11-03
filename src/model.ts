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
