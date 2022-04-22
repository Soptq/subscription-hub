import React, { useContext } from "react";
import { Context } from "../Context";

export default function useAppContext() {
    const { context, setContext } = useContext(Context);

    return {context, setContext};
}