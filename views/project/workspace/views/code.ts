import { Project } from "../../../../types";
import { createLSP, lspSupportedFile } from "../lsp";
import fs from "../../../../../fullstacked_modules/fs";
import { createCodeMirrorView } from "@fullstacked/codemirror-view";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "codemirror";
import type { createHistoryNavigation } from "../history";
import { SupportedLanguage } from "@fullstacked/codemirror-view/languages";
import { sassSupportedFile } from "../sass";
import { lintGutter } from "@codemirror/lint";

export const FILE_EVENT_ORIGIN = "code-editor";

export async function createViewCode(
    project: Project,
    projectFilePath: string,
    lsp: ReturnType<typeof createLSP>,
    history: ReturnType<typeof createHistoryNavigation>
) {
    const contents = await fs.readFile(`${project.id}/${projectFilePath}`, {
        encoding: "utf8"
    });

    const view = createCodeMirrorView({
        contents,
        extensions: [
            oneDark,
            EditorView.clickAddsSelectionRange.of((e) => e.altKey && !e.metaKey)
        ]
    });
    view.element.classList.add("code-container")

    const save = async () => {
        if ((await fs.exists(filePath))?.isFile) {
            await fs.writeFile(filePath, view.value, FILE_EVENT_ORIGIN);
        }
    };

    const filePath = `${project.id}/${projectFilePath}`;
    view.addUpdateListener(save);

    view.setLanguage(projectFilePath.split(".").pop() as SupportedLanguage);

    const lspSupport = lspSupportedFile(projectFilePath);
    const sassSupport = sassSupportedFile(projectFilePath);

    if (lspSupport || sassSupport) {
        view.extensions.add(lintGutter());

        if (lspSupport) {
            lsp.then((l) => {
                l.bindView(projectFilePath, view);
            });
        }
    }

    view.extensions.add(
        EditorView.domEventHandlers({
            click: (e: MouseEvent) => {
                if (e.ctrlKey || e.metaKey) return;
                const pos = view.editorView.posAtCoords({
                    x: e.clientX,
                    y: e.clientY
                });
                history.push(projectFilePath, pos);
            }
        })
    );

    let scroll = {
        top: 0,
        left: 0
    };
    view.editorView.scrollDOM.addEventListener("scroll", () => {
        scroll.top = view.editorView.scrollDOM.scrollTop;
        scroll.left = view.editorView.scrollDOM.scrollLeft;
    });

    return {
        ...view,
        type: "code",
        save,
        reloadContents() {
            fs.readFile(`${project.id}/${projectFilePath}`, {
                encoding: "utf8"
            }).then(view.replaceContents);
        },
        restore() {
            view.editorView.scrollDOM.scrollTo(scroll);
        }
    };
}
