import { EditorView } from "codemirror";
import { setDiagnostics, Diagnostic } from "@codemirror/lint";
import { Project } from "../../../types";
import { Store } from "../../../store";
const extensions = ["sass", "scss", "css"];

export function sassSupportedFile(filePath: string) {
    const ext = filePath.split(".").pop();
    return extensions.includes(ext);
}

export function sassSetDiagnostic(
    project: Project,
    projectFilePath: string,
    view: EditorView
) {
    const buildErrors = Store.editor.codeEditor.buildErrors
        .check()
        .filter(
            ({ file }) => file.split(project.id + "/").pop() === projectFilePath
        );
    const diagnostics = buildErrors.map((err) => {
        const from = view.state.doc.line(err.line).from + err.col;
        return {
            from,
            to: from + err.length,
            severity: "error",
            message: err.message
        } as Diagnostic;
    });
    view.dispatch(setDiagnostics(view.state, diagnostics));
}
