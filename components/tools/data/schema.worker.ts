import { generateJsonSchema, validateJsonSchema } from './jsonSchema';
self.onmessage = (event: MessageEvent<{ action: 'generate' | 'validate'; json: string; schema: string }>) => {
  try {
    const { action, json, schema } = event.data;
    if (json.length + schema.length > 2_000_000) throw new Error('Schema task input limit: 2 MB');
    const value = JSON.parse(json);
    const result = action === 'generate' ? generateJsonSchema(value) : validateJsonSchema(JSON.parse(schema), value);
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: (error as Error).message }); }
};
