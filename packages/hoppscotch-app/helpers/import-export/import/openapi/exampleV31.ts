import { OpenAPIV3_1 as OpenAPIV31 } from "openapi-types"
import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import * as A from "fp-ts/Array"

type MixedArraySchemaType = (OpenAPIV31.ArraySchemaObjectType | OpenAPIV31.NonArraySchemaObjectType)[]

type SchemaType = OpenAPIV31.ArraySchemaObjectType | OpenAPIV31.NonArraySchemaObjectType | MixedArraySchemaType

type PrimitiveSchemaType = Exclude<OpenAPIV31.NonArraySchemaObjectType, "object">

type PrimitiveRequestBodyExampleType = string | number | boolean | null

type RequestBodyExampleType = PrimitiveRequestBodyExampleType | Array<RequestBodyExampleType> | { [name: string]: RequestBodyExampleType }

const isSchemaTypePrimitive = (schemaType: SchemaType) : schemaType is PrimitiveSchemaType => !Array.isArray(schemaType) && !["array", "object"].includes(schemaType)

const getPrimitiveTypePlaceholder = (primitiveType: PrimitiveSchemaType) : PrimitiveRequestBodyExampleType => {
    switch(primitiveType) {
        case "number": return 0.0
        case "integer": return 0
        case "string": return "string"
        case "boolean": return true
    }
    return null
}

// Use carefully, the schema type should necessarily be primitive
// TODO(agarwal): Use Enum values, if any
const generatePrimitiveRequestBodyExample = (schemaObject: OpenAPIV31.NonArraySchemaObject) : RequestBodyExampleType => 
    getPrimitiveTypePlaceholder(schemaObject.type as PrimitiveSchemaType)

// Use carefully, the schema type should necessarily be object
const generateObjectRequestBodyExample = (schemaObject: OpenAPIV31.NonArraySchemaObject) : RequestBodyExampleType =>
    pipe(
        schemaObject.properties,
        O.fromNullable,
        O.map((properties) => Object.entries(properties) as [string, OpenAPIV31.SchemaObject][]),
        O.getOrElseW(() => [] as [string, OpenAPIV31.SchemaObject][]),
        A.reduce(
            {} as {[name: string]: RequestBodyExampleType},
            (aggregatedExample, property) => {
                aggregatedExample[property[0]] = generateRequestBodyExampleFromSchemaObject(property[1])
                return aggregatedExample
            }
        )
    )

// Use carefully, the schema type should necessarily be mixed array
const generateMixedArrayRequestBodyEcample = (schemaObject: OpenAPIV31.SchemaObject) : RequestBodyExampleType =>
    pipe(
        schemaObject,
        schemaObject => schemaObject.type as MixedArraySchemaType,
        A.reduce(
            [] as Array<RequestBodyExampleType>,
            (aggregatedExample, itemType) => {
                // TODO: Figure out how to include non-primitive types as well
                if(isSchemaTypePrimitive(itemType)) {
                    aggregatedExample.push(getPrimitiveTypePlaceholder(itemType))
                }
                return aggregatedExample
            }
        )
    )

const generateArrayRequestBodyExample = (schemaObject: OpenAPIV31.ArraySchemaObject) : RequestBodyExampleType => 
    Array.of(generateRequestBodyExampleFromSchemaObject(schemaObject.items as OpenAPIV31.SchemaObject))

const generateRequestBodyExampleFromSchemaObject = (schemaObject: OpenAPIV31.SchemaObject) : RequestBodyExampleType => {
    // TODO: Handle schema objects with oneof or anyof
    if(schemaObject.example) return schemaObject.example as RequestBodyExampleType
    if(schemaObject.examples) return schemaObject.examples[0] as RequestBodyExampleType
    if(!schemaObject.type) return ""
    if(isSchemaTypePrimitive(schemaObject.type)) return generatePrimitiveRequestBodyExample(schemaObject as OpenAPIV31.NonArraySchemaObject)
    if(schemaObject.type === "object") return generateObjectRequestBodyExample(schemaObject)
    if(schemaObject.type === "array") return generateArrayRequestBodyExample(schemaObject)
    return generateMixedArrayRequestBodyEcample(schemaObject)
}

export const generateRequestBodyExampleFromMediaObject = (mediaObject: OpenAPIV31.MediaTypeObject) : RequestBodyExampleType => {
    if(mediaObject.example) return mediaObject.example as RequestBodyExampleType
    if(mediaObject.examples) return mediaObject.examples[0] as RequestBodyExampleType
    return mediaObject.schema ? generateRequestBodyExampleFromSchemaObject(mediaObject.schema) : ""
}