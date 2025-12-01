import slugify from "slugify";
import { TopBar } from "../../components/top-bar";
import stackNavigation from "../../stack-navigation";
import { BG_COLOR } from "../../constants";
import { Badge, Button, InputText, Loader } from "@fullstacked/ui";
import { viewClass } from "../../style/index.s";
import { createFormClass } from "./index.s";
import { projectsListStatusClass } from "./projects-list.s";
import { core_fetch2 } from "fetch";
import { CONFIG_TYPE, ProjectsListRemote } from "../../types";
import { createElement } from "../../components/element";
import { createRefresheable } from "../../components/refresheable";
import config from "../../editor_modules/config";
import { Store } from "../../store";

export function ProjectsList() {
    const container = document.createElement("div");
    container.classList.add(viewClass, createFormClass);

    const topBar = TopBar({
        title: "Add projects list"
    });

    container.append(topBar);

    const form = document.createElement("form");

    const inputUrl = InputText({
        label: "URL"
    });

    const status = ProjectsListStatus();

    let testUrlDebouncer: ReturnType<typeof setTimeout> = null;
    const testUrl = async (testResult?: null) => {
        const testResponse =
            testResult === undefined
                ? await testProjectsListUrl(inputUrl.input.value)
                : testResult;
        status.refresh(testResponse);
        testUrlDebouncer = null;
        addButton.disabled = !testResponse;

        if (testResponse?.name) {
            inputName.input.value = inputName.input.value || testResponse.name;
        }

        if (testResponse?.id) {
            inputIdentifier.input.value =
                inputIdentifier.input.value || testResponse.id;
        }
    };
    let lastUrlTest = null;
    const testUrlDebounced = () => {
        const urlToTest = inputUrl.input.value;
        if (urlToTest === lastUrlTest) return;

        lastUrlTest = urlToTest;

        if (testUrlDebouncer) {
            clearTimeout(testUrlDebouncer);
        }

        if (!strIsUrl(urlToTest) || !urlToTest) {
            testUrl(null);
        } else {
            status.refresh("loading");
            testUrlDebouncer = setTimeout(testUrl, 2000);
        }
    };

    inputUrl.input.onkeyup = testUrlDebounced;

    const inputName = InputText({
        label: "Name"
    });
    const inputIdentifier = InputText({
        label: "Identifier"
    });
    const addButton = Button({
        text: "Add"
    });
    addButton.disabled = true;

    form.onsubmit = async (e) => {
        e.preventDefault();
        addButton.disabled = true;

        const url = inputUrl.input.value;
        const name = inputName.input.value || urlToName(url);
        const id = slugify(inputIdentifier.input.value || name, {
            lower: true
        });

        await Store.projects.projectsLists.add(url, name, id);
        addButton.disabled = false;
        stackNavigation.back();
    };

    form.append(
        inputUrl.container,
        inputName.container,
        inputIdentifier.container,
        status.container,
        addButton
    );

    container.append(form);

    setTimeout(() => inputUrl.input.focus(), 1);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR
    });
}

export function urlToName(urlStr: string) {
    const url = strIsUrl(urlStr);
    if (!url) return "Unnamed";
    return url.host + " - " + url.pathname.slice(1).replace(/\//g, "_");
}

function validateProject(project: ProjectsListRemote["projects"][number]) {
    return !!project?.gitRepository?.url;
}

let lastStatus: "loading" | Awaited<ReturnType<typeof testProjectsListUrl>> =
    null;
function ProjectsListStatus() {
    const container = createElement("div");
    container.classList.add(projectsListStatusClass);
    container.innerHTML = `<label>Status</label>`;

    const badgeAndTextRenderer = (status: typeof lastStatus) => {
        const element = createElement("div");

        if (status === "loading") {
            if (lastStatus === "loading") {
                return false;
            }

            element.append(Loader());
        } else {
            const text = document.createElement("div");

            let warning: string = null;
            if (!status?.projects || !Array.isArray(status?.projects)) {
                warning = `Property <b>projects</b> is not an Array.`;
            } else if (status?.projects) {
                const totalProjects = status.projects.length;
                const invalidProjects =
                    totalProjects -
                    status.projects.filter(validateProject).length;
                if (invalidProjects) {
                    warning = `${invalidProjects}/${totalProjects} project${invalidProjects > 1 ? "s" : ""} invalid`;
                }
            }

            text.innerHTML = status
                ? status.error ||
                  warning ||
                  `${status.projects.length} project${status.projects.length > 1 ? "s" : ""} in list`
                : "";

            const badge = Badge({
                type: status
                    ? status.error
                        ? "error"
                        : warning
                          ? "warning"
                          : "success"
                    : undefined,
                text: status
                    ? status.error
                        ? "Error"
                        : warning
                          ? "warning"
                          : "Valid"
                    : "-"
            });

            element.append(text, badge);
        }
        lastStatus = status;

        return element;
    };

    const badgeAndText = createRefresheable(badgeAndTextRenderer);
    badgeAndText.refresh(null);

    container.append(badgeAndText.element);

    return {
        container,
        refresh: badgeAndText.refresh
    };
}

function strIsUrl(urlStr: string) {
    try {
        return new URL(urlStr);
    } catch (e) {
        return null;
    }
}

async function testProjectsListUrl(urlStr: string): Promise<
    {
        error?: string;
    } & Partial<ProjectsListRemote>
> {
    const url = strIsUrl(urlStr);
    if (!url) {
        return {
            error: "Not a valid URL"
        };
    }

    const response = await core_fetch2(url);
    if (!response.ok) {
        return {
            error: response.statusText
        };
    }

    let json: ProjectsListRemote = null;
    try {
        json = await response.json();
    } catch (e) {
        return { error: "Invalid json response" };
    }

    return json;
}
