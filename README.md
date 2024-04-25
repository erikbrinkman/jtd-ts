# jtd-ts

[![build](https://github.com/erikbrinkman/jtd-ts/actions/workflows/build.yml/badge.svg)](https://github.com/erikbrinkman/jtd-ts/actions/workflows/build.yml)
[![docs](https://img.shields.io/badge/docs-docs-blue)](https://erikbrinkman.github.io/jtd-ts/)
[![npm](https://img.shields.io/npm/v/jtd-ts)](https://www.npmjs.com/package/jtd-ts)
[![license](https://img.shields.io/github/license/erikbrinkman/jtd-ts)](LICENSE)

A fully compliant, typescript first jtd validator.

## Overview

When it comes to validating json, [JSON Schema](https://json-schema.org/) is by far the widest used, but often it's simpler cousin [JSON Type Definition (JTD)](https://jsontypedef.com/) is a better alternative.

However, when it comes to validating JTD, there are really only two options: [`jtd`](https://www.npmjs.com/package/jtd) and [`ajv`](https://www.npmjs.com/package/ajv). Unfortunately, `jtd` hasn't been updated since 2021, and lacks typescript support, while `ajv` does have typescript support, but is in maintanence mode.

Inspired by [`jsontypedef`](https://www.npmjs.com/package/jsontypedef), this library aims to provide three things:

1. a JTD validator that supports typescript typing.
2. a typescript native format for concisely and cleanly expressing JTD schemas.
3. a generic schema interface that also supports fuzzing and exporting of the JTD schema it represents.

## Usage

```sh
npm install jtd-ts
```

For full usage, see the [docs](//).

Caveats:

- the native interface does not support recurisve refs
- "timestamp" will only validate `string`s not `Date`s

### Native Interface

The native intreface involves calling named functions to construct a schema object:

```ts
import { boolean, properties, float64 } from "jtd-ts";

const schema = properties({ bool: boolean() }, { optFloat: float64() });

// guard against unknown objects with `.guard()`
const obj: unknown = // ...
if (schema.guard(obj)) {
    obj satisfies { bool: boolean; optFloat?: number };
}

// create random data that complies with schema with `.fuzz()`
const fuzzed: { bool: boolean; optFloat?: number } = schema.fuzz();

// get a fully typed output schema with `.schema()`
const export: {
    properties: { bool: { type: "boolean" } };
    optionalProperties: { optFloat: { type: "float64" } };
} = schema.schema();
```

### Compile Interface

However, if you already have a JTD input, you don't need to convert it to a new interface, you can pass it directly to the `compile()` function which will infer everything from the static type:

```ts
import { compile } from "jtd-ts";

const schema = compile({
    properties: { bool: { type: "boolean" } },
    optionalProperties: { optFloat: { type: "float64" } },
});

// guard against unknown objects with `.guard()`
const obj: unknown = // ...
if (schema.guard(obj)) {
    obj satisfies { bool: boolean; optFloat?: number };
}

// create random data that complies with schema with `.fuzz()`
const fuzzed: { bool: boolean; optFloat?: number } = schema.fuzz();
```

Unlike the native interface, this interface also supports circular `ref`s, although typescript doesn't always catch misspellings in refs.

## Speed

`jtd-ts` wasn't designed to be particularly fast, and in general, it's not. Compared to `ajv`, it's about 6x slower for validating a single object. It's also about twice as slow as `jtd`. However, all of this time is in startup. After compiling the schema, it's actually twice as fast as `ajv`, meaning for workloads that can afford a slower startup, and make a lot of validation calls, this will win out.

Below are the results of some benchmarks.
`compile` indicates parsing a schema definition, but not validating, this is the start-up cost.
`validate` indicates just validating, this is the marginal cost for validaing another object.
Since `jtd` doesn't compile anything, it's significantly slower here.
`end-to-end` indicates the time to do one full pass, e.g. parsing and validating once. This is the total cost of a single use.

```text
benchmark           time (avg)             (min … max)       p75       p99      p999
------------------------------------------------------ -----------------------------
• compile
------------------------------------------------------ -----------------------------
jtd-ts          76'930 ns/iter    (61'250 ns … 942 µs) 75'083 ns    146 µs    735 µs
ajv              4'414 ns/iter   (4'303 ns … 4'697 ns)  4'478 ns  4'657 ns  4'697 ns

summary for compile
  ajv
   17.43x faster than jtd-ts

• validate
------------------------------------------------------ -----------------------------
jtd-ts           7'175 ns/iter     (6'292 ns … 564 µs)  6'959 ns 10'625 ns 18'917 ns
jtd             48'986 ns/iter    (33'334 ns … 653 µs) 63'333 ns 87'083 ns    579 µs
ajv             12'839 ns/iter   (8'208 ns … 1'088 µs) 12'583 ns 37'500 ns    469 µs

summary for validate
  jtd-ts
   1.79x faster than ajv
   6.83x faster than jtd

• end-to-end
------------------------------------------------------ -----------------------------
jtd-ts          82'570 ns/iter    (70'333 ns … 747 µs) 79'583 ns    140 µs    640 µs
jtd             47'567 ns/iter    (33'750 ns … 753 µs) 62'458 ns 79'792 ns    565 µs
ajv (compile)   14'326 ns/iter    (11'042 ns … 623 µs) 14'000 ns 33'458 ns    432 µs
ajv (validate)  15'535 ns/iter    (12'042 ns … 615 µs) 15'208 ns 35'541 ns    446 µs

summary for end-to-end
  ajv (compile)
   1.08x faster than ajv (validate)
   3.32x faster than jtd
   5.76x faster than jtd-ts
```
