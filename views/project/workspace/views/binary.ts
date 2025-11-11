import prettyBytes from "pretty-bytes";
import { Project } from "../../../../types";
import fs from "../../../../../fullstacked_modules/fs";
import { binaryViewClass } from "./binary.s";

const extensions = ["zip", "tar", "tff", "otf"];

export function binarySupportedFile(filePath: string) {
    const ext = filePath.split(".").pop();
    return extensions.includes(ext);
}

export function createViewBinary(project: Project, projectFilePath: string) {
    const element = document.createElement("div");
    element.classList.add(binaryViewClass);

    const load = () => {
        fs.stat(`${project.id}/${projectFilePath}`).then(({ size }) => {
            element.innerText = prettyBytes(size);
        });
    };
    load();

    return {
        element,
        type: "binary",
        remove() {
            element.remove();
        },
        reloadContents() {
            load();
        },
        restore() {}
    };
}
