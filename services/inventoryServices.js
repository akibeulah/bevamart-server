const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const {defaultResponse} = require("../utils/requestHelper");
const ProductVariant = require("../models/ProductVariant");

const createInventory = async (req, res, next) => {
    try {
        const {product, quantity, description, variant} = req.body;

        const productToUpdate = await Product.findById(product)
        if (!productToUpdate)
            return defaultResponse(res, [400, "Product does not exist", null]);

        if (productToUpdate.hasVariants && !variant)
            return defaultResponse(res, [400, "Product inventory update requires variant", null]);

        let variantData
        if (variant)
        {
            variantData = await ProductVariant.findById(variant)
            if (!variantData)
                return defaultResponse(res, [400, "Product variant does not exist", inventory]);
        }


        const inventory = new Inventory({product, action: "stock_in", quantity, user_id: req.user_id, description, ...(variant && {variant})});
        await inventory.save();

        if (variantData) {
            variantData.stock = parseInt(variantData.stock) + parseInt(quantity);
            await variantData.save();

        } else {
            productToUpdate.stock = parseInt(productToUpdate.stock) + parseInt(quantity);
            await productToUpdate.save()
        }

        return defaultResponse(res, [200, "Inventory created successfully", inventory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getAllInventoryByProduct = async (req, res, next) => {
    try {
        const {productId} = req.params;
        const product = await Product.findById(productId);

        if (!product)
            return defaultResponse(res, [400, "Product not found", null]);

        const inventoryEntries = await Inventory.find({product: productId, active: true});

        let amountInStock = 0;
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

const getAllInventoryByProductVariant = async (req, res, next) => {
    try {
        const {variantId} = req.params;
        const inventoryEntries = await Inventory.find({variant: variantId, active: true});

        let amountInStock = 0;

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
        const inventory = await Inventory.findById(inventoryId)
            .populate('product')
            .populate('variant')
            .populate('user_id');

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
        const { inventoryId } = req.params;
        const deletedInventory = await Inventory.findByIdAndUpdate(
            inventoryId,
            { $set: { active: false } },
            { new: true }
        );

        if (!deletedInventory) {
            return defaultResponse(res, [404, "Inventory not found", null]);
        }

        // Handle inventory quantity adjustment
        if (deletedInventory.variant) {
            // Update variant stock
            const variantData = await ProductVariant.findById(deletedInventory.variant);
            if (variantData) {
                // Only subtract if it was a stock_in entry
                if (deletedInventory.action === "stock_in") {
                    variantData.stock = Math.max(0, parseInt(variantData.stock) - parseInt(deletedInventory.quantity));
                } else {
                    // Add back if it was a stock_out entry
                    variantData.stock = parseInt(variantData.stock) + parseInt(deletedInventory.quantity);
                }
                await variantData.save();
            }
        } else {
            // Update product stock
            const product = await Product.findById(deletedInventory.product);
            if (product) {
                // Only subtract if it was a stock_in entry
                if (deletedInventory.action === "stock_in") {
                    product.stock = Math.max(0, parseInt(product.stock) - parseInt(deletedInventory.quantity));
                } else {
                    // Add back if it was a stock_out entry
                    product.stock = parseInt(product.stock) + parseInt(deletedInventory.quantity);
                }
                await product.save();
            }
        }

        return defaultResponse(res, [200, "Inventory deleted successfully", deletedInventory]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const inventoryOverview = async (req, res, next) => {
    try {
        const perPage = parseInt(req.query.perPage) || 20;
        const page = parseInt(req.query.page) || 1;
        let statusFilter = req.query.statusFilter || "all";

        // Calculate skip value for pagination
        const skip = (page - 1) * perPage;

        statusFilter = Array.isArray(statusFilter) ? statusFilter[0] : statusFilter;

        // Base query
        const baseQuery = { active: true };
        const aggregateQuery = [];

        // Set up lookups for products, variants and users
        aggregateQuery.push(
            { $match: baseQuery },
            { $skip: skip },
            { $limit: perPage },
            {
                $lookup: {
                    from: 'products',
                    localField: 'product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' }
        );

        // Optional lookup for variants when they exist
        aggregateQuery.push({
            $lookup: {
                from: 'productvariants',
                localField: 'variant',
                foreignField: '_id',
                as: 'variant'
            }
        });

        // Handle the variant field (might be empty array)
        aggregateQuery.push({
            $addFields: {
                variant: { $arrayElemAt: ['$variant', 0] }
            }
        });

        // Execute aggregation
        let inventoryData = await Inventory.aggregate(aggregateQuery);

        // Apply status filters after aggregation if needed
        if (statusFilter !== "all") {
            // For variant items
            const variantItems = inventoryData.filter(item => item.variant);
            if (statusFilter === "lowStocked") {
                inventoryData = inventoryData.filter(item => {
                    if (item.variant) {
                        return parseInt(item.variant.lowAlert) >= parseInt(item.variant.stock);
                    } else {
                        return parseInt(item.product.lowAlert) >= parseInt(item.product.stock);
                    }
                });
            } else if (statusFilter === "stocked") {
                inventoryData = inventoryData.filter(item => {
                    if (item.variant) {
                        return parseInt(item.variant.lowAlert) < parseInt(item.variant.stock);
                    } else {
                        return parseInt(item.product.lowAlert) < parseInt(item.product.stock);
                    }
                });
            }
        }

        // Count total inventory records
        const inventoryCount = await Inventory.countDocuments(baseQuery);
        const totalPages = Math.ceil(inventoryCount / perPage);

        // Get stock status counts
        const products = await Product.find();
        const variants = await ProductVariant.find();

        let lowStock = 0, stocked = 0;

        // Count product stock status
        for (let product of products) {
            if (parseInt(product.lowAlert) >= parseInt(product.stock)) {
                lowStock++;
            } else {
                stocked++;
            }
        }

        // Count variant stock status
        for (let variant of variants) {
            if (parseInt(variant.lowAlert) >= parseInt(variant.stock)) {
                lowStock++;
            } else {
                stocked++;
            }
        }

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
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

module.exports = {
    createInventory,
    getAllInventoryByProduct,
    getInventoryById,
    deleteInventory,
    inventoryOverview,
    getAllInventoryByProductVariant
};
