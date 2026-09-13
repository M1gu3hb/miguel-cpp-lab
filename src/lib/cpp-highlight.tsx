import { Fragment, type ReactNode } from "react";

/**
 * Resaltado de C++ mínimo para vistas de sólo lectura (la revisión del
 * profesor). No arrastra CodeMirror a esa ruta: son unas pocas expresiones
 * regulares sobre una línea, sin estado entre líneas salvo los comentarios de
 * bloque, que se resuelven fuera.
 */

const KEYWORDS = new RegExp(
  "\\b(" +
    [
      "alignas", "alignof", "auto", "bool", "break", "case", "catch", "char", "class", "const",
      "constexpr", "continue", "decltype", "default", "delete", "do", "double", "else", "enum",
      "explicit", "export", "extern", "false", "float", "for", "friend", "goto", "if", "inline",
      "int", "long", "mutable", "namespace", "new", "noexcept", "nullptr", "operator", "private",
      "protected", "public", "return", "short", "signed", "sizeof", "static", "static_cast",
      "struct", "switch", "template", "this", "throw", "true", "try", "typedef", "typename",
      "union", "unsigned", "using", "virtual", "void", "volatile", "while",
    ].join("|") +
    ")\\b",
);

const TOKEN = new RegExp(
  [
    "(\\/\\/.*$)", // comentario de línea
    "(\\/\\*.*?\\*\\/)", // comentario de bloque en una línea
    '("(?:\\\\.|[^"\\\\])*")', // cadena
    "('(?:\\\\.|[^'\\\\])*')", // carácter
    "(^\\s*#\\s*\\w+)", // preprocesador
    "(\\b\\d+(?:\\.\\d+)?[fFuUlL]*\\b)", // número
    "(\\b[A-Za-z_][A-Za-z0-9_]*\\b)", // identificador o palabra clave
  ].join("|"),
  "g",
);

export function highlightCpp(line: string, keyPrefix = ""): ReactNode {
  if (!line) return line;
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;

  while ((match = TOKEN.exec(line))) {
    if (match.index > last) out.push(line.slice(last, match.index));
    const [text, lineComment, blockComment, str, chr, pre, num, ident] = match;

    let className = "";
    if (lineComment || blockComment) className = "c-comment";
    else if (str || chr) className = "c-string";
    else if (pre) className = "c-pre";
    else if (num) className = "c-num";
    else if (ident) className = KEYWORDS.test(ident) ? "c-kw" : ident === "std" ? "c-ns" : "";

    out.push(
      className ? (
        <span key={`${keyPrefix}-${match.index}`} className={className}>
          {text}
        </span>
      ) : (
        text
      ),
    );
    last = match.index + text.length;
  }
  if (last < line.length) out.push(line.slice(last));

  return (
    <Fragment>
      {out.map((node, index) => (
        <Fragment key={index}>{node}</Fragment>
      ))}
    </Fragment>
  );
}
