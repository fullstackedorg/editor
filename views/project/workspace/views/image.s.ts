import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";

export const imageViewClass = style.createClass("image-container", {
    height: "100%",
    width: "100%",
    overflow: "hidden",
    padding: spacing.m,

    "> img": {
        height: "100%",
        width: "100%",
        objectFit: "contain",
        objectPosition: "top"
    }
});
