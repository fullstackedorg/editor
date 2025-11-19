import style, { CSSProperties } from "style";
import spacing from "@fullstacked/ui/values/spacing.s";

const commonViewStyle: CSSProperties = {
    padding: `${spacing.s}px ${spacing.m}px ${spacing.m}px`,
    "&.project": {
        paddingBottom: 0
    }
};

export const viewClass = style.createClass("view", commonViewStyle);
export const viewScrollableClass = style.createClass(
    "view-scrollable",
    commonViewStyle
);
