import Ajv, { type SomeJTDSchemaType } from "ajv/dist/jtd";
import { type Schema, validate } from "jtd";
import { bench, group, run } from "mitata";
import {
  compile,
  elements,
  empty,
  properties,
  type SomeRootSchema,
  values,
} from ".";

const ajv = new Ajv();

const validTestStr = await Bun.file(
  new URL("../json-typedef-spec/tests/validation.json", import.meta.url),
).text();
const testsObj = JSON.parse(validTestStr) as unknown;
const validator = values(
  properties({
    schema: empty(),
    instance: empty(),
    errors: elements(empty()),
  }),
);
if (!validator.guard(testsObj)) {
  throw new Error("tests in wrong format");
}
const tests = Object.values(testsObj);

group("compile", () => {
  bench("jtd-ts", () => {
    for (const { schema } of tests) {
      compile(schema as SomeRootSchema);
    }
  });

  bench("ajv", () => {
    for (const { schema } of tests) {
      // @ts-expect-error infinite type
      ajv.compile(schema as SomeJTDSchemaType);
    }
  });
});

group("validate", () => {
  const jtdCompiled = tests.map(({ schema, instance }) => ({
    // @ts-expect-error infinite type
    valid: compile(schema),
    instance,
  }));

  bench("jtd-ts", () => {
    for (const { valid, instance } of jtdCompiled) {
      valid.guard(instance);
    }
  });

  bench("jtd", () => {
    for (const { schema, instance } of tests) {
      validate(schema as Schema, instance);
    }
  });

  const ajvCompiled = tests.map(({ schema, instance }) => ({
    // @ts-expect-error infinite type
    valid: ajv.compile(schema),
    instance,
  }));

  bench("ajv", () => {
    for (const { valid, instance } of ajvCompiled) {
      valid(instance);
    }
  });
});

group("end-to-end", () => {
  bench("jtd-ts", () => {
    for (const { schema, instance } of tests) {
      const valid = compile(schema as SomeRootSchema);
      valid.guard(instance);
    }
  });

  bench("jtd", () => {
    for (const { schema, instance } of tests) {
      validate(schema as Schema, instance);
    }
  });

  bench("ajv (compile)", () => {
    for (const { schema, instance } of tests) {
      const valid = ajv.compile(schema as SomeJTDSchemaType);
      valid(instance);
    }
  });

  bench("ajv (validate)", () => {
    for (const { schema, instance } of tests) {
      ajv.validate(schema as SomeJTDSchemaType, instance);
    }
  });
});

await run();
