/**
 * `jtd-ts` is a typescript first jtd parser, validator, and fuzzer
 *
 * The root of the API is exposed through a {@link CompiledSchema}, which represents a
 * compiled JTD schema and has methods for {@link CompiledSchema#guard | `guard`}ing if an
 * object complies, {@link CompiledSchema#fuzz | `fuzz`}ing random objects, or getting the
 * underlying {@link CompiledSchema#schema `schema`}.
 *
 * There are two primary ways to compile a schema, using native typescript
 * functions, or compiling a raw schema.
 *
 * ## Native Typescript Functions
 *
 * The first is the typescript native way, using functions that have similar
 * names to their JTD counterparts, e.g. {@link boolean}. The advantage of this
 * aproach is that it's a little less verbose, and it skips some checks compared
 * to compiling a raw schema. The disadvantage is that there are some concncepts
 * in JTD that this can not express, primarily, circular refs. This interface
 * doesn't allow declaring an infinite type.

 * Every function except for {@link compile} corresponds to its appropriate
 * schema definition. In addition, there are three functions that behave
 * slightly differently.
 * 1. {@link nullable} - modifies an existing schema to make it nullable
 * 2. {@link metadata} - modifies an existing schema to include metadata, the
 *    type of the metadata is preserved.
 * 3. {@link definitions} - creates a builder to accurately type a directed
 *    acyclic graph of definitions and references, before needing to call 
 *    {@link Definitions#build | `build`} to create the actual
 *    {@link CompiledSchema}.
 *
 * ### Usage
 * ```ts
 * import { boolean, properties, float64 } from "jtd-ts";
 *
 * const schema = properties({ bool: boolean() }, { optFloat: float64() });
 *
 * // guard against unknown objects with `.guard()`
 * const obj: unknown = // ...
 * if (schema.guard(obj)) {
 *     obj satisfies { bool: boolean; optFloat?: number };
 * }
 *
 * // create random data that complies with schema with `.fuzz()`
 * const fuzzed: { bool: boolean; optFloat?: number } = schema.fuzz();
 *
 * // get a fully typed output schema with `.schema()`
 * const export: {
 *     properties: { bool: { type: "boolean" } };
 *     optionalProperties: { optFloat: { type: "float64" } };
 * } = schema.schema();
 * ```
 *
 * ## Schema Compilation
 *
 * If you've defined your schema elsewhere, you can similarly just compile it in
 * typescript. The advantage of this is portability, and typescript will infer
 * the appropriate type for the guards. It can also handle circular refs. The
 * downside is it's more verbose, and the type checking doesn't regonize all
 * errors, so if you're not targeting portability, the other interface is
 * better, and can still export the corresponding schema.
 *
 * In addition to the {@link compile} function, this API also exposes interfaces
 * for the various schemas, like {@link BooleanSchema}.
 *
 * ### Usage
 * ```ts
 * import { compile } from "jtd-ts";
 *
 * const schema = compile({
 *     properties: { bool: { type: "boolean" } },
 *     optionalProperties: { optFloat: { type: "float64" } },
 * });
 *
 * // guard against unknown objects with `.guard()`
 * const obj: unknown = // ...
 * if (schema.guard(obj)) {
 *     obj satisfies { bool: boolean; optFloat?: number };
 * }
 *
 * // create random data that complies with schema with `.fuzz()`
 * const fuzzed: { bool: boolean; optFloat?: number } = schema.fuzz();
 * ```
 *
 *
 *
 * @packageDocumentation
 */

import { concat, filter, map, range } from "./iter";
import { bernoulli, chars, choice, gaussian, poisson, uniform } from "./random";
import { type IntType, intBounds, isRecord, isTimestamp } from "./utils";

export type { IntType };

/**
 * a compiled schema that allows various functions
 *
 *
 *
 * @typeParam T - the type that this schema validates
 * @typeParam S - the type of the JTD schema that corresponds to this compiled schema
 */
export interface CompiledSchema<T, S> {
  /**
   * guard for if the input complies with the schema
   *
   * @example
   * const schema = boolean();
   * const val: unknown = // ...
   * if (schema.guard(val)) {
   *     val satisfies boolean;
   * }
   */
  guard(inp: unknown): inp is T;

  /**
   * guard for if the input complies with the schema
   *
   * If the guard fails, this will raise an exception with information about why
   * the schema failed. Ideally this would be a raw assert but typescript
   * doesn't allow that.
   *
   * @example
   * const schema = boolean();
   * const val: unknown = // ...
   * if (schema.guardAssert(val)) {
   *     val satisfies boolean;
   * }
   */
  guardAssert(inp: unknown): inp is T;

  /**
   * generate a random item that complies with this schema
   *
   * @example
   * const schema = nullable(boolean());
   * const val: boolean | null = schema.fuzz();
   */
  fuzz(): T;

  /**
   * produce the raw schema
   *
   * @example
   * const schema = nullable(boolean);
   * const raw: { type: "boolean", nullable: true } = schema.schema();
   */
  schema(): S;

  /** @ignore */
  readonly definitions?: true;

  /** @ignore */
  readonly nullable?: true;

  /** @ignore */
  readonly keys?: Readonly<Set<string>>;

  /** @ignore */
  pathErrors(inp: unknown): Iterable<[string[], string]>;
}

type Entries<V = unknown> = readonly (readonly [
  string,
  CompiledSchema<V, unknown>,
])[];

function formatKey(key: string): string {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? `.${key}` : `["${key}"]`;
}

function formatType(obj: unknown): string {
  return obj === null ? "null" : Array.isArray(obj) ? "array" : typeof obj;
}

abstract class CompiledSchemaMixin<T> {
  abstract pathErrors(inp: unknown): Iterable<[string[], string]>;

  abstract schema(): unknown;

  guard(inp: unknown): inp is T {
    for (const _ of this.pathErrors(inp)) {
      return false; // any error is a failure
    }
    return true;
  }

  guardAssert(inp: unknown): inp is T {
    const errors = [];
    for (const [path, error] of this.pathErrors(inp)) {
      const unified = path.reverse().join("") || ".";
      errors.push(`${unified}: ${error}`);
    }
    if (errors.length) {
      const current = JSON.stringify(inp, null, 2);
      const schema = JSON.stringify(this.schema(), null, 2);
      throw new Error(
        `Validation errors:\n${errors.join("\n")}\n\nWhile trying to validate:\n${current}\n\nAgainst schema:\n${schema}`,
      );
    } else {
      return true;
    }
  }
}

class CompiledNullable<T, S>
  extends CompiledSchemaMixin<T | null>
  implements
    CompiledSchema<
      T | null,
      {
        [K in keyof (S & Record<"nullable", true>)]: (S &
          Record<"nullable", true>)[K];
      }
    >
{
  #wrapped: CompiledSchema<T, S>;
  definitions?: true;
  nullable = true as const;

  constructor(wrapped: CompiledSchema<T, S>) {
    super();
    this.#wrapped = wrapped;
    this.definitions = wrapped.definitions;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (inp !== null) {
      for (const [path, error] of this.#wrapped.pathErrors(inp)) {
        yield [path, `${error} or ${formatType(inp)} is not null`];
      }
    }
  }

  fuzz(): T | null {
    return bernoulli(0.1) ? null : this.#wrapped.fuzz();
  }

  schema(): {
    [K in keyof (S & Record<"nullable", true>)]: (S &
      Record<"nullable", true>)[K];
  } {
    return {
      ...this.#wrapped.schema(),
      nullable: true,
    };
  }
}

/**
 * schema that allows null values
 *
 * @example
 * const schema = nullable(boolean());
 */
export function nullable<const T, const S>(
  val: CompiledSchema<T, S>,
): CompiledSchema<
  T | null,
  {
    [K in keyof (S & Record<"nullable", true>)]: (S &
      Record<"nullable", true>)[K];
  }
> {
  return new CompiledNullable(val);
}

class CompiledMetadata<T, S, M>
  extends CompiledSchemaMixin<T>
  implements
    CompiledSchema<
      T,
      {
        [K in keyof (S & Record<"metadata", M>)]: (S &
          Record<"metadata", M>)[K];
      }
    >
{
  readonly #wrapped: CompiledSchema<T, S>;
  readonly #metadata: M;
  readonly definitions?: true;
  readonly nullable?: true;

  constructor(wrapped: CompiledSchema<T, S>, metadata: M) {
    super();
    this.#wrapped = wrapped;
    this.#metadata = metadata;
    this.definitions = wrapped.definitions;
    this.nullable = wrapped.nullable;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    yield* this.#wrapped.pathErrors(inp);
  }

  fuzz(): T {
    return this.#wrapped.fuzz();
  }

  schema(): {
    [K in keyof (S & Record<"metadata", M>)]: (S & Record<"metadata", M>)[K];
  } {
    return {
      ...this.#wrapped.schema(),
      metadata: this.#metadata,
    };
  }
}

/**
 * add metadata to a schema
 *
 * @example
 * const schema = metadata(boolean(), "flag");
 * const raw: { type: "boolean", metadata: "flag" } = schema.schema();
 */
export function metadata<const T, const S, const M>(
  val: CompiledSchema<T, S>,
  metadata: M,
): CompiledSchema<
  T,
  {
    [K in keyof (S & Record<"metadata", M>)]: (S & Record<"metadata", M>)[K];
  }
> {
  return new CompiledMetadata(val, metadata);
}

class CompiledEmpty
  extends CompiledSchemaMixin<unknown>
  implements CompiledSchema<unknown, {}>
{
  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (inp === undefined) {
      yield [[], "value is undefined"];
    }
  }

  fuzz(): unknown {
    return choice([
      () => null,
      bernoulli,
      gaussian,
      () => chars(poisson()),
      () =>
        Array<null>(poisson())
          .fill(null)
          .map(() => this.fuzz()),
      () =>
        Object.fromEntries(
          Array<null>(poisson())
            .fill(null)
            .map(() => [chars(poisson(3)), this.fuzz()]),
        ),
    ])();
  }

  schema(): {} {
    return {};
  }
}

/** a schema that accepts everything but undefined */
export function empty(): CompiledSchema<unknown, {}> {
  return new CompiledEmpty();
}

class CompiledBoolean
  extends CompiledSchemaMixin<boolean>
  implements CompiledSchema<boolean, { type: "boolean" }>
{
  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (typeof inp !== "boolean") {
      yield [[], `${formatType(inp)} is not a boolean`];
    }
  }

  fuzz(): boolean {
    return bernoulli();
  }

  schema(): { type: "boolean" } {
    return { type: "boolean" };
  }
}

/** a schema that accepts boolean values */
export function boolean(): CompiledSchema<
  boolean,
  {
    /** the type definition */
    type: "boolean";
  }
> {
  return new CompiledBoolean();
}

class CompiledInt<I extends IntType>
  extends CompiledSchemaMixin<number>
  implements CompiledSchema<number, { type: I }>
{
  readonly #key: I;
  readonly #lower: number;
  readonly #upper: number;

  constructor(key: I) {
    super();
    this.#key = key;
    [this.#lower, this.#upper] = intBounds[key];
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (typeof inp !== "number") {
      yield [[], `${formatType(inp)} is not a number`];
    } else if (inp % 1 !== 0) {
      yield [[], `${inp.toPrecision()} is not an integer`];
    } else if (inp < this.#lower) {
      yield [[], `${inp.toFixed()} is less than ${this.#lower.toFixed()}`];
    } else if (inp >= this.#upper) {
      yield [
        [],
        `${inp.toFixed()} is greater than ${(this.#upper - 1).toFixed()}`,
      ];
    }
  }

  fuzz(): number {
    return uniform(this.#lower, this.#upper);
  }

  schema(): { type: I } {
    return { type: this.#key };
  }
}

/** a schema that accepts 8-bit integers */
export function int8(): CompiledSchema<
  number,
  {
    /** the int8 type */
    type: "int8";
  }
> {
  return new CompiledInt("int8");
}

/** a schema that accepts 8-bit unsigned integers */
export function uint8(): CompiledSchema<
  number,
  {
    /** the uint8 type */
    type: "uint8";
  }
> {
  return new CompiledInt("uint8");
}

/** a schema that accepts 16-bit integers */
export function int16(): CompiledSchema<
  number,
  {
    /** the int16 type */
    type: "int16";
  }
> {
  return new CompiledInt("int16");
}

/** a schema that accepts 16-bit unsigned integers */
export function uint16(): CompiledSchema<
  number,
  {
    /** the uint16 type */
    type: "uint16";
  }
> {
  return new CompiledInt("uint16");
}

/** a schema that accepts 32-bit integers */
export function int32(): CompiledSchema<
  number,
  {
    /** the int32 type */
    type: "int32";
  }
> {
  return new CompiledInt("int32");
}

/** a schema that accepts 32-bit unsigned integers */
export function uint32(): CompiledSchema<
  number,
  {
    /** the uint32 type */
    type: "uint32";
  }
> {
  return new CompiledInt("uint32");
}

class CompiledFloat<F extends "float32" | "float64">
  extends CompiledSchemaMixin<number>
  implements CompiledSchema<number, { type: F }>
{
  readonly #key: F;

  constructor(key: F) {
    super();
    this.#key = key;
  }
  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (typeof inp !== "number") {
      yield [[], `${formatType(inp)} is not number, expected a float`];
    }
  }

  fuzz(): number {
    return gaussian();
  }

  schema(): { type: F } {
    return { type: this.#key };
  }
}

/** a schema that accepts floats */
export function float32(): CompiledSchema<
  number,
  {
    /** the float32 type */
    type: "float32";
  }
> {
  return new CompiledFloat("float32");
}

/** a schema that accepts floats */
export function float64(): CompiledSchema<
  number,
  {
    /** the float64 type */
    type: "float64";
  }
> {
  return new CompiledFloat("float64");
}

class CompiledString
  extends CompiledSchemaMixin<string>
  implements CompiledSchema<string, { type: "string" }>
{
  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (typeof inp !== "string") {
      yield [[], `${formatType(inp)} is not a string`];
    }
  }

  fuzz(): string {
    return chars(poisson(3));
  }

  schema(): { type: "string" } {
    return { type: "string" };
  }
}

/** a schema that accepts strings */
export function string(): CompiledSchema<
  string,
  {
    /** the string type */
    type: "string";
  }
> {
  return new CompiledString();
}

class CompiledTimestamp
  extends CompiledSchemaMixin<string>
  implements CompiledSchema<string, { type: "timestamp" }>
{
  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (typeof inp !== "string") {
      yield [[], `${formatType(inp)} is not a string`];
    } else if (!isTimestamp(inp)) {
      yield [[], `${inp} is not a valid timestamp`];
    }
  }

  fuzz(): string {
    // ~100 years since the epoch
    return new Date(Math.random() * 3153600000000).toISOString();
  }

  schema(): { type: "timestamp" } {
    return { type: "timestamp" };
  }
}

/** a schema that accepts timestamp strings */
export function timestamp(): CompiledSchema<
  string,
  {
    /** the timestamp type */
    type: "timestamp";
  }
> {
  return new CompiledTimestamp();
}

class CompiledEnum<V extends readonly [string, ...string[]]>
  extends CompiledSchemaMixin<V[number]>
  implements CompiledSchema<V[number], { enum: [...V] }>
{
  readonly #vals: V;
  readonly #svals: Set<V[number]>;

  constructor(vals: V, set: Readonly<Set<string>>) {
    super();
    this.#vals = vals;
    this.#svals = set;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (typeof inp !== "string") {
      yield [[], `${formatType(inp)} is not a string`];
    } else if (!this.#svals.has(inp)) {
      yield [[], `${inp} is not one of ${this.#vals.join(", ")}`];
    }
  }

  fuzz(): V[number] {
    return choice(this.#vals);
  }

  schema(): { enum: [...V] } {
    return { enum: [...this.#vals] };
  }
}

/**
 * a schema that accepts a limited set of strings
 *
 * @remarks
 * `enum` is a reserved word in typescript, so this is called enumeration.
 *
 * @example
 * const schema = enumeration("a", "b", "c");
 * schema.guard("a");
 */
export function enumeration<const V extends readonly [string, ...string[]]>(
  ...values: V
): CompiledSchema<
  V[number],
  {
    /** the enumerated options */
    enum: [...V];
  }
> {
  const set = new Set<string>(values);
  if (set.size !== values.length) {
    throw new Error("enum can't contain duplicates");
  } else {
    return new CompiledEnum(values, set);
  }
}

class CompiledElements<E, S>
  extends CompiledSchemaMixin<E[]>
  implements CompiledSchema<E[], { elements: S }>
{
  readonly #element: CompiledSchema<E, S>;

  constructor(element: CompiledSchema<E, S>) {
    super();
    this.#element = element;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (!Array.isArray(inp)) {
      yield [[], `${formatType(inp)} is not an array`];
    } else {
      for (const [i, e] of inp.entries()) {
        for (const [path, error] of this.#element.pathErrors(e)) {
          path.push(`[${i.toFixed()}]`);
          yield [path, error];
        }
      }
    }
  }

  fuzz(): E[] {
    return Array<null>(poisson())
      .fill(null)
      .map(() => this.#element.fuzz());
  }

  schema(): { elements: S } {
    return { elements: this.#element.schema() };
  }
}

/**
 * a schema that accepts arrays of elements
 *
 * @param element - the schema for the element
 *
 * @example
 * const schema = elements(boolean());
 * schema.guard([true]);
 */
export function elements<const E, const S>(
  element: CompiledSchema<E, S>,
): CompiledSchema<
  E[],
  {
    /** the element schema */
    elements: S;
  }
> {
  if (element.definitions) {
    throw new Error("definitions can only exist on a root schema");
  } else {
    return new CompiledElements(element);
  }
}

class CompiledValues<V, S>
  extends CompiledSchemaMixin<Record<string, V>>
  implements CompiledSchema<Record<string, V>, { values: S }>
{
  readonly #values: CompiledSchema<V, S>;

  constructor(values: CompiledSchema<V, S>) {
    super();
    this.#values = values;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (!isRecord(inp)) {
      yield [[], `${formatType(inp)} is not a record`];
    } else {
      for (const [key, val] of Object.entries(inp)) {
        for (const [path, error] of this.#values.pathErrors(val)) {
          path.push(formatKey(key));
          yield [path, error];
        }
      }
    }
  }

  fuzz(): Record<string, V> {
    return Object.fromEntries(
      Array<null>(poisson())
        .fill(null)
        .map(() => [chars(poisson(3)), this.#values.fuzz()]),
    );
  }

  schema(): { values: S } {
    return { values: this.#values.schema() };
  }
}

/**
 * a schema that accepts records with arbitrary keys to the same value
 *
 * @param value - the schema for the record values
 *
 * @example
 * const schema = values(boolean());
 * schema.guard({"a": false});
 */
export function values<const V, const S>(
  value: CompiledSchema<V, S>,
): CompiledSchema<
  Record<string, V>,
  {
    /** the value schema */
    values: S;
  }
> {
  if (value.definitions) {
    throw new Error("definitions can only exist on a root schema");
  } else {
    return new CompiledValues(value);
  }
}

class CompiledProperties<
    P extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
    O extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
  >
  extends CompiledSchemaMixin<{
    -readonly [K in keyof (Required<P> & Partial<O>)]: (P &
      O)[K] extends CompiledSchema<infer T, unknown>
      ? T
      : never;
  }>
  implements
    CompiledSchema<
      {
        -readonly [K in keyof (Required<P> & Partial<O>)]: (P &
          O)[K] extends CompiledSchema<infer T, unknown>
          ? T
          : never;
      },
      {
        properties?: {
          -readonly [K in keyof P]: P[K] extends CompiledSchema<
            unknown,
            infer S
          >
            ? S
            : never;
        };
        optionalProperties?: {
          -readonly [K in keyof O]: O[K] extends CompiledSchema<
            unknown,
            infer S
          >
            ? S
            : never;
        };
        additionalProperties?: true;
      }
    >
{
  readonly #props: Entries | undefined;
  readonly #oprops: Entries | undefined;
  readonly #additional: boolean;
  readonly keys: Readonly<Set<string>>;

  constructor(
    props: Entries | undefined,
    oprops: Entries | undefined,
    additional: boolean,
    keys: Set<string>,
  ) {
    super();
    this.#props = props;
    this.#oprops = oprops;
    this.#additional = additional;
    this.keys = keys;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (!isRecord(inp)) {
      yield [[], `${formatType(inp)} is not a record`];
    } else {
      if (this.#props) {
        for (const [key, comp] of this.#props) {
          const val = inp[key];
          if (val === undefined) {
            yield [[], `required key '${key}' is missing`];
          } else {
            for (const [path, error] of comp.pathErrors(val)) {
              path.push(formatKey(key));
              yield [path, error];
            }
          }
        }
      }
      if (this.#oprops) {
        for (const [key, comp] of this.#oprops) {
          if (inp[key] !== undefined) {
            for (const [path, error] of comp.pathErrors(inp[key])) {
              path.push(formatKey(key));
              yield [path, error];
            }
          }
        }
      }
      if (!this.#additional) {
        for (const key of Object.keys(inp)) {
          if (!this.keys.has(key)) {
            yield [
              [formatKey(key)],
              `'${key}' is not a valid property and additional properties are not allowed`,
            ];
          }
        }
      }
    }
  }

  fuzz(): {
    -readonly [K in keyof (Required<P> & Partial<O>)]: (P &
      O)[K] extends CompiledSchema<infer T, unknown>
      ? T
      : never;
  } {
    const req = map(
      this.#props ?? [],
      ([key, comp]) => [key, comp.fuzz()] as const,
    );
    const opt = map(
      filter(this.#oprops ?? [], () => bernoulli()),
      ([key, comp]) => [key, comp.fuzz()] as const,
    );
    const extra = this.#additional
      ? map(
          range(poisson()),
          () =>
            [
              chars(poisson(3)),
              choice([
                () => null,
                bernoulli,
                gaussian,
                () => chars(poisson()),
                () => [],
                () => ({}),
              ])(),
            ] as const,
        )
      : [];
    return Object.fromEntries(concat(req, opt, extra)) as {
      -readonly [K in keyof (Required<P> & Partial<O>)]: (P &
        O)[K] extends CompiledSchema<infer T, unknown>
        ? T
        : never;
    };
  }

  schema(): {
    properties?: {
      -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    optionalProperties?: {
      -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    additionalProperties?: true;
  } {
    const schema: {
      properties?: {
        -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
          ? S
          : never;
      };
      optionalProperties?: {
        -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
          ? S
          : never;
      };
      additionalProperties?: true;
    } = {};
    if (this.#props) {
      schema.properties = Object.fromEntries(
        this.#props.map(([key, comp]) => [key, comp.schema()]),
      ) as {
        -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
          ? S
          : never;
      };
    }
    if (this.#oprops) {
      schema.optionalProperties = Object.fromEntries(
        this.#oprops.map(([key, comp]) => [key, comp.schema()]),
      ) as {
        -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
          ? S
          : never;
      };
    }
    if (this.#additional) {
      schema.additionalProperties = true;
    }
    return schema;
  }
}

/** the true properties constructor that just takes entries */
function propertiesEntries<
  const P extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
  const O extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
>(
  props?: Entries,
  oprops?: Entries,
  additionalProperties?: boolean,
): CompiledSchema<
  {
    -readonly [K in keyof (Required<P> & Partial<O>)]: (P &
      O)[K] extends CompiledSchema<infer T, unknown>
      ? T
      : never;
  },
  {
    /** the schemas for required properties */
    properties?: {
      -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** the schemas for optional properties */
    optionalProperties?: {
      -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** if the schema accepts other properties */
    additionalProperties?: true;
  }
> {
  const keys = new Set<string>(
    map(concat(props ?? [], oprops ?? []), ([key]) => key),
  );
  if (props?.some(([, p]) => p.definitions)) {
    throw new Error("definitions can only exist on a root schema");
  } else if (oprops?.some(([, p]) => p.definitions)) {
    throw new Error("definitions can only exist on a root schema");
  } else if (keys.size !== (props?.length ?? 0) + (oprops?.length ?? 0)) {
    throw new Error("properties and optionalProperties keys must be unique");
  } else {
    return new CompiledProperties(
      props,
      oprops,
      additionalProperties ?? false,
      keys,
    );
  }
}

/**
 * a schema that accepts named and optional properties as well as properties not listed
 *
 * This function has many overloads to account for the different ways to specify
 * optional and non-optional properties, However, effectively either `props` or
 * `oprops` must be specified, and additional is a boolean value.
 *
 * @example
 * const schema = properties({ bool: boolean() }, { opt: boolean() }, true);
 */
export function properties<
  const P extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
  const O extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
>(
  props: P,
  oprops: O,
  additional: true,
): CompiledSchema<
  {
    -readonly [K in keyof (Required<P> &
      Partial<O> &
      Record<string, unknown>)]: (P & O)[K] extends CompiledSchema<
      infer T,
      unknown
    >
      ? T
      : unknown;
  },
  {
    /** the schemas for required properties */
    properties: {
      -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** the schemas for optional properties */
    optionalProperties: {
      -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** if the schema accepts other properties */
    additionalProperties: true;
  }
>;
/**
 * a schema that accepts named properties as well as properties not listed
 *
 * @example
 * const schema = properties({ bool: boolean() }, undefined, true);
 */
export function properties<
  const P extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
>(
  props: P,
  oprops: undefined,
  additional: true,
): CompiledSchema<
  {
    -readonly [K in keyof (Required<P> &
      Record<string, unknown>)]: P[K] extends CompiledSchema<infer T, unknown>
      ? T
      : unknown;
  },
  {
    /** the schemas for required properties */
    properties: {
      -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** if the schema accepts other properties */
    additionalProperties: true;
  }
>;
/**
 * a schema that accepts optional properties as well as properties not listed

 * @example
 * const schema = properties(undefined, { opt: boolean() });
 */
export function properties<
  const O extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
>(
  props: undefined,
  oprops: O,
  additional: true,
): CompiledSchema<
  {
    -readonly [K in keyof (Partial<O> &
      Record<string, unknown>)]: O[K] extends CompiledSchema<infer T, unknown>
      ? T
      : unknown;
  },
  {
    /** the schemas for optional properties */
    optionalProperties: {
      -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** if the schema accepts other properties */
    additionalProperties: true;
  }
>;
/**
 * a schema that accepts named and optional properties
 *
 * @example
 * const schema = properties({ bool: boolean() }, { opt: boolean() });
 */
export function properties<
  const P extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
  const O extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
>(
  props: P,
  oprops: O,
  additional?: false,
): CompiledSchema<
  {
    -readonly [K in keyof (Required<P> & Partial<O>)]: (P &
      O)[K] extends CompiledSchema<infer T, unknown>
      ? T
      : never;
  },
  {
    /** the schemas for required properties */
    properties: {
      -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** the schemas for optional properties */
    optionalProperties: {
      -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
  }
>;
/**
 * a schema that accepts named properties
 *
 * @example
 * const schema = properties({ bool: boolean() });
 */
export function properties<
  const P extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
>(
  props: P,
  oprops?: undefined,
  additional?: false,
): CompiledSchema<
  {
    -readonly [K in keyof Required<P>]: P[K] extends CompiledSchema<
      infer T,
      unknown
    >
      ? T
      : never;
  },
  {
    /** the schemas for required properties */
    properties: {
      -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
  }
>;
/**
 * a schema that accepts optional properties

 * @example
 * const schema = properties(undefined, { opt: boolean() });
 */
export function properties<
  const O extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
>(
  props: undefined,
  oprops: O,
  additional?: false,
): CompiledSchema<
  {
    -readonly [K in keyof Partial<O>]: O[K] extends CompiledSchema<
      infer T,
      unknown
    >
      ? T
      : never;
  },
  {
    /** the schemas for optional properties */
    optionalProperties: {
      -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
  }
>;
export function properties<
  const P extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
  const O extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
>(
  props?: P,
  oprops?: O,
  additionalProperties?: boolean,
): CompiledSchema<
  {
    -readonly [K in keyof (Required<P> & Partial<O>)]: (P &
      O)[K] extends CompiledSchema<infer T, unknown>
      ? T
      : never;
  },
  {
    /** the schemas for required properties */
    properties?: {
      -readonly [K in keyof P]: P[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** the schemas for optional properties */
    optionalProperties?: {
      -readonly [K in keyof O]: O[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    /** if the schema accepts other properties */
    additionalProperties?: true;
  }
> {
  return propertiesEntries(
    props ? Object.entries(props) : undefined,
    oprops ? Object.entries(oprops) : undefined,
    additionalProperties,
  );
}

class CompiledDiscriminator<
    D extends string,
    M extends Record<string, CompiledSchema<Record<string, unknown>, unknown>>,
  >
  extends CompiledSchemaMixin<
    {
      [K in keyof M]: M[K] extends CompiledSchema<infer P, unknown>
        ? { [Y in keyof (Record<D, K> & P)]: (P & Record<D, K>)[Y] }
        : never;
    }[keyof M]
  >
  implements
    CompiledSchema<
      {
        [K in keyof M]: M[K] extends CompiledSchema<infer P, unknown>
          ? { [Y in keyof (Record<D, K> & P)]: (P & Record<D, K>)[Y] }
          : never;
      }[keyof M],
      {
        discriminator: D;
        mapping: {
          -readonly [K in keyof M]: M[K] extends CompiledSchema<
            unknown,
            infer S
          >
            ? S
            : never;
        };
      }
    >
{
  readonly #discriminator: D;
  readonly #mapping: M;
  readonly #entries: Entries<Record<string, unknown>>;

  constructor(
    discriminator: D,
    mapping: M,
    entries: Entries<Record<string, unknown>>,
  ) {
    super();
    this.#discriminator = discriminator;
    this.#mapping = mapping;
    this.#entries = entries;
  }

  guard(obj: unknown): obj is {
    [K in keyof M]: M[K] extends CompiledSchema<infer P, unknown>
      ? { [Y in keyof (Record<D, K> & P)]: (P & Record<D, K>)[Y] }
      : never;
  }[keyof M] {
    if (!isRecord(obj)) return false;
    const { [this.#discriminator]: key, ...rest } = obj;
    if (typeof key !== "string") return false;
    return this.#mapping[key]?.guard(rest) ?? false;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    if (!isRecord(inp)) {
      yield [[], `${formatType(inp)} is not an object`];
    } else {
      const { [this.#discriminator]: key, ...rest } = inp;
      if (key === undefined) {
        yield [[], `discriminator key '${this.#discriminator}' is missing`];
      } else if (typeof key !== "string") {
        yield [
          [formatKey(this.#discriminator)],
          `${formatType(key)} is not a string`,
        ];
      } else {
        const comp = this.#mapping[key];
        if (comp === undefined) {
          yield [
            [formatKey(this.#discriminator)],
            `'${key}' is not a valid discriminator value (${Object.keys(this.#mapping).join(", ")})`,
          ];
        } else {
          yield* comp.pathErrors(rest);
        }
      }
    }
  }

  fuzz(): {
    [K in keyof M]: M[K] extends CompiledSchema<infer P, unknown>
      ? { [Y in keyof (Record<D, K> & P)]: (P & Record<D, K>)[Y] }
      : never;
  }[keyof M] {
    const [key, comp] = choice(this.#entries);
    return {
      ...comp.fuzz(),
      [this.#discriminator]: key,
    } as {
      [K in keyof M]: M[K] extends CompiledSchema<infer P, unknown>
        ? { [Y in keyof (Record<D, K> & P)]: (P & Record<D, K>)[Y] }
        : never;
    }[keyof M];
  }

  schema(): {
    discriminator: D;
    mapping: {
      -readonly [K in keyof M]: M[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
  } {
    const mapping = Object.fromEntries(
      this.#entries.map(([key, val]) => [key, val.schema()]),
    ) as {
      -readonly [K in keyof M]: M[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
    return { discriminator: this.#discriminator, mapping };
  }
}

/**
 * a schema that accepts discriminated unions
 */
function discriminatorEntries<
  const D extends string,
  const M extends Record<
    string,
    CompiledSchema<Record<string, unknown>, unknown>
  >,
>(
  discriminator: D,
  mapping: M,
  entries: Entries<Record<string, unknown>>,
): CompiledSchema<
  {
    [K in keyof M]: M[K] extends CompiledSchema<infer P, unknown>
      ? { [Y in keyof (Record<D, K> & P)]: (P & Record<D, K>)[Y] }
      : never;
  }[keyof M],
  {
    /** the discriminator key */
    discriminator: D;
    /** a mapping from discriminator values to schemas */
    mapping: {
      -readonly [K in keyof M]: M[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
  }
> {
  if (entries.some(([, comp]) => comp.definitions)) {
    throw new Error("definitions can only exist on a root schema");
  } else if (
    entries.some(([, comp]) => comp.keys?.has(discriminator) ?? true)
  ) {
    throw new Error(
      "all discriminator mappings must be properties schemas that don't contain discriminator",
    );
  } else {
    return new CompiledDiscriminator(discriminator, mapping, entries);
  }
}

/**
 * a schema that accepts discriminated unions
 *
 * @example
 * const schema = discriminator("choice", {
 *    one: properties({ val: boolean() }),
 *    two: properties({ val: float64() }),
 * })
 * schema.guard({ choice: "one", val: true });
 * schema.guard({ choice: "two", val: 2.0 });
 */
export function discriminator<
  const D extends string,
  const M extends Record<
    string,
    CompiledSchema<Record<string, unknown>, unknown>
  >,
>(
  discriminator: D,
  mapping: M,
): CompiledSchema<
  {
    [K in keyof M]: M[K] extends CompiledSchema<infer P, unknown>
      ? { [Y in keyof (Record<D, K> & P)]: (P & Record<D, K>)[Y] }
      : never;
  }[keyof M],
  {
    /** the discriminator key */
    discriminator: D;
    /** a mapping from discriminator values to schemas */
    mapping: {
      -readonly [K in keyof M]: M[K] extends CompiledSchema<unknown, infer S>
        ? S
        : never;
    };
  }
> {
  return discriminatorEntries(discriminator, mapping, Object.entries(mapping));
}

/** a dictionary of the reference schemas */
export type Refs<
  D extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
> = {
  [R in keyof D]: D[R] extends CompiledSchema<infer T, unknown>
    ? CompiledSchema<
        T,
        {
          /** the referred to schema */
          ref: R;
        }
      >
    : never;
};

/** a type for gradually building a definitions schema */
export interface Definitions<
  D extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
> {
  /** add a definition */
  def<const R extends string, const T, const S>(
    name: R,
    val: (b: Refs<D>) => CompiledSchema<T, S>,
  ): Definitions<{
    [K in keyof (D & Record<R, CompiledSchema<T, S>>)]: (D &
      Record<R, CompiledSchema<T, S>>)[K];
  }>;

  /** build  the definitions into a compiled schema */
  build<const T, const S>(
    val: (defs: Refs<D>) => CompiledSchema<T, S>,
  ): CompiledSchema<
    T,
    {
      [K in keyof (S &
        Record<
          "definitions",
          {
            [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S>
              ? S
              : never;
          }
        >)]: (S &
        Record<
          "definitions",
          {
            [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S>
              ? S
              : never;
          }
        >)[K];
    }
  >;
}

class CompiledDefinitions<
    D extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
    T,
    S,
  >
  extends CompiledSchemaMixin<T>
  implements
    CompiledSchema<
      T,
      {
        [K in keyof (S &
          Record<
            "definitions",
            {
              [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S>
                ? S
                : never;
            }
          >)]: (S &
          Record<
            "definitions",
            {
              [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S>
                ? S
                : never;
            }
          >)[K];
      }
    >
{
  readonly #defs: D;
  readonly #val: CompiledSchema<T, S>;
  readonly definitions = true as const;

  constructor(defs: D, val: CompiledSchema<T, S>) {
    super();
    this.#defs = defs;
    this.#val = val;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    yield* this.#val.pathErrors(inp);
  }

  fuzz(): T {
    return this.#val.fuzz();
  }

  schema(): {
    [K in keyof (S &
      Record<
        "definitions",
        {
          [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S>
            ? S
            : never;
        }
      >)]: (S &
      Record<
        "definitions",
        {
          [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S>
            ? S
            : never;
        }
      >)[K];
  } {
    const definitions = Object.fromEntries(
      Object.entries(this.#defs).map(([key, comp]) => [key, comp.schema()]),
    ) as {
      [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S> ? S : never;
    };
    return {
      ...this.#val.schema(),
      definitions,
    };
  }
}

class CompiledRef<R extends string, T>
  extends CompiledSchemaMixin<T>
  implements CompiledSchema<T, { ref: R }>
{
  readonly #ref: R;
  readonly #val: CompiledSchema<T, unknown>;

  constructor(ref: R, val: CompiledSchema<T, unknown>) {
    super();
    this.#ref = ref;
    this.#val = val;
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    yield* this.#val.pathErrors(inp);
  }

  fuzz(): T {
    return this.#val.fuzz();
  }

  schema(): { ref: R } {
    return { ref: this.#ref };
  }
}

class DefinitionsBuilder<
  D extends Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
> implements Definitions<D>
{
  readonly #defs: D;
  readonly #refs: Refs<D>;

  constructor(defs: D, refs: Refs<D>) {
    this.#defs = defs;
    this.#refs = refs;
  }

  def<const R extends string, const T, const S>(
    name: R,
    val: (b: Refs<D>) => CompiledSchema<T, S>,
  ): Definitions<{
    [K in keyof (D & Record<R, CompiledSchema<T, S>>)]: (D &
      Record<R, CompiledSchema<T, S>>)[K];
  }> {
    const comp = val(this.#refs);
    return new DefinitionsBuilder(
      {
        ...this.#defs,
        [name]: comp,
      },
      {
        ...this.#refs,
        [name]: new CompiledRef(name, comp),
      } as Refs<D & Record<R, CompiledSchema<T, S>>>,
    );
  }

  build<const T, const S>(
    val: (defs: Refs<D>) => CompiledSchema<T, S>,
  ): CompiledSchema<
    T,
    {
      [K in keyof (S &
        Record<
          "definitions",
          {
            [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S>
              ? S
              : never;
          }
        >)]: (S &
        Record<
          "definitions",
          {
            [R in keyof D]: D[R] extends CompiledSchema<unknown, infer S>
              ? S
              : never;
          }
        >)[K];
    }
  > {
    return new CompiledDefinitions(this.#defs, val(this.#refs));
  }
}

/**
 * creates a builder for a definitions structure
 *
 * This is the only moderately complicated function for building a schema. After
 * creating a schema, you can add a new definition by calling {@link
 * Definitions#def | `def`} with the name of the new definition, and a function
 * that creates it from the current references.
 *
 * @remarks
 * Unlike full JTD, references declared in this way can't be cyclic. You can
 * only reference previously defined references.
 *
 * @example
 * const schema = definitions()
 *     .def("a", () => boolean())
 *     .def("b": ({ a }) => elements(a))
 *     .def("c": ({ a, b }) => properties({ a }, { b }))
 *     .build(({ c }) => c);
 * schema.guard({ a: true, b: [false] });
 * schema.guard({ a: false });
 */
export function definitions(): Definitions<{}> {
  return new DefinitionsBuilder({}, {});
}

/** a schema that validates anything */
export interface EmptySchema {
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
/** a schema that validates a boolean value */
export interface BooleanSchema {
  /** the type */
  readonly type: "boolean";
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}

/** any type that validates a number */
export type NumberType = "float32" | "float64" | IntType;

/** a schema that validates any number */
export interface NumberSchema<N extends NumberType = NumberType> {
  /** the type */
  readonly type: N;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}

/** an type that validates a string */
export type StringType = "string" | "timestamp";

/** a schema that validates any string */
export interface StringSchema<S extends StringType = StringType> {
  /** the type */
  readonly type: S;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
/** a schema that validates one of a set of strings */
export interface EnumSchema<
  S extends readonly [string, ...string[]] = readonly [string, ...string[]],
> {
  /** an array of all values allowed */
  readonly enum: S;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
/** a schema that validates an array */
export interface ElementsSchema<S extends SomeSchema = SomeSchema> {
  /** a schema for every element in the array */
  readonly elements: S;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
// NOTE these are split into three types because inference on an optional type
// doesn't handle the way we might like
/** a schema for an object with required and optional properties */
export interface BothPropertiesSchema<
  P extends Readonly<Record<string, SomeSchema>> = Readonly<
    Record<string, SomeSchema>
  >,
  O extends Readonly<Record<string, SomeSchema>> = Readonly<
    Record<string, SomeSchema>
  >,
> {
  /** a schema for every required property */
  readonly properties: P;
  /** a schema for every optional property */
  readonly optionalProperties: O;
  /** if non-listed properties are allowed */
  readonly additionalProperties?: boolean;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
/** a schema for an object with only required properties */
export interface PropertiesSchema<
  P extends Readonly<Record<string, SomeSchema>> = Readonly<
    Record<string, SomeSchema>
  >,
> {
  /** a schema for every required property */
  readonly properties: P;
  /** properties defines no optional properties */
  readonly optionalProperties?: undefined;
  /** if non-listed properties are allowed */
  readonly additionalProperties?: boolean;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
/** a schema for an object with only optional properties */
export interface OptionalPropertiesSchema<
  O extends Readonly<Record<string, SomeSchema>> = Readonly<
    Record<string, SomeSchema>
  >,
> {
  /** optional properties defines no properties */
  readonly properties?: undefined;
  /** a schema for every optional property */
  readonly optionalProperties: O;
  /** if non-listed properties are allowed */
  readonly additionalProperties?: boolean;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
/** a schema for a dictionary of strings to identical values */
export interface ValuesSchema<S extends SomeSchema = SomeSchema> {
  /** the schema for every value in the mapping */
  readonly values: S;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
/** any schema that is valid in the mapping section of a discriminator type */
export type MappingSchema = (
  | BothPropertiesSchema
  | PropertiesSchema
  | OptionalPropertiesSchema
) & {
  /** mapping schemas can't be null */
  readonly nullable?: false;
};
/** a schema for tagged unions of objects */
export interface DiscriminatorSchema<
  K extends string = string,
  M extends Readonly<Record<string, MappingSchema>> = Readonly<
    Record<string, MappingSchema>
  >,
> {
  /** the key for the discriminator in the type */
  readonly discriminator: K;
  /** a mapping of discriminator values to schemas */
  readonly mapping: M;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}
/** a schema referencing a predefined definition */
export interface RefSchema<K extends string = string> {
  /** a key with the name of the reference in definitions */
  readonly ref: K;
  /** a key indicating if a type can be null */
  readonly nullable?: boolean;
  /** optional metadata on a schema */
  readonly metadata?: unknown;
}

/** any arbitrary schema */
export type SomeSchema =
  | EmptySchema
  | BooleanSchema
  | NumberSchema
  | StringSchema
  | EnumSchema
  | ElementsSchema
  | BothPropertiesSchema
  | PropertiesSchema
  | OptionalPropertiesSchema
  | ValuesSchema
  | DiscriminatorSchema
  | RefSchema;

/** schema for additional properties of a properties type */
export type AdditionalProperties<
  S extends PropertiesSchema | OptionalPropertiesSchema | BothPropertiesSchema,
> = S["additionalProperties"] extends true ? Record<string, unknown> : unknown;

/** the data type resulting for a schema that may be nullable */
export type NullableData<S extends SomeSchema> = S["nullable"] extends true
  ? null
  : never;

// NOTE ideally this might union over all extends, but since it's meant to be
// called on a const type, this helps inference
/** the data type compiled by some jtd schema */
export type SchemaData<
  S extends SomeSchema,
  R extends Readonly<Record<string, SomeSchema>>,
> = S extends BooleanSchema // boolean type
  ? boolean | NullableData<S>
  : // number types
    S extends NumberSchema
    ? number | NullableData<S>
    : // string types
      S extends StringSchema
      ? string | NullableData<S>
      : // enum types
        S extends EnumSchema<infer V>
        ? V[number] | NullableData<S>
        : // elements types
          S extends ElementsSchema<infer A>
          ? SchemaData<A, R>[] | NullableData<S>
          : // all three properties types
            S extends BothPropertiesSchema<infer P, infer O>
            ?
                | {
                    -readonly [K in keyof (Required<P> &
                      Partial<O> &
                      AdditionalProperties<S>)]: SchemaData<(P & O)[K], R>;
                  }
                | NullableData<S>
            : S extends PropertiesSchema<infer P>
              ?
                  | {
                      -readonly [K in keyof (Required<P> &
                        AdditionalProperties<S>)]: SchemaData<P[K], R>;
                    }
                  | NullableData<S>
              : S extends OptionalPropertiesSchema<infer O>
                ?
                    | {
                        -readonly [K in keyof (Partial<O> &
                          AdditionalProperties<S>)]: SchemaData<O[K], R>;
                      }
                    | NullableData<S>
                : // values type
                  S extends ValuesSchema<infer V>
                  ? Record<string, SchemaData<V, R>> | NullableData<S>
                  : // ref type
                    S extends RefSchema<infer D>
                    ? D extends keyof R
                      ? SchemaData<R[D], R> | NullableData<S>
                      : never
                    : // discriminator type
                      S extends DiscriminatorSchema<infer D, infer M>
                      ?
                          | {
                              [K in keyof M]: Record<D, K> &
                                SchemaData<M[K], R>;
                            }[keyof M]
                          // I'm not sure where an any is coming from, but it's not ideal
                          // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
                          | NullableData<S>
                      : // empty type
                        // NOTE it's hard to actually type this better than unknown
                        unknown;

const typeValidators = {
  boolean,
  float32,
  float64,
  int8,
  uint8,
  int16,
  uint16,
  int32,
  uint32,
  string,
  timestamp,
};

class LazyCompiledRef
  extends CompiledSchemaMixin<unknown>
  implements CompiledSchema<unknown, { ref: string }>
{
  readonly #ref: string;
  readonly #valids: Readonly<Record<string, CompiledSchema<unknown, unknown>>>;

  constructor(
    valids: Readonly<Record<string, CompiledSchema<unknown, unknown>>>,
    ref: string,
  ) {
    super();
    this.#valids = valids;
    this.#ref = ref;
  }

  #validator(): CompiledSchema<unknown, unknown> {
    // NOTE this is inherently lazy, because they key might not exist when this is created
    const val = this.#valids[this.#ref];
    if (val === undefined) {
      throw new Error(
        `ref ${this.#ref} was not in definitions after ref builder was finished`,
      );
    } else {
      return val;
    }
  }

  *pathErrors(inp: unknown): Iterable<[string[], string]> {
    yield* this.#validator().pathErrors(inp);
  }

  fuzz(): unknown {
    return this.#validator().fuzz();
  }

  schema(): { ref: string } {
    return { ref: this.#ref };
  }
}

class Compiler<R extends Readonly<Record<string, SomeSchema>>> {
  /** precompiled ref schemas */
  readonly validDefs: Record<string, CompiledSchema<unknown, unknown>> = {};

  constructor(readonly defs: R) {
    for (const [key, schema] of Object.entries(defs)) {
      this.validDefs[key] = this.compile(schema);
    }
  }

  compile(schema: SomeSchema): CompiledSchema<unknown, unknown> {
    // in case someone bypasses a check
    let valid: CompiledSchema<unknown, unknown>;
    let meta: unknown;
    let nulla: boolean | undefined;
    let rest: Record<string, unknown>;
    if (
      typeof schema !== "object" ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      schema === null ||
      Array.isArray(schema)
    ) {
      throw new Error("jtd schema must be an object");
    } else if ("type" in schema) {
      schema satisfies BooleanSchema | NumberSchema | StringSchema;
      let type: "boolean" | NumberType | StringType;
      ({ type, metadata: meta, nullable: nulla, ...rest } = schema);
      valid = typeValidators[type]();
    } else if ("enum" in schema) {
      schema satisfies EnumSchema;
      let rawValues: unknown;
      ({ enum: rawValues, metadata: meta, nullable: nulla, ...rest } = schema);
      if (
        !Array.isArray(rawValues) ||
        rawValues.length === 0 ||
        rawValues.some((val) => typeof val !== "string")
      ) {
        throw new Error(
          "enum schema enum was not a non-empty array of strings",
        );
      } else {
        valid = enumeration(
          ...(rawValues as unknown as readonly [string, ...string[]]),
        );
      }
    } else if ("elements" in schema) {
      schema satisfies ElementsSchema;
      let elems: SomeSchema;
      ({ elements: elems, nullable: nulla, metadata: meta, ...rest } = schema);
      valid = elements(this.compile(elems));
    } else if ("properties" in schema || "optionalProperties" in schema) {
      schema satisfies
        | BothPropertiesSchema
        | PropertiesSchema
        | OptionalPropertiesSchema;
      let props: Record<string, SomeSchema>;
      let oprops: Record<string, SomeSchema>;
      let additionalProperties: boolean;
      ({
        properties: props = {},
        optionalProperties: oprops = {},
        additionalProperties = false,
        nullable: nulla,
        metadata: meta,
        ...rest
      } = schema);
      if (!isRecord(props)) {
        throw new Error("properties must be an object");
      } else if (!isRecord(oprops)) {
        throw new Error("optionalProperties must be an object");
      } else if (typeof additionalProperties !== "boolean") {
        throw new Error("additionalProperties must be a boolean");
      }
      const reqs = Object.entries(props).map(
        ([key, schema]) => [key, this.compile(schema)] as const,
      );
      const opts = Object.entries(oprops).map(
        ([key, schema]) => [key, this.compile(schema)] as const,
      );
      valid = additionalProperties
        ? propertiesEntries(reqs, opts, true)
        : propertiesEntries(reqs, opts);
    } else if ("values" in schema) {
      schema satisfies ValuesSchema;
      let val: SomeSchema;
      ({ values: val, metadata: meta, nullable: nulla, ...rest } = schema);
      valid = values(this.compile(val));
    } else if ("ref" in schema) {
      schema satisfies RefSchema;
      let ref: string;
      ({ ref, nullable: nulla, metadata: meta, ...rest } = schema);
      if (this.defs[ref] === undefined) {
        throw new Error(`ref ${ref} was not in definitions`);
      } else {
        // NOTE we have to treat this special for recursive refs
        valid = new LazyCompiledRef(this.validDefs, ref);
      }
    } else if ("discriminator" in schema && "mapping" in schema) {
      schema satisfies DiscriminatorSchema;
      let disc: string;
      let mapping: Readonly<Record<string, SomeSchema>>;
      ({
        discriminator: disc,
        mapping,
        nullable: nulla,
        metadata: meta,
        ...rest
      } = schema);
      if (typeof disc !== "string") {
        throw new Error("discriminator was not a string");
      } else if (!isRecord(mapping)) {
        throw new Error("discriminator mapping was not an object");
      } else {
        const ents = Object.entries(mapping).map(
          ([key, schema]) =>
            [key, this.compile(schema)] as [
              string,
              CompiledSchema<Record<string, unknown>, unknown>,
            ],
        );
        valid = discriminatorEntries(disc, Object.fromEntries(ents), ents);
      }
    } else {
      schema satisfies EmptySchema;
      ({ nullable: nulla, metadata: meta, ...rest } = schema);
      valid = empty();
    }

    // cleanup for all schemas
    const keys = Object.keys(rest);
    if (keys.length) {
      throw new Error(`schema had extra keys: ${keys.join(", ")}`);
    } else if (nulla !== undefined && typeof nulla !== "boolean") {
      throw new Error("nullable was not a boolean");
    }
    if (nulla) valid = nullable(valid);
    if (meta !== undefined) valid = metadata(valid, meta);
    return valid;
  }
}

/**
 * any valid root jtd schema
 *
 * Root schemas may contain definitions referenced by "ref" schemas, whereas
 * nested schemas may not.
 */
export type SomeRootSchema = SomeSchema & {
  /** optional definitions that exist in a root schema */
  definitions?: Readonly<Record<string, SomeSchema>>;
};
/** the datatype compiled by some root schema */
export type RootSchemaData<S extends SomeRootSchema> = SchemaData<
  S,
  S["definitions"] extends Readonly<Record<string, SomeSchema>>
    ? S["definitions"]
    : {}
>;

/**
 * compile a jtd schema
 *
 * If the schema is declared inline and statically, or using the `as const`
 * definition, then this will infer the type that the schema validates. As a
 * result, typescript will accurately infer that `compile({ type: "boolean" })`
 * both {@link CompiledSchema#guard | `guard`}s and
 * {@link CompiledSchema#fuzz | `fuzz`}es boolean values.
 *
 * Since this must check for extensions of the generic {@link SomeRootSchema},
 * typescript will allow extra properties. To get around this, you can check
 * that it `satisfies SomeRootSchema`, which will protect to the type inference,
 * but error for extra properties on object literals. However sometimes, this
 * will also cause problems with infinite types.
 *
 * Other common errors include:
 * - If the guarded type is never, the schema is likely invalid, probably with a
 *   a misspelled ref.
 * - If the schema produces an infinite type, the schema is likely not constant,
 *   and as a result there are an infinite number of types it could validate,
 *   since schemas can be infinitely deep.
 *
 * @example
 * const schema = compile({ properties: { bool: { type: "boolean" } } } satisfies SomeRootSchema);
 */
export function compile<const S extends SomeRootSchema>(
  schema: S,
): CompiledSchema<RootSchemaData<S>, S> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof schema !== "object" || schema === null || Array.isArray(schema))
    throw new Error("schema must be an object");
  const { definitions = {}, ...rest } = schema;
  if (!isRecord(definitions)) throw new Error("definitions must be an object");
  const valid = new Compiler(definitions).compile(rest);
  return valid as CompiledSchema<RootSchemaData<S>, S>;
}
