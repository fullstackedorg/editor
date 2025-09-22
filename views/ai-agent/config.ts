import * as ai from "@fullstacked/ai-agent";
import { InputSelect, InputText, InputCheckbox, Button } from "@fullstacked/ui";
import config from "../../editor_modules/config";
import { CONFIG_TYPE } from "../../types";


export function createAiAgentConfigurator() {
    const element = document.createElement("div");

    const providers = ai.providers();

    const providerSelect = InputSelect({
        label: "Provider"
    });


    let providerConfigsContainer = document.createElement("div");
    providerConfigsContainer.innerText = "Select an agent provider to configurate";

    providerSelect.select.onchange = (providerId) => {
        const providerInfos = providers.find(({ id }) => id === providerId);

        const providerConfigs = document.createElement("div");

        let provider: ReturnType<typeof ai.getProvider>;
        const onChange = async () => {
            console.log(providerInfos)
            provider = ai.getProvider(providerInfos);
            const models = await provider.models();
            if (models) {
                const modelSelect = InputSelect({
                    label: "Default Model"
                });
                modelSelect.options.add(...(models.map(name => ({ name }))))
                providerConfigs.append(modelSelect.container);
            } else {
                
            }
        }

        providerInfos.configs.forEach(c => {
            if (c.type === "string") {
                const inputText = InputText({
                    label: c.title
                });
                inputText.input.value = c.value;
                inputText.input.onkeyup = () => {
                    c.value = inputText.input.value;
                    onChange()
                }
                providerConfigs.append(inputText.container)
            } else if (c.type === "key-value") {

            }
        });

        providerConfigsContainer.replaceWith(providerConfigs);
        providerConfigsContainer = providerConfigs;

        onChange();
    }

    config.get(CONFIG_TYPE.AGENT)
        .then(userConfig => {
            element.append(providerSelect.container, providerConfigsContainer);

            for (const provider of providers) {
                providerSelect.options.add({
                    name: provider.title,
                    id: provider.id
                });



            }
        });
    

    return element
} 