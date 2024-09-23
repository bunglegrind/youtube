/*jslint node, unordered, fart */

import fs from "node:fs";
import pq from "./parseq-extended.js";


function delete_file_requestor(cb, {filename}) {
    pq.check_callback(cb);
    fs.unlink(filename, function (e) {
        if (e) {
            return cb(
                undefined,
                pq.make_reason(
                    "fs",
                    `Couldn't delete ${filename}`,
                    e
                )
            );
        }
        return cb(true);
    });

}
const delete_file = pq.factory_maker(
    pq.try_catcher(delete_file_requestor, "fs"),
    "fs"
);

const delete_files = ({filenames}) => pq.parallel(filenames.map(
    (filename) => delete_file({filename})
));

export default Object.freeze({delete_files, delete_file});
