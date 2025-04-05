const jwt = require("jsonwebtoken")
const User = require("../models/User");
const {defaultResponse} = require("../utils/requestHelper")

const verifyUserAuthenticated = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization && req.headers.authorization.startsWith("TSS_BEARER")
    ) {
        try {
            token = await req.headers.authorization.split(" ")[1];
            if (!token)
                return defaultResponse(res, [401, "❌ Not authorized, no token", ""])


            // const deniedToken = await Denylist.findOne({ $and: [{ token: token }] });
            // if (deniedToken)
            //     return sendError(res, "❌ Not Authorized, denied token", 401);

            let decodedData;

            // Verify token
            if (token) {
                decodedData = jwt.verify(token, process.env.JWT_SECRET);

                req.user_id = decodedData.id;
                let userHolster = await User.findById(decodedData.id)
                req.user = {
                    ...userHolster["_doc"],
                    password: "TSS_SECRET"
                }
            }
            next();
        } catch (error) {
            return defaultResponse(res, [401, "❌ Not authorized", {error: error.message}])
        }
    } else {
        return defaultResponse(res, [401, "❌ Please login to continue", ""])
    }
};

const verifyUserAuthenticatedOptional = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization && req.headers.authorization.startsWith("TSS_BEARER")
    ) {
        try {
            token = await req.headers.authorization.split(" ")[1];
            if (!token)
                next()


            // const deniedToken = await Denylist.findOne({ $and: [{ token: token }] });
            // if (deniedToken)
            //     return sendError(res, "❌ Not Authorized, denied token", 401);

            let decodedData;

            // Verify token
            if (token) {
                decodedData = jwt.verify(token, process.env.JWT_SECRET);

                req.user_id = decodedData.id;
                let userHolster = await User.findById(decodedData.id)
                req.user = {
                    ...userHolster["_doc"],
                    password: "TSS_SECRET"
                }
            }
            next();
        } catch (error) {
            return defaultResponse(res, [401, "❌ Not authorized", {error: error.message}])
        }
    } else {
        next()
    }
};

const verifyUserRoleAdmin = async (req, res, next) => {
    if (req.user.role === "admin")
        next()
    else
        return defaultResponse(res, [401, "❌ Not authorized", ""])
}

module.exports = {verifyUserAuthenticated, verifyUserRoleAdmin, verifyUserAuthenticatedOptional}