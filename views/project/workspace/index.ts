import { Project } from "../../../types";
import core_message from "../../../../fullstacked_modules/core_message";
import { createLSP, lspSupportedFile } from "./lsp";
import fs from "../../../../fullstacked_modules/fs";
import { FileEvent, FileEventType } from "../file-event";
import { Store } from "../../../store";
import { BuildError } from "../../../store/editor";
import { sassSupportedFile, sassSetDiagnostic } from "./sass";
import { createViewImage, imageSupportedFile } from "./views/image";
import { binarySupportedFile, createViewBinary } from "./views/binary";
import { createViewCode, FILE_EVENT_ORIGIN } from "./views/code";
import { createViewChat, chatSupportedFile } from "./views/chat";
import { createTabs } from "./tabs";
import { createHistoryNavigation } from "./history";
import { workspaceClass } from "./index.s";

export type Workspace = ReturnType<typeof createWorkspace>;

type ViewCode = Awaited<ReturnType<typeof createViewCode>>;
type ViewImage = ReturnType<typeof createViewImage>;
type ViewBinary = ReturnType<typeof createViewBinary>;
export type ViewChat = ReturnType<typeof createViewChat>;

export function createWorkspace(project: Project) {
    const element = document.createElement("div");
    element.classList.add(workspaceClass);

    let activeView: ViewCode | ViewImage | ViewBinary | ViewChat = null;
    const views = new Map<string, typeof activeView>();

    const open = async (
        projectFilePath: string,
        pos?: { line: number; character: number } | number,
        fromHistory?: boolean,
        oldPath?: string
    ) => {
        let view = views.get(projectFilePath);

        if (!view) {
            let newView: typeof activeView;
            if (chatSupportedFile(projectFilePath)) {
                newView = createViewChat(project, projectFilePath);
            } else if (imageSupportedFile(projectFilePath)) {
                newView = createViewImage(project, projectFilePath);
            } else if (
                lspSupportedFile(projectFilePath) ||
                sassSupportedFile(projectFilePath)
            ) {
                newView = await createViewCode(
                    project,
                    projectFilePath,
                    lsp,
                    history
                );
            } else if (binarySupportedFile(projectFilePath)) {
                newView = createViewBinary(project, projectFilePath);
            } else {
                const fileSize = (
                    await fs.stat(`${project.id}/${projectFilePath}`)
                ).size;
                if (fileSize < 1e6) {
                    // 1mb
                    newView = await createViewCode(
                        project,
                        projectFilePath,
                        lsp,
                        history
                    );
                } else {
                    newView = createViewBinary(project, projectFilePath);
                }
            }

            views.set(projectFilePath, newView);
            view = newView;
        }

        if (activeView === view && !oldPath && view.type === "code") {
            (view as ViewCode).format();
        }

        if (lspSupportedFile(projectFilePath)) {
            lsp.then((l) => l.runDiagnostics(projectFilePath));
        } else if (sassSupportedFile(projectFilePath)) {
            sassSetDiagnostic(
                project,
                projectFilePath,
                (view as ViewCode).editorView
            );
        }

        if (!activeView) {
            container.append(view.element);
        } else if (!oldPath) {
            activeView.element.replaceWith(view.element);
        }

        if (pos) {
            (view as ViewCode).goTo(pos);
        }

        tabs.open(projectFilePath, oldPath);

        if (!fromHistory) {
            if (oldPath) {
                history.replace(oldPath, projectFilePath);
            } else {
                const position =
                    typeof pos === "number"
                        ? pos
                        : pos
                          ? (view as ViewCode).editorView.state.doc.line(
                                pos.line
                            ).from + pos.character
                          : null;

                history.push(projectFilePath, position || 0);
            }
        }

        if (oldPath) {
            const oldView = views.get(oldPath);
            if (oldView === activeView) {
                activeView.element.replaceWith(view.element);
                activeView = view;
            }
            views.delete(oldPath);
        } else {
            activeView = view;
        }

        view.restore();

        return view;
    };

    const close = (filePath: string) => {
        tabs.close(filePath);

        const view = views.get(filePath);
        view?.remove();
        if (view === activeView) {
            activeView = null;
        }
        views.delete(filePath);

        history.close(filePath, Array.from(views.keys()));
    };

    const history = createHistoryNavigation({ open });
    const tabs = createTabs(project, { open, close });
    const topRow = document.createElement("div");
    topRow.append(history.element, tabs.element);

    const container = document.createElement("div");
    container.classList.add("view-container");

    element.append(topRow, container);

    const lsp = createLSP(project, { open });

    const closeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const fileEventsListener = (msg: string) => {
        const fileEvents: FileEvent[] = JSON.parse(msg);
        for (const fileEvent of fileEvents) {
            if (fileEvent.origin === FILE_EVENT_ORIGIN) continue;

            if (!fileEvent.paths.at(0).includes(project.id)) continue;

            const projectFilePath = fileEvent.paths
                .at(0)
                .split(`${project.id}/`)
                .pop();

            switch (fileEvent.type) {
                case FileEventType.DELETED:
                    const deletedViews = Array.from(views.keys()).filter(
                        (filePath) => filePath.startsWith(projectFilePath)
                    );
                    history.remove(projectFilePath);
                    deletedViews.forEach((filePath) => {
                        closeTimeouts.set(
                            filePath,
                            setTimeout(() => {
                                close(filePath);
                                history.remove(filePath);
                            }, 100)
                        );
                    });
                    break;
                case FileEventType.MODIFIED:
                    views?.get(projectFilePath)?.reloadContents();
                    break;
                case FileEventType.CREATED:
                    const closeTimeout = closeTimeouts.get(projectFilePath);
                    if (closeTimeout) {
                        clearTimeout(closeTimeout);
                        views.get(projectFilePath)?.reloadContents();
                    }
                    break;
                case FileEventType.RENAME:
                    const newPath = fileEvent.paths
                        .at(1)
                        .split(`${project.id}/`)
                        .pop();

                    const renamedViews = Array.from(views.keys()).filter(
                        (filePath) => filePath.startsWith(projectFilePath)
                    );
                    renamedViews.forEach((filePath) => {
                        const newFilePath =
                            newPath + filePath.slice(projectFilePath.length);
                        open(
                            newFilePath,
                            (views.get(filePath) as ViewCode)?.editorView?.state
                                ?.selection?.main?.head,
                            false,
                            filePath
                        );
                    });
                    break;
            }
        }
    };
    core_message.addListener("file-event", fileEventsListener);

    const buildErrorsListener = async (buildErrors: BuildError[]) => {
        const projectFilePaths = new Map<
            string,
            { line: number; character: number }
        >();
        buildErrors
            .filter(({ file }) => file.includes(project.id))
            .forEach(({ file, line, col }) => {
                const projectFilePath = file.split(project.id + "/").pop();
                if (projectFilePaths.has(projectFilePath)) return;
                projectFilePaths.set(projectFilePath, { line, character: col });
            });
        const l = await lsp;
        Array.from(views.entries()).filter(([projectFilePath, view]) => {
            if (lspSupportedFile(projectFilePath)) {
                l.runDiagnostics(projectFilePath);
            } else if (sassSupportedFile(projectFilePath)) {
                sassSetDiagnostic(
                    project,
                    projectFilePath,
                    (view as ViewCode).editorView
                );
            }
        });
        Array.from(projectFilePaths.entries()).forEach(([f, pos]) =>
            open(f, pos)
        );
    };
    Store.editor.codeEditor.buildErrors.subscribe(buildErrorsListener);

    const destroy = async () => {
        (await lsp).destroy();
        core_message.removeListener("file-event", fileEventsListener);
        Store.editor.codeEditor.buildErrors.unsubscribe(buildErrorsListener);
        tabs.destroy();
    };

    return {
        element,
        open,
        destroy,
        save: async () => {
            const codeViews = Array.from(views.values()).filter(
                ({ type }) => type === "code"
            ) as ViewCode[];
            return Promise.all(codeViews.map((v) => v.save()));
        }
    };
}
