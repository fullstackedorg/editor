import "./init";
import core_message from "core_message";
import { deeplink, WindowsAskForAdmin } from "./deeplink";
import { Demo } from "./demo";
import { CONFIG_TYPE } from "./types";
import { updatePackagesView } from "./views/packages";
import { Projects } from "./views/projects";
import platform, { Platform } from "platform";
import { InitPrompt } from "./views/prompt";
import { Store } from "./store";
import { Project } from "./views/project";
import { gitAuthCallback } from "./views/git-auth";
import config from "./editor_modules/config";
import { appleClass } from "./style/apple.s";
import { windowsClass } from "./style/windows.s";

core_message.addListener("deeplink", deeplink);
core_message.addListener("git-authentication", gitAuthCallback);

// fix windows scrollbars for browser and app
if (navigator.userAgent.toLocaleLowerCase().includes("windows")) {
    document.documentElement.classList.add(windowsClass);
}

// remove top padding for apple devices
if (platform === Platform.APPLE) {
    document.documentElement.classList.add(appleClass);
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

Store.projects.projectsLists.list.check()?.forEach(Store.projects.projectsLists.add);