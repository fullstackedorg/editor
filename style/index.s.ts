import style from "style";
import spacing from "./spacing.s";

const commonViewStyle = {
    padding: `${spacing.s}px ${spacing.m}px ${spacing.m}px`
};

export const viewClass = style.createClass("view", commonViewStyle);
export const viewScrollableClass = style.createClass(
    "view-scrollable",
    commonViewStyle
);
