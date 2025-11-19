import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";
import colors from "@fullstacked/ui/values/colors.s";

export const historyClass = style.createClass("history", {
    padding: `0 ${spacing.xs}px`,
    display: "flex",
    gap: spacing.xs,
    borderRight: `1px solid ${colors.gray.main}`,
    height: "100%",
    alignItems: "center",

    "> button:first-child": {
        transform: "rotate(180deg)"
    }
});
