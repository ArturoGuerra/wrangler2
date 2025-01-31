"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.mockGlobal = exports.mockCaches = exports.mockManifest = exports.mockKV = exports.getEvent = void 0;
const makeServiceWorkerEnv = require('service-worker-mock');
const HASH = '123HASHBROWN';
const getEvent = (request) => {
    const waitUntil = (callback) => __awaiter(void 0, void 0, void 0, function* () {
        yield callback;
    });
    return {
        request,
        waitUntil,
    };
};
exports.getEvent = getEvent;
const store = {
    'key1.123HASHBROWN.txt': 'val1',
    'key1.123HASHBROWN.png': 'val1',
    'index.123HASHBROWN.html': 'index.html',
    'cache.123HASHBROWN.html': 'cache me if you can',
    '测试.123HASHBROWN.html': 'My filename is non-ascii',
    '%not-really-percent-encoded.123HASHBROWN.html': 'browser percent encoded',
    '%2F.123HASHBROWN.html': 'user percent encoded',
    '你好.123HASHBROWN.html': 'I shouldnt be served',
    '%E4%BD%A0%E5%A5%BD.123HASHBROWN.html': 'Im important',
    'nohash.txt': 'no hash but still got some result',
    'sub/blah.123HASHBROWN.png': 'picturedis',
    'sub/index.123HASHBROWN.html': 'picturedis',
    'client.123HASHBROWN': 'important file',
    'client.123HASHBROWN/index.html': 'Im here but serve my big bro above',
    '你好/index.123HASHBROWN.html': 'My path is non-ascii',
};
const mockKV = (store) => {
    return {
        get: (path) => store[path] || null,
    };
};
exports.mockKV = mockKV;
const mockManifest = () => {
    return JSON.stringify({
        'key1.txt': `key1.${HASH}.txt`,
        'key1.png': `key1.${HASH}.png`,
        'cache.html': `cache.${HASH}.html`,
        '测试.html': `测试.${HASH}.html`,
        '你好.html': `你好.${HASH}.html`,
        '%not-really-percent-encoded.html': `%not-really-percent-encoded.${HASH}.html`,
        '%2F.html': `%2F.${HASH}.html`,
        '%E4%BD%A0%E5%A5%BD.html': `%E4%BD%A0%E5%A5%BD.${HASH}.html`,
        'index.html': `index.${HASH}.html`,
        'sub/blah.png': `sub/blah.${HASH}.png`,
        'sub/index.html': `sub/index.${HASH}.html`,
        client: `client.${HASH}`,
        'client/index.html': `client.${HASH}`,
        '你好/index.html': `你好/index.${HASH}.html`,
    });
};
exports.mockManifest = mockManifest;
let cacheStore = new Map();
const mockCaches = () => {
    return {
        default: {
            match(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    let cacheKey = {
                        url: key.url,
                        headers: {},
                    };
                    let response;
                    if (key.headers.has('if-none-match')) {
                        let makeStrongEtag = key.headers.get('if-none-match').replace('W/', '');
                        Reflect.set(cacheKey.headers, 'etag', makeStrongEtag);
                        response = cacheStore.get(JSON.stringify(cacheKey));
                    }
                    else {
                        // if client doesn't send if-none-match, we need to iterate through these keys
                        // and just test the URL
                        const activeCacheKeys = Array.from(cacheStore.keys());
                        for (const cacheStoreKey of activeCacheKeys) {
                            if (JSON.parse(cacheStoreKey).url === key.url) {
                                response = cacheStore.get(cacheStoreKey);
                            }
                        }
                    }
                    // TODO: write test to accomodate for rare scenarios with where range requests accomodate etags
                    if (response && !key.headers.has('if-none-match')) {
                        // this appears overly verbose, but is necessary to document edge cache behavior
                        // The Range request header triggers the response header Content-Range ...
                        const range = key.headers.get('range');
                        if (range) {
                            response.headers.set('content-range', `bytes ${range.split('=').pop()}/${response.headers.get('content-length')}`);
                        }
                        // ... which we are using in this repository to set status 206
                        if (response.headers.has('content-range')) {
                            response.status = 206;
                        }
                        else {
                            response.status = 200;
                        }
                        let etag = response.headers.get('etag');
                        if (etag && !etag.includes('W/')) {
                            response.headers.set('etag', `W/${etag}`);
                        }
                    }
                    return response;
                });
            },
            put(key, val) {
                return __awaiter(this, void 0, void 0, function* () {
                    let headers = new Headers(val.headers);
                    let url = new URL(key.url);
                    let resWithBody = new Response(val.body, { headers, status: 200 });
                    let resNoBody = new Response(null, { headers, status: 304 });
                    let cacheKey = {
                        url: key.url,
                        headers: {
                            etag: `"${url.pathname.replace('/', '')}"`,
                        },
                    };
                    cacheStore.set(JSON.stringify(cacheKey), resNoBody);
                    cacheKey.headers = {};
                    cacheStore.set(JSON.stringify(cacheKey), resWithBody);
                    return;
                });
            },
        },
    };
};
exports.mockCaches = mockCaches;
function mockGlobal() {
    Object.assign(global, makeServiceWorkerEnv());
    Object.assign(global, { __STATIC_CONTENT_MANIFEST: exports.mockManifest() });
    Object.assign(global, { __STATIC_CONTENT: exports.mockKV(store) });
    Object.assign(global, { caches: exports.mockCaches() });
}
exports.mockGlobal = mockGlobal;
const sleep = (milliseconds) => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
};
exports.sleep = sleep;
