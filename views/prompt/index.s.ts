import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";

export const promptClass = style.createClass("prompt-container", {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s,
    "> button": {
        alignSelf: "flex-end"
    }
});
