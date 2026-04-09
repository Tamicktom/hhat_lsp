//* Libraries imports
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

//* Parser imports
import { parse } from '../index';

function fixture(name: string): string {
  return readFileSync(
    resolve(__dirname, 'fixtures', name),
    'utf-8',
  );
}

describe('Parser', () => {
  describe('valid programs', () => {
    it('parses an empty main block', () => {
      const result = parse(fixture('valid-empty-main.hat'));
      expect(result.diagnostics).toHaveLength(0);
      expect(result.ast).not.toBeNull();
      expect(result.ast!.main).not.toBeNull();
      expect(result.ast!.main!.body).toHaveLength(0);
    });

    it('parses the example main-only program', () => {
      const result = parse(fixture('valid-main-only.hat'));
      expect(result.diagnostics).toHaveLength(0);
      expect(result.ast).not.toBeNull();

      const main = result.ast!.main!;
      expect(main.type).toBe('MainBlock');
      expect(main.body.length).toBeGreaterThanOrEqual(6);

      const firstStmt = main.body[0]!;
      expect(firstStmt.type).toBe('Declaration');
      if (firstStmt.type === 'Declaration') {
        expect(firstStmt.name.name).toBe('x');
        expect(firstStmt.typeAnnotation.name).toBe('i32');
        expect(firstStmt.initializer).not.toBeNull();
        expect(firstStmt.initializer!.type).toBe('IntegerLiteral');
      }
    });

    it('parses all primitive type declarations', () => {
      const result = parse(fixture('valid-declarations.hat'));
      expect(result.diagnostics).toHaveLength(0);

      const main = result.ast!.main!;
      expect(main.body).toHaveLength(10);

      const types = main.body.map((s) =>
        s.type === 'Declaration' ? s.typeAnnotation.name : null,
      );
      expect(types).toEqual([
        'i8', 'i16', 'i32', 'i64',
        'u8', 'u16', 'u32', 'u64',
        'f32', 'f64',
      ]);
    });

    it('parses a function definition with return', () => {
      const result = parse(fixture('valid-function-def.hat'));
      expect(result.diagnostics).toHaveLength(0);

      const fnDef = result.ast!.definitions[0]!;
      expect(fnDef.type).toBe('FunctionDef');
      if (fnDef.type === 'FunctionDef') {
        expect(fnDef.name.name).toBe('add');
        expect(fnDef.params).toHaveLength(2);
        expect(fnDef.returnType).not.toBeNull();
        expect(fnDef.returnType!.name).toBe('i32');
        expect(fnDef.body).toHaveLength(1);
        expect(fnDef.body[0]!.type).toBe('Return');
      }
    });

    it('parses const definitions', () => {
      const result = parse(fixture('valid-const.hat'));
      expect(result.diagnostics).toHaveLength(0);
      expect(result.ast!.definitions).toHaveLength(2);

      const pi = result.ast!.definitions[0]!;
      expect(pi.type).toBe('ConstDef');
      if (pi.type === 'ConstDef') {
        expect(pi.name.name).toBe('PI');
        expect(pi.typeAnnotation.name).toBe('f64');
      }
    });

    it('parses type definitions', () => {
      const result = parse(fixture('valid-type-def.hat'));
      expect(result.diagnostics).toHaveLength(0);
      expect(result.ast!.definitions).toHaveLength(1);

      const typeDef = result.ast!.definitions[0]!;
      expect(typeDef.type).toBe('TypeDef');
      if (typeDef.type === 'TypeDef') {
        expect(typeDef.name.name).toBe('Point');
        expect(typeDef.members).toHaveLength(2);
      }
    });
  });

  describe('invalid programs', () => {
    it('reports error for missing closing brace', () => {
      const result = parse(fixture('invalid-missing-brace.hat'));
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    });

    it('reports error for bad declaration syntax', () => {
      const result = parse(fixture('invalid-bad-declaration.hat'));
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('reports error for completely invalid input', () => {
      const result = parse('??? !!!');
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('expression parsing', () => {
    it('parses a call expression with multiple arguments', () => {
      const result = parse('main { add(1 2) }');
      expect(result.diagnostics).toHaveLength(0);

      const call = result.ast!.main!.body[0]!;
      expect(call.type).toBe('CallExpression');
      if (call.type === 'CallExpression') {
        expect(call.callee.name).toBe('add');
        expect(call.arguments).toHaveLength(2);
      }
    });

    it('parses nested call expressions', () => {
      const result = parse('main { print(add(1 2)) }');
      expect(result.diagnostics).toHaveLength(0);

      const outer = result.ast!.main!.body[0]!;
      expect(outer.type).toBe('CallExpression');
      if (outer.type === 'CallExpression') {
        expect(outer.arguments[0]!.type).toBe('CallExpression');
      }
    });

    it('parses boolean literals in expressions', () => {
      const result = parse('main { x:i32 = true }');
      expect(result.diagnostics).toHaveLength(0);

      const decl = result.ast!.main!.body[0]!;
      expect(decl.type).toBe('Declaration');
      if (decl.type === 'Declaration') {
        expect(decl.initializer!.type).toBe('BooleanLiteral');
      }
    });

    it('parses string literals', () => {
      const result = parse('main { s:str = "hello" }');
      expect(result.diagnostics).toHaveLength(0);

      const decl = result.ast!.main!.body[0]!;
      expect(decl.type).toBe('Declaration');
      if (decl.type === 'Declaration') {
        expect(decl.initializer!.type).toBe('StringLiteral');
      }
    });

    it('parses negative integer literals', () => {
      const result = parse('main { x:i32 = -5 }');
      expect(result.diagnostics).toHaveLength(0);

      const decl = result.ast!.main!.body[0]!;
      if (decl.type === 'Declaration') {
        expect(decl.initializer!.type).toBe('IntegerLiteral');
        if (decl.initializer!.type === 'IntegerLiteral') {
          expect(decl.initializer!.value).toBe(-5);
        }
      }
    });
  });

  describe('source positions', () => {
    it('reports correct line numbers for diagnostics', () => {
      const source = 'main {\n  x:i32 = 10\n  ???\n}';
      const result = parse(source);
      const errorDiag = result.diagnostics.find((d) => d.severity === 'error');
      if (errorDiag) {
        expect(errorDiag.range.start.line).toBe(2);
      }
    });

    it('reports correct positions for AST nodes', () => {
      const result = parse('main {\n  x:i32 = 10\n}');
      const main = result.ast!.main!;
      expect(main.range.start.line).toBe(0);

      const decl = main.body[0]!;
      if (decl.type === 'Declaration') {
        expect(decl.range.start.line).toBe(1);
      }
    });
  });
});
