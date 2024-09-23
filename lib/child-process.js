/*jslint node, unordered */

import cp from "node:child_process";
import pq from "./parseq-extended.js";

const name = "spawn";

function spawn_requestor(callback, {command, args}) {
    pq.check_callback(callback, name);
    const controller = new AbortController();
    let is_called = false;
    function cb(value, reason) {
        if (is_called) {
            return;
        }
        is_called = true;
        return callback(value, reason);
    }

    const opt = Object.create(null);
    opt.signal = controller.signal;
    opt.timeout = 10 * 1000;
    const spawn = cp.spawn(command, args, opt);

    let data = "";
    spawn.stdout.on("data", function (chunk) {
        data += chunk;
    });

    let err = "";
    spawn.stderr.on("data", function (chunk) {
        err += chunk;
    });

    spawn.on("error", function (e) {
        return cb(
            undefined,
            pq.make_reason(name, `Error: ${err}`, e)
        );
    });

    spawn.on("exit", function (ignore, s) {
        if (s) {
            return cb(
                undefined,
                pq.make_reason(name, `Error: ${err} due to signal ${s}`, s)
            );
        }
    });

    spawn.on("close", function (code) {
        if (err) {
            return cb(
                undefined,
                pq.make_reason(
                    name,
                    "errore in output: " + code,
                    err
                )
            );
        }
        return cb(data ?? code);
    });

    return function cancel() {
        is_called = true; //otherwise event error will trigger the callback
        controller.abort();
    };
}


const spawn = pq.factory_maker(pq.try_catcher(spawn_requestor, name), name);


export default Object.freeze({spawn});
