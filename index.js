/*jslint node, unordered, devel */

import process from "node:process";
import fs from "./lib/fs-lib.js";
import pq from "./lib/parseq-extended.js";
import cp from "./lib/child-process.js";
import yt from "./lib/youtube-lib.js";
import ffmpeg from "./lib/ffmpeg-lib.js";

const video = "video.tmp";
const audio = "audio.tmp";

// input parsing

const url = process.argv[2];
const output = process.argv[3] ?? "output.mkv";

const where = (
    process.platform !== "win32"
    ? "whereis"
    : "where"
);

const ffmpeg_exists = pq.sequence([
    cp.spawn({command: where, args: ["ffmpeg"]}),
    pq.if_else(
        (v) => v.startsWith("INFO") || v.endsWith(":"),
        pq.constant(false),
        pq.constant(true)
    )
]);



pq.sequence([

// assure ffmpeg exists

    ffmpeg_exists,

// actual download

    pq.if_else(
        (v) => v,
        pq.sequence([
            pq.parallel([
                yt.download_audio({url, output: audio}),
                yt.download_video({url, output: video})
            ],[], 0, undefined, 1),

// ffmpeg merge

            ffmpeg.merge({audio, video, output}),

// delete temporary files

            fs.delete_files({filenames: [audio, video]})
        ]),
        yt.download_audiovideo({url, output})
    )
])(function (value, reason) {
    if (value === undefined) {
        console.error("ERROR ");
        console.error(reason);
        process.exit(1);
    }
    console.log(value);
});
