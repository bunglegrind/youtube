/*jslint node, unordered, fart */

import ytdl from "@distube/ytdl-core";
import pq from "./parseq-extended.js";
import fc from "./fetch-requestor.js";
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

const get_basic_info = ({url}) => pq.promise_requestorize(
    () => ytdl.getInfo(url)
);

function get_playlist_videos_requestor(callback, {API_KEY, playlistId}) {
    const videoIds = [];
    const maxResults = 50;

    return pq.sequence([
        pq.do_while(
            pq.sequence([
                pq.requestorize(
                    function (nextPageToken) {
                        const uri = (
                            "https://www.googleapis.com/"
                            + "youtube/v3/playlistItems?"
                            + new URLSearchParams({
                                part: "snippet",
                                playlistId,
                                maxResults: maxResults.toString(),
                                pageToken: nextPageToken,
                                key: API_KEY
                            })
                        );

                        return {uri};
                    },
                    "make url"
                ),
                fc(),
                pq.requestorize(
                    function (data) {
                        if (data.error) {
                            throw new Error(data.error);
                        }
                        const ids = data.items.map(
                            (item) => item.contentDetails.videoId
                        );
                        videoIds.push(...ids);

                        return data.nextPageToken || "";
                    }
                )
            ]),
            {test_condition: (v) => Number(v) > 0, name: "fetch playlist id"}
        ),
        pq.requestorize(() => videoIds, "videoIds")
    ])(callback, "");

}



export default Object.freeze({
    download_audio,
    download_video,
    download_audiovideo,
    get_basic_info,
    get_playlist_videos: pq.factory_maker(get_playlist_videos_requestor)
});
