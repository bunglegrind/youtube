/*jslint node, unordered, fart */

import ytdl from "@distube/ytdl-core";
import pq from "./parseq-extended.js";
import fs from "node:fs";
import stream from "node:stream";


function download_requestor(cb, {url, output, opt}) {
    let destroyed = false;
    pq.check_callback(cb);
    function callback(value, reason) {
        if (destroyed) {
            return;
        }
        return cb(value, reason);
    }
    const st = stream.pipeline(
        ytdl(url, opt),
        fs.createWriteStream(output),
        function (err) {
            if (err) {
                return callback(
                    undefined,
                    pq.make_reason(
                        "ytdl",
                        "error writing stream",
                        err
                    )
                );
            }
            return callback(true);
        }
    );

    return function cancel() {
        destroyed = true;
        st.destroy();
    };
}

const download = pq.factory_maker(
    pq.try_catcher(download_requestor, "ytdl"),
    "ytdl"
);

const download_audio = ({url, output}) => download(
    {url, output, opt: {quality: "highestaudio"}}
);

const download_video = ({url, output}) => download(
    {url, output, opt: {quality: "highestvideo"}}
);

const download_audiovideo = ({url, output}) => download(
    {url, output, opt: {quality: "highest"}}
);


export default Object.freeze(
    {download_audio, download_video, download_audiovideo}
);
