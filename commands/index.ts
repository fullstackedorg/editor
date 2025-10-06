import { deeplink } from "../deeplink";
import stackNavigation from "../stack-navigation";
import { Store } from "../store";
import { Project } from "../types";
import { updatePackagesView } from "../views/packages";
import packages from "../../fullstacked_modules/packages";
import fs from "../../fullstacked_modules/fs";
import { promptNewChat } from "../views/prompt";

export type Command = {
    name: string;
    suggestions?(prefix: string): string[] | Promise<string[]>;
    exec?(args: string[]): void;
    alias?: string[];
    subcommand?: Command[];
};

let projectsList = [];
Store.projects.list.subscribe((l) => (projectsList = l.map(({ id }) => id)));

export const commands: Command[] = [
    {
        name: "npm",
        subcommand: [
            {
                name: "install",
                alias: ["i"],
                exec(args) {
                    let dev = false,
                        quick = false;
                    if (args.includes("--save-dev")) {
                        dev = true;
                        args.splice(args.indexOf("--save-dev"), 1);
                    }
                    if (args.includes("--quick")) {
                        quick = true;
                        args.splice(args.indexOf("--quick"), 1);
                    }
                    if (quick) {
                        packages.installQuick(
                            Store.projects.current.check(),
                            updatePackagesView
                        );
                    } else {
                        packages.install(
                            Store.projects.current.check(),
                            args,
                            updatePackagesView,
                            dev
                        );
                    }
                }
            }
        ]
    },
    {
        name: "gh",
        subcommand: [
            {
                name: "repo",
                subcommand: [
                    {
                        name: "clone",
                        exec(args) {
                            const repo = args.at(0);
                            const deeplinkUrl = `fullstacked://https//github.com/${repo}.git`;
                            deeplink(deeplinkUrl);
                        }
                    }
                ]
            }
        ]
    },
    {
        name: "back",
        exec() {
            stackNavigation.back();
        }
    },
    {
        suggestions: () => projectsList,
        exec(args) {
            const projectId = args.at(0);
            if (!projectsList.find((id) => id === projectId)) {
                return;
            }
            const projects = Store.projects.list.check();
            const project = projects.find(({ id }) => id === projectId);
            Store.projects.setCurrent(project);
        },
        name: "code"
    },
    {
        suggestions: () => projectsList,
        exec(args) {
            const projectId = args.at(0);
            let project: Project = null;
            if (projectId === ".") {
                project = Store.projects.current.check();
            } else if (!projectsList.find((id) => id === projectId)) {
                return false;
            }
            if (!project) {
                const projects = Store.projects.list.check();
                project = projects.find(({ id }) => id === projectId);
            }

            if (project) {
                Store.projects.build(project);
                return;
            }
        },
        name: "open"
    },
    {
        name: "git",
        subcommand: [
            {
                name: "clone",
                exec(args) {
                    const repoUrl = args.at(0);
                    const deeplinkUrl = `fullstacked://${repoUrl}`;
                    deeplink(deeplinkUrl);
                }
            }
        ]
    },
    {
        name: "chat",
        exec() {
            promptNewChat();
        }
    }
];
