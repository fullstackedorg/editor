import stackNavigation from "../stack-navigation";

export function Dialog(content: HTMLElement) {
    const container = document.createElement("div");
    container.classList.add("dialog");

    const overlay = document.createElement("div");
    overlay.classList.add("dialog-overlay");

    container.append(content);

    overlay.append(container);

    document.body.append(overlay);
    stackNavigation.lock = true;

    return {
        remove: () => {
            stackNavigation.lock = false;
            overlay.remove();
        }
    };
}
