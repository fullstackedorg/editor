import { providersInfo } from "@fullstacked/ai-agent";

export enum CONFIG_TYPE {
    GENERAL = "general",
    PROJECTS = "projects",
    GIT = "git",
    AGENT = "agent"
}

export type CONFIG_DATA_TYPE = {
    [CONFIG_TYPE.GENERAL]: {
        userMode: boolean;
    };
    [CONFIG_TYPE.PROJECTS]: {
        projects: ProjectsList;
    };
    [CONFIG_TYPE.GIT]: GitAuths;

    [CONFIG_TYPE.AGENT]: AgentProvider[];
};

export type AgentProvider =
    (typeof providersInfo)[keyof typeof providersInfo] & {
        model?: string;
        useDefault?: boolean;
    };

export type ProjectsList = Project[];

export type Project = {
    title: string;
    id: string;
    createdDate: number;
    lists?: string[];
    location?: string;
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
