import { pipe } from "@fp-ts/data/Function"
import * as AST from "@fp-ts/schema/AST"
import * as P from "@fp-ts/schema/Parser"
import * as S from "@fp-ts/schema/Schema"

describe.concurrent("Schema", () => {
  it("templateLiteral. a", () => {
    const schema = S.templateLiteral(S.literal("a"))
    expect(schema.ast).toEqual(AST.createLiteral("a"))
  })

  it("templateLiteral. a b", () => {
    const schema = S.templateLiteral(S.literal("a"), S.literal(" "), S.literal("b"))
    expect(schema.ast).toEqual(
      AST.createLiteral("a b")
    )
  })

  it("templateLiteral. (a | b) c", () => {
    const schema = S.templateLiteral(S.literal("a", "b"), S.literal("c"))
    expect(schema.ast).toEqual(
      AST.createUnion([AST.createLiteral("ac"), AST.createLiteral("bc")])
    )
  })

  it("templateLiteral. (a | b) c (d | e)", () => {
    const schema = S.templateLiteral(S.literal("a", "b"), S.literal("c"), S.literal("d", "e"))
    expect(schema.ast).toEqual(
      AST.createUnion([
        AST.createLiteral("acd"),
        AST.createLiteral("ace"),
        AST.createLiteral("bcd"),
        AST.createLiteral("bce")
      ])
    )
  })

  it("templateLiteral. (a | b) string (d | e)", () => {
    const schema = S.templateLiteral(S.literal("a", "b"), S.string, S.literal("d", "e"))
    expect(schema.ast).toEqual(
      AST.createUnion([
        AST.createTemplateLiteral("a", [{ type: AST.stringKeyword, literal: "d" }]),
        AST.createTemplateLiteral("a", [{ type: AST.stringKeyword, literal: "e" }]),
        AST.createTemplateLiteral("b", [{ type: AST.stringKeyword, literal: "d" }]),
        AST.createTemplateLiteral("b", [{ type: AST.stringKeyword, literal: "e" }])
      ])
    )
  })

  it("templateLiteral. a${string}", () => {
    const schema = S.templateLiteral(S.literal("a"), S.string)
    expect(schema.ast).toEqual(
      AST.createTemplateLiteral("a", [{ type: AST.stringKeyword, literal: "" }])
    )
  })

  it("templateLiteral. a${string}b", () => {
    const schema = S.templateLiteral(S.literal("a"), S.string, S.literal("b"))
    expect(schema.ast).toEqual(
      AST.createTemplateLiteral("a", [{ type: AST.stringKeyword, literal: "b" }])
    )
  })

  it("optional/ should flatten optional calls", () => {
    const schema = S.optional(S.optional(S.string))
    expect(schema).toEqual(S.optional(S.string))
  })

  describe.concurrent("literal", () => {
    it("should return never with no literals", () => {
      expect(S.literal().ast).toEqual(AST.neverKeyword)
    })

    it("should return an unwrapped AST with exactly one literal", () => {
      expect(S.literal(1).ast).toEqual(AST.createLiteral(1))
    })

    it("should return a union with more than one literal", () => {
      expect(S.literal(1, 2).ast).toEqual(
        AST.createUnion([AST.createLiteral(1), AST.createLiteral(2)])
      )
    })
  })

  it("enums", () => {
    enum Fruits {
      Apple,
      Banana
    }
    const schema = S.enums(Fruits)
    const is = P.is(schema)
    expect(is(Fruits.Apple)).toEqual(true)
    expect(is(Fruits.Banana)).toEqual(true)
    expect(is(0)).toEqual(true)
    expect(is(1)).toEqual(true)
    expect(is(3)).toEqual(false)
  })

  describe.concurrent("keyof", () => {
    describe.concurrent("struct", () => {
      it("string keys", () => {
        const schema = S.struct({
          a: S.string,
          b: S.number
        })
        const keyOf = S.keyof(schema)
        const is = P.is(keyOf)
        expect(is("a")).toEqual(true)
        expect(is("b")).toEqual(true)
        expect(is("c")).toEqual(false)
      })

      it("symbol keys", () => {
        const a = Symbol.for("@fp-ts/schema/test/a")
        const b = Symbol.for("@fp-ts/schema/test/b")
        const schema = S.struct({
          [a]: S.string,
          [b]: S.number
        })
        const keyOf = S.keyof(schema)
        const is = P.is(keyOf)
        expect(is(a)).toEqual(true)
        expect(is(b)).toEqual(true)
        expect(is("a")).toEqual(false)
        expect(is("b")).toEqual(false)
      })
    })

    it("union", () => {
      const schema = S.union(
        S.struct({
          a: S.string,
          b: S.number
        }),
        S.struct({
          a: S.boolean,
          c: S.number
        })
      )
      const keyOf = S.keyof(schema)
      const is = P.is(keyOf)
      expect(is("a")).toEqual(true)
      expect(is("b")).toEqual(false)
      expect(is("c")).toEqual(false)
    })
  })

  it(`extend/ union of structs with struct`, () => {
    const schema = pipe(
      S.struct({ b: S.boolean }),
      S.extend(S.union(
        S.struct({ a: S.literal("a") }),
        S.struct({ a: S.literal("b") })
      ))
    )
    const is = P.is(schema)

    expect(is({ a: "a", b: false })).toBe(true)
    expect(is({ a: "b", b: false })).toBe(true)

    expect(is({ a: "a" })).toBe(false)
    expect(is({ a: "b" })).toBe(false)
  })

  it("extend/ can only handle type literals or unions of type literals", () => {
    expect(() => pipe(S.string, S.extend(S.number))).toThrowError(
      new Error("`extend` can only handle type literals or unions of type literals")
    )
  })

  it(`extend/overlapping index signatures/ string`, () => {
    expect(() =>
      pipe(
        S.record(S.string, S.number),
        S.extend(S.record(S.string, S.boolean))
      )
    ).toThrowError(new Error("`extend` cannot handle overlapping index signatures"))
  })

  it(`extend/overlapping index signatures/ symbol`, () => {
    expect(() =>
      pipe(
        S.record(S.symbol, S.number),
        S.extend(S.record(S.symbol, S.boolean))
      )
    ).toThrowError(new Error("`extend` cannot handle overlapping index signatures"))
  })

  it("extend/overlapping index signatures/ refinements", () => {
    expect(() =>
      pipe(
        S.record(S.string, S.number),
        S.extend(S.record(pipe(S.string, S.minLength(2)), S.boolean))
      )
    ).toThrowError(new Error("`extend` cannot handle overlapping index signatures"))
  })

  it(`extend/ struct with union of structs`, () => {
    const schema = pipe(
      S.union(
        S.struct({ a: S.literal("a") }),
        S.struct({ b: S.literal("b") })
      ),
      S.extend(S.struct({ c: S.boolean }))
    )
    const is = P.is(schema)

    expect(is({ a: "a", c: false })).toBe(true)
    expect(is({ b: "b", c: false })).toBe(true)

    expect(is({ a: "a" })).toBe(false)
    expect(is({ a: "b" })).toBe(false)
  })

  it(`extend/ union of structs with union of structs`, () => {
    const schema = pipe(
      S.union(
        S.struct({ a: S.literal("a") }),
        S.struct({ a: S.literal("b") })
      ),
      S.extend(
        S.union(
          S.struct({ c: S.boolean }),
          S.struct({ d: S.number })
        )
      )
    )
    const is = P.is(schema)

    expect(is({ a: "a", c: false })).toBe(true)
    expect(is({ a: "b", d: 69 })).toBe(true)
    expect(is({ a: "a", d: 69 })).toBe(true)
    expect(is({ a: "b", c: false })).toBe(true)

    expect(is({ a: "a" })).toBe(false)
    expect(is({ a: "b" })).toBe(false)
    expect(is({ c: false })).toBe(false)
    expect(is({ d: 42 })).toBe(false)
  })

  it(`extend/ overlapping property signatures`, () => {
    expect(() =>
      pipe(
        S.struct({ a: S.literal("a") }),
        S.extend(S.struct({ a: S.string }))
      )
    ).toThrowError(new Error("`extend` cannot handle overlapping property signatures"))
    expect(() =>
      pipe(
        S.struct({ a: S.literal("a") }),
        S.extend(
          S.union(
            S.struct({ a: S.string }),
            S.struct({ b: S.number })
          )
        )
      )
    ).toThrowError(new Error("`extend` cannot handle overlapping property signatures"))
  })

  describe.concurrent("experimental", () => {
    it("rename", () => {
      const rename = <A, From extends keyof A, To extends PropertyKey>(
        from: From,
        to: To
      ) =>
        (schema: S.Schema<A>): S.Schema<Omit<A, From> & { [K in To]: A[From] }> => {
          if (AST.isTypeLiteral(schema.ast)) {
            const propertySignatures = schema.ast.propertySignatures.slice()
            const i = propertySignatures.findIndex((ps) => ps.name === from)
            propertySignatures[i] = AST.createPropertySignature(
              to,
              propertySignatures[i].type,
              propertySignatures[i].isOptional,
              propertySignatures[i].isReadonly
            )
            return S.make(
              AST.createTypeLiteral(propertySignatures, schema.ast.indexSignatures)
            )
          }
          throw new Error("cannot rename")
        }

      const schema = pipe(
        S.struct({
          a: S.string,
          b: S.number
        }),
        rename("a", "aa")
      )
      const is = P.is(schema)
      expect(is({ a: "foo", b: 1 })).toEqual(false)
      expect(is({ aa: "foo", b: 1 })).toEqual(true)
    })

    it("crazy struct", () => {
      type OptionalKeys<A> = {
        [K in keyof A]: K extends `${string}?` ? K : never
      }[keyof A]

      type RequiredKeys<A> = {
        [K in keyof A]: K extends `${string}?` ? never : K
      }[keyof A]

      const struct = <Fields extends Record<PropertyKey, S.Schema<any>>>(
        fields: Fields
      ): S.Schema<
        S.Spread<
          & { readonly [K in RequiredKeys<Fields>]: S.Infer<Fields[K]> }
          & {
            readonly [K in OptionalKeys<Fields> as K extends `${infer S}?` ? S : K]+?: S.Infer<
              Fields[K]
            >
          }
        >
      > =>
        S.make(
          AST.createTypeLiteral(
            Object.keys(fields).map((key) => {
              const isOptional = key.endsWith("?")
              return AST.createPropertySignature(
                isOptional ? key.substring(0, key.length - 1) : key,
                fields[key].ast,
                isOptional,
                true
              )
            }),
            []
          )
        )

      /*
      const schema: S.Schema<{
        readonly a: string;
        readonly b: number;
        readonly c?: boolean;
      }>
      */
      const schema = struct({
        a: S.string,
        b: S.number,
        "c?": S.boolean
      })

      const is = P.is(schema)
      expect(is({ a: "a", b: 1 })).toBe(true)
      expect(is({ a: "a", b: 1, c: true })).toBe(true)

      expect(is({ a: "a" })).toBe(false)
      expect(is({ a: "a", b: 1, c: 1 })).toBe(false)
    })
  })
})
