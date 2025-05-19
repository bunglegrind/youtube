/*jslint node, unordered, devel */

import process from "node:process";
import fs from "./lib/fs-lib.js";
import pq from "./lib/parseq-extended.js";
import cp from "./lib/child-process.js";
import yt from "./lib/youtube-lib.js";
import ffmpeg from "./lib/ffmpeg-lib.js";

const video = "video.tmp";
const audio = "audio.tmp";

const API_KEY = "";

let output;

// input parsing

const url = process.argv[2];

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

function remove_invalid_chars(str) {
    return str.replace(/[\s?\\\/:|<">*]/g, "-");
}

function is_playlist(url) {
    return url.includes("list");
}

function get_playlistId(url) {
    return url.match(/list=([^&]+)/)[1];
}
function save_playlist(url) {
    return pq.sequence([
        yt.get_playlist_videos({API_KEY, playlistId: get_playlistId(url)}),
        pq.apply_parallel()
    ])
}

const save_video = pq.sequence([
    (
        is_playlist(url)
        ? save_playlist
        : yt.get_basic_info({url})
    ),
    pq.requestorize(function (info) {
        output = remove_invalid_chars(info.videoDetails.title) + ".mkv";

        return output;
    }),

// assure ffmpeg exists

    ffmpeg_exists,

// actual download

    pq.if_else(
        (v) => v,
        pq.sequence([
            pq.parallel([
                yt.download_audio({url, output: audio}),
                yt.download_video({url, output: video})
            ], {throttle: 1}),

// ffmpeg merge

            ffmpeg.merge(() => ({audio, video, output})),

// delete temporary files

            fs.delete_files({filenames: [audio, video]})
        ]),
        yt.download_audiovideo({url, output})
    )
]);


save_video(function (value, reason) {
    if (value === undefined) {
        console.error("ERROR ");
        console.error(reason);
        process.exit(1);
    }
    console.log(value);
});
