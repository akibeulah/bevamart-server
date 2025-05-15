const AUTHENTICATION_ROUTES = require('./authenticationRoutes');
const USER_ROUTES = require("./userRoutes")
const ADDRESS_BOOK_ROUTES = require("./addressBookRoutes")
const CATEGOTY_ROUTES = require("./categoryRoutes")
const TYPE_ROUTES = require("./typeRoutes")
const PRODUCT_ROUTES = require("./productRoutes")
const INVENTORY_ROUTES = require("./inventoryRoutes")
const REVIEW_ROUTES = require("./reviewsRoutes")
const CART_ROUTES = require("./cartRoutes")
const WISHLIST_ROUTES = require("./wishListItemRoutes")
const FAQ_ROUTES = require("./faqRoutes")
const CONTACT_ROUTES = require("./contactRoutes")
const SEARCH_BIN_ROUTES = require("./searchBinRoutes")
const DISCOUNT_ROUTES = require("./discountRoutes")
const ORDER_ROUTES = require("./orderRoutes")
const EXTERN_PAYMENT_ROUTES = require("./externalPaymentRoutes")
const ADMIN_USER_ROUTES = require("./AdminRoutes")
const OPERATIONS_ROUTES = require("./operationsRoutes")
const MEDIA_ROUTES = require("./mediaRoutes")

module.exports = [
    AUTHENTICATION_ROUTES,
    USER_ROUTES,
    ADDRESS_BOOK_ROUTES,
    CATEGOTY_ROUTES,
    TYPE_ROUTES,
    PRODUCT_ROUTES,
    INVENTORY_ROUTES,
    REVIEW_ROUTES,
    CART_ROUTES,
    WISHLIST_ROUTES,
    FAQ_ROUTES,
    CONTACT_ROUTES,
    SEARCH_BIN_ROUTES,
    DISCOUNT_ROUTES,
    ORDER_ROUTES,
    EXTERN_PAYMENT_ROUTES,
    ADMIN_USER_ROUTES,
    OPERATIONS_ROUTES,
    MEDIA_ROUTES,
]