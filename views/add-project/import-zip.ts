import prettyBytes from "pretty-bytes";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import { BG_COLOR, IMPORT_PROJECT_FILE_INPUT_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import slugify from "slugify";
import { Store } from "../../store";
import { CONFIG_TYPE } from "../../types";
import fs from "../../../fullstacked_modules/fs";
import { InputFile, Loader } from "@fullstacked/ui";
import archive from "../../../fullstacked_modules/archive";
import config from "../../editor_modules/config";

export function ImportZip() {
    const { container, scrollable } = ViewScrollable();
    container.classList.add("view", "create-form");

    const topBar = TopBar({
        title: "Import zip"
    });

    container.prepend(topBar);

    const form = document.createElement("form");

    const zipFileInput = InputFile({
        label: "Project ZIP"
    });
    zipFileInput.input.id = IMPORT_PROJECT_FILE_INPUT_ID;
    form.append(zipFileInput.container);

    zipFileInput.input.onchange = () => {
        const file = zipFileInput.input.files?.[0];
        if (!file) return;
        zipFileInput.input.disabled = true;
        loadZipFile(file, scrollable).then(() => {
            stackNavigation.back();
        });
    };

    scrollable.append(form);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR
    });
}

export function CreateLoader(opts: { text: string }) {
    const container = document.createElement("div");
    container.classList.add("create-loader");

    const text = document.createElement("div");
    text.innerText = opts.text;

    container.append(Loader(), text);

    return container;
}

export function ConsoleTerminal() {
    const container = document.createElement("div");
    container.classList.add("create-terminal");

    const text = document.createElement("pre");
    container.append(text);

    const logger = (message: string) => {
        ((text.innerHTML += `${message.trim()}<br/>`),
            text.scrollIntoView(false));
    };

    return { container, text, logger };
}

async function loadZipFile(file: File, scrollable: HTMLElement) {
    const loader = CreateLoader({
        text: "Importing Project..."
    });

    const consoleTerminal = ConsoleTerminal();

    const tmpDirectory = tmpDir + "/" + randomStr(6);

    scrollable.append(loader, consoleTerminal.container);

    consoleTerminal.logger(`Importing file: ${file.name}`);
    const zipData = new Uint8Array(await file.arrayBuffer());
    consoleTerminal.logger(`ZIP size: ${prettyBytes(zipData.byteLength)}`);
    consoleTerminal.logger(`Unpacking`);
    await archive.unzip(zipData, tmpDirectory);

    // remove .zip extension
    let defaultProjectTitle = file.name;
    const fileNameComponents = file.name.split(".");
    if (fileNameComponents.at(-1) === "zip") {
        defaultProjectTitle = fileNameComponents.slice(0, -1).join(".");
    }

    const isGitZip = (dir: string) => {
        if (dir === defaultProjectTitle) return true;

        // we might have "....-branch" in default name
        const projectTitleComponent = defaultProjectTitle
            .split("-")
            .slice(0, -1);
        return projectTitleComponent.join("-") === dir;
    };

    const contents = await fs.readdir(tmpDirectory);
    if (contents.length === 1 && isGitZip(contents.at(0))) {
        const tmpTmpDir = tmpDir + "/" + randomStr(6);
        await fs.rename(tmpDir + "/" + contents.at(0), tmpTmpDir);
        await fs.rmdir(tmpDir);
        await fs.rename(tmpTmpDir, tmpDir);
    }

    createAndMoveProject(
        tmpDirectory,
        consoleTerminal,
        defaultProjectTitle,
        null
    );

    consoleTerminal.logger(`Finished importing ${file.name}`);
    consoleTerminal.logger("Done");
}

export const tmpDir = ".tmp";
export function randomStr(length: number) {
    let result = "";
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
        counter += 1;
    }
    return result;
}

export async function createAndMoveProject(
    tmpDirectory: string,
    consoleTerminal: ReturnType<typeof ConsoleTerminal>,
    defaultProjectTitle: string,
    defaultGitRepoUrl: string
) {
    consoleTerminal.logger(`Looking for .fullstacked file`);
    const contents = await fs.readdir(tmpDirectory);

    const project: Parameters<typeof Store.projects.create>[0] = {
        title: defaultProjectTitle,
        id: slugify(defaultProjectTitle.replace(/\//g, "."), { lower: true })
    };

    if (contents.includes(".fullstacked")) {
        try {
            const fullstackedFile = await fs.readFile(
                `${tmpDirectory}/.fullstacked`,
                { encoding: "utf8" }
            );
            const fullstackedProjectData = JSON.parse(fullstackedFile);
            consoleTerminal.logger(`Found valid .fullstacked file`);
            consoleTerminal.logger(
                `${JSON.stringify(fullstackedFile, null, 2)}`
            );
            project.title = fullstackedProjectData.title || project.title;
            project.id = fullstackedProjectData.id || project.id;
            if (fullstackedProjectData.git?.url) {
                project.gitRepository = {
                    url: fullstackedProjectData.git?.url
                };
            }
        } catch (e) {
            consoleTerminal.logger(`Found invalid .fullstacked file`);
        }
    }

    if (defaultGitRepoUrl) {
        project.gitRepository = {
            url: defaultGitRepoUrl
        };
    }

    if (project.gitRepository?.url) {
        const url = new URL(project.gitRepository.url);
        const hostname = url.hostname;
        const gitAuthConfigs = await config.get(CONFIG_TYPE.GIT);
        const gitAuth = gitAuthConfigs[hostname];
        if (gitAuth?.username) {
            project.gitRepository.name = gitAuth.username;
        }
        if (gitAuth?.email) {
            project.gitRepository.email = gitAuth.email;
        }
    }

    consoleTerminal.logger(`Creating Project`);
    consoleTerminal.logger(`${JSON.stringify(project, null, 2)}`);

    let tries = 1,
        originalProjectId = project.id;
    while (!(await fs.rename(tmpDirectory, project.id))) {
        tries++;
        project.id = originalProjectId + "-" + tries;
    }

    return Store.projects.create(project);
}
