import "./init";
import core_message from "../fullstacked_modules/core_message";
import { deeplink, WindowsAskForAdmin } from "./deeplink";
import { Demo } from "./demo";
import { CONFIG_TYPE } from "./types";
import { updatePackagesView } from "./views/packages";
import { Projects } from "./views/projects";
import platform, { Platform } from "../fullstacked_modules/platform";
import { InitPrompt } from "./views/prompt";
import { Store } from "./store";
import { Project } from "./views/project";
import config from "../fullstacked_modules/config";

core_message.addListener("deeplink", deeplink);

// fix windows scrollbars
if (navigator.userAgent.includes("Windows")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/windows.css";
    document.head.append(link);
}

// remove top padding for apple devices
if (platform === Platform.APPLE) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/apple.css";
    document.head.append(link);
}

document.querySelector("#splash")?.remove();
Projects();
InitPrompt();
Store.projects.current.subscribe(Project);

core_message.addListener("package", (dataStr) => {
    try {
        updatePackagesView(JSON.parse(dataStr));
    } catch (e) {
        console.log(dataStr);
    }
});

const checkProjectsConfigExists = await config.get(CONFIG_TYPE.PROJECTS, true);
if (!checkProjectsConfigExists) {
    if (platform === Platform.WINDOWS) {
        WindowsAskForAdmin();
    }

    Demo();
}
