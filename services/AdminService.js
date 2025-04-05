const User = require("../models/User");
const Order = require("../models/Order");
const {defaultResponse} = require("../utils/requestHelper");
const bcrypt = require('bcrypt');
const {capitalize} = require("../utils/utils");
const AddressBook = require("../models/AddressBook");

// Service to create a new admin user
const newAdminUser = async (req, res, next) => {
    try {
        const {username, email, first_name, last_name, password} = req.body;

        const newUser = new User({
            username,
            email,
            first_name,
            last_name,
            password,
            accepts_marketing: true,
            role: 'admin'
        });

        await newUser.save();
        return defaultResponse(res, [201, "Admin user created successfully", newUser]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

// Service to lock an admin user account
const lockAdminUserAccount = async (req, res, next) => {
    try {
        const {userId} = req.params;
        const user = await User.findById(userId);

        if (!user || user.role !== 'admin') {
            return defaultResponse(res, [404, "Admin user not found", null]);
        }

        if (user.state === "enabled") {
            user.state = 'disabled';

            await user.save();
            return defaultResponse(res, [200, "Admin user account locked", user]);
        } else if (user.state === "disabled") {
            user.state = 'enabled';

            await user.save();
            return defaultResponse(res, [200, "Admin user account unlocked", user]);
        }
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

// Service to update admin user details (all except password)
const updateAdminUserDetails = async (req, res, next) => {
    try {
        const {userId} = req.params;
        const updates = req.body;

        const user = await User.findByIdAndUpdate(userId, updates, {new: true});

        if (!user || user.role !== 'admin') {
            return defaultResponse(res, [404, "Admin user not found", null]);
        }

        return defaultResponse(res, [200, "Admin user details updated", user]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

// Service to delete an admin user
const deleteAdminUser = async (req, res, next) => {
    try {
        const {userId} = req.params;
        const user = await User.findById(userId);

        if (!user || user.role !== 'admin') {
            return defaultResponse(res, [404, "Admin user not found", null]);
        }

        user.state = 'deleted';
        await user.save();

        return defaultResponse(res, [200, "Admin user deleted", user]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

// Service to get all admin users with pagination
const getAllAdminUsers = async (req, res, next) => {
        try {
            const perPage = parseInt(req.query.perPage) || 20;
            const page = parseInt(req.query.page) || 1;

            const users = await User.find({role: 'admin', state: {$in: ['enabled', 'disabled']}})
                .skip((page - 1) * perPage)
                .limit(perPage);

            const totalUsersCount = await User.countDocuments({role: 'admin', state: {$in: ['enabled', 'disabled']}});
            const totalPages = Math.ceil(totalUsersCount / perPage);

            return defaultResponse(res, [200, "Admin users retrieved successfully", {
                page,
                perPage,
                totalPages,
                data: users
            }]);
        } catch
            (error) {
            console.error(error);
            return defaultResponse(res, [500, "Internal server error", error]);
        }
    }
;

// Service to reset admin password
const resetAdminPassword = async (req, res, next) => {
    try {
        const {userId} = req.params;
        const {newPassword} = req.body;

        const user = await User.findById(userId);

        if (!user || user.role !== 'admin') {
            return defaultResponse(res, [404, "Admin user not found", null]);
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        return defaultResponse(res, [200, "Admin password reset successfully", user]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

// Service to get all customers with pagination and filters
const getAllCustomers = async (req, res, next) => {
    try {
        const perPage = parseInt(req.query.perPage) || 20;
        const page = parseInt(req.query.page) || 1;
        const {isEmailVerified, accepts_marketing} = req.query;

        let query = {role: 'customer'};
        if (isEmailVerified) query.isEmailVerified = isEmailVerified === 'true';
        if (accepts_marketing) query.accepts_marketing = accepts_marketing === 'true';

        const users = await User.find(query)
            .skip((page - 1) * perPage)
            .limit(perPage)
            .lean();

        const totalUsersCount = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsersCount / perPage);
        const parsedUsers = await Promise.all(users.map(async user => {
                const phoneNumbers = await AddressBook.find({owner: user._id}, 'phone_number').lean()
                return {
                    ...user,
                    phone_numbers: phoneNumbers.map(ab => ab.phone_number),
                    numberOfOrders: await Order.countDocuments({user_id: user._id})
                }
            }
        ));

        return defaultResponse(res, [200, "Customers retrieved successfully", {
            page,
            perPage,
            totalPages,
            data: parsedUsers
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

// Service to lock a customer account
const lockCustomerAccount = async (req, res, next) => {
    try {
        const {userId} = req.params;
        const user = await User.findById(userId);

        if (!user || user.role !== 'customer') {
            return defaultResponse(res, [404, "Customer not found", null]);
        }

        if (user.state === "enabled") {
            user.state = 'disabled';

            await user.save();
            return defaultResponse(res, [200, "Customer account locked", user]);
        } else if (user.state === "disabled") {
            user.state = 'enabled';

            await user.save();
            return defaultResponse(res, [200, "Customer account unlocked", user]);
        }
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getCustomerOverview = async (req, res, next) => {
    try {
        // Aggregate orders to count the number of orders per user
        const orderCounts = await Order.aggregate([
            {
                $group: {
                    _id: "$user_id",
                    numberOfOrders: {$sum: 1}
                }
            },
            {
                $sort: {
                    numberOfOrders: -1
                }
            }
        ]);

        if (orderCounts.length === 0) {
            throw new Error("No orders found");
        }

        // Get user with most orders
        const userWithMostOrders = await User.findById(orderCounts[0]._id);

        // Get user with least orders
        const userWithLeastOrders = await User.findById(orderCounts[orderCounts.length - 1]._id);

        return defaultResponse(res, [200, {
            userWithMostOrders: {
                user: userWithMostOrders,
                numberOfOrders: orderCounts[0].numberOfOrders
            },
            userWithLeastOrders: {
                user: userWithLeastOrders,
                numberOfOrders: orderCounts[orderCounts.length - 1].numberOfOrders
            }
        }, "User Overview Returned"])
    } catch (error) {
        console.error("Error fetching users with most and least orders:", error);
        throw error;
    }
}

module.exports = {
    newAdminUser,
    lockAdminUserAccount,
    updateAdminUserDetails,
    deleteAdminUser,
    getAllAdminUsers,
    resetAdminPassword,
    getAllCustomers,
    lockCustomerAccount,
    getCustomerOverview
};
