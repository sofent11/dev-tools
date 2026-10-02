import Ajv, { type AnySchema } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true, ownProperties: true });
addFormats(ajv);
export const validateJsonSchema = (schema: unknown, data: unknown): string[] => {
  try {
    const validate = ajv.compile(schema as AnySchema);
    const valid = validate(data);
    const errors = valid ? [] : (validate.errors ?? []).map(error =>
      `${error.instancePath || '/'}: ${error.message} (${JSON.stringify(error.params)})`);
    ajv.removeSchema(schema as AnySchema);
    return errors;
  } catch (error) {
    return [`Unsupported or invalid draft-07 schema: ${(error as Error).message}`];
  }
};

export const generateJsonSchema = (value: unknown): Record<string, unknown> => {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    const variants = [...new Map(value.map(item => {
      const schema = generateJsonSchema(item);
      return [JSON.stringify(schema), schema];
    })).values()];
    return { type: 'array', items: variants.length === 0 ? {} : variants.length === 1 ? variants[0] : { anyOf: variants } };
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return { type: 'object', properties: Object.fromEntries(entries.map(([key, item]) => [key, generateJsonSchema(item)])), required: entries.map(([key]) => key) };
  }
  return { type: typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value };
};
