import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";
import typography from "@fullstacked/ui/values/typography.s";

export const projectsListStatusClass = style.createClass(
    "projects-list-status",
    {
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,
        ".loader": {
            height: 24,
            width: 24,
            marginTop: 1
        },
        "> div": {
            textAlign: "right",
            fontSize: typography.s,
            gap: spacing.xs,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end"
        }
    }
);
