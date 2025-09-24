import { Project } from "../../../../types";
import fs from "../../../../../fullstacked_modules/fs";
import { createConversation } from "@fullstacked/ai-agent";
import ai, { createToolFS } from "../../../../../fullstacked_modules/ai";
import { getDefaultAgentProvider } from "../../../ai-agent";
import { createAiAgentConfigurator } from "../../../ai-agent/config";
import { save } from "../../../../editor_modules/config";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@fullstacked/ui";
import { EditorView } from "codemirror";

const extensions = ["chat"];

export function chatSupportedFile(filePath: string) {
    const ext = filePath.split(".").pop();
    return extensions.includes(ext);
}

async function getProviderAndModel(providerId: string, model: string) {
    if (!providerId) {
        return getDefaultAgentProvider();
    }
}

export function createViewChat(
    project: Project, 
    filePath: string
) {
    const element = document.createElement("div");
    element.classList.add("chat-container");

    fs.readFile(`${project.id}/${filePath}`, { encoding: "utf8" }).then(
        async (chatData) => {
            let savedChat: {
                provider?: string;
                model?: string;
                messages?: any[];
            } = {};
            try {
                savedChat = JSON.parse(chatData);
            } catch (e) {}

            const agent = await getProviderAndModel(
                savedChat.provider,
                savedChat.model
            );
            if (!agent?.info?.model) {
                const configurator = createAiAgentConfigurator(savedChat.provider);
                const submitButton = Button({
                    text: "Select"
                })
                submitButton.onclick = () => {
                    console.log(configurator.current)
                }
                element.append(configurator.element, submitButton);
                return;
            }

            const conversation = createConversation({
                provider: agent.provider,
                model: agent.info.model,
                tools: createToolFS({
                    baseDirectory: project.id
                }),
                codemirrorViewExtension: [oneDark]
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
                conversation.element.replaceWith(createAiAgentConfigurator(agent.info.id).element);
            }

            element.append(infos, conversation.element);
        }
    );

    return {
        type: "chat",
        element,
        remove() {
            element.remove();
        },
        reloadContents() {}
    };
}
