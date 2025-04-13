const jwt = require("jsonwebtoken")
const User = require("../models/User");
const {defaultResponse} = require("../utils/requestHelper")

const verifyUserAuthenticated = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization && req.headers.authorization.startsWith("BM_BEARER")
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
                req.user = await User.findOne({_id: decodedData.id})
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
        req.headers.authorization && req.headers.authorization.startsWith("BM_BEARER")
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
    if (req.user.role.toLowerCase() === "admin")
        next()
    else
        return defaultResponse(res, [401, "❌ Not authorized", ""])
}

const verifyUserRole = (roles = ["admin"]) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    console.log(allowedRoles)
    return (req, res, next) => {
        console.log("user: " + req.user)

        if (allowedRoles.map(role => role.toLowerCase()).includes(req.user.role.toLowerCase())) {
            next();
        } else {
            return defaultResponse(res, [401, "❌ Not authorized to access this resource", ""]);
        }
    };
};

module.exports = {verifyUserAuthenticated, verifyUserRoleAdmin, verifyUserAuthenticatedOptional, verifyUserRole}