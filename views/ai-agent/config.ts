import * as ai from "@fullstacked/ai-agent";
import {
    InputSelect,
    InputText,
    InputCheckbox,
    Button,
    Message
} from "@fullstacked/ui";
import config from "../../editor_modules/config";
import { CONFIG_TYPE } from "../../types";

export function createAiAgentConfigurator() {
    const element = document.createElement("div");
    element.classList.add("ai-agent-configurator");

    const providers = ai.providers();

    const providerSelect = InputSelect({
        label: "Provider"
    });

    let providerConfigsContainer = document.createElement("div");
    providerConfigsContainer.innerText =
        "Select an agent provider to configure";

    providerSelect.select.onchange = (providerId) => {
        const providerInfos = providers.find(({ id }) => id === providerId);

        const providerConfigs = document.createElement("div");

        let providerModelSelectContainer = document.createElement("div");
        let provider: ReturnType<typeof ai.getProvider>;
        const onChange = async (showWarning = true) => {
            const providerModelSelect = document.createElement("div");

            provider = ai.getProvider(providerInfos);
            let models: string[];
            try {
                models = await provider.models();
            } catch (e) {}

            if (models) {
                const modelSelect = InputSelect({
                    label: "Default Model"
                });
                modelSelect.options.add(...models.map((name) => ({ name })));

                const defaultCheckbox = document.createElement("div");
                defaultCheckbox.innerHTML = `<label>Use as default agent</label>`;
                const checkbox = InputCheckbox();
                defaultCheckbox.append(checkbox.container);

                providerModelSelect.append(
                    modelSelect.container,
                    defaultCheckbox
                );
            } else if (showWarning) {
                providerModelSelect.append(
                    Message({
                        style: "warning",
                        text: "Failed to connect to provider. Check configuration."
                    })
                );
            }

            providerModelSelectContainer.replaceWith(providerModelSelect);
            providerModelSelectContainer = providerModelSelect;
        };

        providerInfos.configs.forEach((c) => {
            if (c.type === "string") {
                const inputText = InputText({
                    label: c.title
                });
                inputText.input.value = c.value;
                inputText.input.onkeyup = () => {
                    c.value = inputText.input.value;
                    onChange();
                };
                providerConfigs.append(inputText.container);
            } else if (c.type === "key-value") {
                providerConfigs.append(
                    keyValueComponent({
                        title: c.title,
                        value: c.value,
                        onChange: (v) => {
                            c.value = v;
                            onChange();
                        }
                    })
                );
            }
        });

        providerConfigs.append(providerModelSelectContainer);

        providerConfigsContainer.replaceWith(providerConfigs);
        providerConfigsContainer = providerConfigs;

        onChange(false);
    };

    config.get(CONFIG_TYPE.AGENT).then((userConfig) => {
        element.append(providerSelect.container, providerConfigsContainer);

        for (const provider of providers) {
            providerSelect.options.add({
                name: provider.title,
                id: provider.id
            });
        }
    });

    return element;
}

function keyValueComponent(opts: {
    title: string;
    value: Record<string, string>;
    onChange: (value: Record<string, string>) => void;
}) {
    const container = document.createElement("div");
    container.classList.add("key-value-form");
    container.innerHTML = `<label>${opts.title}</label>`;

    const keyValuesContainer = document.createElement("div");

    const addKeyValueRow = (value?: { key: string; value: string }) => {
        const row = document.createElement("div");
        row.classList.add("key-value");
        const keyInput = InputText();
        keyInput.input.value = value?.key || "";
        const valueInput = InputText();
        valueInput.input.value = value?.value || "";
        row.append(keyInput.container, valueInput.container);
        keyValuesContainer.append(row);
    };

    Object.entries(opts.value).forEach(([key, value]) => {
        addKeyValueRow({ key, value });
    });

    const addKeyValueButton = Button({
        text: "Add"
    });

    addKeyValueButton.onclick = () => {
        addKeyValueRow();
    };

    container.append(keyValuesContainer, addKeyValueButton);

    return container;
}
