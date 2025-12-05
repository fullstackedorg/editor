import { createSequential, createSubscribable, Store } from ".";
import { CONFIG_TYPE, Project, ProjectsListRemote } from "../types";
import fs from "fs";
import { SnackBar } from "components/snackbar";
import git from "git";
import { updatePackagesView } from "../views/packages";
import stackNavigation from "../stack-navigation";
import build from "build";
import core_open from "core_open";
import packages from "packages";
import config from "../editor_modules/config";
import type { createWorkspace } from "../views/project/workspace";
import { core_fetch2 } from "fetch";
import { urlToName } from "../views/add-project/projects-list";
import slugify from "slugify";

const list = createSubscribable(listP, []);

const activeProjectBuilds = new Set<string>();
const builds = createSubscribable(() => activeProjectBuilds);

const activeProjectPulls = new Set<string>();
const pulls = createSubscribable(() => activeProjectPulls);

let currentOpenedProject: Project & {
    workspace?: ReturnType<typeof createWorkspace>;
} = null;
const current = createSubscribable(() => currentOpenedProject);

const projectsLists = createSubscribable(listProjectsLists);

export const projects = {
    list: list.subscription,
    create: createSequential(create),
    update,
    deleteP,

    projectsLists: {
        list: projectsLists.subscription,
        add: addProjectsList
    },

    setCurrent,
    current: current.subscription,

    build: buildProject,
    builds: builds.subscription,

    pull,
    pulls: pulls.subscription
};

function setCurrent(project: Project) {
    if (currentOpenedProject) {
        stackNavigation.back();
    }
    currentOpenedProject = project;
    current.notify();
}

async function listProjectsLists() {
    const { lists } = await config.get(CONFIG_TYPE.PROJECTS_LISTS);
    return lists || [];
}

async function addProjectsList(list: {
    url: string;
    name?: string;
    id?: string;
}) {
    let projectsList: ProjectsListRemote = null;
    try {
        projectsList = await (await core_fetch2(list.url)).json();
    } catch (e) {
        return;
    }

    if (!projectsList?.projects || !Array.isArray(projectsList?.projects)) {
        return;
    }

    let { lists } = await config.get(CONFIG_TYPE.PROJECTS_LISTS);
    if (!lists) {
        lists = [];
    }

    const existingList = lists.find(({ url }) => url === list.url);

    const name =
        existingList?.name ||
        list.name ||
        projectsList.name ||
        urlToName(list.url);
    const id =
        existingList?.id ||
        slugify(list.id || projectsList.id || name, { lower: true });

    for (let i = 0; i < projectsList.projects.length; i++) {
        const project = projectsList.projects[i];
        await create({
            id: slugify(project.id || `${id}-${i}`, { lower: true }),
            title: project.title || `${name}-${i}`,
            lists: [id],
            gitRepository: {
                url: project.gitRepository.url
            }
        });
    }

    if (!existingList) {
        lists.push({
            ...list,
            id,
            name
        });
    }

    await config.save(CONFIG_TYPE.PROJECTS_LISTS, { lists });
    projectsLists.notify();
}

async function listP() {
    const { projects } = await config.get(CONFIG_TYPE.PROJECTS);
    return projects || [];
}

async function create(project: Omit<Project, "createdDate">) {
    const projects = await listP();

    let newProject: Project = {
        ...project,
        createdDate: Date.now()
    };

    const existingProject = projects.find(({ id }) => id === project.id);
    if (existingProject) {
        newProject = existingProject;

        if (project.lists?.length) {
            existingProject.lists = Array.from(
                new Set([...(existingProject.lists || []), ...project.lists])
            );
        }
    } else {
        if (newProject.gitRepository?.url) {
            const url = new URL(newProject.gitRepository.url);
            const hostname = url.hostname;
            const gitAuthConfigs = await config.get(CONFIG_TYPE.GIT);
            const gitAuth = gitAuthConfigs[hostname];
            if (gitAuth?.username) {
                newProject.gitRepository.name =
                    newProject.gitRepository.name || gitAuth.username;
            }
            if (gitAuth?.email) {
                newProject.gitRepository.email =
                    newProject.gitRepository.email || gitAuth.email;
            }
        }

        projects.push(newProject);
    }

    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();

    return newProject;
}

async function update(project: Project, updatedProject: Project) {
    const projects = await listP();
    const indexOf = projects.findIndex(({ id }) => id === project.id);
    if (indexOf === -1) return;

    if (project.id != updatedProject.id) {
        await fs.rename(project.id, updatedProject.id);
    }

    projects[indexOf] = updatedProject;
    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();
}

async function deleteP(project: Project) {
    const projects = await listP();
    const indexOf = projects.findIndex(({ id }) => id === project.id);
    if (indexOf === -1) return;
    projects.splice(indexOf, 1);
    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();

    fs.rmdir(project.id);
}

async function buildProject(project: Project) {
    Store.editor.codeEditor.clearAllBuildErrors();

    activeProjectBuilds.add(project.id);
    builds.notify();

    const removeProjectBuild = () => {
        activeProjectBuilds.delete(project.id);
        builds.notify();
    };

    const isUserMode = Store.preferences.isUserMode.check();
    if (!isUserMode || (await build.shouldBuild(project))) {
        await packages.installQuick(project, updatePackagesView);
        const buildErrors = await build.buildProject(project);
        const errors = buildErrors.map((error) => {
            return {
                file: error.location?.file,
                line: error.location?.line,
                col: error.location?.column,
                length: error.location?.length,
                message: error.text
            };
        });

        if (errors.length) {
            console.log(errors);
            if (isUserMode) {
                SnackBar({
                    message: `Encountered errors while building <b>${project.title}</b>.`,
                    autoDismissTimeout: 4000
                });
            } else {
                Store.editor.codeEditor.addBuildErrors(errors);
            }
        } else {
            core_open(project.id);
        }
    } else {
        core_open(project.id);
    }

    removeProjectBuild();
}

async function pull(project: Project) {
    if (!project.gitRepository?.url) {
        return;
    }

    activeProjectPulls.add(project.id);
    pulls.notify();
    try {
        await git.pull(project);
    } catch (e) {
        SnackBar({
            message: `Failed to update <b>${project.title}</b>.`,
            autoDismissTimeout: 4000
        });
    }
    activeProjectPulls.delete(project.id);
    pulls.notify();
}
