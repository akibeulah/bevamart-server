const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const {defaultResponse} = require("../utils/requestHelper");

const createInventory = async (req, res, next) => {
    try {
        const {product, quantity, description} = req.body;
        const inventory = new Inventory({product, action: "stock_in", quantity, user_id: req.user_id, description});
        await inventory.save();

        const productToUpdate = await Product.findById(product)
        productToUpdate.stock = parseInt(productToUpdate.stock) + parseInt(quantity);
        productToUpdate.save()

        return defaultResponse(res, [200, "Inventory created successfully", inventory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getAllInventoryByProduct = async (req, res, next) => {
    try {
        const {productId} = req.params;
        const inventoryEntries = await Inventory.find({product: productId, active: true});

        // Initialize amountInStock as a number
        let amountInStock = 0;

        // Accumulate the quantity values
        inventoryEntries.forEach(entry => {
            amountInStock += entry.action === "stock_out" ? (-1 * entry.quantity) : entry.quantity;
        });

        return defaultResponse(res, [200, "Inventory retrieved successfully", {
            amountInStock: amountInStock,
            inventoryEntries
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getInventoryById = async (req, res, next) => {
    try {
        const {inventoryId} = req.params;
        const inventory = await Inventory.findById(inventoryId);
        if (!inventory) {
            return defaultResponse(res, [404, "Inventory not found", null]);
        }
        return defaultResponse(res, [200, "Inventory retrieved successfully", inventory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const deleteInventory = async (req, res, next) => {
    try {
        const {inventoryId} = req.params;
        const deletedInventory = await Inventory.findByIdAndUpdate(
            inventoryId,
            {$set: {active: false}}, // Set the 'active' field to false
            {new: true} // Return the updated document
        );
        const product = await Product.findById(deletedInventory.product)
        product.stock = parseInt(productToUpdate.stock) - parseInt(deletedInventory.quantity);
        product.save()
        return defaultResponse(res, [200, "Inventory deleted successfully", deletedInventory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const inventoryOverview = async (req, res, next) => {
    try {
        const perPage = req.query.perPage || 20;
        const page = req.query.page || 1;
        let statusFilter = req.query.statusFilter || "all"

        // Calculate skip value for pagination
        const skip = (page - 1) * perPage;

        statusFilter = Array.isArray(statusFilter) ? statusFilter[0] : statusFilter
        let inventoryData

        if (statusFilter === "all") {
            inventoryData = await Inventory.find()
                .populate('product')
                .skip((page - 1) * perPage)
                .limit(perPage);
        } else {
            inventoryData = await Inventory.find()
                .populate('product')
                .populate('user_id')
                .skip((page - 1) * perPage)
                .limit(perPage);

            if (statusFilter === "lowStocked")
                inventoryData = inventoryData.filter(i => parseInt(i.product.lowAlert) >= parseInt(i.product.stock));
            else if (statusFilter === "stocked")
                inventoryData = inventoryData.filter(i => parseInt(i.product.lowAlert) < parseInt(i.product.stock));
        }


        const inventoryCount = await Inventory.countDocuments();
        const totalPages = Math.ceil(inventoryCount / perPage);

        const products = await Product.find()
        let lowStock = 0, stocked = 0

        for (let product of products) {
            if (product.lowAlert <= product.stock)
                lowStock++
            else
                stocked++
        }
        // Return paginated response
        return defaultResponse(res, [200, "Inventory Overview fetched", {
            perPage,
            page,
            totalPages,
            lowStockItems: lowStock,
            stockedItems: stocked,
            inventoryData,
            inventoryCount
        }]);
    } catch (error) {
        console.error(error);
        throw new Error('Error fetching inventory overview');
    }
};

module.exports = {
    createInventory,
    getAllInventoryByProduct,
    getInventoryById,
    deleteInventory,
    inventoryOverview
};
