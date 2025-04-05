// services/searchBinServices.js
const SearchBin = require('../models/SearchBin');
const { defaultResponse } = require('../utils/requestHelper');

const createSearchBin = async (req, res, next) => {
    try {
        const { query } = req.body;
        const searchBin = new SearchBin({ query });
        await searchBin.save();
        return defaultResponse(res, [201, 'Search bin created successfully', searchBin]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getAllSearchBins = async (req, res, next) => {
    try {
        const searchBins = await SearchBin.find();
        return defaultResponse(res, [200, 'Search bins retrieved successfully', searchBins]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const deleteSearchBins = async (req, res, next) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            try {
                ids = JSON.parse(JSON.stringify(ids))
            } catch (error) {
                console.log(error   )
                return defaultResponse(res, [400, 'Bad request', 'ids should be an array']);
            }
        }
        const result = await SearchBin.deleteMany({ _id: { $in: ids } });
        return defaultResponse(res, [200, 'Search bins deleted successfully', result]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

module.exports = { createSearchBin, getAllSearchBins, deleteSearchBins };
