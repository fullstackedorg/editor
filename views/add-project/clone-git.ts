import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import {
    ConsoleTerminal,
    createAndMoveProject,
    CreateLoader,
    randomStr,
    tmpDir
} from "./import-zip";
import stackNavigation from "../../stack-navigation";
import { BG_COLOR } from "../../constants";
import core_message from "../../../fullstacked_modules/core_message";
import git from "../../lib/git";
import { Button, InputText } from "@fullstacked/ui";

export function CloneGit(repoUrl?: string) {
    const { container, scrollable } = ViewScrollable();
    container.classList.add("view", "create-form");

    const topBar = TopBar({
        title: "Clone git repository"
    });

    container.prepend(topBar);

    const form = document.createElement("form");

    const repoUrlInput = InputText({
        label: "Git repository URL"
    });

    const cloneButton = Button({
        text: "Clone"
    });

    form.append(repoUrlInput.container, cloneButton);

    const submit = async () => {
        cloneButton.disabled = true;
        let url = repoUrlInput.input.value;
        if (!url.endsWith(".git")) {
            url += ".git";
        }
        cloneGitRepo(url, scrollable)
            .then(() => stackNavigation.back())
            .catch(() => {});
    };
    form.onsubmit = (e) => {
        e.preventDefault();
        submit();
    };

    scrollable.append(form);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            core_message.addListener("git-clone", checkForDone);
        }
    });

    if (repoUrl) {
        repoUrlInput.input.value = repoUrl;
        submit();
    }
}

let checkForDone: (progress: string) => void;
async function cloneGitRepo(url: string, scrollable: HTMLElement) {
    const consoleTerminal = ConsoleTerminal();

    const tmpDirectory = tmpDir + "/" + randomStr(6);

    const logProgress = gitLogger(consoleTerminal);

    const donePromise = new Promise<void>((resolve) => {
        checkForDone = (gitProgress: string) => {
            let json: { url: string; data: string };
            try {
                json = JSON.parse(gitProgress);
            } catch (e) {
                return;
            }

            if (json.url !== url) return;

            if (json.data.trim().endsWith("done")) {
                resolve();
            }
            logProgress(json.data);
        };
    });

    core_message.addListener("git-clone", checkForDone);

    const loader = CreateLoader({
        text: "Cloning from remote..."
    });

    scrollable.append(loader, consoleTerminal.container);

    consoleTerminal.logger(`Cloning ${url}`);
    try {
        git.clone(url, tmpDirectory);
    } catch (e) {
        consoleTerminal.logger(e.Error);
        throw e;
    }

    await donePromise;

    const repoUrl = new URL(url);
    let defaultProjectTitle = repoUrl.pathname.slice(1); // remove forward slash
    // remove .git
    const pathnameComponents = defaultProjectTitle.split(".");
    if (pathnameComponents.at(-1) === "git") {
        defaultProjectTitle = pathnameComponents.slice(0, -1).join(".");
    }

    createAndMoveProject(
        tmpDirectory,
        consoleTerminal,
        defaultProjectTitle,
        url
    );

    consoleTerminal.logger(`Finished cloning ${url}`);
    consoleTerminal.logger(`Done`);

    core_message.removeListener("git-clone", checkForDone);
}

export function gitLogger(consoleTerminal: ReturnType<typeof ConsoleTerminal>) {
    let currentPhase: string, currentHTMLElement: HTMLDivElement;
    return (progress: string) => {
        const progressLines = progress.split("\n");
        progressLines.forEach((line) => {
            if (!line.trim()) return;

            const phase = line.split(":").at(0);
            if (phase !== currentPhase) {
                currentPhase = phase;
                currentHTMLElement = document.createElement("div");
                consoleTerminal.text.append(currentHTMLElement);
            }

            currentHTMLElement.innerText = line.trim();
            consoleTerminal.text.scrollIntoView(false);
        });
    };
}
