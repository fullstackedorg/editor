import { Project } from "../../../../types";
import fs from "../../../../../fullstacked_modules/fs";
import { createConversation } from "@fullstacked/ai-agent";
import { createToolFS } from "../../../../../fullstacked_modules/ai";
import { getDefaultAgentProvider } from "../../../ai-agent";
import { createAiAgentConfigurator } from "../../../ai-agent/config";

const extensions = ["chat"];

export function chatSupportedFile(filePath: string) {
    const ext = filePath.split(".").pop();
    return extensions.includes(ext);
}

export function createViewChat(
    project: Project, 
    filePath: string,
) {
    const element = document.createElement("div");

    fs.readFile(`${project.id}/${filePath}`, { encoding: "utf8" })
        .then(async chatData => {
            let messages: any[];
            try {
                messages = JSON.parse(chatData)
            } catch (e) {
                messages = [];
             }

            const provider = getDefaultAgentProvider();
            if(!provider) {
                element.append(createAiAgentConfigurator())
            }
        });

    return {
        type: "chat",
        element,
        remove() {
            element.remove();
         },
        reloadContents() { }
    }
} 