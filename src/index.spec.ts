import {
  compile,
  type SomeRootSchema,
  empty,
  nullable,
  boolean,
  int8,
  uint16,
  enumeration,
  values,
  string,
  definitions,
  timestamp,
  elements,
  discriminator,
  float64,
  properties,
  metadata,
  type CompiledSchema,
} from ".";
import { test, expect, describe } from "bun:test";

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion,@typescript-eslint/no-redundant-type-constituents */

function assert(expr: unknown): asserts expr {
  expect(expr).toBeTruthy();
}

type Cycle = Record<string, Cycle>[];

describe("native", () => {
  test("empty()", () => {
    const valid = empty();
    const any: unknown = true;
    assert(valid.guard(any));
    any satisfies unknown;
    void (any as unknown satisfies typeof any);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard(undefined)).toBeFalse();
    // eslint-disable-next-line @typescript-eslint/ban-types
    expect(valid.schema() satisfies {}).toEqual({});

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies unknown | null;
    void (null as unknown | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(vnull.schema() satisfies { nullable: true }).toEqual({
      nullable: true,
    });
  });

  test("boolean()", () => {
    const valid = boolean();
    const bool: unknown = true;
    assert(valid.guard(bool));
    bool satisfies boolean;
    void (true as boolean satisfies typeof bool);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard(null)).toBeFalse();
    expect(valid.schema() satisfies { type: "boolean" }).toEqual({
      type: "boolean",
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies boolean | null;
    void (null as boolean | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies { type: "boolean"; nullable: true },
    ).toEqual({ type: "boolean", nullable: true });
  });

  test("float64()", () => {
    const valid = float64();
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard(null)).toBeFalse();
    expect(valid.schema() satisfies { type: "float64" }).toEqual({
      type: "float64",
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies { type: "float64"; nullable: true },
    ).toEqual({ type: "float64", nullable: true });
  });

  test("int8()", () => {
    const valid = int8();
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard(-129)).toBeFalse();
    expect(valid.guard(128)).toBeFalse();
    expect(valid.guard(0.5)).toBeFalse();
    expect(valid.guard(null)).toBeFalse();
    expect(valid.schema() satisfies { type: "int8" }).toEqual({
      type: "int8",
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(vnull.schema() satisfies { type: "int8"; nullable: true }).toEqual({
      type: "int8",
      nullable: true,
    });
  });

  test("uint16()", () => {
    const valid = uint16();
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard(-1)).toBeFalse();
    expect(valid.guard(65536)).toBeFalse();
    expect(valid.guard(0.5)).toBeFalse();
    expect(valid.guard(null)).toBeFalse();
    expect(valid.schema() satisfies { type: "uint16" }).toEqual({
      type: "uint16",
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(vnull.schema() satisfies { type: "uint16"; nullable: true }).toEqual(
      {
        type: "uint16",
        nullable: true,
      },
    );
  });

  test("string()", () => {
    const valid = string();
    const str: unknown = "string";
    assert(valid.guard(str));
    str satisfies string;
    void ("" as string satisfies typeof str);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard(null)).toBeFalse();
    expect(valid.schema() satisfies { type: "string" }).toEqual({
      type: "string",
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies string | null;
    void (null as string | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(vnull.schema() satisfies { type: "string"; nullable: true }).toEqual(
      {
        type: "string",
        nullable: true,
      },
    );
  });

  test("timestamp()", () => {
    const valid = timestamp();
    const time: unknown = "1985-04-12T23:20:50.52Z";
    assert(valid.guard(time));
    time satisfies string;
    void ("" as string satisfies typeof time);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard("foo")).toBeFalse();
    expect(valid.guard(null)).toBeFalse();
    expect(valid.schema() satisfies { type: "timestamp" }).toEqual({
      type: "timestamp",
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies string | null;
    void (null as string | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies { type: "timestamp"; nullable: true },
    ).toEqual({
      type: "timestamp",
      nullable: true,
    });
  });

  test("enumeration()", () => {
    const valid = enumeration("a", "b", "c");
    const abc: unknown = "a";
    assert(valid.guard(abc));
    abc satisfies "a" | "b" | "c";
    void ("a" as "a" | "b" | "c" satisfies typeof abc);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard("d")).toBeFalse();
    expect(valid.guard(null)).toBeFalse();
    expect(valid.schema() satisfies { enum: ["a", "b", "c"] }).toEqual({
      enum: ["a", "b", "c"],
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies "a" | "b" | "c" | null;
    void (null as "a" | "b" | "c" | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies { enum: ["a", "b", "c"]; nullable: true },
    ).toEqual({
      enum: ["a", "b", "c"],
      nullable: true,
    });
  });

  test("elements()", () => {
    const valid = elements(boolean());
    const bools: unknown = [true];
    assert(valid.guard([]));
    assert(valid.guard(bools));
    bools satisfies boolean[];
    void ([] as boolean[] satisfies typeof bools);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard([5])).toBeFalse();
    expect(valid.guard(null)).toBeFalse();
    expect(valid.schema() satisfies { elements: { type: "boolean" } }).toEqual({
      elements: { type: "boolean" },
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies boolean[] | null;
    void (null as boolean[] | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies {
        elements: { type: "boolean" };
        nullable: true;
      },
    ).toEqual({
      elements: { type: "boolean" },
      nullable: true,
    });
  });

  test("properties()", () => {
    const valid = properties({ bool: boolean() });
    const props: unknown = { bool: true };
    assert(valid.guard(props));
    props satisfies { bool: boolean };
    void (props as { bool: boolean } satisfies typeof props);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard(null)).toBeFalse();
    expect(valid.guard({ bool: true, extra: 5 })).toBeFalse();
    expect(
      valid.schema() satisfies { properties: { bool: { type: "boolean" } } },
    ).toEqual({
      properties: { bool: { type: "boolean" } },
    });

    const avalid = properties({ bool: boolean() }, undefined, true);
    const aprops: unknown = { bool: true, extra: 5 };
    assert(avalid.guard(aprops));
    aprops satisfies { bool: boolean; [k: string]: unknown };
    void (aprops as {
      bool: boolean;
      [k: string]: unknown;
    } satisfies typeof aprops);
    expect(avalid.guard({ bool: 7, extra: 5 })).toBeFalse();
    for (let i = 0; i < 20; ++i) {
      expect(avalid.guard(avalid.fuzz()));
    }
    expect(
      avalid.schema() satisfies {
        properties: { bool: { type: "boolean" } };
        additionalProperties: true;
      },
    ).toEqual({
      properties: { bool: { type: "boolean" } },
      additionalProperties: true,
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies { bool: boolean } | null;
    void (null as { bool: boolean } | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies {
        properties: { bool: { type: "boolean" } };
        nullable: true;
      },
    ).toEqual({
      properties: { bool: { type: "boolean" } },
      nullable: true,
    });
  });

  test("optionalProperties()", () => {
    const valid = properties(undefined, { bool: boolean() });
    const props: unknown = { bool: true };
    assert(valid.guard(props));
    props satisfies { bool?: boolean };
    void (props as { bool?: boolean } satisfies typeof props);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard({})).toBeTrue();
    expect(valid.guard(null)).toBeFalse();
    expect(
      valid.schema() satisfies {
        optionalProperties: { bool: { type: "boolean" } };
      },
    ).toEqual({
      optionalProperties: { bool: { type: "boolean" } },
    });

    const avalid = properties(undefined, { bool: boolean() }, true);
    const aprops: unknown = { extra: 5 };
    assert(avalid.guard(aprops));
    aprops satisfies { bool?: boolean; [k: string]: unknown };
    void (aprops as {
      bool?: boolean;
      [k: string]: unknown;
    } satisfies typeof aprops);
    expect(avalid.guard({ bool: 7, extra: 5 })).toBeFalse();
    expect(avalid.guard(avalid.fuzz()));
    expect(
      avalid.schema() satisfies {
        optionalProperties: { bool: { type: "boolean" } };
        additionalProperties: true;
      },
    ).toEqual({
      optionalProperties: { bool: { type: "boolean" } },
      additionalProperties: true,
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies { bool?: boolean } | null;
    void (null as { bool?: boolean } | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies {
        optionalProperties: { bool: { type: "boolean" } };
        nullable: true;
      },
    ).toEqual({
      optionalProperties: { bool: { type: "boolean" } },
      nullable: true,
    });
  });

  test("bothProperties()", () => {
    const valid = properties({ int: int8() }, { bool: boolean() });
    const props: unknown = { int: 5, bool: true };
    assert(valid.guard(props));
    props satisfies { int: number; bool?: boolean };
    void ({ int: 5 } as { int: number; bool?: boolean } satisfies typeof props);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard({ int: 5 })).toBeTrue();
    expect(valid.guard(null)).toBeFalse();
    expect(valid.guard({ int: 10000 })).toBeFalse();
    expect(
      valid.schema() satisfies {
        properties: { int: { type: "int8" } };
        optionalProperties: { bool: { type: "boolean" } };
      },
    ).toEqual({
      properties: { int: { type: "int8" } },
      optionalProperties: { bool: { type: "boolean" } },
    });

    const avalid = properties({ int: int8() }, { bool: boolean() }, true);
    const aprops: unknown = { int: 0, extra: 5 };
    assert(avalid.guard(aprops));
    aprops satisfies { int: number; bool?: boolean; [k: string]: unknown };
    void (aprops as {
      int: number;
      bool?: boolean;
      [k: string]: unknown;
    } satisfies typeof aprops);
    expect(avalid.guard({ int: 7, bool: 9, extra: 5 })).toBeFalse();
    expect(avalid.guard({ bool: false })).toBeFalse();
    expect(avalid.guard(avalid.fuzz()));
    expect(
      avalid.schema() satisfies {
        properties: { int: { type: "int8" } };
        optionalProperties: { bool: { type: "boolean" } };
        additionalProperties: true;
      },
    ).toEqual({
      properties: { int: { type: "int8" } },
      optionalProperties: { bool: { type: "boolean" } },
      additionalProperties: true,
    });

    const vnull = nullable(valid);
    expect(vnull.guard(props)).toBeTrue();
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies { int: number; bool?: boolean } | null;
    void (null as { int: number; bool?: boolean } | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies {
        properties: { int: { type: "int8" } };
        optionalProperties: { bool: { type: "boolean" } };
        nullable: true;
      },
    ).toEqual({
      properties: { int: { type: "int8" } },
      optionalProperties: { bool: { type: "boolean" } },
      nullable: true,
    });
  });

  test("values()", () => {
    const valid = values(boolean());
    const bools: unknown = { key: true };
    assert(valid.guard(bools));
    bools satisfies Record<string, boolean>;
    void ({} as Record<string, boolean> satisfies typeof bools);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard({})).toBeTrue();
    expect(valid.guard([5])).toBeFalse();
    expect(valid.guard(null)).toBeFalse();
    expect(
      valid.schema() satisfies {
        values: { type: "boolean" };
      },
    ).toEqual({
      values: { type: "boolean" },
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies Record<string, boolean> | null;
    void (null as Record<string, boolean> | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies {
        values: { type: "boolean" };
        nullable: true;
      },
    ).toEqual({
      values: { type: "boolean" },
      nullable: true,
    });
  });

  test("discriminator()", () => {
    const valid = discriminator("type", {
      int: properties({ value: int8() }, undefined, true),
      bool: properties({}, { value: boolean() }),
      mixed: properties({ int: int8() }, { bool: boolean() }),
    });
    const discs: unknown = { type: "int", value: 5 };
    assert(valid.guard(discs));
    discs satisfies
      | ({ type: "int"; value: number } & Record<string, unknown>)
      | { type: "bool"; value?: boolean }
      | { type: "mixed"; int: number; bool?: boolean };
    void (discs as
      | ({ type: "int"; value: number } & Record<string, unknown>)
      | { type: "bool"; value?: boolean }
      | { type: "mixed"; int: number; bool?: boolean } satisfies typeof discs);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard({ type: "int" })).toBeFalse();
    expect(valid.guard({ type: "mixed", bool: true, int: 0 })).toBeTrue();
    expect(valid.guard({ type: "mixed", bool: true })).toBeFalse();
    expect(valid.guard({ type: "int", value: 0, extra: 8 })).toBeTrue();
    expect(valid.guard({ type: "bool" })).toBeTrue();
    expect(valid.guard({ type: "bool", value: true })).toBeTrue();
    expect(valid.guard({ type: "bool", extra: 8 })).toBeFalse();
    expect(
      valid.schema() satisfies {
        discriminator: "type";
        mapping: {
          int: {
            properties: { value: { type: "int8" } };
            additionalProperties: true;
          };
          bool: {
            // eslint-disable-next-line @typescript-eslint/ban-types
            properties: {};
            optionalProperties: { value: { type: "boolean" } };
          };
          mixed: {
            properties: { int: { type: "int8" } };
            optionalProperties: { bool: { type: "boolean" } };
          };
        };
      },
    ).toEqual({
      discriminator: "type",
      mapping: {
        int: {
          properties: { value: { type: "int8" } },
          additionalProperties: true,
        },
        bool: {
          properties: {},
          optionalProperties: { value: { type: "boolean" } },
        },
        mixed: {
          properties: { int: { type: "int8" } },
          optionalProperties: { bool: { type: "boolean" } },
        },
      },
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies
      | ({ type: "int"; value: number } & Record<string, unknown>)
      | { type: "bool"; value?: boolean }
      | { type: "mixed"; int: number; bool?: boolean }
      | null;
    void (null as
      | ({ type: "int"; value: number } & Record<string, unknown>)
      | { type: "bool"; value?: boolean }
      | { type: "mixed"; int: number; bool?: boolean }
      | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies {
        discriminator: "type";
        mapping: {
          int: {
            properties: { value: { type: "int8" } };
            additionalProperties: true;
          };
          bool: {
            // eslint-disable-next-line @typescript-eslint/ban-types
            properties: {};
            optionalProperties: { value: { type: "boolean" } };
          };
          mixed: {
            properties: { int: { type: "int8" } };
            optionalProperties: { bool: { type: "boolean" } };
          };
        };
        nullable: true;
      },
    ).toEqual({
      discriminator: "type",
      mapping: {
        int: {
          properties: { value: { type: "int8" } },
          additionalProperties: true,
        },
        bool: {
          properties: {},
          optionalProperties: { value: { type: "boolean" } },
        },
        mixed: {
          properties: { int: { type: "int8" } },
          optionalProperties: { bool: { type: "boolean" } },
        },
      },
      nullable: true,
    });
  });

  test("definitions()", () => {
    const valid = definitions()
      .def("num", () => int8())
      .build(({ num }) => num);
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);
    expect(valid.guard(valid.fuzz()));
    expect(valid.guard(null)).toBeFalse();
    expect(
      valid.schema() satisfies {
        definitions: { num: { type: "int8" } };
        ref: "num";
      },
    ).toEqual({
      definitions: { num: { type: "int8" } },
      ref: "num",
    });

    const vnull = nullable(valid);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);
    expect(vnull.guard(vnull.fuzz()));
    expect(
      vnull.schema() satisfies {
        definitions: { num: { type: "int8" } };
        ref: "num";
        nullable: true;
      },
    ).toEqual({
      definitions: { num: { type: "int8" } },
      ref: "num",
      nullable: true,
    });

    const inull = definitions()
      .def("num", () => nullable(int8()))
      .build(({ num }) => num);
    const inul: unknown = null;
    assert(inull.guard(inul));
    inul satisfies number | null;
    void (null as number | null satisfies typeof inul);
    expect(inull.guard(inull.fuzz()));
    expect(
      inull.schema() satisfies {
        definitions: { num: { type: "int8"; nullable: true } };
        ref: "num";
      },
    ).toEqual({
      definitions: { num: { type: "int8", nullable: true } },
      ref: "num",
    });
  });

  test("metadata()", () => {
    const valid = metadata(empty(), "meta");
    // NOTE we run this 20 times to make sure we test all the various empty fuzzes
    for (let i = 0; i < 20; ++i) {
      expect(valid.guard(valid.fuzz()));
    }
    expect(valid.schema() satisfies { metadata: "meta" }).toEqual({
      metadata: "meta",
    });
  });

  test("complex", () => {
    const valid = definitions()
      .def("bool", () => boolean())
      .def("double", ({ bool }) => bool)
      .build(({ double }) =>
        discriminator("select", {
          int: properties({ value: int8() }, {}, true),
          opt: properties(
            {},
            { value: boolean(), elems: elements(timestamp()) },
          ),
          props: properties({ values: values(int8()) }, { bool: double }),
        }),
      );

    const val: unknown = { select: "props", values: { key: 0 } };
    assert(valid.guard(val));
    val satisfies
      | { select: "int"; value: number; [k: string]: unknown }
      | { select: "opt"; value?: boolean; elems?: string[] }
      | { select: "props"; values: Record<string, number>; bool?: boolean };
    void (val as
      | { select: "int"; value: number; [k: string]: unknown }
      | { select: "opt"; value?: boolean; elems?: string[] }
      | {
          select: "props";
          values: Record<string, number>;
          bool?: boolean;
        } satisfies typeof val);
    expect(valid.guard(valid.fuzz()));
  });
});

describe("compile", () => {
  test("works for empty schema", () => {
    const valid = compile({} satisfies SomeRootSchema);
    const any: unknown = true;
    assert(valid.guard(any));
    any satisfies unknown;
    void (any as unknown satisfies typeof any);

    expect(valid.guard(undefined)).toBeFalse();

    const vnull = compile({
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies unknown | null;
    void (null as unknown | null satisfies typeof nul);
  });

  test("works for boolean", () => {
    const valid = compile({ type: "boolean" } satisfies SomeRootSchema);
    const bool: unknown = true;
    assert(valid.guard(bool));
    bool satisfies boolean;
    void (true as boolean satisfies typeof bool);

    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      type: "boolean",
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies boolean | null;
    void (null as boolean | null satisfies typeof nul);
  });

  test("works for float32", () => {
    const valid = compile({ type: "float32" } satisfies SomeRootSchema);
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);

    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      type: "float32",
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);
  });

  test("works for float64", () => {
    const valid = compile({ type: "float64" } satisfies SomeRootSchema);
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);

    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      type: "float64",
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);
  });

  test("works for int8", () => {
    const valid = compile({ type: "int8" } satisfies SomeRootSchema);
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);

    expect(valid.guard(-129)).toBeFalse();
    expect(valid.guard(128)).toBeFalse();
    expect(valid.guard(0.5)).toBeFalse();
    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      type: "int8",
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);
  });

  test("works for uint16", () => {
    const valid = compile({ type: "uint16" } satisfies SomeRootSchema);
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);

    expect(valid.guard(-1)).toBeFalse();
    expect(valid.guard(65536)).toBeFalse();
    expect(valid.guard(0.5)).toBeFalse();
    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      type: "uint16",
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);
  });

  test("works for string", () => {
    const valid = compile({ type: "string" } satisfies SomeRootSchema);
    const str: unknown = "string";
    assert(valid.guard(str));
    str satisfies string;
    void ("" as string satisfies typeof str);

    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      type: "string",
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies string | null;
    void (null as string | null satisfies typeof nul);
  });

  test("works for timestamp", () => {
    const valid = compile({ type: "timestamp" } satisfies SomeRootSchema);
    const time: unknown = "1985-04-12T23:20:50.52Z";
    assert(valid.guard(time));
    time satisfies string;
    void ("" as string satisfies typeof time);

    expect(valid.guard("foo")).toBeFalse();
    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      type: "timestamp",
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies string | null;
    void (null as string | null satisfies typeof nul);
  });

  test("works for enum", () => {
    const valid = compile({ enum: ["a", "b", "c"] });
    const abc: unknown = "a";
    assert(valid.guard(abc));
    abc satisfies "a" | "b" | "c";
    void ("a" as "a" | "b" | "c" satisfies typeof abc);

    expect(valid.guard("d")).toBeFalse();
    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      enum: ["a", "b", "c"],
      nullable: true,
    });
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies "a" | "b" | "c" | null;
    void (null as "a" | "b" | "c" | null satisfies typeof nul);
  });

  test("works for elements", () => {
    const valid = compile({
      elements: { type: "boolean" },
    } satisfies SomeRootSchema);
    const bools: unknown = [true];
    assert(valid.guard([]));
    assert(valid.guard(bools));
    bools satisfies boolean[];
    void ([] as boolean[] satisfies typeof bools);

    expect(valid.guard([5])).toBeFalse();
    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      elements: { type: "boolean" },
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies boolean[] | null;
    void (null as boolean[] | null satisfies typeof nul);
  });

  test("works for properties", () => {
    const valid = compile({
      properties: { bool: { type: "boolean" } },
    } satisfies SomeRootSchema);
    const props: unknown = { bool: true };
    assert(valid.guard(props));
    props satisfies { bool: boolean };
    void (props as { bool: boolean } satisfies typeof props);

    expect(valid.guard(null)).toBeFalse();
    expect(valid.guard({ bool: true, extra: 5 })).toBeFalse();

    const avalid = compile({
      properties: { bool: { type: "boolean" } },
      additionalProperties: true,
    } satisfies SomeRootSchema);
    const aprops: unknown = { bool: true, extra: 5 };
    assert(avalid.guard(aprops));
    aprops satisfies { bool: boolean; [k: string]: unknown };
    void (aprops as {
      bool: boolean;
      [k: string]: unknown;
    } satisfies typeof aprops);

    expect(avalid.guard({ bool: 7, extra: 5 })).toBeFalse();

    const vnull = compile({
      properties: { bool: { type: "boolean" } },
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies { bool: boolean } | null;
    void (null as { bool: boolean } | null satisfies typeof nul);
  });

  test("works for optionalProperties", () => {
    const valid = compile({
      optionalProperties: { bool: { type: "boolean" } },
    } satisfies SomeRootSchema);
    const props: unknown = { bool: true };
    assert(valid.guard(props));
    props satisfies { bool?: boolean };
    void (props as { bool?: boolean } satisfies typeof props);

    expect(valid.guard({})).toBeTrue();
    expect(valid.guard(null)).toBeFalse();

    const avalid = compile({
      optionalProperties: { bool: { type: "boolean" } },
      additionalProperties: true,
    } satisfies SomeRootSchema);
    const aprops: unknown = { extra: 5 };
    assert(avalid.guard(aprops));
    aprops satisfies { bool?: boolean; [k: string]: unknown };
    void (aprops as {
      bool?: boolean;
      [k: string]: unknown;
    } satisfies typeof aprops);

    expect(avalid.guard({ bool: 7, extra: 5 })).toBeFalse();

    const vnull = compile({
      optionalProperties: { bool: { type: "boolean" } },
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies { bool?: boolean } | null;
    void (null as { bool?: boolean } | null satisfies typeof nul);
  });

  test("works for bothProperties", () => {
    const valid = compile({
      properties: { int: { type: "int8" } },
      optionalProperties: { bool: { type: "boolean" } },
    } satisfies SomeRootSchema);
    const props: unknown = { int: 5, bool: true };
    assert(valid.guard(props));
    props satisfies { int: number; bool?: boolean };
    void ({ int: 5 } as { int: number; bool?: boolean } satisfies typeof props);

    expect(valid.guard({ int: 5 })).toBeTrue();
    expect(valid.guard(null)).toBeFalse();
    expect(valid.guard({ int: 10000 })).toBeFalse();

    const avalid = compile({
      properties: { int: { type: "int8" } },
      optionalProperties: { bool: { type: "boolean" } },
      additionalProperties: true,
    } satisfies SomeRootSchema);
    const aprops: unknown = { int: 0, extra: 5 };
    assert(avalid.guard(aprops));
    aprops satisfies { int: number; bool?: boolean; [k: string]: unknown };
    void (aprops as {
      int: number;
      bool?: boolean;
      [k: string]: unknown;
    } satisfies typeof aprops);

    expect(avalid.guard({ int: 7, bool: 9, extra: 5 })).toBeFalse();
    expect(avalid.guard({ bool: false })).toBeFalse();

    const vnull = compile({
      properties: { int: { type: "int8" } },
      optionalProperties: { bool: { type: "boolean" } },
      nullable: true,
    } satisfies SomeRootSchema);
    expect(vnull.guard(props)).toBeTrue();
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies { int: number; bool?: boolean } | null;
    void (null as { int: number; bool?: boolean } | null satisfies typeof nul);
  });

  test("works for values", () => {
    const valid = compile({
      values: { type: "boolean" },
    } satisfies SomeRootSchema);
    const bools: unknown = { key: true };
    assert(valid.guard(bools));
    bools satisfies Record<string, boolean>;
    void ({} as Record<string, boolean> satisfies typeof bools);

    expect(valid.guard({})).toBeTrue();
    expect(valid.guard([5])).toBeFalse();
    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      values: { type: "boolean" },
      nullable: true,
    } satisfies SomeRootSchema);
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies Record<string, boolean> | null;
    void (null as Record<string, boolean> | null satisfies typeof nul);
  });

  test("works for discriminator", () => {
    const valid = compile({
      discriminator: "type",
      mapping: {
        int: {
          properties: { value: { type: "int8" } },
          additionalProperties: true,
        },
        bool: { optionalProperties: { value: { type: "boolean" } } },
        mixed: {
          properties: { int: { type: "int8" } },
          optionalProperties: { bool: { type: "boolean" } },
        },
      },
    });
    const discs: unknown = { type: "int", value: 5 };
    assert(valid.guard(discs));
    discs satisfies
      | ({ type: "int"; value: number } & Record<string, unknown>)
      | { type: "bool"; value?: boolean }
      | { type: "mixed"; int: number; bool?: boolean };
    void (discs as
      | ({ type: "int"; value: number } & Record<string, unknown>)
      | { type: "bool"; value?: boolean }
      | { type: "mixed"; int: number; bool?: boolean } satisfies typeof discs);

    expect(valid.guard({ type: "int" })).toBeFalse();
    expect(valid.guard({ type: "mixed", bool: true, int: 0 })).toBeTrue();
    expect(valid.guard({ type: "mixed", bool: true })).toBeFalse();
    expect(valid.guard({ type: "int", value: 0, extra: 8 })).toBeTrue();
    expect(valid.guard({ type: "bool" })).toBeTrue();
    expect(valid.guard({ type: "bool", value: true })).toBeTrue();
    expect(valid.guard({ type: "bool", extra: 8 })).toBeFalse();

    const vnull = compile({
      discriminator: "type",
      mapping: {
        int: {
          properties: { value: { type: "int8" } },
          additionalProperties: true,
        },
        bool: { optionalProperties: { value: { type: "boolean" } } },
        mixed: {
          properties: { int: { type: "int8" } },
          optionalProperties: { bool: { type: "boolean" } },
        },
      },
      nullable: true,
    });
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies
      | ({ type: "int"; value: number } & Record<string, unknown>)
      | { type: "bool"; value?: boolean }
      | { type: "mixed"; int: number; bool?: boolean }
      | null;
    void (null as
      | ({ type: "int"; value: number } & Record<string, unknown>)
      | { type: "bool"; value?: boolean }
      | { type: "mixed"; int: number; bool?: boolean }
      | null satisfies typeof nul);
  });

  test("works for ref", () => {
    const valid = compile({
      definitions: { num: { type: "int8" } },
      ref: "num",
    });
    const num: unknown = 5;
    assert(valid.guard(num));
    num satisfies number;
    void (0 as number satisfies typeof num);
    expect(valid.guard(null)).toBeFalse();

    const vnull = compile({
      definitions: { num: { type: "int8" } },
      ref: "num",
      nullable: true,
    });
    const nul: unknown = null;
    assert(vnull.guard(nul));
    nul satisfies number | null;
    void (null as number | null satisfies typeof nul);

    const inull = compile({
      definitions: { num: { type: "int8", nullable: true } },
      ref: "num",
    });
    const inul: unknown = null;
    assert(inull.guard(inul));
    inul satisfies number | null;
    void (null as number | null satisfies typeof inul);
  });

  test("works for circular refs", () => {
    const valid = compile({
      definitions: {
        // eslint-disable-next-line spellcheck/spell-checker
        elems: { elements: { ref: "vals" } },
        vals: { values: { ref: "elems" } },
      },
      ref: "elems",
    });
    const num: unknown = [{ foo: [] }];
    assert(valid.guard(num));
    num satisfies Cycle;
    void ([] as Cycle satisfies typeof num);
    expect(valid.guard(5)).toBeFalse();
    expect(valid.guard(valid.fuzz()));
  });

  test("works for complex type", () => {
    const valid = compile({
      definitions: {
        bool: { type: "boolean" },
        double: { ref: "bool" },
      },
      discriminator: "select",
      mapping: {
        int: {
          properties: { value: { type: "int8" } },
          additionalProperties: true,
        },
        opt: {
          optionalProperties: {
            value: { type: "boolean" },
            elems: { elements: { type: "timestamp" } },
          },
        },
        props: {
          properties: { values: { values: { type: "int8" } } },
          optionalProperties: { bool: { ref: "double" } },
        },
      },
    });

    const val: unknown = { select: "props", values: { key: 0 } };
    assert(valid.guard(val));
    val satisfies
      | { select: "int"; value: number; [k: string]: unknown }
      | { select: "opt"; value?: boolean; elems?: string[] }
      | { select: "props"; values: Record<string, number>; bool?: boolean };
    void (val as
      | { select: "int"; value: number; [k: string]: unknown }
      | { select: "opt"; value?: boolean; elems?: string[] }
      | {
          select: "props";
          values: Record<string, number>;
          bool?: boolean;
        } satisfies typeof val);
  });

  test("works for unknown schemas", () => {
    const schema: unknown = { type: "boolean" };
    // @ts-expect-error this causes a recursive lookup because we don't know the actual type
    const valid = compile(schema) as CompiledSchema<boolean, unknown>;
    expect(valid.guard(true)).toBeTrue();
    expect(valid.guard(null)).toBeFalse();
  });
});

const validTestStr = await Bun.file(
  new URL("../json-typedef-spec/tests/validation.json", import.meta.url),
).text();
describe("jtd validation tests", () => {
  const validTests = JSON.parse(validTestStr) as unknown;
  const validator = values(
    properties({
      schema: empty(),
      instance: empty(),
      errors: elements(empty()),
    }),
  );
  assert(validator.guard(validTests));
  for (const [name, { schema, instance, errors }] of Object.entries(
    validTests,
  )) {
    test(name, () => {
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error,@typescript-eslint/ban-ts-comment
      // @ts-ignore can't actually infer type of SomeRootSchema
      const valid = compile(schema as SomeRootSchema);
      expect(valid.guard(instance)).toBe(!errors.length);
    });
  }
});

const invalidTestStr = await Bun.file(
  new URL("../json-typedef-spec/tests/invalid_schemas.json", import.meta.url),
).text();
describe("jtd invalid schema tests", () => {
  const invalidTests = JSON.parse(invalidTestStr) as unknown;
  const validator = compile({ values: {} });
  assert(validator.guard(invalidTests));
  for (const [name, schema] of Object.entries(invalidTests)) {
    test(name, () => {
      expect(() => compile(schema as SomeRootSchema)).toThrow();
    });
  }
});
