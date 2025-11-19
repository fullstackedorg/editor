import style from "style";
import spacing, { maxWidth } from "@fullstacked/ui/values/spacing.s";

export const projectSettingsClass = style.createClass("project-settings", {
    form: {
        width: "100%",
        maxWidth: maxWidth,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: spacing.s,
        paddingTop: spacing.m,
        "> button": {
            alignSelf: "flex-end"
        }
    }
});
