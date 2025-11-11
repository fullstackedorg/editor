import { Project } from "../../../../types";
import fs from "../../../../../fullstacked_modules/fs";
import { imageViewClass } from "./image.s";

const extensions = ["jpg", "jpeg", "png", "webp", "bmp", "gif"];

export function imageSupportedFile(filePath: string) {
    const ext = filePath.split(".").pop();
    return extensions.includes(ext);
}

export function createViewImage(project: Project, projectFilePath: string) {
    const element = document.createElement("div");
    element.classList.add(imageViewClass);

    const image = document.createElement("img");
    element.append(image);

    let url: ReturnType<typeof URL.createObjectURL>;
    const load = () => {
        fs.readFile(`${project.id}/${projectFilePath}`).then(
            (data: Uint8Array<ArrayBuffer>) => {
                const blob = new Blob([data], {
                    type: "image/" + projectFilePath.split(".").pop()
                });
                const url = URL.createObjectURL(blob);
                image.src = url;
            }
        );
    };
    load();

    return {
        element,
        type: "image",
        remove() {
            element.remove();
            URL.revokeObjectURL(url);
        },
        reloadContents() {
            URL.revokeObjectURL(url);
            load();
        },
        restore() {}
    };
}
