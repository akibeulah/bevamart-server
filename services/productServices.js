const Inventory = require("../models/Inventory");
const WishList = require("../models/WishListItem");
const Product = require("../models/Product");
const {defaultResponse} = require("../utils/requestHelper");
const Order = require("../models/Order");
const CartItem = require("../models/CartItem");
const Category = require("../models/Category");
const Type = require("../models/Type");
const ProductAttribute = require("../models/ProductAttribute");
const ProductAttributeOption = require("../models/ProductAttributeOption");
const ProductVariant = require("../models/ProductVariant");

/**
 * Creates a new product with optional variants
 */
const createProduct = async (req, res) => {
    try {
        const {
            name, brand, productImages, description, price,
            amount, unit, stock, tags, status,
            lowAlert, variantOptions, variants
        } = req.body;

        // Validate required fields
        if (!name || !brand || !description || price === undefined) {
            return defaultResponse(res, [400, "Missing required product fields", {
                required: ["name", "brand", "description", "price"]
            }]);
        }

        // Check for existing product with same name and brand
        const existingProductSlugCheck = await Product.findOne({name, brand});
        if (existingProductSlugCheck) {
            return defaultResponse(res, [400, "Product with name-brand combination already exists", {
                existingId: existingProductSlugCheck._id
            }]);
        }

        // Prepare base product data
        const cleanedProductData = {
            name,
            brand,
            productImages: Array.isArray(productImages) ? productImages : [],
            description,
            price: Math.round(price * 100),
            amount: amount || 1,
            unit: unit || "unit(s)",
            stock: stock || 0,
            category: req.category?._id,
            tags: Array.isArray(tags) ? tags : [],
            lowAlert: lowAlert || 0,
            status: status || 'active'
        };

        // Check if product has variants
        const hasVariants = variantOptions && Array.isArray(variantOptions) && variantOptions.length > 0;

        if (hasVariants) {
            // Validate variants are provided when variant options are set
            if (!variants || !Array.isArray(variants) || variants.length < 1) {
                return defaultResponse(res, [400, "Product with variants must have at least one variant defined", null]);
            }

            // Validate that all variant options exist in the database
            const optionIds = variantOptions.map(option => typeof option === 'string' ? option : option._id);
            const existingOptions = await ProductAttributeOption.find({_id: {$in: optionIds}});

            if (existingOptions.length !== optionIds.length) {
                const foundIds = existingOptions.map(opt => opt._id.toString());
                const missingIds = optionIds.filter(id => !foundIds.includes(id.toString()));

                return defaultResponse(res, [400, "Some variant options do not exist", {
                    missingOptionIds: missingIds
                }]);
            }

            // Mark product as having variants
            cleanedProductData.hasVariants = true;
            cleanedProductData.variantOptions = optionIds;
        }

        // Create and save the base product first
        const product = new Product(cleanedProductData);
        await product.save();

        // Process variants if they exist
        const createdVariants = [];
        const productVariantErrors = [];

        if (hasVariants) {
            // Create each variant one by one
            for (const variant of variants) {
                try {
                    // Validate required variant fields
                    if (!variant.attributeOptions || !Array.isArray(variant.attributeOptions) || variant.attributeOptions.length === 0) {
                        productVariantErrors.push({
                            sku: variant.sku || 'Unknown',
                            error: "Missing attributeOptions for variant"
                        });
                        continue;
                    }

                    if (variant.price === undefined) {
                        productVariantErrors.push({
                            sku: variant.sku || 'Unknown',
                            error: "Missing price for variant"
                        });
                        continue;
                    }

                    // Create new product variant
                    const newProductVariant = new ProductVariant({
                        parentProduct: product._id, // Fixed typo from 'parentProdut'
                        sku: variant.sku || `${product._id.toString().slice(-6)}-${createdVariants.length + 1}`,
                        attributeOptions: variant.attributeOptions,
                        price: Math.round(variant.price * 100), // Convert to cents
                        stock: variant.stock || 0,
                        images: variant.images || [],
                        active: variant.active !== false, // Default to true
                        lowAlert: variant.lowAlert || 0
                    });

                    await newProductVariant.save();
                    createdVariants.push(newProductVariant);

                    // Create inventory entry for variant if stock is provided
                    if (variant.stock > 0) {
                        const variantStockIn = new Inventory({
                            product: product._id,
                            variant: newProductVariant._id,
                            action: "stock_in",
                            quantity: variant.stock,
                            user_id: req.user_id,
                            description: `Initial stock for variant ${newProductVariant.sku}`
                        });
                        await variantStockIn.save();
                    }
                } catch (error) {
                    console.error("Error creating product variant:", error);
                    productVariantErrors.push({
                        sku: variant.sku || 'Unknown',
                        attributeOptions: variant.attributeOptions,
                        error: error.message
                    });
                }
            }

            // Update product with created variants
            if (createdVariants.length > 0) {
                product.variants = createdVariants.map(v => v._id);
                await product.save();
            } else if (productVariantErrors.length > 0) {
                // If all variants failed to create, update product to not have variants
                product.hasVariants = false;
                product.variantOptions = [];
                await product.save();
            }
        }

        // Create inventory entry for main product if stock > 0 and no variants
        if (!hasVariants && cleanedProductData.stock > 0) {
            const stockIn = new Inventory({
                product: product._id,
                action: "stock_in",
                quantity: cleanedProductData.stock,
                user_id: req.user_id,
                description: "Initial stock with product creation"
            });
            await stockIn.save();

            // Add inventory reference to product
            if (!product.inventory) product.inventory = [];
            product.inventory.push(stockIn._id);
            await product.save();
        }

        // Fetch inventory entries
        const inventoryEntries = await Inventory.find({product: product._id});

        // Prepare response data
        const responseData = {
            product: {
                ...product.toObject(),
                displayPrice: (product.price / 100).toFixed(2)
            },
            inventory: inventoryEntries
        };

        // Add variants to response if they exist
        if (hasVariants) {
            responseData.variants = createdVariants.map(variant => ({
                ...variant.toObject(),
                displayPrice: (variant.price / 100).toFixed(2)
            }));

            if (productVariantErrors.length > 0) {
                responseData.variantErrors = productVariantErrors;
            }
        }

        // Determine appropriate status code and message
        let statusCode = 201;
        let message = "Product created successfully";

        if (hasVariants && productVariantErrors.length > 0) {
            if (createdVariants.length === 0) {
                statusCode = 207; // Partial success
                message = "Product created but all variants failed";
            } else {
                statusCode = 207; // Partial success
                message = "Product created but some variants failed";
            }
        }

        return defaultResponse(res, [statusCode, message, responseData]);
    } catch (error) {
        console.error("Error creating product:", error);

        if (error.name === 'ValidationError') {
            return defaultResponse(res, [400, "Validation error", error.errors]);
        }

        if (error.code === 11000) {
            return defaultResponse(res, [400, "Duplicate key error", error.keyValue]);
        }

        return defaultResponse(res, [500, "Error creating product", {
            message: error.message
        }]);
    }
};

const updateProduct = async (req, res, next) => {
    try {
        const {
            name, brand, productImages, description, price, amount, unit,
            tags, status, lowAlert, category, variantOptions, variants
        } = req.body;

        if (!name || !brand || !description) {
            return defaultResponse(res, [400, "Missing required fields for product update", {
                required: ["name", "brand", "description"]
            }]);
        }

        const existingProductWithSameSlug = await Product.find({name, brand});
        const isDuplicate = existingProductWithSameSlug.some(product =>
            product._id.toString() !== req.product._id.toString()
        );

        if (isDuplicate) {
            return defaultResponse(res, [400, "Product with this name-brand combination already exists", {
                existingId: existingProductWithSameSlug[0]._id
            }]);
        }

        let cleanedProductImages = [];
        if (Array.isArray(productImages)) {
            cleanedProductImages = productImages;
        } else if (productImages) {
            try {
                cleanedProductImages = JSON.parse(productImages);
                if (!Array.isArray(cleanedProductImages)) {
                    cleanedProductImages = [];
                }
            } catch (error) {
                console.error("Error parsing product images:", error);
                // Keep existing images if parsing fails
                cleanedProductImages = req.product.productImages || [];
            }
        }

        const updateData = {
            name,
            brand,
            productImages: cleanedProductImages,
            description
        };

        if (price !== undefined) updateData.price = Math.round(price * 100);
        if (amount !== undefined) updateData.amount = amount;
        if (unit !== undefined) updateData.unit = unit;
        if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
        if (status !== undefined) updateData.status = status;
        if (lowAlert !== undefined) updateData.lowAlert = lowAlert;
        if (category !== undefined) updateData.category = category;

        if (variantOptions !== undefined || variants !== undefined) {
            if (variantOptions && Array.isArray(variantOptions) && variantOptions.length > 0) {
                updateData.hasVariants = true;
                updateData.variantOptions = variantOptions;

                if (variants && Array.isArray(variants) && variants.length > 0) {
                    updateData.variants = variants;
                } else if (variants !== undefined) {
                    return defaultResponse(res, [400, "Invalid variants data provided", null]);
                }
            } else if (variantOptions !== undefined) {
                updateData.hasVariants = false;
                updateData.variantOptions = [];
                updateData.variants = [];
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.product._id,
            updateData,
            {new: true, runValidators: true}
        );

        if (!updatedProduct) {
            return defaultResponse(res, [404, "Product not found", null]);
        }

        const formattedProduct = {
            ...updatedProduct.toObject(),
            price: (updatedProduct.price / 100).toFixed(2)
        };

        return defaultResponse(res, [200, "Product updated successfully", formattedProduct]);
    } catch (error) {
        console.error("Error updating product:", error);

        if (error.name === 'ValidationError') {
            return defaultResponse(res, [400, "Validation error", error.errors]);
        }

        if (error.code === 11000) {
            return defaultResponse(res, [400, "Duplicate key error", error.keyValue]);
        }

        return defaultResponse(res, [500, "Error updating product", {
            message: error.message
        }]);
    }
};

const getProductsOverview = async (req, res, next) => {
    try {
        const newestProduct = await Product.findOne({}).sort({createdAt: -1}).limit(1);
        const mostViewedProducts = await Product.find({}).sort({views: -1}).limit(5);
        const leastPerformingProduct = await Product.find({}).sort({views: 1}).limit(1);

        const cartItems = await CartItem.find({});

        if (cartItems.length === 0) {
            return defaultResponse(res, [200, "Products overview retrieved successfully", {
                newestProduct: newestProduct || null,
                mostViewedProducts: mostViewedProducts || [],
                leastPerformingProduct: leastPerformingProduct && leastPerformingProduct.length > 0
                    ? leastPerformingProduct[0]
                    : null,
                topPerformingProduct: null
            }]);
        }

        const productCounts = new Map();

        cartItems.forEach(item => {
            const productId = item.product.toString();
            productCounts.set(productId, (productCounts.get(productId) || 0) + 1);
        });

        let topPerformingProduct = null;
        if (productCounts.size > 0) {
            const topPerformingProductId = [...productCounts.entries()]
                .sort((a, b) => b[1] - a[1])[0][0]; // Sort by count descending and get first

            topPerformingProduct = await Product.findById(topPerformingProductId);
        }

        return defaultResponse(res, [200, "Products overview retrieved successfully", {
            newestProduct: newestProduct || null,
            mostViewedProducts: mostViewedProducts || [],
            topPerformingProduct: topPerformingProduct || null,
            leastPerformingProduct: leastPerformingProduct && leastPerformingProduct.length > 0
                ? leastPerformingProduct[0]
                : null
        }]);
    } catch (error) {
        console.error("Error retrieving products overview:", error);
        return defaultResponse(res, [500, "Error retrieving products overview", {
            message: error.message
        }]);
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
            .populate('variant')
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
            metadata: {
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

const createProductAttribute = async (req, res) => {
    const {name, description, displayOrder, options} = req.body;
    try {
        const newPA = new ProductAttribute({name, description, displayOrder});
        await newPA.save();

        if (!options)
            return defaultResponse(res, [200, "Product attribute created successfully", newPA]);

        const pAO = [];
        const errors = [];

        await Promise.all(
            options.map(async (attribute) => {
                try {
                    const attr = typeof attribute === 'string' ? JSON.parse(attribute) : attribute;
                    const newPAO = new ProductAttributeOption({
                        attribute: newPA._id,
                        value: attr.value,
                        displayName: attr.displayName,
                        displayOrder: attr.displayOrder,
                    })
                    await newPAO.save();
                    pAO.push(newPAO);
                } catch (error) {
                    errors.push(error);
                }
            })
        )
        if (errors.length > 0)
            return defaultResponse(res, [200, "Product attribute created successfully, but some errors occurred for options creation", {
                productAttribute: newPA,
                productAttributeOptions: pAO,
                errors
            }]);

        return defaultResponse(res, [200, "Product attribute and options created successfully", {
            productAttribute: newPA,
            productAttributeOptions: pAO,
            errors
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Error creating product attribute", error]);
    }
}

const getProductAttribute = async (req, res) => {
    const {id} = req.params;

    try {
        const productAttribute = await ProductAttribute.findById(id);

        if (!productAttribute) {
            return defaultResponse(res, [404, "Product attribute not found", null]);
        }

        // Get associated options
        const options = await ProductAttributeOption.find({attribute: id});

        return defaultResponse(res, [200, "Product attribute retrieved successfully", {
            productAttribute,
            options
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error retrieving product attribute", error]);
    }
};

const getAllProductAttributes = async (req, res) => {
    try {
        const productAttributes = await ProductAttribute.find().sort({displayOrder: 1});

        // Get options for each attribute
        const attributesWithOptions = await Promise.all(
            productAttributes.map(async (attr) => {
                const options = await ProductAttributeOption.find({attribute: attr._id})
                    .sort({displayOrder: 1});

                return {
                    _id: attr._id,
                    name: attr.name,
                    description: attr.description,
                    displayOrder: attr.displayOrder,
                    createdAt: attr.createdAt,
                    updatedAt: attr.updatedAt,
                    options
                };
            })
        );

        return defaultResponse(res, [200, "Product attributes retrieved successfully", attributesWithOptions]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error retrieving product attributes", error]);
    }
};

const updateProductAttribute = async (req, res) => {
    const {id} = req.params;
    const {name, description, displayOrder} = req.body;

    try {
        const productAttribute = await ProductAttribute.findById(id);

        if (!productAttribute) {
            return defaultResponse(res, [404, "Product attribute not found", null]);
        }

        // Update fields if provided
        if (name) productAttribute.name = name;
        if (description !== undefined) productAttribute.description = description;
        if (displayOrder !== undefined) productAttribute.displayOrder = displayOrder;

        await productAttribute.save();

        return defaultResponse(res, [200, "Product attribute updated successfully", productAttribute]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error updating product attribute", error]);
    }
};

const deleteProductAttribute = async (req, res) => {
    const {id} = req.params;

    try {
        const productAttribute = await ProductAttribute.findById(id);

        if (!productAttribute) {
            return defaultResponse(res, [404, "Product attribute not found", null]);
        }

        // Delete associated options first
        await ProductAttributeOption.deleteMany({attribute: id});

        // Delete the attribute
        await ProductAttribute.findByIdAndDelete(id);

        return defaultResponse(res, [200, "Product attribute and associated options deleted successfully", null]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error deleting product attribute", error]);
    }
};

const createProductAttributeOption = async (req, res) => {
    const {attribute, value, displayOrder, displayName} = req.body;

    try {
        const newPAO = new ProductAttributeOption({attribute, value, displayOrder, displayName});
        await newPAO.save();

        return defaultResponse(res, [200, "Product attribute option created successfully", newPAO]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Error creating product attribute option", error]);
    }
}

const getProductAttributeOption = async (req, res) => {
    const {id} = req.params;

    try {
        const option = await ProductAttributeOption.findById(id).populate('attribute');

        if (!option) {
            return defaultResponse(res, [404, "Product attribute option not found", null]);
        }

        return defaultResponse(res, [200, "Product attribute option retrieved successfully", option]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error retrieving product attribute option", error]);
    }
};

const getAllProductAttributeOptions = async (req, res) => {
    const {attributeId} = req.query;

    try {
        let query = {};

        // If attribute ID is provided, filter by that attribute
        if (attributeId) {
            query.attribute = attributeId;
        }

        const options = await ProductAttributeOption.find(query)
            .populate('attribute')
            .sort({displayOrder: 1});

        return defaultResponse(res, [200, "Product attribute options retrieved successfully", options]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error retrieving product attribute options", error]);
    }
};

const updateProductAttributeOption = async (req, res) => {
    const {id} = req.params;
    const {value, displayName, displayOrder} = req.body;

    try {
        const option = await ProductAttributeOption.findById(id);

        if (!option) {
            return defaultResponse(res, [404, "Product attribute option not found", null]);
        }

        // Update fields if provided
        if (value !== undefined) option.value = value;
        if (displayName !== undefined) option.displayName = displayName;
        if (displayOrder !== undefined) option.displayOrder = displayOrder;

        await option.save();

        return defaultResponse(res, [200, "Product attribute option updated successfully", option]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error updating product attribute option", error]);
    }
};

const deleteProductAttributeOption = async (req, res) => {
    const {id} = req.params;

    try {
        const option = await ProductAttributeOption.findById(id);

        if (!option) {
            return defaultResponse(res, [404, "Product attribute option not found", null]);
        }

        await ProductAttributeOption.findByIdAndDelete(id);

        return defaultResponse(res, [200, "Product attribute option deleted successfully", null]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error deleting product attribute option", error]);
    }
};

/**
 * Updates product variants
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProductVariants = async (req, res) => {
    try {
        const { productId } = req.params;
        const { variants, variantOptions } = req.body;

        // Validate input
        if (!productId) {
            return defaultResponse(res, [400, "Product ID is required", null]);
        }

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return defaultResponse(res, [404, "Product not found", null]);
        }

        // Validate variant options if provided
        if (variantOptions) {
            if (!Array.isArray(variantOptions) || variantOptions.length === 0) {
                return defaultResponse(res, [400, "variantOptions must be a non-empty array", null]);
            }

            // Verify all variant options exist
            const optionIds = variantOptions.map(option => typeof option === 'string' ? option : option._id);
            const existingOptions = await ProductAttributeOption.find({ _id: { $in: optionIds } });

            if (existingOptions.length !== optionIds.length) {
                const foundIds = existingOptions.map(opt => opt._id.toString());
                const missingIds = optionIds.filter(id => !foundIds.includes(id.toString()));

                return defaultResponse(res, [400, "Some variant options do not exist", {
                    missingOptionIds: missingIds
                }]);
            }

            // Update product's variant options
            product.variantOptions = optionIds;
        }

        // Process variants
        const updatedVariants = [];
        const newVariants = [];
        const variantErrors = [];

        if (variants && Array.isArray(variants)) {
            // Process each variant
            for (const variant of variants) {
                try {
                    // Determine if this is an update or a new variant
                    if (variant._id) {
                        // Update existing variant
                        const existingVariant = await ProductVariant.findById(variant._id);

                        if (!existingVariant) {
                            variantErrors.push({
                                variantId: variant._id,
                                error: "Variant not found"
                            });
                            continue;
                        }

                        // Update fields if provided
                        if (variant.sku !== undefined) existingVariant.sku = variant.sku;
                        if (variant.attributeOptions !== undefined) existingVariant.attributeOptions = variant.attributeOptions;
                        if (variant.price !== undefined) existingVariant.price = Math.round(variant.price * 100);
                        if (variant.stock !== undefined) existingVariant.stock = variant.stock;
                        if (variant.images !== undefined) existingVariant.images = variant.images;
                        if (variant.active !== undefined) existingVariant.active = variant.active;
                        if (variant.lowAlert !== undefined) existingVariant.lowAlert = variant.lowAlert;

                        await existingVariant.save();
                        updatedVariants.push(existingVariant);
                    } else {
                        // Create new variant
                        // Validate required fields
                        if (!variant.attributeOptions || variant.price === undefined) {
                            variantErrors.push({
                                sku: variant.sku || 'Unknown',
                                error: "Missing required fields (attributeOptions, price)"
                            });
                            continue;
                        }

                        const newVariant = new ProductVariant({
                            parentProduct: product._id,
                            sku: variant.sku || `${product._id.toString().slice(-6)}-${Date.now()}`,
                            attributeOptions: variant.attributeOptions,
                            price: Math.round(variant.price * 100),
                            stock: variant.stock || 0,
                            images: variant.images || [],
                            active: variant.active !== false,
                            lowAlert: variant.lowAlert || 0
                        });

                        await newVariant.save();
                        newVariants.push(newVariant);

                        // Create inventory entry if stock > 0
                        if (variant.stock > 0) {
                            const variantStockIn = new Inventory({
                                product: product._id,
                                variant: newVariant._id,
                                action: "stock_in",
                                quantity: variant.stock,
                                user_id: req.user_id,
                                description: `Stock added for variant ${newVariant.sku}`
                            });
                            await variantStockIn.save();
                        }
                    }
                } catch (error) {
                    console.error("Error processing variant:", error);
                    variantErrors.push({
                        variantId: variant._id || 'New variant',
                        sku: variant.sku || 'Unknown',
                        error: error.message
                    });
                }
            }

            // Update product's variants array with all current variants
            const currentVariants = await ProductVariant.find({ parentProduct: product._id });
            product.variants = currentVariants.map(v => v._id);
        }

        // Update product's hasVariants status
        const hasAnyVariants = (await ProductVariant.countDocuments({ parentProduct: product._id })) > 0;
        product.hasVariants = hasAnyVariants;

        // If hasVariants is false, remove variantOptions
        if (!product.hasVariants) {
            product.variantOptions = [];
        }

        await product.save();

        // Prepare response data
        const responseData = {
            product: {
                ...product.toObject(),
                displayPrice: (product.price / 100).toFixed(2)
            },
            updatedVariants: updatedVariants.map(v => ({
                ...v.toObject(),
                displayPrice: (v.price / 100).toFixed(2)
            })),
            newVariants: newVariants.map(v => ({
                ...v.toObject(),
                displayPrice: (v.price / 100).toFixed(2)
            }))
        };

        if (variantErrors.length > 0) {
            responseData.variantErrors = variantErrors;
        }

        // Determine status and message
        let statusCode = 200;
        let message = "Product variants updated successfully";

        if (variantErrors.length > 0) {
            if (updatedVariants.length === 0 && newVariants.length === 0) {
                statusCode = 400;
                message = "Failed to update any variants";
            } else {
                statusCode = 207;
                message = "Some variant updates failed";
            }
        }

        return defaultResponse(res, [statusCode, message, responseData]);
    } catch (error) {
        console.error("Error updating product variants:", error);
        return defaultResponse(res, [500, "Error updating product variants", {
            message: error.message
        }]);
    }
};

/**
 * Deletes a product variant
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteProductVariant = async (req, res) => {
    try {
        const { variantId } = req.params;

        if (!variantId) {
            return defaultResponse(res, [400, "Variant ID is required", null]);
        }

        // Find the variant
        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
            return defaultResponse(res, [404, "Variant not found", null]);
        }

        const productId = variant.parentProduct;

        // Delete inventory records for this variant
        await Inventory.deleteMany({ variant: variantId });

        // Delete the variant
        await ProductVariant.findByIdAndDelete(variantId);

        // Update the parent product
        const product = await Product.findById(productId);
        if (product) {
            // Remove the variant from the product's variants array
            product.variants = product.variants.filter(id => id.toString() !== variantId);

            // Check if there are any remaining variants
            const remainingVariantsCount = await ProductVariant.countDocuments({ parentProduct: productId });
            product.hasVariants = remainingVariantsCount > 0;

            // If no more variants, clear variant options
            if (!product.hasVariants) {
                product.variantOptions = [];
            }

            await product.save();
        }

        return defaultResponse(res, [200, "Product variant deleted successfully", {
            deletedVariantId: variantId,
            productId,
            productHasRemainingVariants: product ? product.hasVariants : false
        }]);
    } catch (error) {
        console.error("Error deleting product variant:", error);
        return defaultResponse(res, [500, "Error deleting product variant", {
            message: error.message
        }]);
    }
};

/**
 * Gets variants for a specific product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProductVariants = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!productId) {
            return defaultResponse(res, [400, "Product ID is required", null]);
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return defaultResponse(res, [404, "Product not found", null]);
        }

        // Get all variants for this product with attribute details
        const variants = await ProductVariant.find({ parentProduct: productId })
            .populate({
                path: 'attributeOptions',
                populate: {
                    path: 'attribute',
                    select: 'name displayOrder'
                }
            })
            .sort({ createdAt: 1 });

        // If no variants, return early
        if (variants.length === 0) {
            return defaultResponse(res, [200, "No variants found for this product", {
                productId,
                variants: []
            }]);
        }

        // Format variants for response
        const formattedVariants = variants.map(variant => ({
            ...variant.toObject(),
            displayPrice: (variant.price / 100).toFixed(2)
        }));

        return defaultResponse(res, [200, "Product variants retrieved successfully", {
            productId,
            variants: formattedVariants
        }]);
    } catch (error) {
        console.error("Error getting product variants:", error);
        return defaultResponse(res, [500, "Error retrieving product variants", {
            message: error.message
        }]);
    }
};

/**
 * Updates the stock of a product variant
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateVariantStock = async (req, res) => {
    try {
        const { variantId } = req.params;
        const { quantity, action, description } = req.body;

        // Validate inputs
        if (!variantId) {
            return defaultResponse(res, [400, "Variant ID is required", null]);
        }

        if (!quantity || !action) {
            return defaultResponse(res, [400, "Quantity and action are required", null]);
        }

        if (action !== 'stock_in' && action !== 'stock_out') {
            return defaultResponse(res, [400, "Action must be 'stock_in' or 'stock_out'", null]);
        }

        // Find the variant
        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
            return defaultResponse(res, [404, "Variant not found", null]);
        }

        // Create inventory record
        const inventory = new Inventory({
            product: variant.parentProduct,
            variant: variantId,
            action,
            quantity,
            user_id: req.user_id,
            description: description || `${action === 'stock_in' ? 'Stock added to' : 'Stock removed from'} variant ${variant.sku}`
        });

        await inventory.save();

        // Update variant stock
        const stockAdjustment = action === 'stock_in' ? quantity : -quantity;
        variant.stock = Math.max(0, variant.stock + stockAdjustment);
        await variant.save();

        return defaultResponse(res, [200, "Variant stock updated successfully", {
            variant: {
                ...variant.toObject(),
                displayPrice: (variant.price / 100).toFixed(2)
            },
            inventoryRecord: inventory
        }]);
    } catch (error) {
        console.error("Error updating variant stock:", error);
        return defaultResponse(res, [500, "Error updating variant stock", {
            message: error.message
        }]);
    }
};

/**
 * Creates a new product variant for an existing product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createProductVariant = async (req, res) => {
    try {
        const { productId } = req.params;
        const {
            sku,
            attributeOptions,
            price,
            stock,
            images,
            active,
            lowAlert
        } = req.body;

        // Validate required fields
        if (!productId) {
            return defaultResponse(res, [400, "Product ID is required", null]);
        }

        if (!attributeOptions || !Array.isArray(attributeOptions) || attributeOptions.length === 0) {
            return defaultResponse(res, [400, "attributeOptions is required and must be a non-empty array", null]);
        }

        if (price === undefined) {
            return defaultResponse(res, [400, "Price is required for the variant", null]);
        }

        // Find the parent product
        const product = await Product.findById(productId);
        if (!product) {
            return defaultResponse(res, [404, "Parent product not found", null]);
        }

        // Verify that all attribute options exist
        const optionIds = attributeOptions.map(option =>
            typeof option === 'string' ? option : option._id
        );

        const existingOptions = await ProductAttributeOption.find({ _id: { $in: optionIds } });
        if (existingOptions.length !== optionIds.length) {
            const foundIds = existingOptions.map(opt => opt._id.toString());
            const missingIds = optionIds.filter(id => !foundIds.includes(id.toString()));

            return defaultResponse(res, [400, "Some attribute options do not exist", {
                missingOptionIds: missingIds
            }]);
        }

        // Check if a variant with the same attribute options already exists
        const existingVariant = await ProductVariant.findOne({
            parentProduct: productId,
            attributeOptions: { $all: optionIds, $size: optionIds.length }
        });

        if (existingVariant) {
            return defaultResponse(res, [400, "A variant with these attribute options already exists", {
                existingVariantId: existingVariant._id
            }]);
        }

        // Check if SKU is unique if provided
        if (sku) {
            const existingSkuVariant = await ProductVariant.findOne({ sku });
            if (existingSkuVariant) {
                return defaultResponse(res, [400, "A variant with this SKU already exists", {
                    existingVariantId: existingSkuVariant._id
                }]);
            }
        }

        // Create the new variant
        const newVariant = new ProductVariant({
            parentProduct: productId,
            sku: sku || `${productId.toString().slice(-6)}-${Date.now()}`,
            attributeOptions: optionIds,
            price: Math.round(price * 100), // Convert to cents
            stock: stock || 0,
            images: Array.isArray(images) ? images : [],
            active: active !== false, // Default to true
            lowAlert: lowAlert || 0
        });

        await newVariant.save();

        // Create inventory entry if stock > 0
        if (stock > 0) {
            const stockIn = new Inventory({
                product: productId,
                variant: newVariant._id,
                action: "stock_in",
                quantity: stock,
                user_id: req.user_id,
                description: `Initial stock for variant ${newVariant.sku}`
            });
            await stockIn.save();
        }

        // Update parent product
        if (!product.hasVariants) {
            product.hasVariants = true;
        }

        // Ensure product has the correct variant options
        if (!product.variantOptions || !Array.isArray(product.variantOptions)) {
            product.variantOptions = [];
        }

        // Add any missing variant options to the product
        for (const optionId of optionIds) {
            if (!product.variantOptions.includes(optionId) &&
                !product.variantOptions.some(vo => vo.toString() === optionId.toString())) {
                product.variantOptions.push(optionId);
            }
        }

        // Add variant to product's variants array
        if (!product.variants) {
            product.variants = [newVariant._id];
        } else {
            product.variants.push(newVariant._id);
        }

        await product.save();

        // Populate attribute information for response
        await newVariant.populate({
            path: 'attributeOptions',
            populate: {
                path: 'attribute',
                select: 'name displayOrder'
            }
        });

        return defaultResponse(res, [201, "Product variant created successfully", {
            variant: {
                ...newVariant.toObject(),
                displayPrice: (newVariant.price / 100).toFixed(2)
            },
            productUpdated: {
                hasVariants: product.hasVariants,
                variantCount: product.variants.length
            }
        }]);
    } catch (error) {
        console.error("Error creating product variant:", error);

        // Handle specific errors
        if (error.name === 'ValidationError') {
            return defaultResponse(res, [400, "Validation error", error.errors]);
        }

        if (error.code === 11000) {
            return defaultResponse(res, [400, "Duplicate key error", error.keyValue]);
        }

        return defaultResponse(res, [500, "Error creating product variant", {
            message: error.message
        }]);
    }
};

module.exports = {
    createProduct,
    createProductAttribute,
    createProductAttributeOption,
    getProductAttribute,
    getAllProductAttributes,
    updateProductAttribute,
    deleteProductAttribute,
    getProductAttributeOption,
    getAllProductAttributeOptions,
    updateProductAttributeOption,
    deleteProductAttributeOption,
    getAllProducts,
    getProductById,
    getProductBySlug,
    updateProduct,
    deleteProduct,
    searchProducts,
    incrementProductViews,
    getProductsOverview,
    updateProductVariants,
    deleteProductVariant,
    getProductVariants,
    updateVariantStock,
    createProductVariant
};
