import { Button } from "@fullstacked/ui";
export function createHistoryNavigation(actions: {
    open: (filePath: string, pos: number, fromHistory: true) => void;
}) {
    let history: {
        filePath: string;
        pos: number;
    }[] = [];

    const element = document.createElement("div");
    element.classList.add("history");

    const back = Button({
        style: "icon-small",
        iconRight: "Arrow 2"
    });
    back.disabled = true;
    back.onclick = () => {
        cursor--;
        const { filePath, pos } = history.at(cursor);
        actions.open(filePath, pos, true);
        refreshState();
    };
    const next = Button({
        style: "icon-small",
        iconRight: "Arrow 2"
    });
    next.onclick = () => {
        cursor++;
        const { filePath, pos } = history.at(cursor);
        actions.open(filePath, pos, true);
        refreshState();
    };
    next.disabled = true;
    element.append(back, next);

    let cursor = 0;

    const refreshState = () => {
        back.disabled = cursor <= 0;
        next.disabled = cursor >= history.length - 1;
    };

    return {
        element,
        push(filePath: string, pos: number) {
            const lastState = history.at(cursor);
            if (lastState?.filePath === filePath && lastState?.pos === pos)
                return;

            history = history.slice(0, cursor + 1);
            history.push({ filePath, pos });
            cursor = history.length - 1;
            refreshState();
        },
        replace(oldPath: string, newPath: string) {
            history = history.map((state) =>
                state.filePath === oldPath
                    ? {
                          ...state,
                          filePath: newPath
                      }
                    : state
            );
        },
        close(filePath: string, openedFiles: string[]) {
            if (
                !history.at(cursor)?.filePath ||
                history.at(cursor).filePath !== filePath
            )
                return;

            const restoreState = (i: number) => {
                const state = history.at(i);
                if (
                    state.filePath !== filePath &&
                    openedFiles.includes(state.filePath)
                ) {
                    actions.open(state.filePath, state.pos, true);
                    cursor = i;
                    refreshState();
                    return true;
                }
                return false;
            };

            for (let i = cursor; i >= 0; i--) {
                if (restoreState(i)) return;
            }

            for (let i = history.length - 1; i > cursor; i--) {
                if (restoreState(i)) return;
            }
        },
        remove(filePath: string) {
            let didChangeHistory = false;

            for (let i = history.length - 1; i >= 0; i--) {
                if (history.at(i).filePath.startsWith(filePath)) {

                    didChangeHistory = true;

                    history.splice(i, 1);
                    if (i <= cursor) {
                        cursor--;
                    }
                    
                }
            }

            if (!didChangeHistory) {
                return;
            }

            const lastState = history.at(cursor);
            if (lastState) {
                actions.open(lastState.filePath, lastState.pos, true);
            }

            refreshState();
        }
    };
}
