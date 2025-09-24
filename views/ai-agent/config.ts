import * as ai from "@fullstacked/ai-agent";
import {
    InputSelect,
    InputText,
    InputCheckbox,
    Button,
    Message
} from "@fullstacked/ui";
import config from "../../editor_modules/config";
import { CONFIG_TYPE, AgentProvider } from "../../types";
import { merge } from "immutable";
import { getDefaultAgentProvider } from ".";
import { O } from "ollama/dist/shared/ollama.d792a03f.mjs";

async function mergeConfigsWithAvailableProviders(): Promise<AgentProvider[]> {
    const savedAgentConfig = await config.get(CONFIG_TYPE.AGENT);
    const availableProvider = ai.providers();

    return availableProvider.map((provider) => {
        const savedConfig = savedAgentConfig.find(
            ({ id }) => id === provider.id
        );
        return {
            ...savedConfig,
            ...provider,
            configs: provider.configs.map(
                (c) =>
                    ({
                        ...c,
                        value:
                            savedConfig?.configs?.find(({ id }) => id === c.id)
                                ?.value || c.value
                    }) as any
            )
        };
    });
}

export function createAiAgentConfigurator(configProvider?: string) {
    const element = document.createElement("div");
    element.classList.add("ai-agent-configurator");

    const saveConfigs = () => {
        config.save(CONFIG_TYPE.AGENT, providers);
    };

    const providerSelect = InputSelect({
        label: "Provider"
    });
    let modelSelect: ReturnType<typeof InputSelect>;

    let providerConfigsContainer = document.createElement("div");
    providerConfigsContainer.innerText =
        "Select an agent provider to configure";

    providerSelect.select.onchange = (providerId) => {
        const providerInfos = providers.find(({ id }) => id === providerId);

        const providerConfigs = document.createElement("div");

        let providerModelSelectContainer = document.createElement("div");
        let provider: ReturnType<typeof ai.getProvider>;
        const onChange = async (showWarning = true) => {
            saveConfigs();

            const providerModelSelect = document.createElement("div");

            provider = ai.getProvider(providerInfos);
            let models: string[];
            try {
                models = await provider.models();
            } catch (e) {}

            if (models) {
                modelSelect = InputSelect({
                    label: "Default Model"
                });
                modelSelect.options.add(...models.map((name) => ({ name })));
                modelSelect.select.value = providerInfos.model;

                const defaultCheckbox = document.createElement("div");
                defaultCheckbox.innerHTML = `<label>Use as default agent</label>`;
                const checkbox = InputCheckbox();
                checkbox.input.checked = providerInfos.useDefault;
                defaultCheckbox.append(checkbox.container);

                providerModelSelect.append(
                    modelSelect.container,
                    defaultCheckbox
                );

                modelSelect.select.onchange = () => {
                    providerInfos.model = modelSelect.select.value;
                    saveConfigs();
                };
                checkbox.input.onchange = () => {
                    if (checkbox.input.checked) {
                        providers.forEach((p) => (p.useDefault = false));
                    }
                    providerInfos.useDefault = checkbox.input.checked;
                    saveConfigs();
                };
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

    let providers: Awaited<
        ReturnType<typeof mergeConfigsWithAvailableProviders>
    >;
    mergeConfigsWithAvailableProviders().then(async (p) => {
        providers = p;

        providerSelect.options.add(
            ...providers.map((provider) => ({
                name: provider.title,
                id: provider.id
            }))
        );

        if (configProvider) {
            providerSelect.select.value = configProvider;
        } else {
            getDefaultAgentProvider().then((defaultAgent) => {
                if (!defaultAgent) return;
                providerSelect.select.value = defaultAgent.info.id;
                providerSelect.select.onchange(defaultAgent.info.id);
            });
        }

        element.append(providerSelect.container, providerConfigsContainer);
    });

    return {
        element,
        get current(){
            return {
                provider: providerSelect.select.value,
                model: modelSelect?.select.value
            }
        }
    };
}

function keyValueComponent(opts: {
    title: string;
    value: [string, string][];
    onChange: (value: [string, string][]) => void;
}) {
    if (!Array.isArray(opts.value)) {
        opts.value = [];
    }

    const container = document.createElement("div");
    container.classList.add("key-value-form");
    container.innerHTML = `<label>${opts.title}</label>`;

    const keyValuesContainer = document.createElement("div");

    const addKeyValueRow = (item: [string, string]) => {
        const row = document.createElement("div");
        row.classList.add("key-value");
        const keyInput = InputText();
        keyInput.input.value = item.at(0);
        keyInput.input.onkeyup = () => {
            item[0] = keyInput.input.value;
            opts.onChange(opts.value);
        };
        const valueInput = InputText();
        valueInput.input.value = item.at(1);
        valueInput.input.onkeyup = () => {
            item[1] = valueInput.input.value;
            opts.onChange(opts.value);
        };
        const removeBtn = Button({
            style: "icon-small",
            iconRight: "Close"
        });
        removeBtn.onclick = () => {
            const indexOf = opts.value.indexOf(item);
            opts.value.splice(indexOf, 1);
            row.remove();
            opts.onChange(opts.value);
        };
        row.append(keyInput.container, valueInput.container, removeBtn);
        keyValuesContainer.append(row);
    };

    opts.value.forEach(addKeyValueRow);

    const addKeyValueButton = Button({
        text: "Add"
    });

    addKeyValueButton.onclick = () => {
        const item: [string, string] = ["", ""];
        opts.value.push(item);
        addKeyValueRow(item);
    };

    container.append(keyValuesContainer, addKeyValueButton);

    return container;
}
