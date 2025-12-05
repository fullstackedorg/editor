import { providersInfo } from "@fullstacked/ai-agent";

export enum CONFIG_TYPE {
    GENERAL = "general",
    PROJECTS = "projects",
    PROJECTS_LISTS = "projects-lists",
    GIT = "git",
    AGENT = "agent"
}

export type CONFIG_DATA_TYPE = {
    [CONFIG_TYPE.GENERAL]: {
        userMode: boolean;
    };
    [CONFIG_TYPE.PROJECTS]: {
        projects: Project[];
    };
    [CONFIG_TYPE.PROJECTS_LISTS]: {
        lists: ProjectsList[];
    };
    [CONFIG_TYPE.GIT]: GitAuths;

    [CONFIG_TYPE.AGENT]: AgentProvider[];
};

export type AgentProvider =
    (typeof providersInfo)[keyof typeof providersInfo] & {
        model?: string;
        useDefault?: boolean;
    };

export type ProjectsList = {
    name: string;
    id: string;
    url: string;
};

export type ProjectsListRemote = {
    name?: string;
    id?: string;
    projects: {
        id?: string;
        title?: string;
        gitRepository: {
            url: string;
        };
    }[];
};

export type Project = {
    title: string;
    id: string;
    createdDate: number;
    lists?: string[];
    gitRepository?: {
        url: string;
        name?: string;
        email?: string;
    };
};

export type GitAuths = {
    [hostname: string]: {
        username: string;
        password?: string;
        email?: string;
    };
};
