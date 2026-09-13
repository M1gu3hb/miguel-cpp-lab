import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { type Diagnostic } from "@codemirror/lint";

/**
 * Subrayado de los errores del compilador.
 *
 * Se pinta con un campo de estado propio, instalado desde el primer render, en
 * vez de depender del que @codemirror/lint añade sobre la marcha: así el
 * subrayado aparece ya en la primera compilación. El margen y el tooltip los
 * sigue poniendo lint.
 */

export const setMarks = StateEffect.define<Diagnostic[]>();

const marks = {
  error: Decoration.mark({ class: "cpp-diag cpp-diag-error" }),
  warning: Decoration.mark({ class: "cpp-diag cpp-diag-warning" }),
  info: Decoration.mark({ class: "cpp-diag cpp-diag-info" }),
};

function build(list: Diagnostic[]): DecorationSet {
  const ranges = list
    .filter((diagnostic) => diagnostic.to > diagnostic.from)
    .sort((a, b) => a.from - b.from)
    .map((diagnostic) =>
      (marks[diagnostic.severity as keyof typeof marks] ?? marks.info).range(
        diagnostic.from,
        diagnostic.to,
      ),
    );
  return Decoration.set(ranges, true);
}

export const diagnosticMarks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMarks)) return build(effect.value);
    }
    // Al editar, las marcas siguen al texto (como en VS Code) hasta la próxima
    // compilación.
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
