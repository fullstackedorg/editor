import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";

export const windAdminDialogClass = style.createClass("win-admin-dialog", {
    display: "flex",
    flexDirection: "column",

    h1: {
        marginBottom: spacing.s
    },

    p: {
        marginBottom: spacing.xs
    },

    button: {
        alignSelf: "flex-end"
    }
});
