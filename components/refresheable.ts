import { createElement, ElementComponent } from "./element";

export function createRefresheable<
    T extends (...args: any) => ElementComponent | Promise<ElementComponent>,
    P extends Parameters<T>
>(
    elementRenderer: (
        ...args: P
    ) => ElementComponent | Promise<ElementComponent> | false,
    placeholder?: ElementComponent
) {
    const refresheable = {
        element: (placeholder ||
            (createElement(
                "div"
            ) as ElementComponent<any>)) as ElementComponent,
        refresh: (...newArgs: P) => {
            const updatedElement = elementRenderer(...newArgs);
            if (updatedElement === false) {
                return;
            }

            refresheable.element.destroy();
            if (updatedElement instanceof Promise) {
                return new Promise<void>((resolve) => {
                    updatedElement.then((e) => {
                        refresheable.element.replaceWith(e);
                        refresheable.element = e;
                        resolve();
                    });
                });
            } else {
                refresheable.element.replaceWith(updatedElement);
                refresheable.element = updatedElement;
            }
        }
    };

    return refresheable;
}
