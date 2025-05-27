const Inventory = require("../models/Inventory");
const WishList = require("../models/WishListItem");
const Product = require("../models/Product");
const {defaultResponse} = require("../utils/requestHelper");
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
            lowAlert, variants, productVariantGroup, productSpecification
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
            status: status || 'active',
            productVariantGroup,
            productSpecification
        };

        // Check if product has variants
        const hasVariants = variants && Array.isArray(variants) && variants.length > 0;

        if (hasVariants) {
            // Validate that all variant options exist in the database
            const optionIds = variants.flatMap(v => v.attributeOptions).map(option => typeof option === 'string' ? option : option._id);
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

const updateProduct = async (req, res) => {
    try {
        let {
            name, brand, productImages, description, price, amount, unit,
            tags, status, lowAlert, category, productVariantGroup, productSpecification
        } = req.body;

        if (!name)
            name = req.product.name;
        if (!brand)
            brand = req.product.brand;
        if (!description)
            description = req.product.description;

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
        if (productVariantGroup !== undefined) updateData.productVariantGroup = productVariantGroup;
        if (productSpecification !== undefined) updateData.productSpecification = productSpecification;


        // Update the base product
        const updatedProduct = await Product.findByIdAndUpdate(
            req.product._id,
            updateData,
            {new: true, runValidators: true}
        );

        if (!updatedProduct) {
            return defaultResponse(res, [404, "Product not found", null]);
        }

        const up = await Product.findById(updatedProduct._id);

        const responseData = {
            product: {
                ...up.toObject(),
                displayPrice: (updatedProduct.price / 100).toFixed(2)
            }
        };

        return defaultResponse(res, [200, "Product updated successfully", responseData]);
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

const getProductsOverview = async (req, res) => {
    try {
        const newestProduct = await Product.findOne({}).populate("variants").sort({createdAt: -1}).limit(1);
        const mostViewedProducts = await Product.find({}).populate("variants").sort({views: -1}).limit(5);
        const leastPerformingProduct = await Product.find({}).populate("variants").sort({views: 1}).limit(1);

        const cartItems = await CartItem.find();

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
            const productId = item.product._id;
            productCounts.set(productId, (productCounts.get(productId) || 0) + 1);
        });

        let topPerformingProduct = null;
        if (productCounts.size > 0) {
            const topPerformingProductId = [...productCounts.entries()]
                .sort((a, b) => b[1] - a[1])[0][0];

            topPerformingProduct = await Product.findById(topPerformingProductId).populate("variants");
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

const getAllProducts = async (req, res) => {
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

        const products = await Product.find(query)
            .sort({ createdAt: -1 })
            .populate('variants')
            .skip((page - 1) * perPage)
            .limit(perPage);

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

const getProductById = async (req, res) => {
    try {
        let product = await Product.findById(req.params.productId).populate("variants")
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

const getProductBySlug = async (req, res) => {
    try {
        let product = await Product.findOne({slug: req.params.productSlug}).populate(
            {
                path: "variants",
                populate: {
                    path: 'attributeOptions'
                }
            })
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

const deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.product._id);
        return defaultResponse(res, [200, "Product deleted successfully", deletedProduct]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const incrementProductViews = async (req, res) => {
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

const searchProducts = async (req, res) => {
    try {
        const page = parseInt(req.body.page) || 1;
        const perPage = parseInt(req.body.perPage) || 20;
        const skip = (page - 1) * perPage;

        const filters = {};

        // Extracting filters from the request body
        const { brand, category, type, amount, priceRange, tags, sort } = req.body;

        // Applying filters
        if (brand && Array.isArray(brand)) {
            filters.brand = { $in: brand.map(b => new RegExp(b, "i")) };
        }

        if (category && Array.isArray(category)) {
            const categoryDocs = await Category.find({ name: { $in: category } });
            const categoryIds = categoryDocs.map(cat => cat._id);
            filters.category = { $in: categoryIds };
        }

        if (type && Array.isArray(type)) {
            const typeDocs = await Type.find({ name: { $in: type } });
            const typeIds = typeDocs.map(t => t._id);
            filters.type = { $in: typeIds };
        }

        if (amount) {
            filters.amount = amount;
        }

        if (priceRange) {
            const [minPrice, maxPrice] = priceRange.split("-");
            filters.price = {
                $gte: parseInt(minPrice) * 100,
                $lte: parseInt(maxPrice) * 100
            };
        }

        if (tags && Array.isArray(tags)) {
            filters.tags = { $in: tags.map(tag => new RegExp(tag, "i")) };
        }

        // Search query for name, brand, description, and tags
        const query = req.body.query || '';
        const searchFilters = {
            $or: [
                { name: { $regex: query, $options: "i" } },
                { brand: { $regex: query, $options: "i" } },
                { description: { $regex: query, $options: "i" } },
                { tags: { $regex: query, $options: "i" } }
            ]
        };

        // Combine search filter with other filters
        const finalFilters = { $and: [searchFilters, filters] };

        // Sort logic
        let sortOption;
        switch (sort) {
            case 'alphabetical':
                sortOption = { name: 1 };
                break;
            case 'newest':
                sortOption = { createdAt: -1 };
                break;
            case 'best_selling':
                sortOption = { views: -1 };
                break;
            case 'oldest':
                sortOption = { createdAt: 1 };
                break;
            case 'most_expensive':
                sortOption = { price: -1 };
                break;
            case 'least_expensive':
                sortOption = { price: 1 };
                break;
            default:
                sortOption = { createdAt: -1 }; // Default sort by newest
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
                path: 'variants',
                select: 'price stock images attributeOptions',
                populate: {
                    path: 'attributeOptions',
                    populate: {
                        path: 'attribute'
                    }
                }
            })
            .skip(skip)
            .limit(perPage)
            .sort(sortOption);

        // Generate metadata from search results for filtering options
        // Fetch all products matching query without pagination for metadata
        const metadataProducts = await Product.find(finalFilters)
            .select('brand tags price category variantOptions')
            .populate({
                path: 'category',
                select: 'name _id'
            })
            .populate({
                path: 'variantOptions',
                select: 'value displayName attribute',
                populate: {
                    path: 'attribute',
                    select: 'name _id'
                }
            });

        // Extract metadata for filters
        const brandsInResults = [...new Set(metadataProducts.map(product => product.brand))];

        // Extract tags from all result products
        const tagsInResults = [...new Set(metadataProducts.flatMap(product =>
            product.tags ? product.tags : []))];

        // Extract categories from all result products
        const categoriesInResults = metadataProducts
            .map(product => product.category)
            .filter(category => category) // Filter out null/undefined
            .reduce((acc, category) => {
                // Check if category already exists in accumulator
                if (!acc.some(c => c._id.toString() === category._id.toString())) {
                    acc.push({ _id: category._id, name: category.name });
                }
                return acc;
            }, []);

        // Get min and max prices
        const prices = metadataProducts.map(product => product.price);
        const minPrice = prices.length > 0 ? Math.min(...prices) / 100 : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) / 100 : 0;

        // Extract attributes and their options
        const attributesMap = new Map();

        metadataProducts.forEach(product => {
            if (product.variantOptions && product.variantOptions.length > 0) {
                product.variantOptions.forEach(option => {
                    if (option.attribute) {
                        const attrId = option.attribute._id.toString();
                        const attrName = option.attribute.name;

                        if (!attributesMap.has(attrId)) {
                            attributesMap.set(attrId, {
                                _id: attrId,
                                name: attrName,
                                options: []
                            });
                        }

                        const attr = attributesMap.get(attrId);
                        if (!attr.options.some(opt => opt._id.toString() === option._id.toString())) {
                            attr.options.push({
                                _id: option._id,
                                value: option.value,
                                displayName: option.displayName
                            });
                        }
                    }
                });
            }
        });

        const attributesInResults = Array.from(attributesMap.values());

        // Add wishlist info if user is authenticated
        const productsWithWishlist = [];
        if (req.user_id) {
            for (const product of products) {
                productsWithWishlist.push({
                    ...product.toObject(),
                    displayPrice: (product.price / 100).toFixed(2),
                    isInWishList: await checkItemInAuthenticatedUserWishList(req.user_id, product._id)
                });
            }
        } else {
            // Format products for non-authenticated users
            products.forEach(product => {
                productsWithWishlist.push({
                    ...product.toObject(),
                    displayPrice: (product.price / 100).toFixed(2)
                });
            });
        }

        return defaultResponse(res, [200, "Products retrieved successfully", {
            page,
            perPage,
            totalPages,
            totalCount,
            metadata: {
                brands: brandsInResults,
                tags: tagsInResults,
                categories: categoriesInResults,
                priceRange: {
                    min: minPrice,
                    max: maxPrice
                },
                attributes: attributesInResults,
            },
            products: productsWithWishlist
        }]);
    } catch (error) {
        console.error("Error searching products:", error);
        return defaultResponse(res, [500, "Error searching products", { message: error.message }]);
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
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Convert to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    try {
        // Find the option and populate its attribute
        const option = await ProductAttributeOption.findById(id).populate('attribute');

        if (!option) {
            return defaultResponse(res, [404, "Product attribute option not found", null]);
        }

        // Find products that have this option in their variantOptions array
        const productsQuery = Product.find({
            $or: [
                { variantOptions: id },
                { 'variants.attributeOptions': id }
            ]
        });

        // Count total products for pagination
        const totalProducts = await Product.countDocuments({
            $or: [
                { variantOptions: id },
                { 'variants.attributeOptions': id }
            ]
        });

        // Apply pagination
        const products = await productsQuery
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .populate('category');

        // Format products with price display
        const formattedProducts = products.map(product => ({
            ...product.toObject(),
            displayPrice: (product.price / 100).toFixed(2)
        }));

        return defaultResponse(res, [200, "Product attribute option retrieved successfully", {
            option,
            products: {
                items: formattedProducts,
                totalItems: totalProducts,
                currentPage: pageNum,
                totalPages: Math.ceil(totalProducts / limitNum),
                limit: limitNum
            }
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error retrieving product attribute option", error]);
    }
};

const getProductAttribute = async (req, res) => {
    const { id } = req.params;
    const { page = 1, perPage = 10 } = req.query;

    // Convert to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(perPage, 10);

    try {
        const productAttribute = await ProductAttribute.findById(id);

        if (!productAttribute) {
            return defaultResponse(res, [404, "Product attribute not found", null]);
        }

        // Get associated options
        const options = await ProductAttributeOption.find({ attribute: id });

        // Get option IDs for product search
        const optionIds = options.map(option => option._id);

        // Find products that have any of these options
        const productsQuery = Product.find({
            $or: [
                { variantOptions: { $in: optionIds } },
                { 'variants.attributeOptions': { $in: optionIds } }
            ]
        });

        // Count total products for pagination
        const totalProducts = await Product.countDocuments({
            $or: [
                { variantOptions: { $in: optionIds } },
                { 'variants.attributeOptions': { $in: optionIds } }
            ]
        });

        // Apply pagination
        const products = await productsQuery
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .populate('category');

        // Format products with price display
        const formattedProducts = products.map(product => ({
            ...product.toObject(),
            displayPrice: (product.price / 100).toFixed(2)
        }));

        return defaultResponse(res, [200, "Product attribute retrieved successfully", {
            productAttribute,
            options,
            products: {
                items: formattedProducts,
                totalItems: totalProducts,
                currentPage: pageNum,
                totalPages: Math.ceil(totalProducts / limitNum),
                limit: limitNum
            }
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Error retrieving product attribute", error]);
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

const updateProductVariant = async (req, res) => {
    try {
        const { productId, variantId } = req.params;
        const {
            sku,
            price,
            images,
            lowAlert,
            attributeOptions
        } = req.body;

        // Validate input
        if (!productId) {
            return defaultResponse(res, [400, "Product ID is required", null]);
        }

        if (!variantId) {
            return defaultResponse(res, [400, "Variant ID is required", null]);
        }

        const product = await Product.findById(productId);
        if (!product) {
            return defaultResponse(res, [404, "Product not found", null]);
        }

        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
            return defaultResponse(res, [404, "Variant not found", null]);
        }

        // Verify that variant belongs to the product
        if (variant.parentProduct.toString() !== product._id.toString()) {
            return defaultResponse(res, [400, "Variant does not belong to the product", null]);
        }

        // Prepare update data
        const updateData = {};

        if (sku !== undefined) updateData.sku = sku;
        if (price !== undefined) updateData.price = Math.round(price * 100);
        if (lowAlert !== undefined) updateData.lowAlert = lowAlert;

        // Process attributeOptions if provided
        if (attributeOptions !== undefined) {
            if (Array.isArray(attributeOptions) && attributeOptions.length > 0) {
                // Validate that all attribute options exist in the database
                const optionIds = attributeOptions.map(option =>
                    typeof option === 'string' ? option : option._id
                );

                const existingOptions = await ProductAttributeOption.find({_id: {$in: optionIds}});

                if (existingOptions.length !== optionIds.length) {
                    const foundIds = existingOptions.map(opt => opt._id.toString());
                    const missingIds = optionIds.filter(id => !foundIds.includes(id.toString()));

                    return defaultResponse(res, [400, "Some attribute options do not exist", {
                        missingOptionIds: missingIds
                    }]);
                }

                updateData.attributeOptions = optionIds;
            } else {
                // If attributeOptions is provided but empty or not an array, clear it
                updateData.attributeOptions = [];
            }
        }

        // Process images if provided
        if (images !== undefined) {
            let cleanedImages = variant.images || [];

            if (Array.isArray(images)) {
                cleanedImages = images;
            } else if (images) {
                try {
                    cleanedImages = JSON.parse(images);
                    if (!Array.isArray(cleanedImages)) {
                        cleanedImages = variant.images || [];
                    }
                } catch (error) {
                    console.error("Error parsing variant images:", error);
                    cleanedImages = variant.images || [];
                }
            }

            updateData.images = cleanedImages;
        }

        // Update the variant
        const updatedVariant = await ProductVariant.findByIdAndUpdate(
            variantId,
            updateData,
            {new: true, runValidators: true}
        );

        if (!updatedVariant) {
            return defaultResponse(res, [404, "Failed to update variant", null]);
        }

        // Format the response
        const responseData = {
            variant: {
                ...updatedVariant.toObject(),
                displayPrice: (updatedVariant.price / 100).toFixed(2)
            }
        };

        return defaultResponse(res, [200, "Variant updated successfully", responseData]);
    } catch (error) {
        console.error("Error updating product variant:", error);

        if (error.name === 'ValidationError') {
            return defaultResponse(res, [400, "Validation error", error.errors]);
        }

        if (error.code === 11000) {
            return defaultResponse(res, [400, "Duplicate key error", error.keyValue]);
        }

        return defaultResponse(res, [500, "Error updating product variant", {
            message: error.message
        }]);
    }
};

const updateMultipleProductVariants = async (req, res) => {
    try {
        const { productId } = req.params;
        const { variants } = req.body;
        const errors = [];
        const updatedVariants = [];

        // Validate input
        if (!productId) {
            return defaultResponse(res, [400, "Product ID is required", null]);
        }

        if (!variants || !(variants instanceof Array)) {
            return defaultResponse(res, [400, "Variants must be an array", null]);
        }

        if (variants.length === 0) {
            return defaultResponse(res, [400, "Variants must contain at least one item", null]);
        }

        const product = await Product.findById(productId);
        if (!product) {
            return defaultResponse(res, [404, "Product not found", null]);
        }

        // Process each variant
        for (let i = 0; i < variants.length; i++) {
            let variantData = null;
            try {
                variantData = JSON.parse(variants[i]);

                if (!(variantData instanceof Object)) {
                    errors.push(`Variant needs to be an object after JSON.parse() for variant at index ${i}: ${JSON.stringify(variantData)}`);
                    continue;
                }
            } catch (error) {
                errors.push(`Variant needs to be a JSON stringified object for variant at index ${i}: ${JSON.stringify(variantData)}. Error: ${error.message}`);
                continue;
            }
            if (variantData === null) {
                errors.push(`Error processing variant at index ${i}.`);
                continue;
            }

            const {
                id,
                sku,
                price,
                images,
                lowAlert,
                attributeOptions
            } = variantData;

            if (!id) {
                errors.push(`Variant ID is required for variant at index ${i}: ${JSON.stringify(variantData)}`);
                continue;
            }

            try {
                const variant = await ProductVariant.findById(id);
                if (!variant) {
                    errors.push(`Variant not found for ID: ${id}`);
                    continue;
                }

                if (variant.parentProduct.toString() !== product._id.toString()) {
                    errors.push(`Variant [${id}] does not belong to the product`);
                    continue;
                }

                const updateData = {};

                if (sku !== undefined) updateData.sku = sku;
                if (price !== undefined) updateData.price = Math.round(price * 100);
                if (lowAlert !== undefined) updateData.lowAlert = lowAlert;

                // Process attributeOptions if provided
                if (attributeOptions !== undefined) {
                    if (Array.isArray(attributeOptions) && attributeOptions.length > 0) {
                        // Validate that all attribute options exist in the database
                        const optionIds = attributeOptions.map(option =>
                            typeof option === 'string' ? option : option._id
                        );

                        const existingOptions = await ProductAttributeOption.find({_id: {$in: optionIds}});

                        if (existingOptions.length !== optionIds.length) {
                            const foundIds = existingOptions.map(opt => opt._id.toString());
                            const missingIds = optionIds.filter(id => !foundIds.includes(id.toString()));

                            errors.push(`Some attribute options do not exist for variant [${id}]: ${missingIds.join(', ')}`);
                            continue;
                        }

                        updateData.attributeOptions = optionIds;
                    } else {
                        // If attributeOptions is provided but empty or not an array, clear it
                        updateData.attributeOptions = [];
                    }
                }

                // Process images if provided
                if (images !== undefined) {
                    let cleanedImages = variant.images || [];

                    if (Array.isArray(images)) {
                        cleanedImages = images;
                    } else if (images) {
                        try {
                            cleanedImages = JSON.parse(images);
                            if (!Array.isArray(cleanedImages)) {
                                cleanedImages = variant.images || [];
                            }
                        } catch (error) {
                            console.error("Error parsing variant images:", error);
                            cleanedImages = variant.images || [];
                        }
                    }

                    updateData.images = cleanedImages;
                }

                // Update the variant
                const updatedVariant = await ProductVariant.findByIdAndUpdate(
                    id,
                    updateData,
                    {new: true, runValidators: true}
                );

                if (!updatedVariant) {
                    errors.push(`Failed to update variant [${id}]`);
                    continue;
                }

                // Add display price and push to results
                updatedVariants.push({
                    ...updatedVariant.toObject(),
                    displayPrice: (updatedVariant.price / 100).toFixed(2)
                });

            } catch (variantError) {
                console.error(`Error updating variant [${id}]:`, variantError);
                errors.push(`Error updating variant [${id}]: ${variantError.message}`);
            }
        }

        const hasErrors = errors.length > 0;
        const successCount = updatedVariants.length;
        const totalCount = variants.length;

        let message;
        if (successCount === 0) {
            message = "No variants were updated";
        } else if (hasErrors) {
            message = `${successCount} of ${totalCount} variants updated successfully`;
        } else {
            message = "All variants updated successfully";
        }

        return defaultResponse(res, [200, message, {
            updatedVariants,
            errors,
            summary: {
                total: totalCount,
                successful: successCount,
                failed: errors.length
            }
        }]);

    } catch (error) {
        console.error("Error updating product variants:", error);

        if (error.name === 'ValidationError') {
            return defaultResponse(res, [400, "Validation error", error.errors]);
        }

        if (error.code === 11000) {
            return defaultResponse(res, [400, "Duplicate key error", error.keyValue]);
        }

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

const getRandomizedProducts = async (req, res) => {
    try {
        const perPage = parseInt(req.query.perPage) || 20;
        const page = parseInt(req.query.page) || 1;
        const categorySlug = req.params.category;

        let query = { status: 'active' };

        if (categorySlug) {
            const category = await Category.findOne({ slug: categorySlug });
            if (category) {
                query.category = category._id;
            } else {
                return defaultResponse(res, [404, "Category not found", null]);
            }
        }

        const today = new Date();
        const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

        const totalProductsCount = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProductsCount / perPage);

        const allProductIds = await Product.find(query).select('_id');

        const shuffledIds = shuffleArray(allProductIds.map(p => p._id), dateString);

        const paginatedIds = shuffledIds.slice((page - 1) * perPage, page * perPage);

        const products = await Product.find({ _id: { $in: paginatedIds } })
            .populate('category')
            .populate({
                path: 'variants',
                select: 'price stock images attributeOptions',
                populate: {
                    path: 'attributeOptions',
                    populate: {
                        path: 'attribute'
                    }
                }
            });

        const formattedProducts = products.map(product => ({
            ...product.toObject(),
            displayPrice: (product.price / 100).toFixed(2)
        }));

        return defaultResponse(res, [200, "Randomized products retrieved successfully", {
            page,
            perPage,
            totalPages,
            totalItems: totalProductsCount,
            data: formattedProducts
        }]);
    } catch (error) {
        console.error("Error retrieving randomized products:", error);
        return defaultResponse(res, [500, "Error retrieving randomized products", {
            message: error.message
        }]);
    }
};

/**
 * Deterministically shuffles an array based on a seed string.
 * @param {Array} array - The array to shuffle
 * @param {string} seed - A seed string for consistent shuffling
 * @returns {Array} - The shuffled array
 */
function shuffleArray(array, seed) {
    const result = [...array];

    const seededRandom = createSeededRandom(seed);

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

/**
 * Creates a seeded pseudorandom number generator
 * @param {string} seed - A seed string
 * @returns {Function} - A function that returns a pseudorandom number between 0 and 1
 */
const createSeededRandom = (seed) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }

    return function() {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };
}

const getBestSellers = async (req, res) => {
    try {
        const perPage = parseInt(req.query.perPage) || 20;
        const page = parseInt(req.query.page) || 1;
        const timeFrame = req.query.timeFrame || 'all';

        let dateFilter = {};
        if (timeFrame === 'month' || timeFrame === 'week') {
            const now = new Date();
            const startDate = new Date();

            if (timeFrame === 'month') {
                startDate.setMonth(now.getMonth() - 1);
            } else if (timeFrame === 'week') {
                startDate.setDate(now.getDate() - 7);
            }

            dateFilter.createdAt = { $gte: startDate };
        }

        const productPopularity = await CartItem.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$product",
                    count: { $sum: "$quantity" }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const totalItems = productPopularity.length;
        const totalPages = Math.ceil(totalItems / perPage);

        const paginatedPopularity = productPopularity.slice(
            (page - 1) * perPage,
            page * perPage
        );

        const productIds = paginatedPopularity.map(item => item._id);

        const products = await Product.find({
            _id: { $in: productIds },
            status: 'active'
        })
            .populate('category')
            .populate({
                path: 'variants',
                select: 'price stock images attributeOptions',
                populate: {
                    path: 'attributeOptions',
                    populate: {
                        path: 'attribute'
                    }
                }
            });


        const sortedProducts = productIds.map(id => {
            const product = products.find(p => p._id.toString() === id.toString());
            if (!product) return null;


            const popularity = paginatedPopularity.find(
                item => item._id.toString() === id.toString()
            );

            return {
                ...product.toObject(),
                displayPrice: (product.price / 100).toFixed(2),
                popularityScore: popularity ? popularity.count : 0
            };
        }).filter(Boolean);

        return defaultResponse(res, [200, "Best sellers retrieved successfully", {
            page,
            perPage,
            totalPages,
            totalItems,
            timeFrame,
            data: sortedProducts
        }]);
    } catch (error) {
        console.error("Error retrieving best sellers:", error);
        return defaultResponse(res, [500, "Error retrieving best sellers", {
            message: error.message
        }]);
    }
};

module.exports = {
    getBestSellers,
    getRandomizedProducts,
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
    updateProductVariant,
    deleteProductVariant,
    getProductVariants,
    updateVariantStock,
    createProductVariant,
    updateMultipleProductVariants
};
