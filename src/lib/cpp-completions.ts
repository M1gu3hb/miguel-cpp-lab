import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

/**
 * Autocompletado de editor, no de ejercicios: palabras del lenguaje, cabeceras
 * estándar y miembros de `std`. No propone soluciones ni plantillas de código.
 */

const KEYWORDS = [
  "alignas", "alignof", "and", "asm", "auto", "bool", "break", "case", "catch", "char",
  "char8_t", "char16_t", "char32_t", "class", "const", "consteval", "constexpr", "constinit",
  "const_cast", "continue", "decltype", "default", "delete", "do", "double", "dynamic_cast",
  "else", "enum", "explicit", "export", "extern", "false", "float", "for", "friend", "goto",
  "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "not", "nullptr",
  "operator", "or", "private", "protected", "public", "register", "reinterpret_cast", "return",
  "short", "signed", "sizeof", "static", "static_assert", "static_cast", "struct", "switch",
  "template", "this", "thread_local", "throw", "true", "try", "typedef", "typeid", "typename",
  "union", "unsigned", "using", "virtual", "void", "volatile", "wchar_t", "while", "xor",
];

const PREPROCESSOR = ["#include", "#define", "#ifdef", "#ifndef", "#endif", "#pragma once"];

const HEADERS = [
  "algorithm", "array", "bitset", "cassert", "cctype", "chrono", "climits", "cmath", "complex",
  "cstdio", "cstdlib", "cstring", "ctime", "deque", "exception", "filesystem", "fstream",
  "functional", "initializer_list", "iomanip", "ios", "iostream", "iterator", "limits", "list",
  "map", "memory", "numeric", "optional", "queue", "random", "ratio", "regex", "set", "sstream",
  "stack", "stdexcept", "string", "string_view", "tuple", "type_traits", "unordered_map",
  "unordered_set", "utility", "variant", "vector",
];

type Entry = [label: string, detail: string];

const STD_MEMBERS: Entry[] = [
  ["cout", "flujo de salida"],
  ["cin", "flujo de entrada"],
  ["cerr", "salida de error"],
  ["endl", "salto de línea y flush"],
  ["string", "cadena"],
  ["to_string", "convierte a string"],
  ["stoi", "string → int"],
  ["stod", "string → double"],
  ["getline", "lee una línea completa"],
  ["vector", "arreglo dinámico"],
  ["array", "arreglo fijo"],
  ["map", "diccionario ordenado"],
  ["unordered_map", "diccionario hash"],
  ["set", "conjunto ordenado"],
  ["pair", "par de valores"],
  ["make_pair", "construye un par"],
  ["tuple", "tupla"],
  ["sort", "ordena un rango"],
  ["reverse", "invierte un rango"],
  ["find", "busca en un rango"],
  ["count", "cuenta en un rango"],
  ["accumulate", "suma un rango (<numeric>)"],
  ["max", "máximo"],
  ["min", "mínimo"],
  ["max_element", "mayor de un rango"],
  ["min_element", "menor de un rango"],
  ["swap", "intercambia dos valores"],
  ["abs", "valor absoluto"],
  ["pow", "potencia"],
  ["sqrt", "raíz cuadrada"],
  ["size_t", "tipo de tamaño"],
  ["move", "mueve un valor"],
  ["unique_ptr", "puntero único"],
  ["shared_ptr", "puntero compartido"],
  ["optional", "valor opcional"],
  ["stringstream", "flujo sobre cadena"],
  ["ostringstream", "flujo de salida sobre cadena"],
  ["istringstream", "flujo de entrada sobre cadena"],
  ["runtime_error", "excepción"],
  ["exception", "excepción base"],
  ["numeric_limits", "límites de un tipo"],
];

const MEMBER_FUNCTIONS: Entry[] = [
  ["size", "número de elementos"],
  ["empty", "¿está vacío?"],
  ["push_back", "añade al final"],
  ["pop_back", "quita el último"],
  ["begin", "iterador al inicio"],
  ["end", "iterador al final"],
  ["at", "acceso con comprobación"],
  ["front", "primer elemento"],
  ["back", "último elemento"],
  ["clear", "vacía el contenedor"],
  ["insert", "inserta"],
  ["erase", "borra"],
  ["length", "longitud de la cadena"],
  ["substr", "subcadena"],
  ["c_str", "cadena estilo C"],
];

function options(entries: Entry[], type: Completion["type"]): Completion[] {
  return entries.map(([label, detail]) => ({ label, detail, type }));
}

const GENERAL: Completion[] = [
  ...KEYWORDS.map((label) => ({ label, type: "keyword" as const })),
  ...PREPROCESSOR.map((label) => ({ label, type: "macro" as const })),
  { label: "std", detail: "espacio de nombres estándar", type: "namespace" },
  ...options(STD_MEMBERS, "function"),
  ...options(MEMBER_FUNCTIONS, "method"),
];

const HEADER_OPTIONS: Completion[] = HEADERS.map((label) => ({
  label,
  type: "class",
  detail: "cabecera estándar",
}));

const STD_OPTIONS: Completion[] = options(STD_MEMBERS, "function");

export function cppCompletions(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);

  const include = /#\s*include\s*[<"]([A-Za-z0-9_./]*)$/.exec(before);
  if (include) {
    return {
      from: context.pos - include[1].length,
      options: HEADER_OPTIONS,
      validFor: /^[A-Za-z0-9_./]*$/,
    };
  }

  const stdMember = /std::([A-Za-z0-9_]*)$/.exec(before);
  if (stdMember) {
    return {
      from: context.pos - stdMember[1].length,
      options: STD_OPTIONS,
      validFor: /^[A-Za-z0-9_]*$/,
    };
  }

  const word = context.matchBefore(/[A-Za-z_#][A-Za-z0-9_]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  return { from: word.from, options: GENERAL, validFor: /^[A-Za-z0-9_#]*$/ };
}
