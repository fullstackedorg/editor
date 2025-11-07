import style from "style";
import spacing, { maxWidth } from "../../style/spacing.s";
import typography from "../../style/typography.s";

export const aiAgentConfigClass = style.createClass("ai-agent-configurator", {
    width: "100%",
    maxWidth,
    display: "flex",
    flexDirection: "column",
    gap: spacing.s
});

export const aiConfigEmpty = style.createClass("ai-configurator-empty", {
    fontSize: typography.s
});

export const alignColCenterClass = style.createClass("flex-col-center", {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s
});

export const inputCheckboxWrapClass = style.createClass("input-checkbox-wrap", {
    display: "flex",
    flexDirection: "column",
    gap: spacing.xs
});

export const keyValueClass = "key-value";
export const keyValueFormClass = style.createClass("key-value-form", {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",

    "> label": {
        paddingBottom: spacing.xs
    },

    "> div": {
        display: "flex",
        flexDirection: "column",
        gap: spacing.s,
        width: "100%",

        [`.${keyValueClass}`]: {
            display: "flex",
            gap: spacing.s,
            alignItems: "center",

            "&:last-child": {
                paddingBottom: spacing.xs
            }
        }
    }
});
