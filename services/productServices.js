const Inventory = require("../models/Inventory");
const WishList = require("../models/WishListItem");
const Product = require("../models/Product");
const {defaultResponse} = require("../utils/requestHelper");
const Order = require("../models/Order");
const CartItem = require("../models/CartItem");
const Category = require("../models/Category");
const Type = require("../models/Type");

const createProduct = async (req, res, next) => {
    try {
        const {
            name, brand, productImages, description, price,
            amount, unit, stock, tags, status,
            projectHighlights,
            skinConcern,
            skinType,
            productsBestUsedWith,
            pregnancySafe,
            howToUse,
            ingredientsList,
            shippingReturns,
            lowAlert
        } = req.body;

        const existingProductSlugCheck = await Product.findOne({name: name, brand: brand});
        if (existingProductSlugCheck)
            return defaultResponse(res, [400, "Product with name - brand combination already exists", ""]);

        // Create the product
        const product = new Product({
            name,
            brand,
            productImages,
            description,
            price: price * 100,
            amount,
            unit,
            stock,
            category: req.category._id,
            tags,
            // type: req.type._id,
            projectHighlights,
            skinConcern,
            skinType,
            productsBestUsedWith,
            pregnancySafe,
            howToUse,
            ingredientsList,
            shippingReturns,
            lowAlert,
            status: status || 'active'
        });

        // Save the product
        await product.save();

        // Create inventory entry if stock is greater than 0
        if (stock > 0) {
            const stockIn = new Inventory({
                product: product._id,
                action: "stock_in",
                quantity: stock,
                user_id: req.user_id,
                description: "Stock In with creation of product"
            });
            await stockIn.save();
        }

        // Fetch inventory entries associated with the product
        const inventoryEntries = await Inventory.find({product: product._id});

        // Construct response object with product details and associated inventory
        const productResponse = {
            ...product.toObject(), // Convert product document to plain JavaScript object
            inventory: inventoryEntries
        };

        // Return success response with product details and associated inventory
        return defaultResponse(res, [200, "Product created successfully", productResponse]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const updateProduct = async (req, res, next) => {
    try {
        const {
            name, brand, productImages, description, price, amount, unit,
            tags, status, lowAlert, category, type, projectHighlights,
            skinConcern, skinType, productsBestUsedWith, pregnancySafe,
            howToUse, ingredientsList, shippingReturns
        } = req.body;

        const existingProductSlugCheck = await Product.find({name: name, brand: brand});
        if (existingProductSlugCheck.length > 0 && (req.product._id.toString() !== existingProductSlugCheck[0]._id.toString()))
            return defaultResponse(res, [400, "Product with name - brand combination already exists", ""]);

        let cleanedProductImages = [];
        if (Array.isArray(productImages))
            cleanedProductImages = productImages;
        else {
            try {
                cleanedProductImages = JSON.parse(productImages);
            } catch (error) {
                console.log(error);
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(req.product._id, {
            name,
            brand,
            productImages: cleanedProductImages,
            description,
            price,
            amount,
            unit,
            tags,
            status,
            lowAlert,
            category,
            type,
            projectHighlights,
            skinConcern,
            skinType,
            productsBestUsedWith,
            pregnancySafe,
            howToUse,
            ingredientsList,
            shippingReturns
        }, {new: true});

        return defaultResponse(res, [200, "Product updated successfully", updatedProduct]);
    } catch (error) {
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getProductsOverview = async (req, res, next) => {
    try {
        const newestProduct = await Product.findOne({}).sort({createdAt: -1}).limit(1);
        const mostViewedProduct = await Product.find({}).sort({views: -1}).limit(5);
        const leastPerformingProduct = await Product.find({}).sort({views: 1}).limit(1);

        const cartItems = await CartItem.find({});
        const productCounts = new Map();

        cartItems.forEach(item => {
            const productId = item.product.toString();
            productCounts.set(productId, (productCounts.get(productId) || 0) + 1);
        });

        const topPerformingProductId = [...productCounts.keys()].reduce((a, b) => productCounts.get(a) > productCounts.get(b) ? a : b);
        const topPerformingProduct = await Product.findById(topPerformingProductId);

        return defaultResponse(res, [200, "Products overview retrieved successfully", {
            newestProduct,
            mostViewedProduct,
            topPerformingProduct,
            leastPerformingProduct
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getAllProducts = async (req, res, next) => {
    try {
        const perPage = parseInt(req.query.perPage) || 20; // Default to 20 products per page
        const page = parseInt(req.query.page) || 1; // Default to the first page
        const filter = req.query.filter[0] || 'all'; // Default filter

        let query = {};

        if (filter === 'active') {
            query.status = 'active';
        } else if (filter === 'archive') {
            query.status = 'archive';
        }

        // Perform pagination
        const products = await Product.find(query)
            .skip((page - 1) * perPage)
            .limit(perPage);

        // Fetch inventory quantities for each product
        const productsWithInventory = await Promise.all(products.map(async (product) => {
            const inventoryEntries = await Inventory.find({product: product._id});
            let inStock = 0;
            if (inventoryEntries.length > 0) {
                inStock = inventoryEntries.reduce((accumulator, inventoryEntry) => {
                    return accumulator + (inventoryEntry.action === "stock_in" ? inventoryEntry.quantity : -inventoryEntry.quantity);
                }, 0);
            }
            return {...product.toObject(), inventory: inStock};
        }));

        const totalProductsCount = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProductsCount / perPage);

        return defaultResponse(res, [200, "Products retrieved successfully", {
            page,
            perPage,
            totalPages,
            filter,
            data: productsWithInventory
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.productId)

        return defaultResponse(res, [200, "Product retrieved successfully", product]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getProductBySlug = async (req, res, next) => {
    try {
        let product = await Product.findOne({slug: req.params.productSlug})
        if (!product)
            return defaultResponse(res, [404, "Product not found!", null])

        if (req.user_id)
            product = {
                ...product.toObject(),
                isInWishList: await checkItemInAuthenticatedUserWishList(req.user_id, product.id)
            }

        return defaultResponse(res, [200, "Product retrieved successfully", product]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const generateSlug = (brand, name) => {
    let slug = (brand && brand.length > 0 ? brand + "-" : "") + name;
    slug = slug.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/&/g, 'and')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    return slug;
};

const deleteProduct = async (req, res, next) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.product._id);
        return defaultResponse(res, [200, "Product deleted successfully", deletedProduct]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const incrementProductViews = async (req, res, next) => {
    try {
        await Product.findByIdAndUpdate(
            req.product._id,
            {$inc: {views: 1}}, // Increment views by 1
            {new: true} // Return the updated document
        );

        return defaultResponse(res, [200, "Product updated successfully", null]);
    } catch (error) {
        throw new Error('Failed to increment product views');
    }
};

const searchProducts = async (req, res, next) => {
    try {
        const page = parseInt(req.body.page) || 1;
        const perPage = parseInt(req.body.perPage) || 20;
        const skip = (page - 1) * perPage;

        const filters = {};

        // Extracting other filters from the request body
        const {brand, category, type, amount, priceRange, tags, sort, skinType, skinConcern, pregnancySafe} = req.body;

        // Applying other filters
        if (brand && Array.isArray(brand)) {
            filters.brand = {$in: brand.map(brand => new RegExp(brand, "i"))};
        }

        if (category && Array.isArray(category)) {
            const categoryDocs = await Category.find({name: {$in: category}});
            const categoryIds = categoryDocs.map(cat => cat._id);
            filters.category = {$in: categoryIds};
        }

        if (type && Array.isArray(type)) {
            const typeDocs = await Type.find({name: {$in: type}});
            const typeIds = typeDocs.map(cat => cat._id);
            filters.type = {$in: typeIds};
        }

        if (amount) {
            filters.amount = amount;
        }

        if (priceRange) {
            const [minPrice, maxPrice] = priceRange.split("-");
            filters.price = {$gte: minPrice, $lte: maxPrice};
        }

        if (tags) {
            filters.tags = {$regex: tags, $options: "i"};
        }

        if (skinType && Array.isArray(skinType)) {
            filters.skinType = {$in: skinType.map(type => new RegExp(type, "i"))};
        }

        if (skinConcern && Array.isArray(skinConcern)) {
            filters.skinConcern = {$in: skinConcern.map(concern => new RegExp(concern, "i"))};
        }

        if (typeof pregnancySafe === 'boolean') {
            filters.pregnancySafe = pregnancySafe;
        }

        // Search query for name, brand, description, and tags
        const query = req.body.query || '';
        const searchFilters = {
            $or: [
                {name: {$regex: query, $options: "i"}},
                {brand: {$regex: query, $options: "i"}},
                {description: {$regex: query, $options: "i"}},
                {tags: {$regex: query, $options: "i"}},
                {skinConcern: {$regex: query, $options: "i"}},
                {skinType: {$regex: query, $options: "i"}},
            ]
        };

        // Combine search filter with other filters
        const finalFilters = {$and: [searchFilters, filters]};

        // Sort logic
        let sortOption = {};
        switch (sort) {
            case 'alphabetical':
                sortOption = {name: 1};
                break;
            case 'newest':
                sortOption = {createdAt: -1};
                break;
            case 'best_selling':
                sortOption = {views: -1};
                break;
            case 'oldest':
                sortOption = {createdAt: 1};
                break;
            case 'most_expensive':
                sortOption = {price: -1};
                break;
            case 'least_expensive':
                sortOption = {price: 1};
                break;
            default:
                sortOption = {}; // No sorting
        }

        // Count total documents based on filters
        const totalCount = await Product.countDocuments(finalFilters);
        const totalPages = Math.ceil(totalCount / perPage);

        // Retrieve products based on filters, pagination, and sorting
        const products = await Product.find(finalFilters)
            .populate({
                path: 'category',
                select: 'name _id'
            })
            .populate({
                path: 'type',
                select: 'name _id'
            })
            .populate({
                path: 'productsBestUsedWith',
                select: 'name _id'
            })
            .skip(skip)
            .limit(perPage)
            .sort(sortOption);

        const allProducts = await Product.find(finalFilters).select('skinConcern skinType brand');
        const skinTypesInResults = [...new Set(allProducts.flatMap(product => product.skinType))];
        const skinConcernsInResults = [...new Set(allProducts.flatMap(product => product.skinConcern))];
        const brandsInResults = [...new Set(allProducts.flatMap(product => product.brand))];

        const newProducts = [];
        if (req.user_id) {
            for (let i = 0; i < products.length; i++) {
                newProducts.push({
                    ...products[i].toObject(),
                    isInWishList: await checkItemInAuthenticatedUserWishList(req.user_id, products[i].id)
                });
            }
        }

        return defaultResponse(res, [200, "Products retrieved successfully", {
            page,
            perPage,
            totalPages,
            metadata:   {
                brandsInResults,
                skinConcernsInResults,
                skinTypesInResults
            },
            Products: newProducts.length === 0 ? products : newProducts
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const checkItemInAuthenticatedUserWishList = async (user_id, product_id) => {
    const wishListItem = await WishList.find({owner: user_id, product: product_id})
    return wishListItem.length > 0
}


module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    getProductBySlug,
    updateProduct,
    deleteProduct,
    searchProducts,
    incrementProductViews,
    getProductsOverview
};
