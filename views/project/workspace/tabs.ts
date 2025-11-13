import { Project } from "../../../types";
import { BuildError } from "../../../store/editor";
import { hideChatExtension } from "../file-tree";
import { Diagnostic } from "@codemirror/lint";
import { Store } from "../../../store";
import { Button } from "@fullstacked/ui";
import { createDevIcon } from "../dev-icons";
import {
    activeTabClass,
    errorTabClass,
    filePathHelperClass,
    streamingTabClass,
    tabsClass
} from "./tabs.s";

export function createTabs(
    project: Project,
    actions: {
        open: (filePath: string) => void;
        close: (filePath: string) => void;
    }
) {
    const element = document.createElement("div");
    element.classList.add(tabsClass);

    const tabs = new Map<string, [HTMLElement, HTMLElement, HTMLElement]>();

    const setActive = (filePath: string) => {
        Array.from(tabs.entries()).forEach(([f, tab]) => {
            if (filePath === f) {
                tab[0].classList.add(activeTabClass);
                tab[0].scrollIntoView();
            } else {
                tab[0].classList.remove(activeTabClass);
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
                tab.classList.add(errorTabClass);
            } else {
                tab.classList.remove(errorTabClass);
            }
        });
    };
    Store.editor.codeEditor.buildErrors.subscribe(onBuildErrors);

    const onLspDiagnostics = (diagnostics: Map<string, Diagnostic[]>) => {
        Array.from(tabs.entries()).forEach(([filePath, [tab]]) => {
            if (diagnostics.get(filePath)?.length) {
                tab.classList.add(errorTabClass);
            } else {
                tab.classList.remove(errorTabClass);
            }
        });
    };

    Store.editor.codeEditor.lspDiagnostics.subscribe(onLspDiagnostics);

    const onChatStatus = (chats: Map<string, string>) => {
        Array.from(tabs.entries()).forEach(([filePath, [tab]]) => {
            const status = chats.get(filePath);
            if (status) {
                if (status === "ERROR") {
                    tab.classList.remove(streamingTabClass);
                    tab.classList.add(errorTabClass);
                } else {
                    tab.classList.remove(errorTabClass);
                    tab.classList.add(streamingTabClass);
                }
            } else if (filePath.endsWith(".chat")) {
                tab.classList.remove(streamingTabClass, errorTabClass);
            }
        });
    };

    Store.editor.codeEditor.chatsStatus.subscribe(onChatStatus);

    return {
        element,
        destroy() {
            Array.from(tabs.values()).forEach((t) => {
                t?.at(0)?.remove();
                t?.at(2)?.remove();
            });
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
                    document.createElement("span"),
                    document.createElement("div")
                ];
                tab[0].onclick = () => actions.open(filePath);
                tab[2].classList.add(filePathHelperClass);
                let popoverDelayTimeout: ReturnType<typeof setTimeout>;
                tab[2].innerText = filePath;
                const remove = () => {
                    setTimeout(() => tab[2]?.remove(), 200);
                    tab[0].removeEventListener("mouseleave", remove);
                };
                let lastEvent: MouseEvent = null;
                tab[1].onmouseenter = (e) => {
                    lastEvent = e;
                    popoverDelayTimeout = setTimeout(() => {
                        const bb = tab[0].getBoundingClientRect();
                        if (bb.height === 0) return;
                        tab[2].style.top = lastEvent.clientY + 5 + "px";
                        tab[2].style.left = lastEvent.clientX + 5 + "px";
                        document.body.append(tab[2]);
                        tab[0].addEventListener("mouseleave", remove);
                    }, 1000);
                };
                tab[0].onmousemove = (e) => (lastEvent = e);
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
                tab[0].classList.add(errorTabClass);
            } else {
                tab[0].classList.remove(errorTabClass);
            }

            if (oldPath) {
                const oldTab = tabs.get(oldPath);
                if (oldTab) {
                    const wasActive =
                        oldTab[0].classList.contains(activeTabClass);
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
            tab?.at(2)?.remove();
            tabs.delete(filePath);

            displayDirectoryIfNeeded();
        }
    };
}
