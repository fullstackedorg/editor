import { Project, CONFIG_TYPE } from "../../../../types";
import fs from "../../../../../fullstacked_modules/fs";
import { createConversation } from "@fullstacked/ai-agent";
import ai, { createToolFS } from "../../../../../fullstacked_modules/ai";
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

export function createViewChat(project: Project, projectFilePath: string) {
    const element = document.createElement("div");
    element.classList.add("chat-container");

    const filePath = `${project.id}/${projectFilePath}`;

    fs.readFile(filePath, { encoding: "utf8" }).then(async (chatData) => {
        let chat: {
            provider?: string;
            model?: string;
            messages?: any[];
        } = {};
        try {
            chat = JSON.parse(chatData);
        } catch (e) {}

        const agent = await getProviderAndModel(chat.provider, chat.model);

        console.log(agent);
        if (!agent?.info?.model) {
            const configurator = createAiAgentConfigurator(chat.provider);
            const submitButton = Button({
                text: "Select"
            });
            submitButton.onclick = () => {
                console.log(configurator.current);
            };
            element.append(configurator.element, submitButton);
            return;
        } else {
            chat.provider = agent.info.id;
            chat.model = agent.info.model;
        }

        const conversation = createConversation({
            provider: agent.provider,
            model: agent.info.model,
            messages: chat.messages || undefined,
            tools: createToolFS({
                baseDirectory: project.id
            }),
            codemirrorViewExtension: [oneDark],
            onStateChange: (state) => {
                if (state === "IDLE") {
                    Store.editor.codeEditor.removeChatStatus(projectFilePath);
                    chat.messages = conversation.serialize();
                    fs.writeFile(filePath, JSON.stringify(chat, null, 2));
                } else {
                    Store.editor.codeEditor.setChatStatus(
                        projectFilePath,
                        state
                    );
                }
            }
        });

        const infos = document.createElement("div");
        infos.classList.add("infos");
        infos.innerHTML = `<div>
                <label>${agent.info.title}</label>
                <div>${agent.info.model}</div>
            </div>`;

        const settings = Button({
            style: "icon-small",
            iconRight: "Settings"
        });
        infos.append(settings);
        settings.onclick = () => {
            conversation.element.replaceWith(
                createAiAgentConfigurator(agent.info.id).element
            );
        };

        element.append(infos, conversation.element);
    });

    return {
        type: "chat",
        element,
        remove() {
            element.remove();
        },
        reloadContents() {}
    };
}
