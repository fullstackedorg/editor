import { Project, CONFIG_TYPE } from "../../../../types";
import fs from "../../../../../fullstacked_modules/fs";
import ai from "@fullstacked/ai-agent";
import { getDefaultAgentProvider } from "../../../ai-agent";
import {
    createAiAgentConfigurator,
    mergeConfigsWithAvailableProviders
} from "../../../ai-agent/config";
import config from "../../../../editor_modules/config";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@fullstacked/ui";
import { EditorView } from "codemirror";
import { Store } from "../../../../store";
import { z } from "zod";

const extensions = ["chat"];

export function chatSupportedFile(filePath: string) {
    const ext = filePath.split(".").pop();
    return extensions.includes(ext);
}

async function getProviderAndModel(providerId: string, model: string) {
    const providerInfo = (await mergeConfigsWithAvailableProviders()).find(
        ({ id }) => id === providerId
    );
    if (providerInfo) {
        const provider = ai.getProvider(providerInfo);
        if (provider) {
            try {
                const models = await provider.models();
                if (models.includes(model)) {
                    return {
                        provider,
                        info: {
                            ...providerInfo,
                            model
                        }
                    };
                }
            } catch (e) {
                console.log(e);
            }
        }
    } else {
        return getDefaultAgentProvider();
    }
}

function aiAgentSelector(
    provider: string,
    didSelect: (selection: { provider: string; model: string }) => void
) {
    const element = document.createElement("div");
    element.classList.add("ai-agent-selector");

    const configurator = createAiAgentConfigurator(provider);
    const submitButton = Button({
        text: "Select"
    });
    submitButton.onclick = () => didSelect(configurator.current);

    element.append(configurator.element, submitButton);
    return element;
}

export function createViewChat(project: Project, projectFilePath: string) {
    const element = document.createElement("div");
    element.classList.add("chat-container");

    let lastScrollY = 0;

    const filePath = `${project.id}/${projectFilePath}`;

    let conversation: ReturnType<typeof ai.createConversation>;

    const messageToPrompt: string[] = [];
    const prompt = (message: string) => {
        if (conversation) {
            conversation.prompt(message);
        } else {
            messageToPrompt.push(message);
        }
    };

    const initAgentConversation = async (chat: {
        provider?: string;
        model?: string;
        messages?: any[];
    }) => {
        let agent = await getProviderAndModel(chat?.provider, chat?.model);

        if (!agent?.info?.model) {
            const agentSelector = aiAgentSelector(
                chat?.provider,
                (selection) => {
                    initAgentConversation({
                        provider: selection.provider,
                        model: selection.model,
                        messages: chat?.messages
                    });
                    agentSelector.remove();
                }
            );
            element.append(agentSelector);
            return;
        }

        if (chat === null) {
            chat = {};
        }

        const saveChat = () => {
            chat.messages = conversation.serialize();
            fs.writeFile(filePath, JSON.stringify(chat, null, 2));
        };

        conversation = ai.createConversation({
            provider: agent.provider,
            model: agent.info.model,
            messages: chat?.messages || undefined,
            tools: createToolFS({
                baseDirectory: project.id
            }),
            codemirrorViewExtension: [oneDark],
            onStateChange: (state) => {
                if (state === "IDLE") {
                    Store.editor.codeEditor.removeChatStatus(projectFilePath);
                    saveChat();
                    if (projectFilePath.startsWith("chat/New Chat")) {
                        conversation
                            .generateConversationTitle()
                            .then(async (t) => {
                                if (t && t.split(" ").length <= 5) {
                                    let count = 1;
                                    let newChatFilePath = `${project.id}/chat/${t}.chat`;
                                    while (await fs.exists(newChatFilePath)) {
                                        count++;
                                        newChatFilePath = `${project.id}/chat/${t}-${count}.chat`;
                                    }

                                    fs.rename(filePath, newChatFilePath);
                                }
                            });
                    }
                } else {
                    Store.editor.codeEditor.setChatStatus(
                        projectFilePath,
                        state
                    );
                }
            }
        });

        setTimeout(() => {
            lastScrollY = conversation.element.scrollHeight;
            conversation.element.scrollTo(0, lastScrollY);
            conversation.element.addEventListener("scroll", () => {
                lastScrollY = conversation.element.scrollTop;
            });
        });

        const infos = document.createElement("div");
        infos.classList.add("infos");

        const providerAndModel = document.createElement("div");
        const agentTitle = document.createElement("label");
        const modelName = document.createElement("div");

        providerAndModel.append(agentTitle, modelName);
        infos.append(providerAndModel);

        const setProviderInfo = () => {
            chat.provider = agent.info.id;
            chat.model = agent.info.model;
            agentTitle.innerText = agent.info.title;
            modelName.innerText = agent.info.model;
        };
        setProviderInfo();

        const settings = Button({
            style: "icon-small",
            iconRight: "Settings"
        });
        infos.append(settings);
        settings.onclick = () => {
            const agentSelector = aiAgentSelector(
                agent.info.id,
                async (selection) => {
                    const newAgent = await getProviderAndModel(
                        selection.provider,
                        selection.model
                    );
                    if (!newAgent) return;
                    agent = newAgent;
                    setProviderInfo();
                    conversation.updateChatModel(
                        agent.provider,
                        agent.info.model
                    );
                    agentSelector.replaceWith(conversation.element);
                    conversation.element.scrollTo(0, lastScrollY);
                    saveChat();
                }
            );
            conversation.element.replaceWith(agentSelector);
        };

        element.append(infos, conversation.element);

        if (messageToPrompt.length) {
            while (messageToPrompt.length) {
                conversation.prompt(messageToPrompt.shift());
            }
        }
    };

    fs.readFile(filePath, { encoding: "utf8" }).then((chatDataStr) => {
        let chat: any;
        try {
            chat = JSON.parse(chatDataStr);
        } catch (e) {
            chat = null;
        }
        initAgentConversation(chat);
    });

    return {
        type: "chat",
        element,
        prompt,
        remove() {
            element.remove();
        },
        reloadContents() {},
        restore() {
            conversation?.element?.scrollTo(0, lastScrollY);
        }
    };
}

type ToolFSOptions = {
    baseDirectory: string;
};

export function createToolFS(opts?: Partial<ToolFSOptions>) {
    let basePath = opts?.baseDirectory || "";

    if (basePath !== "" && !basePath.endsWith("/")) {
        basePath += "/";
    }

    const fixPath = (path: string) => basePath + path;

    return [
        ai.createTool({
            name: "CreateDir",
            description: "Create a directory.",
            schema: z.object({
                path: z.string()
            }),
            fn: async ({ path }) => {
                const success = await fs.mkdir(fixPath(path));
                return success
                    ? `Successfully created directory ${path}.`
                    : `Failed to create directory ${path}.`;
            },
            message: ({ path }) => `Creating directory \`${path}\``
        }),
        ai.createTool({
            name: "ListFiles",
            description: "List files in a directory.",
            schema: z.object({
                path: z.string()
            }),
            fn: ({ path }) => fs.readdir(fixPath(path)),
            message: ({ path }) => `Listing files at \`${path}\``
        }),
        ai.createTool({
            name: "ReadFile",
            description: "Read the content of a file.",
            schema: z.object({
                path: z.string()
            }),
            fn: ({ path }) => fs.readFile(fixPath(path), { encoding: "utf8" }),
            message: ({ path }) => `Reading file at \`${path}\``
        }),
        ai.createTool({
            name: "WriteFile",
            description: "Write content to file.",
            schema: z.object({
                path: z.string(),
                contents: z.string()
            }),
            fn: async ({ path, contents }) => {
                const success = await fs.writeFile(fixPath(path), contents);
                return success
                    ? `Successfully written ${contents.length} characters to ${path}.`
                    : `Failed to write to ${path}.`;
            },
            message: ({ path }) => `Writing to \`${path}\``
        })
    ];
}
