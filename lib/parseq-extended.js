/*jslint
    unordered
*/
/*global
    setTimeout, clearTimeout
*/
/*property
    adapters, apply_fallback, apply_parallel, apply_parallel_object, apply_race,
    assign, catch, check_callback, check_requestors, constant, create, default,
    delay, do_nothing, do_while, dynamic_default_import, dynamic_import,
    evidence, factory_maker, fallback, fill, forEach, freeze, if_else, isArray,
    keys, length, make_reason, make_requestor_factory, map, name, obj_factories,
    optional_array, optional_object, optional_requestor_factory, parallel,
    parallel_merge, parallel_object, persist, promise_requestorize, race,
    reason, reduce, requestorize, sequence, slice, stringify, tap,
    test_condition, then, throttle, time_limit, time_option, try_catcher, value,
    when, wrap_reason
*/

import parseq from "./parseq.js";

function json_stringify(value) {
    return JSON.stringify(
        value,
        (ignore, v) => (
            v === undefined
            ? "undefined"
            : v
        )
    );
}

function try_catcher(requestor, name = "try-catcher") {
    return function (callback, value) {
        try {
            return requestor(callback, value);
        } catch (e) {
            return callback(
                undefined,
                parseq.make_reason(
                    name,
                    (
                        `caught requestor error `
                        + `${json_stringify(value).slice(0, 200)}`
                    ),
                    e
                )
            );
        }
    };
}

function check_unary(f, name) {
    if (typeof f !== "function" || f.length > 1) {
        throw parseq.make_reason(
            name,
            "Not a unary function",
            f
        );
    }
}

function requestorize(unary, name = ".") {
    name = name + ".requestorize";
    check_unary(unary, name);
    return function delay_requestor(callback, v) {
        parseq.check_callback(callback, name);
        const id = setTimeout(function (v) {
            let result;
            try {
                result = unary(v);
            } catch (error) {
                return callback(
                    undefined,
                    parseq.make_reason(
                        name,
                        (
                            `caught error in ${name} with value `
                            + `${json_stringify(v).slice(0, 200)}`
                        ),
                        error
                    )
                );
            }
            if (result === undefined) {
                return callback(
                    undefined,
                    parseq.make_reason(
                        name,
                        "unary function returned undefined",
                        v
                    )
                );
            }
            return callback(result);
        }, 0, v);

        return function () {
            clearTimeout(id);
        };
    };
}

function delay(requestor, ms, name = "delay") {
    return try_catcher(function (cb, v) {
        const id = setTimeout(requestor, ms, cb, v);

        return function () {
            clearTimeout(id);
        };
    }, name);
}

const do_nothing = requestorize((v) => v, "do_nothing");
const constant = (c) => requestorize(() => c, `constant ${json_stringify(c)}`);

function if_else(condition, requestor_if, requestor_else, name = "if_else") {
    check_unary(condition, name);
    parseq.check_requestors([requestor_if, requestor_else], name);

    return function (callback, value) {
        parseq.check_callback(callback, name);
        if (condition(value)) {
            return requestor_if(callback, value);
        }
        return requestor_else(callback, value);
    };
}

function when(condition, requestor, name = "when") {
    return if_else(condition, requestor, do_nothing, name);
}

function wrap_reason(requestor, name = "wrap_reason") {
    parseq.check_requestors([requestor]);

    return function (callback, value) {
        parseq.check_callback(callback, name);
        return requestor(function (value, reason) {
            return callback({value, reason});
        }, value);
    };
}

function apply_race(
    requestor_factory,
    options = {name: "apply_race"}
) {
    const {time_limit, throttle, name} = options;
    return function (callback, value) {
        if (!Array.isArray(value)) {
            return callback(undefined, parseq.make_reason(
                name,
                "Value is not an array",
                value
            ));
        }
        parseq.check_callback(callback, name);
        return try_catcher(parseq.race(
            value.map(requestor_factory),
            time_limit,
            throttle
        ), name)(callback);
    };
}

function apply_fallback(
    requestor_factory,
    options = {name: "apply_fallback"}
) {
    const {time_limit, name} = options;
    return function (callback, value) {
        if (!Array.isArray(value)) {
            return callback(undefined, parseq.make_reason(
                name,
                "Value is not an array",
                value
            ));
        }
        parseq.check_callback(callback, name);
        return try_catcher(parseq.fallback(
            value.map(requestor_factory),
            time_limit
        ), name)(callback);
    };
}

function apply_parallel(
    requestor_factory,
    options = {name: "apply_parallel"}
) {
    const {
        optional_requestor_factory,
        time_limit,
        time_option,
        throttle,
        name
    } = options;
    return function (callback, value) {
        if (!Array.isArray(value)) {
            return callback(undefined, parseq.make_reason(
                name,
                "Value is not an array",
                value
            ));
        }
        parseq.check_callback(callback, name);
        return try_catcher(parseq.parallel(
            value.map(requestor_factory),
            (
                typeof optional_requestor_factory === "function"
                ? value.map(optional_requestor_factory)
                : []
            ),
            time_limit,
            time_option,
            throttle
        ), name)(callback);
    };
}

function apply_parallel_object(
    requestor_factory,
    options = {name: "apply_parallel_object"}
) {
    const {
        time_limit,
        time_option,
        throttle,
        name
    } = options;
    return try_catcher(function (callback, value) {
        if (typeof value !== "object") {
            return callback(undefined, parseq.make_reason(
                name,
                "Value is not an object",
                value
            ));
        }
        parseq.check_callback(callback, name);
        const keys = Object.keys(value);
        const required_obj_requestor = Object.create(null);
        keys.forEach(function (key) {
            required_obj_requestor[key] = requestor_factory(value[key]);
        });
        return parseq.parallel_object(
            required_obj_requestor,
            undefined,
            time_limit,
            time_option,
            throttle
        )(callback);
    }, name);
}

function parallel_merge(
    obj,
    options = {name: "parallel_merge"}
) {
    const {
        optional_object,
        time_limit,
        time_option,
        throttle,
        name
    } = options;
    if (typeof obj !== "object") {
        throw parseq.make_reason(
            name,
            "obj is not an object",
            obj
        );
    }
    return function parallel_merge_requestor(callback, value) {
        parseq.check_callback(callback, name);
        return parseq.sequence([
            parseq.parallel_object(
                obj,
                optional_object,
                time_limit,
                time_option,
                throttle
            ),
            requestorize(function (to_merge) {
                return Object.assign(
                    Object.create(null),
                    value,
                    to_merge
                );
            })
        ])(callback, value);
    };
}

const is_thunk = (f) => typeof f === "function" && !f.length;
const is_promise = (p) => typeof p?.then === "function";

function promise_requestorize(
    promise_thunk,
    name = "executing promise",
    cancel = undefined
) {
    if (!is_thunk(promise_thunk)) {
        throw parseq.make_reason(
            name,
            `Not a thunk when ${name}`,
            promise_thunk
        );
    }

    return function (callback) {
        parseq.check_callback(callback, name);
        let is_called = false;
        function promise_callback(value, reason) {
            if (!is_called) {
                is_called = true;
                if (value === undefined) {
                    return callback(
                        undefined,

// first callback call: promise has thrown

                        parseq.make_reason(
                            "promise_requestorize",
                            `Failed when ${name}`,
                            reason
                        )
                    );
                }
                return callback(value);
            }

// second callback call: callback has thrown

            throw parseq.make_reason(
                name,
                `Callback failed when ${name}`,
                reason
            );
        }
        const promise = promise_thunk();
        if (!is_promise(promise)) {
            return promise_callback(
                undefined,
                parseq.make_reason(
                    name,
                    `Not a promise when ${name}`,
                    promise
                )
            );
        }
        promise.then(promise_callback).catch(function (e) {

// at this point we still don't know if the promise or the callback has thrown

            promise_callback(
                undefined,
                e
            );
        });
        if (typeof cancel === "function") {
            return cancel;
        }
    };
}

function dynamic_import(url) {
    return promise_requestorize(function () {
        return import(url);
    }, `importing ${url}`);
}

function dynamic_default_import(url) {
    return parseq.sequence([
        dynamic_import(url),
        requestorize((m) => m.default)
    ]);
}

function factory_maker(requestor, name = "factory") {
    parseq.check_requestors([requestor], name);

// the adapter combines the online value passed to the requestor with the
// closure/context in which the factory is executed
// its return value is passed to the requestor

    return function factory(adapter) {

// a default adapter is provided in order to manage the most common cases

        function default_adapter(precomputed) {
            return function (value) {

// default: both values are object, so we give the requestor their merge

                if (
                    typeof precomputed === "object"
                    && !Array.isArray(precomputed)
                ) {
                    return Object.assign(
                        Object.create(null),
                        precomputed,
                        value
                    );
                }

// otherwise, default behavior is to provide only the precomputed value
// in order to have a simple make_requestor_factory unless it's nil

                return precomputed ?? value;
            };
        }

        if (typeof adapter !== "function") {
            adapter = default_adapter(adapter);
        }
        return parseq.sequence([
            requestorize(adapter),
            requestor
        ]);
    };
}

function make_requestor_factory(unary) {
    return factory_maker(requestorize(unary));
}

function tap(requestor) {
    return function (cb, value) {
        return requestor(function (v, reason) {
            if (v === undefined) {
                return cb(undefined, reason);
            }
            return cb(value);
        }, value);
    };
}

function reduce(
    reducer,
    initial_value,
    requestor_array,
    throttle
) {
    // throttle = throttle || requestor_array.length;
    // let i = 0;
    // let acc = initial_value;
    // let requestors = [];

    // while (i * throttle < requestor_array.length) {
    //     requestors = requestors.concat([
    //         parseq.parallel(
    //             requestor_array.slice(i * throttle, (i + 1) * throttle)
    //         ),
    //         requestorize(function (array) {
    //             acc = array.reduce(reducer, acc);
    //             return acc;
    //         })
    //     ]);

    //     i += 1;
    // };
    // requestors.push(do_nothing);
    // return parseq.sequence(requestors);

    throttle = throttle || requestor_array.length;
    return parseq.sequence([
        parseq.parallel(requestor_array.slice(0, throttle)),
        requestorize(function (array) {
            return array.reduce(reducer, initial_value);
        }),
        if_else(
            () => throttle >= requestor_array.length,
            do_nothing,
            (callback, value) => reduce(
                reducer,
                value,
                requestor_array.slice(throttle),
                throttle
            )(callback, value)
        )
    ]);
}

function do_while(
    requestor,
    {test_condition, name}
) {
    return parseq.sequence([
        requestor,
        if_else(
            test_condition,
            (c, v) => do_while(requestor, {test_condition, name})(c, v),
            do_nothing,
            name
        )
    ]);
}

function persist(
    requestor,
    tentatives,
    time_delay = 0,
    time_limit = undefined
) {
    const delay_requestor = delay(requestor, time_delay);
    return parseq.fallback(
        [
            requestor,
            ...(new Array(tentatives - 1)).fill(delay_requestor)
        ],
        time_limit
    );
}

function sequence(requestor_array, options = {}) {
    return parseq.sequence(requestor_array, options?.time_limit, options?.name);
}

function parallel(
    required_array,
    options = {}
) {
    return parseq.parallel(
        required_array,
        options?.optional_array,
        options?.time_limit,
        options?.time_option,
        options?.throttle,
        options?.name
    );
}

function parallel_object(
    required_object,
    options = {}
) {
    return parseq.parallel_object(
        required_object,
        options?.optional_object,
        options?.time_limit,
        options?.time_option,
        options?.throttle,
        options?.name
    );
}

function fallback(requestor_array, options = {}) {
    return parseq.fallback(
        requestor_array,
        options?.time_limit,
        options?.name
    );
}

function race(requestor_array, options = {}) {
    return parseq.race(
        requestor_array,
        options?.time_limit,
        options?.throttle,
        options?.name
    );
}

export default Object.freeze({
    sequence,
    parallel,
    parallel_object,
    fallback,
    race,
    make_reason: parseq.make_reason,
    check_callback: parseq.check_callback,
    wrap_reason,
    constant,
    requestorize,
    make_requestor_factory,
    promise_requestorize,
    do_nothing,
    when,
    if_else,
    apply_race,
    apply_fallback,
    apply_parallel,
    apply_parallel_object,
    dynamic_default_import,
    dynamic_import,
    delay,
    factory_maker,
    parallel_merge,
    try_catcher,
    tap,
    reduce,
    persist,
    do_while
});
