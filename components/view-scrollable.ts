import { scrollableClass, viewScrollableClass } from "./view-scrollable.s";

export function ViewScrollable() {
    const container = document.createElement("div");
    container.classList.add(viewScrollableClass);

    const scrollable = document.createElement("div");
    scrollable.classList.add(scrollableClass);

    container.append(scrollable);

    return { container, scrollable };
}
