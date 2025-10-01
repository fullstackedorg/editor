import { Project } from "../../../types";
import { BuildError } from "../../../store/editor";
import { hideChatExtension } from "../file-tree";
import { Diagnostic } from "@codemirror/lint";
import { Store } from "../../../store";
import { Popover, Button } from "@fullstacked/ui";
import { createDevIcon } from "../dev-icons";

export function createTabs(
    project: Project,
    actions: {
        open: (filePath: string) => void;
        close: (filePath: string) => void;
    }
) {
    const element = document.createElement("div");
    element.classList.add("tabs");

    const tabs = new Map<string, [HTMLElement, HTMLElement]>();

    const setActive = (filePath: string) => {
        Array.from(tabs.entries()).forEach(([f, tab]) => {
            if (filePath === f) {
                tab[0].classList.add("active");
                tab[0].scrollIntoView();
            } else {
                tab[0].classList.remove("active");
            }
        });
    };

    const displayDirectoryIfNeeded = () => {
        Array.from(tabs.entries()).forEach((tab) => {
            const otherTabs = Array.from(tabs.entries()).filter(
                (t) => t[0] !== tab[0]
            );
            const otherFileNames = otherTabs.map(([filePath]) =>
                filePath.split("/").pop()
            );
            const [filePath, [_, text]] = tab;
            const filePathComponents = filePath.split("/");
            if (otherFileNames.includes(filePathComponents.at(-1))) {
                text.innerHTML =
                    filePathComponents.at(-1) +
                    `<small>${
                        filePathComponents.at(-2)
                            ? `../${filePathComponents.at(-2)}`
                            : "/"
                    }</small>`;
            } else {
                text.innerText = hideChatExtension(filePathComponents.at(-1));
            }
        });
    };

    const onBuildErrors = (buildErrors: BuildError[]) => {
        Array.from(tabs.entries()).forEach(([filePath, [tab]]) => {
            if (
                buildErrors.find(
                    ({ file }) =>
                        file.split(project.id + "/").pop() === filePath
                )
            ) {
                tab.classList.add("has-error");
            } else {
                tab.classList.remove("has-error");
            }
        });
    };
    Store.editor.codeEditor.buildErrors.subscribe(onBuildErrors);

    const onLspDiagnostics = (diagnostics: Map<string, Diagnostic[]>) => {
        Array.from(tabs.entries()).forEach(([filePath, [tab]]) => {
            if (diagnostics.get(filePath)?.length) {
                tab.classList.add("has-error");
            } else {
                tab.classList.remove("has-error");
            }
        });
    };

    Store.editor.codeEditor.lspDiagnostics.subscribe(onLspDiagnostics);

    const onChatStatus = (chats: Map<string, string>) => {
        Array.from(tabs.entries()).forEach(([filePath, [tab]]) => {
            const status = chats.get(filePath);
            if (status) {
                if (status === "ERROR") {
                    tab.classList.remove("is-streaming");
                    tab.classList.add("has-error");
                } else {
                    tab.classList.remove("has-error");
                    tab.classList.add("is-streaming");
                }
            } else {
                tab.classList.remove("is-streaming", "has-error");
            }
        });
    };

    Store.editor.codeEditor.chatsStatus.subscribe(onChatStatus);

    return {
        element,
        destroy() {
            Store.editor.codeEditor.buildErrors.unsubscribe(onBuildErrors);
            Store.editor.codeEditor.lspDiagnostics.unsubscribe(
                onLspDiagnostics
            );
        },
        open(filePath: string, oldPath?: string) {
            let tab = tabs.get(filePath);

            if (!tab) {
                tab = [
                    document.createElement("div"),
                    document.createElement("span")
                ];
                tab[0].onclick = () => actions.open(filePath);
                const filePathEl = document.createElement("div");
                filePathEl.classList.add("file-path-helper");
                let popover: ReturnType<typeof Popover>;
                let popoverDelayTimeout: ReturnType<typeof setTimeout>;
                filePathEl.innerText = filePath;
                const remove = () => {
                    setTimeout(() => popover?.remove(), 500);
                    window.removeEventListener("mousemove", remove);
                };
                tab[1].onmouseenter = () => {
                    popoverDelayTimeout = setTimeout(() => {
                        const bb = tab[0].getBoundingClientRect();
                        if (bb.height === 0) return;
                        popover = Popover({
                            content: filePathEl,
                            align: {
                                x: "center",
                                y: "bottom"
                            },
                            anchor: tab[0]
                        });
                        setTimeout(() => {
                            window.addEventListener("mousemove", remove);
                        }, 500);
                    }, 1000);
                };
                tab[0].onmouseleave = () => {
                    clearTimeout(popoverDelayTimeout);
                };

                tab[1].innerText = filePath.split("/").pop();

                const close = Button({
                    style: "icon-small",
                    iconRight: "Close"
                });

                close.onclick = (e) => {
                    e.stopPropagation();
                    actions.close(filePath);
                };

                tab[0].append(createDevIcon(filePath), tab[1], close);
                element.append(tab[0]);

                tabs.set(filePath, tab);
            }

            const hasBuildErrors = Store.editor.codeEditor.buildErrors
                .check()
                .find(
                    ({ file }) =>
                        file.split(project.id + "/").pop() === filePath
                );
            if (hasBuildErrors) {
                tab[0].classList.add("has-error");
            } else {
                tab[0].classList.remove("has-error");
            }

            if (oldPath) {
                const oldTab = tabs.get(oldPath);
                if (oldTab) {
                    const wasActive = oldTab[0].classList.contains("active");
                    oldTab[0].replaceWith(tab[0]);
                    tabs.delete(oldPath);
                    if (wasActive) {
                        setActive(filePath);
                    }
                }
            } else {
                setActive(filePath);
            }

            displayDirectoryIfNeeded();
        },
        close(filePath: string) {
            const tab = tabs.get(filePath);
            tab?.at(0)?.remove();
            tabs.delete(filePath);

            displayDirectoryIfNeeded();
        }
    };
}
