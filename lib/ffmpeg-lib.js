/*jslint node, unordered, devel */

import process from "node:process";
import fs from "./fs-lib.js";
import pq from "./parseq-extended.js";
import cp from "./child-process.js";


function merge_requestor(callback, {audio, video, output}) {

const args = [
    `-i ${audio}`,
    `-i ${video}`,
    "-y",
    `-c:v copy`,
    `-c:a copy`,
    `${output}`
];

    return cp.spawn({
        command: "ffmpeg",
        args
    })(callback);
}

const merge = pq.factory_maker(
    pq.try_catcher(merge_requestor, "ffmpeg_merge"),
    "ffmpeg_merge"
);


export default Object.freeze({merge});
