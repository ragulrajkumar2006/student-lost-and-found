const axios = require("axios");

// Thin wrapper around the Qdrant REST API for the lost_found_items collection.
// Every point uses the MySQL Report_ID as its id, so writing the same report
// again REPLACES the old vector instead of creating a duplicate.

function collectionClient() {
    return axios.create({
        baseURL: `${process.env.QDRANT_URL}/collections/${process.env.QDRANT_COLLECTION}`,
        timeout: 10000
    });
}

// CREATE / REPLACE: insert or overwrite one or more points
async function upsertPoints(points) {
    await collectionClient().put("/points?wait=true", { points });
}

// READ: fetch points by id (optionally including the vector itself)
async function retrievePoints(ids, withVector = false) {
    const response = await collectionClient().post("/points", {
        ids,
        with_payload: true,
        with_vector: withVector
    });
    return response.data.result;
}

// UPDATE: change payload fields (e.g. status) without touching the vector
async function setPayload(id, payload) {
    await collectionClient().post("/points/payload?wait=true", { payload, points: [id] });
}

// DELETE: remove points by id
async function deletePoints(ids) {
    await collectionClient().post("/points/delete?wait=true", { points: ids });
}

// SIMILARITY SEARCH: `query` is either a vector or an existing point id
async function queryPoints({ query, filter, limit = 5, scoreThreshold }) {
    const response = await collectionClient().post("/points/query", {
        query,
        filter,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true
    });
    return response.data.result.points;
}

// Lists every point id in the collection (used when rebuilding the index)
async function listAllIds() {
    const ids = [];
    let offset = null;

    do {
        const response = await collectionClient().post("/points/scroll", {
            limit: 256,
            offset,
            with_payload: false,
            with_vector: false
        });
        ids.push(...response.data.result.points.map((point) => point.id));
        offset = response.data.result.next_page_offset;
    } while (offset !== null && offset !== undefined);

    return ids;
}

async function collectionInfo() {
    const response = await collectionClient().get("");
    return response.data.result;
}

module.exports = {
    upsertPoints,
    retrievePoints,
    setPayload,
    deletePoints,
    queryPoints,
    listAllIds,
    collectionInfo
};
