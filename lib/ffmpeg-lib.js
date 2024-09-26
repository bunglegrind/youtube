/*jslint node, unordered, devel */

import process from "node:process";
import fs from "./lib/fs-lib.js";
import pq from "./lib/parseq-extended.js";
import cp from "./lib/child-process.js";


function merge({audio, video}) {
    return function requestor(callback) {

        return cp.spawn(
            "ffmpeg",

        );

    };
}


export default Object.freeze({merge});
