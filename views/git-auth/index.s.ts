import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";

export const gitAuthClass = style.createClass("git-auth", {
    h3: {
        paddingBottom: spacing.m
    },
    p: {
        paddingBottom: spacing.m
    },

    form: {
        display: "flex",
        flexDirection: "column",
        gap: spacing.s,

        "> div:last-child": {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        }
    }
});
