import { Icon } from "@fullstacked/ui";
import { devIconClass } from "./dev-icons.s";

export function createDevIcon(filePath: string) {
    const element = document.createElement("div");
    element.classList.add(devIconClass);
    if (filePath.endsWith(".chat")) {
        const chatIcon = Icon("Glitter");
        element.append(chatIcon);
    } else {
        const devIconClass = pathToDevIconClass(filePath);
        if (devIconClass) {
            element.classList.add(devIconClass);
        }
    }

    return element;
}

function pathToDevIconClass(path: string) {
    const ext = path.split(".").pop();
    switch (ext) {
        case "ts":
        case "cts":
        case "mts":
            return "typescript";
        case "js":
        case "cjs":
        case "mjs":
            return "javascript";
        case "tsx":
        case "jsx":
            return "react";
        case "html":
            return "html";
        case "sass":
        case "scss":
            return "sass";
        case "css":
            return "css";
        case "json":
            return "json";
        case "md":
            return "markdown";
        case "liquid":
            return "liquid";
        case "png":
        case "jpg":
        case "jpeg":
            return "image";
        case "svg":
            return "svg";
        case "npmignore":
            return "npm";
        default:
            return "default";
    }
}
